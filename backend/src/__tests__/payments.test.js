import { test, describe, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import TransbankSDK from 'transbank-sdk';
import { app } from '../app.js';
import { pool } from '../config/database.js';
import { retryPendingRefunds } from '../services/payment.service.js';
import { ticketsDashboard } from '../services/ticket.service.js';

// No se llama a Transbank: se reemplazan los métodos de WebpayPlus.Transaction que usa
// webpay.service.js, así el flujo completo (ruta de retorno → confirmPayment → BD) corre de verdad.
const Tx = TransbankSDK.WebpayPlus.Transaction.prototype;
const COMMIT_OK = { response_code: 0, status: 'AUTHORIZED', authorization_code: '1213' };

const PREFIJO_EMAIL = 'pagos_test_';
const suffix = Date.now();
const dueno = { email: `${PREFIJO_EMAIL}${suffix}@demo.cl` };
let duenoId, parkingId;
let n = 0;

async function crearPago(estado = 'INICIADO') {
  n++;
  const token = `tok-pagos-${suffix}-${n}`;
  const buyOrder = `RP${suffix}${n}`.slice(0, 26);
  await pool.query(
    `INSERT INTO payments(tipo,estacionamiento_id,patente,buy_order,token,monto,estado)
     VALUES('RESERVA',$1,'PG1234',$2,$3,100,$4)`,
    [parkingId, buyOrder, token, estado]
  );
  return { token, buyOrder };
}

// retryPendingRefunds recorre todos los pendientes de la BD: los mocks solo responden por el pago
// de la prueba, para no marcar como reembolsado ningún otro registro que exista en la base local.
const soloPara = (token, respuesta) => async t => {
  if (t !== token) throw new Error('pago ajeno a la prueba');
  return respuesta();
};

const pagoPorToken = async token => (await pool.query('SELECT * FROM payments WHERE token=$1', [token])).rows[0];
const cupos = async () => (await pool.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [parkingId])).rows[0].cupos_disponibles;
const setCupos = c => pool.query('UPDATE estacionamientos SET cupos_disponibles=$1 WHERE id=$2', [c, parkingId]);
const reservas = async () => (await pool.query('SELECT COUNT(*)::int AS n FROM tickets WHERE estacionamiento_id=$1', [parkingId])).rows[0].n;

const volverDeWebpay = token => request(app).post('/api/payments/webpay/return').type('form').send({ token_ws: token });
const paramsRedirect = res => new URL(res.headers.location).searchParams;

// Borra todo lo que cuelga de los dueños de prueba (los de esta corrida y los que hayan quedado
// de corridas anteriores que se cortaron a la mitad).
async function limpiar() {
  const parkings = `SELECT e.id FROM estacionamientos e JOIN usuarios u ON u.id=e.cliente_id WHERE u.email LIKE '${PREFIJO_EMAIL}%'`;
  await pool.query(`DELETE FROM payments WHERE estacionamiento_id IN (${parkings}) OR ticket_id IN (SELECT id FROM tickets WHERE estacionamiento_id IN (${parkings}))`);
  await pool.query(`DELETE FROM tickets WHERE estacionamiento_id IN (${parkings})`);
  await pool.query(`DELETE FROM estacionamientos WHERE id IN (${parkings})`);
  await pool.query(`DELETE FROM usuarios WHERE email LIKE '${PREFIJO_EMAIL}%'`);
}

