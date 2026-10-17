import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { app } from '../app.js';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

const suffix = Date.now();
const ids = {};
const tokens = {};
let lotA, lotB, lotAjeno;
const auth = rol => ({ Authorization: `Bearer ${tokens[rol]}` });

async function ticket(lot, estado, entrada, salida = null, monto = null) {
  await pool.query(
    `INSERT INTO tickets(estacionamiento_id,codigo_qr,patente,estado,fecha_entrada,fecha_salida,monto,reserva_expira)
     VALUES($1,$2,'EST123',$3,NOW() - $4::interval,NOW() - $5::interval,$6,$7)`,
    [lot, randomUUID(), estado, entrada, salida, monto, estado === 'RESERVADO' ? new Date(Date.now() + 600000) : null]
  );
}

describe('estadísticas del dueño (últimos 7 o 30 días)', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 4);
    for (const clave of ['dueno', 'otro']) {
      const email = `estad_${clave}_${suffix}@demo.cl`;
      ids[clave] = (await pool.query(
        `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES($1,$2,$3,'CLIENTE') RETURNING id`, [`Estad ${clave}`, email, hash]
      )).rows[0].id;
      tokens[clave] = jwt.sign({ id: ids[clave], email, rol: 'CLIENTE' }, env.jwtSecret, { expiresIn: '1h' });
    }
    const crear = async (cliente, nombre, cupos) => (await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,$2,'Calle Test 1',-33.4,-70.6,20,0,$3,$3) RETURNING id`, [cliente, `${nombre} ${suffix}`, cupos]
    )).rows[0].id;
    lotA = await crear(ids.dueno, 'Estad A', 10);
    lotB = await crear(ids.dueno, 'Estad B', 4);
    lotAjeno = await crear(ids.otro, 'Estad ajeno', 10);

    // Hoy: un cobro de $2.000 y una reserva que no llegó (no cuenta como vehículo).
    await ticket(lotA, 'CERRADO', '1 minute', '0 seconds', 2000);
    await ticket(lotA, 'RESERVADO', '0 seconds');
    // Hace 8 días (período anterior en la vista de 7 días): un cobro de $1.000.
    await ticket(lotA, 'CERRADO', '8 days 1 hour', '8 days', 1000);
    // B: un auto dentro desde hace 40 días ocupa 1 de 4 cupos durante todo el período.
    await ticket(lotB, 'ACTIVO', '40 days');
    // Movimiento de otro dueño: nunca debe aparecer.
    await ticket(lotAjeno, 'CERRADO', '1 minute', '0 seconds', 9999);
  });

  after(async () => {
    await pool.query('DELETE FROM tickets WHERE estacionamiento_id=ANY($1)', [[lotA, lotB, lotAjeno]]);
    await pool.query('DELETE FROM estacionamientos WHERE id=ANY($1)', [[lotA, lotB, lotAjeno]]);
    await pool.query('DELETE FROM usuarios WHERE id=ANY($1)', [Object.values(ids)]);
    await pool.end();
  });

  test('7 días: un registro por día, terminando hoy, con lo cobrado y los vehículos', async () => {
    const r = await request(app).get('/api/tickets/estadisticas').set(auth('dueno')).query({ estacionamiento_id: lotA });
    assert.equal(r.status, 200);
    assert.equal(r.body.dias, 7);
    assert.equal(r.body.porDia.length, 7);
    assert.equal(r.body.porDia.at(-1).fecha, r.body.hasta);
    assert.equal(r.body.porDia[0].fecha, r.body.desde);
    assert.equal(r.body.porDia.at(-1).cobrado, 2000);
    assert.equal(r.body.porDia.at(-1).vehiculos, 1, 'la reserva pendiente no es un vehículo ingresado');
    assert.equal(r.body.total.cobrado, 2000);
    assert.equal(r.body.total.ticketPromedio, 2000);
  });

  test('compara con los 7 días anteriores', async () => {
    const r = await request(app).get('/api/tickets/estadisticas').set(auth('dueno')).query({ estacionamiento_id: lotA });
    assert.deepEqual(r.body.anterior, { cobrado: 1000, vehiculos: 1 });
  });

  test('30 días incluye el cobro de hace 8 días', async () => {
    const r = await request(app).get('/api/tickets/estadisticas').set(auth('dueno')).query({ estacionamiento_id: lotA, dias: '30' });
    assert.equal(r.status, 200);
    assert.equal(r.body.porDia.length, 30);
    assert.equal(r.body.total.cobrado, 3000);
    assert.equal(r.body.total.vehiculos, 2);
  });

  test('ocupación promedio: 1 auto todo el período en 4 cupos = 25 %', async () => {
    const r = await request(app).get('/api/tickets/estadisticas').set(auth('dueno')).query({ estacionamiento_id: lotB });
    assert.equal(r.body.ocupacionPromedio, 25);
  });

  test('sin filtro suma todos los estacionamientos del dueño y nada de otros dueños', async () => {
    const r = await request(app).get('/api/tickets/estadisticas').set(auth('dueno'));
    assert.equal(r.body.total.cobrado, 2000);
    assert.ok(r.body.horaPico, 'hay hora de mayor flujo');
    assert.ok(r.body.diaPico, 'hay día de mayor flujo');
  });

  test('el estacionamiento de otro dueño no entrega datos', async () => {
    const r = await request(app).get('/api/tickets/estadisticas').set(auth('dueno')).query({ estacionamiento_id: lotAjeno });
    assert.equal(r.status, 200);
    assert.equal(r.body.total.cobrado, 0);
    assert.equal(r.body.ocupacionPromedio, null);
  });

  test('valida el período y exige sesión de dueño', async () => {
    assert.equal((await request(app).get('/api/tickets/estadisticas').set(auth('dueno')).query({ dias: '15' })).status, 400);
    assert.equal((await request(app).get('/api/tickets/estadisticas')).status, 401);
  });
});
