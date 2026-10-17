import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

const suffix = Date.now();
const emails = { dueno: `horario_dueno_${suffix}@demo.cl`, otro: `horario_otro_${suffix}@demo.cl`, admin: `horario_admin_${suffix}@demo.cl` };
const ids = {};
const tokens = {};
let parkingId, parkingAjenoId;

const SIEMPRE_CERRADO = Array(7).fill(null);
const TODO_EL_DIA = Array(7).fill({ abre: '00:00', cierra: '24:00' });
const auth = rol => ({ Authorization: `Bearer ${tokens[rol]}` });

describe('horario de atención (API)', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 4);
    for (const [clave, rol] of [['dueno', 'CLIENTE'], ['otro', 'CLIENTE'], ['admin', 'ADMIN']]) {
      ids[clave] = (await pool.query(
        `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES($1,$2,$3,$4) RETURNING id`,
        [`Horario ${clave}`, emails[clave], hash, rol]
      )).rows[0].id;
      tokens[clave] = jwt.sign({ id: ids[clave], email: emails[clave], rol }, env.jwtSecret, { expiresIn: '1h' });
    }
    const crear = async (cliente) => (await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,$2,'Calle Test 123',-33.4000,-70.6000,20,0,5,5) RETURNING id`, [cliente, `Horario test ${suffix} ${cliente}`]
    )).rows[0].id;
    parkingId = await crear(ids.dueno);
    parkingAjenoId = await crear(ids.otro);
  });

  after(async () => {
    await pool.query('DELETE FROM tickets WHERE estacionamiento_id=ANY($1)', [[parkingId, parkingAjenoId]]);
    await pool.query('DELETE FROM payments WHERE estacionamiento_id=ANY($1)', [[parkingId, parkingAjenoId]]);
    await pool.query('DELETE FROM estacionamientos WHERE id=ANY($1)', [[parkingId, parkingAjenoId]]);
    await pool.query('DELETE FROM audit_log WHERE usuario_id=ANY($1)', [Object.values(ids)]);
    await pool.query('DELETE FROM usuarios WHERE id=ANY($1)', [Object.values(ids)]);
    await pool.end();
  });

  test('sin horario definido, el estacionamiento aparece abierto las 24 horas', async () => {
    const r = await request(app).get(`/api/parking/${parkingId}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.horario, null);
    assert.equal(r.body.horario_estado.abierto, true);
    assert.equal(r.body.horario_estado.siempre, true);
  });

  test('el dueño fija el horario de su estacionamiento y queda en la auditoría', async () => {
    const horario = [null, ...Array(5).fill({ abre: '08:00', cierra: '20:00' }), null];
    const r = await request(app).put(`/api/parking/${parkingId}/horario`).set(auth('dueno')).send({ horario });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.horario, horario);
    assert.equal(typeof r.body.horario_estado.abierto, 'boolean');
    const a = await pool.query(`SELECT 1 FROM audit_log WHERE accion='estacionamiento.actualizar_horario' AND entidad_id=$1`, [parkingId]);
    assert.equal(a.rowCount, 1);
  });

  test('un dueño no puede cambiar el horario de un estacionamiento ajeno', async () => {
    const r = await request(app).put(`/api/parking/${parkingAjenoId}/horario`).set(auth('dueno')).send({ horario: SIEMPRE_CERRADO });
    assert.equal(r.status, 404);
    const p = await pool.query('SELECT horario FROM estacionamientos WHERE id=$1', [parkingAjenoId]);
    assert.equal(p.rows[0].horario, null);
  });

  test('el administrador puede fijar el horario de cualquier estacionamiento', async () => {
    const r = await request(app).put(`/api/admin/parking/${parkingAjenoId}/horario`).set(auth('admin')).send({ horario: TODO_EL_DIA });
    assert.equal(r.status, 200);
    assert.equal(r.body.horario_estado.siempre, true);
  });

  test('rechaza horarios mal formados', async () => {
    for (const horario of [
      Array(6).fill(null),                                   // faltan días
      Array(7).fill({ abre: '25:00', cierra: '20:00' }),     // hora imposible
      Array(7).fill({ abre: '08:00', cierra: '08:00' }),     // apertura = cierre
      Array(7).fill({ abre: '24:00', cierra: '08:00' })      // 24:00 solo vale para cerrar
    ]) {
      const r = await request(app).put(`/api/parking/${parkingId}/horario`).set(auth('dueno')).send({ horario });
      assert.equal(r.status, 400, JSON.stringify(horario[0]));
    }
  });

  test('cerrado: la búsqueda lo muestra como cerrado y no se puede reservar ni iniciar el pago', async () => {
    await pool.query('UPDATE estacionamientos SET horario=$1 WHERE id=$2', [JSON.stringify(SIEMPRE_CERRADO), parkingId]);

    const cerca = await request(app).get('/api/parking/nearby').query({ lat: -33.4, lng: -70.6, radiusKm: 1 });
    const fila = cerca.body.find(p => p.id === parkingId);
    assert.ok(fila, 'el estacionamiento cerrado sigue apareciendo en la búsqueda');
    assert.equal(fila.horario_estado.abierto, false);

    const reserva = await request(app).post('/api/tickets/reserve').set(auth('dueno')).send({ estacionamiento_id: parkingId, patente: 'HOR123' });
    assert.equal(reserva.status, 400);
    assert.match(reserva.body.error, /cerrado/i);

    const pago = await request(app).post('/api/payments/webpay/reserve-start').send({ estacionamiento_id: parkingId, patente: 'HOR123' });
    assert.equal(pago.status, 400);
    assert.match(pago.body.error, /cerrado/i);

    const cupos = await pool.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [parkingId]);
    assert.equal(cupos.rows[0].cupos_disponibles, 5);
  });

  test('abierto las 24 horas: la reserva funciona', async () => {
    await pool.query('UPDATE estacionamientos SET horario=$1 WHERE id=$2', [JSON.stringify(TODO_EL_DIA), parkingId]);
    const r = await request(app).post('/api/tickets/reserve').set(auth('dueno')).send({ estacionamiento_id: parkingId, patente: 'HOR124' });
    assert.equal(r.status, 201);
  });
});