describe('pagos de reserva: reembolso cuando no queda cupo', () => {
  before(async () => {
    await limpiar();
    const hash = await bcrypt.hash('clave12345', 10);
    const u = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Dueño Pagos',$1,$2,'CLIENTE') RETURNING id`,
      [dueno.email, hash]
    );
    duenoId = u.rows[0].id;
    const p = await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,'Test Parking Pagos','Calle Pagos',-33.45,-70.66,20,500,1,1) RETURNING id`,
      [duenoId]
    );
    parkingId = p.rows[0].id;
  });

  afterEach(() => mock.restoreAll());

  after(async () => {
    await limpiar();
  });

  test('si el último cupo se ocupó durante el pago, se anula el cobro en Webpay y se marca REEMBOLSADO', async () => {
    const { token } = await crearPago();
    await setCupos(0); // alguien tomó el último cupo entre reserve-start y el commit
    mock.method(Tx, 'commit', async () => COMMIT_OK);
    const refund = mock.method(Tx, 'refund', async () => ({ type: 'REVERSED' }));

    const res = await volverDeWebpay(token);

    assert.equal(res.status, 302);
    const q = paramsRedirect(res);
    assert.equal(q.get('pago'), 'reembolsado');
    assert.equal(q.get('monto'), '100');
    assert.equal(refund.mock.callCount(), 1);
    assert.deepEqual(refund.mock.calls[0].arguments, [token, 100]);

    const pago = await pagoPorToken(token);
    assert.equal(pago.estado, 'REEMBOLSADO');
    assert.equal(pago.reembolso_tipo, 'REVERSED');
    assert.ok(pago.reembolsado_at);
    assert.equal(pago.ticket_id, null);
    assert.equal(await reservas(), 0, 'no se debe crear una reserva');
    assert.equal(await cupos(), 0, 'no se debe tocar el contador de cupos');
    await setCupos(1);
  });

  test('una anulación (NULLIFIED) aceptada por Transbank también cuenta como reembolso', async () => {
    const { token } = await crearPago();
    await setCupos(0);
    mock.method(Tx, 'commit', async () => COMMIT_OK);
    mock.method(Tx, 'refund', async () => ({ type: 'NULLIFIED', response_code: 0, authorization_code: '123456', nullified_amount: 100 }));

    const res = await volverDeWebpay(token);

    assert.equal(paramsRedirect(res).get('pago'), 'reembolsado');
    const pago = await pagoPorToken(token);
    assert.equal(pago.estado, 'REEMBOLSADO');
    assert.equal(pago.reembolso_tipo, 'NULLIFIED');
    await setCupos(1);
  });

  test('si Transbank falla al anular, queda REEMBOLSO_PENDIENTE y el conductor recibe la orden de compra', async () => {
    const { token, buyOrder } = await crearPago();
    await setCupos(0);
    mock.method(Tx, 'commit', async () => COMMIT_OK);
    mock.method(Tx, 'refund', async () => { throw new Error('Transbank no responde'); });

    const res = await volverDeWebpay(token);

    const q = paramsRedirect(res);
    assert.equal(q.get('pago'), 'sin_cupo');
    assert.equal(q.get('orden'), buyOrder);
    assert.equal((await pagoPorToken(token)).estado, 'REEMBOLSO_PENDIENTE');
    await setCupos(1);
  });

  test('una anulación NULLIFIED rechazada (response_code distinto de 0) no se da por reembolsada', async () => {
    const { token } = await crearPago();
    await setCupos(0);
    mock.method(Tx, 'commit', async () => COMMIT_OK);
    mock.method(Tx, 'refund', async () => ({ type: 'NULLIFIED', response_code: -1 }));

    const res = await volverDeWebpay(token);

    assert.equal(paramsRedirect(res).get('pago'), 'sin_cupo');
    assert.equal((await pagoPorToken(token)).estado, 'REEMBOLSO_PENDIENTE');
    await setCupos(1);
  });

  test('con cupo disponible, el pago aprobado crea la reserva y no se reembolsa nada', async () => {
    const { token } = await crearPago();
    mock.method(Tx, 'commit', async () => COMMIT_OK);
    const refund = mock.method(Tx, 'refund', async () => ({ type: 'REVERSED' }));

    const res = await volverDeWebpay(token);

    const q = paramsRedirect(res);
    assert.equal(q.get('pago'), 'aprobado');
    assert.ok(q.get('reserva'));
    assert.equal(refund.mock.callCount(), 0);
    const pago = await pagoPorToken(token);
    assert.equal(pago.estado, 'APROBADO');
    assert.ok(pago.ticket_id);
    assert.equal(await cupos(), 0);

    await pool.query(`UPDATE tickets SET estado='CANCELADO' WHERE id=$1`, [pago.ticket_id]);
    await setCupos(1);
  });

  test('un pago rechazado por Transbank no intenta reembolsar', async () => {
    const { token } = await crearPago();
    mock.method(Tx, 'commit', async () => ({ response_code: -1, status: 'FAILED' }));
    const refund = mock.method(Tx, 'refund', async () => ({ type: 'REVERSED' }));

    const res = await volverDeWebpay(token);

    assert.equal(paramsRedirect(res).get('pago'), 'rechazado');
    assert.equal(refund.mock.callCount(), 0);
    assert.equal((await pagoPorToken(token)).estado, 'RECHAZADO');
  });

  test('el reintento anula los pendientes que siguen autorizados en Transbank', async () => {
    const { token } = await crearPago('REEMBOLSO_PENDIENTE');
    mock.method(Tx, 'status', soloPara(token, () => ({ status: 'AUTHORIZED' })));
    const refund = mock.method(Tx, 'refund', soloPara(token, () => ({ type: 'REVERSED' })));

    await retryPendingRefunds();

    assert.deepEqual(refund.mock.calls.filter(c => c.arguments[0] === token).map(c => c.arguments), [[token, 100]]);
    const pago = await pagoPorToken(token);
    assert.equal(pago.estado, 'REEMBOLSADO');
    assert.equal(pago.reembolso_tipo, 'REVERSED');
  });

  test('el reintento no anula dos veces si Transbank ya tiene el pago reversado', async () => {
    const { token } = await crearPago('REEMBOLSO_PENDIENTE');
    mock.method(Tx, 'status', soloPara(token, () => ({ status: 'REVERSED' })));
    const refund = mock.method(Tx, 'refund', soloPara(token, () => ({ type: 'REVERSED' })));

    await retryPendingRefunds();

    assert.ok(!refund.mock.calls.some(c => c.arguments[0] === token));
    assert.equal((await pagoPorToken(token)).estado, 'REEMBOLSADO');
  });

  test('si el reintento vuelve a fallar, el pago sigue pendiente', async () => {
    const { token } = await crearPago('REEMBOLSO_PENDIENTE');
    mock.method(Tx, 'status', async () => { throw new Error('Transbank no responde'); });

    await retryPendingRefunds();

    assert.equal((await pagoPorToken(token)).estado, 'REEMBOLSO_PENDIENTE');
  });

  test('el dashboard del dueño no cuenta como abono los pagos reembolsados ni los pendientes de reembolso', async () => {
    const antes = await ticketsDashboard(duenoId, parkingId);
    await crearPago('REEMBOLSADO');
    await crearPago('REEMBOLSO_PENDIENTE');
    const conReembolsos = await ticketsDashboard(duenoId, parkingId);
    assert.deepEqual(conReembolsos.abonosReservas, antes.abonosReservas);

    await crearPago('APROBADO');
    const conAbono = await ticketsDashboard(duenoId, parkingId);
    assert.equal(conAbono.abonosReservas.cantidad, antes.abonosReservas.cantidad + 1);
    assert.equal(conAbono.abonosReservas.monto, antes.abonosReservas.monto + 100);
  });
});
