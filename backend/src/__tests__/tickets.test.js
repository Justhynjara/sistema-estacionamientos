import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const suffix = Date.now();
const clienteA = { email: `cliente_a_${suffix}@demo.cl`, password: 'clave12345' };
const clienteB = { email: `cliente_b_${suffix}@demo.cl`, password: 'clave12345' };
let tokenA, tokenB, parkingA, parkingB;

describe('tickets: propiedad y flujo', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 10);
    const uA = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Cliente A',$1,$2,'CLIENTE') RETURNING id`,
      [clienteA.email, hash]
    );
    const uB = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Cliente B',$1,$2,'CLIENTE') RETURNING id`,
      [clienteB.email, hash]
    );
    const pA = await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,'Test Parking A','Calle A',-33.45,-70.66,20,500,10,10) RETURNING id`,
      [uA.rows[0].id]
    );
    const pB = await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,'Test Parking B','Calle B',-33.46,-70.67,40,800,10,10) RETURNING id`,
      [uB.rows[0].id]
    );
    parkingA = pA.rows[0].id;
    parkingB = pB.rows[0].id;

    const loginA = await request(app).post('/api/auth/login').send(clienteA);
    const loginB = await request(app).post('/api/auth/login').send(clienteB);
    tokenA = loginA.body.token;
    tokenB = loginB.body.token;
  });

  after(async () => {
    await pool.query('DELETE FROM payments WHERE ticket_id IN (SELECT id FROM tickets WHERE estacionamiento_id=ANY($1))', [[parkingA, parkingB]]);
    await pool.query('DELETE FROM tickets WHERE estacionamiento_id=ANY($1)', [[parkingA, parkingB]]);
    await pool.query('DELETE FROM estacionamientos WHERE id=ANY($1)', [[parkingA, parkingB]]);
    await pool.query('DELETE FROM usuarios WHERE email=ANY($1)', [[clienteA.email, clienteB.email]]);
    await pool.end();
  });

  test('un cliente no puede emitir tickets en el estacionamiento de otro', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingB });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no te pertenece/i);
  });

  test('un cliente sí puede emitir tickets en su propio estacionamiento', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'AA1111' });
    assert.equal(res.status, 201);
    assert.equal(res.body.estado, 'ACTIVO');
  });

  test('el dueño puede reservar manualmente un cupo en su estacionamiento (ej. reserva telefónica)', async () => {
    const before = await pool.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [parkingA]);
    const res = await request(app)
      .post('/api/tickets/reserve')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA });
    assert.equal(res.status, 201);
    assert.equal(res.body.estado, 'RESERVADO');
    assert.ok(res.body.codigo_qr);
    const after = await pool.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [parkingA]);
    assert.equal(after.rows[0].cupos_disponibles, before.rows[0].cupos_disponibles - 1);
  });

  test('el dueño de otro estacionamiento no puede validar una reserva ajena', async () => {
    const reserva = await request(app)
      .post('/api/tickets/reserve')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA });
    const res = await request(app)
      .post('/api/tickets/checkin')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ codigo_qr: reserva.body.codigo_qr });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no pertenece/i);
  });

  test('el dueño correcto sí puede validar su reserva', async () => {
    const reserva = await request(app)
      .post('/api/tickets/reserve')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA });
    const res = await request(app)
      .post('/api/tickets/checkin')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: reserva.body.codigo_qr });
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'ACTIVO');
  });

  test('cerrar un ticket exige indicar el método de pago', async () => {
    const emitido = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'CC3333' });
    const res = await request(app)
      .post('/api/tickets/close')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr });
    assert.equal(res.status, 400);
  });

  test('cerrar un ticket con tarjeta registra el método de pago (sin pasar por Webpay)', async () => {
    const emitido = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'DD4444' });
    const res = await request(app)
      .post('/api/tickets/close')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr, metodo_pago: 'DEBITO' });
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'CERRADO');
    assert.equal(res.body.metodo_pago, 'DEBITO');
  });

  test('ya no existe el cobro de tickets por Webpay del lado del dueño', async () => {
    const res = await request(app)
      .post('/api/payments/webpay/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: 'lo-que-sea' });
    assert.equal(res.status, 404);
  });

  test('el dashboard solo cuenta tickets del cliente autenticado', async () => {
    const res = await request(app)
      .get('/api/tickets/dashboard')
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.tickets.every(t => t.estacionamiento_nombre !== 'Test Parking A'));
  });

  test('sin token, el dashboard responde 401', async () => {
    const res = await request(app).get('/api/tickets/dashboard');
    assert.equal(res.status, 401);
  });

  test('el micropago de reserva pública exige patente', async () => {
    const res = await request(app)
      .post('/api/payments/webpay/reserve-start')
      .send({ estacionamiento_id: parkingA });
    assert.equal(res.status, 400);
  });

  test('el micropago de reserva pública rechaza una patente con formato inválido', async () => {
    const res = await request(app)
      .post('/api/payments/webpay/reserve-start')
      .send({ estacionamiento_id: parkingA, patente: 'A' });
    assert.equal(res.status, 400);
  });

  test('el micropago de reserva pública rechaza un estacionamiento inexistente', async () => {
    const res = await request(app)
      .post('/api/payments/webpay/reserve-start')
      .send({ estacionamiento_id: '11111111-1111-4111-8111-111111111111', patente: 'ZZ9999' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no encontrado/i);
  });

  test('el cobro usa precio por minuto con valor base mínimo', async () => {
    const corto = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'MM0001' });
    const cierraCorto = await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: corto.body.codigo_qr, metodo_pago: 'EFECTIVO' });
    assert.equal(cierraCorto.status, 200);
    assert.equal(Number(cierraCorto.body.monto), 500);

    const largo = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'MM0002' });
    await pool.query(`UPDATE tickets SET fecha_entrada = NOW() - interval '90 minutes' WHERE codigo_qr=$1`, [largo.body.codigo_qr]);
    const cierraLargo = await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: largo.body.codigo_qr, metodo_pago: 'EFECTIVO' });
    assert.equal(cierraLargo.status, 200);
    const monto = Number(cierraLargo.body.monto);
    assert.ok(monto === 1800 || monto === 1820, `esperaba 90 o 91 min a $20/min, obtuve ${monto}`);
  });

  test('quien escanea el QR sin sesión ve el tiempo y el monto a pagar hasta ahora', async () => {
    const emitido = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'PU0001' });
    await pool.query(`UPDATE tickets SET fecha_entrada = NOW() - interval '60 minutes' WHERE codigo_qr=$1`, [emitido.body.codigo_qr]);

    const res = await request(app).get(`/api/tickets/publico/${emitido.body.codigo_qr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'ACTIVO');
    assert.equal(res.body.patente, 'PU0001');
    assert.equal(res.body.estacionamiento_nombre, 'Test Parking A');
    assert.equal(res.body.precio_minuto, 20);
    assert.equal(res.body.tarifa_minima, 500);
    assert.ok(res.body.minutos === 60 || res.body.minutos === 61);
    assert.equal(res.body.monto, res.body.minutos * 20);
    assert.ok(res.body.ahora);
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('la vista pública no expone datos internos (ids ni el dueño)', async () => {
    const emitido = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'PU0002' });
    const res = await request(app).get(`/api/tickets/publico/${emitido.body.codigo_qr}`);
    assert.equal(res.status, 200);
    for (const campo of ['id', 'cliente_id', 'estacionamiento_id']) {
      assert.equal(campo in res.body, false, `no debe exponer ${campo}`);
    }
  });

  test('la vista pública de una reserva muestra cuándo vence y no cobra nada aún', async () => {
    const reserva = await request(app).post('/api/tickets/reserve').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA });
    const res = await request(app).get(`/api/tickets/publico/${reserva.body.codigo_qr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'RESERVADO');
    assert.ok(res.body.reserva_expira);
    assert.equal('monto' in res.body, false);
  });

  test('la vista pública de un ticket cerrado muestra lo que se pagó', async () => {
    const emitido = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'PU0003' });
    await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr, metodo_pago: 'CREDITO' });
    const res = await request(app).get(`/api/tickets/publico/${emitido.body.codigo_qr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'CERRADO');
    assert.equal(res.body.monto, 500);
  });

  test('la vista pública responde 404 para un código inexistente y 400 para uno absurdo', async () => {
    const inexistente = await request(app).get('/api/tickets/publico/' + 'a'.repeat(36));
    assert.equal(inexistente.status, 404);
    const corto = await request(app).get('/api/tickets/publico/ab');
    assert.equal(corto.status, 400);
  });
  test('el monto cotizado se mantiene al cobrar aunque pasen minutos', async () => {
    const emitido = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'QT0001' });
    await pool.query(`UPDATE tickets SET fecha_entrada = NOW() - interval '60 minutes' WHERE codigo_qr=$1`, [emitido.body.codigo_qr]);

    const quote = await request(app).post('/api/tickets/quote').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr });
    assert.equal(quote.status, 200);
    assert.ok(quote.body.cotizacion && quote.body.cotizacion_expira);
    const cotizado = Number(quote.body.monto);

    // Pasan 5 minutos entre que el dueño le dice el monto al cliente y confirma el cobro.
    await pool.query(`UPDATE tickets SET fecha_entrada = fecha_entrada - interval '5 minutes' WHERE codigo_qr=$1`, [emitido.body.codigo_qr]);
    const cierra = await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr, metodo_pago: 'EFECTIVO', cotizacion: quote.body.cotizacion });
    assert.equal(cierra.status, 200);
    assert.equal(Number(cierra.body.monto), cotizado);
  });

  test('sin cotización vigente el cobro se recalcula con la hora actual', async () => {
    const emitido = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`)
      .send({ estacionamiento_id: parkingA, patente: 'QT0002' });
    await pool.query(`UPDATE tickets SET fecha_entrada = NOW() - interval '60 minutes' WHERE codigo_qr=$1`, [emitido.body.codigo_qr]);
    const quote = await request(app).post('/api/tickets/quote').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr });
    await pool.query(`UPDATE tickets SET fecha_entrada = fecha_entrada - interval '5 minutes' WHERE codigo_qr=$1`, [emitido.body.codigo_qr]);

    const cierra = await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: emitido.body.codigo_qr, metodo_pago: 'EFECTIVO' });
    assert.equal(cierra.status, 200);
    assert.ok(Number(cierra.body.monto) > Number(quote.body.monto));
  });

  test('una cotización alterada o de otro ticket no se honra', async () => {
    const t1 = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`).send({ estacionamiento_id: parkingA, patente: 'QT0003' });
    const t2 = await request(app).post('/api/tickets').set('Authorization', `Bearer ${tokenA}`).send({ estacionamiento_id: parkingA, patente: 'QT0004' });
    await pool.query(`UPDATE tickets SET fecha_entrada = NOW() - interval '120 minutes' WHERE codigo_qr=$1`, [t2.body.codigo_qr]);
    const cotizacionBarata = (await request(app).post('/api/tickets/quote').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: t1.body.codigo_qr })).body.cotizacion;

    // La cotización barata del ticket 1 usada en el ticket 2 (2 horas dentro): no debe aplicarse.
    const cruzada = await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: t2.body.codigo_qr, metodo_pago: 'EFECTIVO', cotizacion: cotizacionBarata });
    assert.equal(cruzada.status, 200);
    assert.ok(Number(cruzada.body.monto) >= 2400, `cobró ${cruzada.body.monto} con una cotización ajena`);

    const [cuerpo] = cotizacionBarata.split('.');
    const alterada = await request(app).post('/api/tickets/close').set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: t1.body.codigo_qr, metodo_pago: 'EFECTIVO', cotizacion: `${cuerpo}.firmafalsa` });
    assert.equal(alterada.status, 200);
    assert.equal(Number(alterada.body.monto), 500);
  });
});
