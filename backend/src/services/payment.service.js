import crypto from 'crypto';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { webpayTransaction } from './webpay.service.js';
import { emitCupos, reserveTicket, calcularMonto } from './ticket.service.js';

const STALE_PAYMENT_MIN = 30; // Transbank invalida el token bastante antes de esto.

function buyOrderFor(ticketId) {
  return ('T' + ticketId.replace(/-/g, '')).slice(0, 26);
}

// Un pago queda en INICIADO si el usuario nunca vuelve de Webpay (cerró la pestaña, perdió
// conexión, etc.). Sin este barrido esos registros quedan "colgados" para siempre y ensucian
// cualquier reporte/panel que revise pagos pendientes. No libera cupos: startPayment/
// startReservationPayment nunca reservan un cupo antes de que Transbank confirme el pago.
export async function releaseStalePayments() {
  const r = await pool.query(
    `UPDATE payments SET estado='EXPIRADO'
     WHERE estado='INICIADO' AND created_at < NOW() - ($1 || ' minutes')::interval
     RETURNING id`,
    [STALE_PAYMENT_MIN]
  );
  return r.rowCount;
}

export function startPaymentSweeper(logger) {
  setInterval(() => {
    releaseStalePayments().catch(err => logger?.error({ err }, 'Error liberando pagos vencidos'));
  }, 5 * 60000);
}

async function getReservaMontoClp() {
  const r = await pool.query(`SELECT valor FROM parametros_sistema WHERE clave='reserva_monto_clp'`);
  const monto = Number(r.rows[0]?.valor);
  return Number.isFinite(monto) && monto >= 100 ? monto : 100;
}

export async function startReservationPayment(estacionamientoId, patente) {
  const p = await pool.query('SELECT id,cupos_disponibles,estado FROM estacionamientos WHERE id=$1', [estacionamientoId]);
  if (!p.rowCount || !p.rows[0].estado) throw new Error('Estacionamiento no encontrado');
  if (p.rows[0].cupos_disponibles <= 0) throw new Error('Sin cupos disponibles');

  const monto = await getReservaMontoClp();
  const buyOrder = ('R' + crypto.randomUUID().replace(/-/g, '')).slice(0, 26);
  const sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 26);

  const tx = webpayTransaction();
  const resp = await tx.create(buyOrder, sessionId, monto, env.webpay.returnUrl);

  await pool.query(
    `INSERT INTO payments(tipo,estacionamiento_id,patente,buy_order,token,monto,estado)
     VALUES('RESERVA',$1,$2,$3,$4,$5,'INICIADO')`,
    [estacionamientoId, patente || null, buyOrder, resp.token, monto]
  );

  return { url: resp.url, token: resp.token, monto };
}

export async function startPayment(codigoQr, clienteId) {
  const t = await pool.query(
    `SELECT t.*, e.cliente_id, e.precio_hora
     FROM tickets t JOIN estacionamientos e ON e.id = t.estacionamiento_id
     WHERE t.codigo_qr = $1`,
    [codigoQr]
  );
  if (!t.rowCount) throw new Error('Ticket no encontrado');
  const ticket = t.rows[0];
  if (ticket.cliente_id !== clienteId) throw new Error('Este ticket no pertenece a uno de tus estacionamientos');
  if (ticket.estado !== 'ACTIVO') throw new Error('Solo se pueden cobrar tickets activos');

  const { monto } = await calcularMonto(ticket.id, ticket.fecha_entrada, ticket.precio_hora);
  if (monto <= 0) throw new Error('El descuento de tu reserva ya cubre el total. Usa "Cobrar en efectivo" para cerrar el ticket sin cobro adicional.');
  const buyOrder = buyOrderFor(ticket.id);
  const sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 26);

  const tx = webpayTransaction();
  const resp = await tx.create(buyOrder, sessionId, monto, env.webpay.returnUrl);

  await pool.query(
    `INSERT INTO payments(ticket_id,buy_order,token,monto,estado) VALUES($1,$2,$3,$4,'INICIADO')`,
    [ticket.id, buyOrder, resp.token, monto]
  );

  return { url: resp.url, token: resp.token };
}

export async function confirmPayment(token) {
  const p = await pool.query('SELECT * FROM payments WHERE token = $1', [token]);
  if (!p.rowCount) throw new Error('Pago no encontrado');
  const payment = p.rows[0];

  const tx = webpayTransaction();
  const result = await tx.commit(token);
  const aprobado = result.response_code === 0 && result.status === 'AUTHORIZED';

  await pool.query(
    `UPDATE payments SET estado=$1, response_code=$2, authorization_code=$3 WHERE id=$4`,
    [aprobado ? 'APROBADO' : 'RECHAZADO', result.response_code, result.authorization_code, payment.id]
  );

  if (payment.tipo === 'RESERVA') {
    if (!aprobado) return { aprobado, tipo: 'RESERVA', monto: Number(payment.monto) };
    let reserva;
    try {
      reserva = await reserveTicket(payment.estacionamiento_id, payment.patente);
    } catch (e) {
      // El pago se aprobó pero el cupo se agotó justo antes de confirmar (carrera poco frecuente).
      return { aprobado: false, tipo: 'RESERVA', monto: Number(payment.monto), error: e.message };
    }
    await pool.query(`UPDATE payments SET ticket_id=$1 WHERE id=$2`, [reserva.id, payment.id]);
    return { aprobado, tipo: 'RESERVA', monto: Number(payment.monto), codigoQr: reserva.codigo_qr };
  }

  if (aprobado) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [payment.ticket_id]);
      const ticket = t.rows[0];
      await client.query(
        `UPDATE tickets SET estado='PAGADO', fecha_salida=NOW(), monto=$1 WHERE id=$2`,
        [payment.monto, payment.ticket_id]
      );
      const upd = await client.query(
        `UPDATE estacionamientos SET cupos_disponibles=LEAST(cupo_maximo,cupos_disponibles+1)
         WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo`,
        [ticket.estacionamiento_id]
      );
      await client.query('COMMIT');
      emitCupos(ticket.estacionamiento_id, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  return { aprobado, tipo: 'COBRO', ticketId: payment.ticket_id, monto: Number(payment.monto) };
}
