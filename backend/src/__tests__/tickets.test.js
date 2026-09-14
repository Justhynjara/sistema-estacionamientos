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
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles)
       VALUES($1,'Test Parking A','Calle A',-33.45,-70.66,1000,10,10) RETURNING id`,
      [uA.rows[0].id]
    );
    const pB = await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles)
       VALUES($1,'Test Parking B','Calle B',-33.46,-70.67,2000,10,10) RETURNING id`,
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

  test('reservar un cupo público (sin auth) reduce la disponibilidad y genera un código', async () => {
    const before = await pool.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [parkingA]);
    const res = await request(app).post('/api/tickets/reserve').send({ estacionamiento_id: parkingA });
    assert.equal(res.status, 201);
    assert.equal(res.body.estado, 'RESERVADO');
    assert.ok(res.body.codigo_qr);
    const after = await pool.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [parkingA]);
    assert.equal(after.rows[0].cupos_disponibles, before.rows[0].cupos_disponibles - 1);
  });

  test('el dueño de otro estacionamiento no puede validar una reserva ajena', async () => {
    const reserva = await request(app).post('/api/tickets/reserve').send({ estacionamiento_id: parkingA });
    const res = await request(app)
      .post('/api/tickets/checkin')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ codigo_qr: reserva.body.codigo_qr });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no pertenece/i);
  });

  test('el dueño correcto sí puede validar su reserva', async () => {
    const reserva = await request(app).post('/api/tickets/reserve').send({ estacionamiento_id: parkingA });
    const res = await request(app)
      .post('/api/tickets/checkin')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ codigo_qr: reserva.body.codigo_qr });
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'ACTIVO');
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
});
