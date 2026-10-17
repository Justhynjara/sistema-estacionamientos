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
let parkingId;
const codigo = randomUUID();
const auth = rol => ({ Authorization: `Bearer ${tokens[rol]}` });
const ruta = () => `/api/admin/parking/${parkingId}/tarifas-horario`;
const TODO_EL_DIA_A_5 = [{ desde: '00:00', hasta: '24:00', precio_minuto: 5 }];

describe('tarifa por horario (API)', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 4);
    for (const [clave, rol] of [['dueno', 'CLIENTE'], ['admin', 'ADMIN']]) {
      const email = `tarifas_${clave}_${suffix}@demo.cl`;
      ids[clave] = (await pool.query(
        `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES($1,$2,$3,$4) RETURNING id`, [`Tarifas ${clave}`, email, hash, rol]
      )).rows[0].id;
      tokens[clave] = jwt.sign({ id: ids[clave], email, rol }, env.jwtSecret, { expiresIn: '1h' });
    }
    parkingId = (await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,$2,'Calle Test 1',-33.4,-70.6,20,0,5,4) RETURNING id`, [ids.dueno, `Tarifas test ${suffix}`]
    )).rows[0].id;
    // Un auto que entró hace exactamente 60 minutos.
    await pool.query(
      `INSERT INTO tickets(estacionamiento_id,codigo_qr,patente,estado,fecha_entrada) VALUES($1,$2,'TAR123','ACTIVO',NOW() - interval '60 minutes')`,
      [parkingId, codigo]
    );
  });

  after(async () => {
    await pool.query('DELETE FROM tickets WHERE estacionamiento_id=$1', [parkingId]);
    await pool.query('DELETE FROM estacionamientos WHERE id=$1', [parkingId]);
    await pool.query('DELETE FROM audit_log WHERE usuario_id=ANY($1)', [Object.values(ids)]);
    await pool.query('DELETE FROM usuarios WHERE id=ANY($1)', [Object.values(ids)]);
    await pool.end();
  });

  test('sin tramos, el cobro usa el precio base', async () => {
    const r = await request(app).post('/api/tickets/quote').set(auth('dueno')).send({ codigo_qr: codigo });
    assert.equal(r.status, 200);
    assert.ok([1200, 1220].includes(r.body.monto), `60 o 61 min a $20 (fue ${r.body.monto})`);
  });

  test('el administrador fija los tramos y queda en la auditoría', async () => {
    const r = await request(app).put(ruta()).set(auth('admin')).send({ tarifas_horario: TODO_EL_DIA_A_5 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.tarifas_horario, TODO_EL_DIA_A_5);
    const a = await pool.query(`SELECT 1 FROM audit_log WHERE accion='estacionamiento.actualizar_tarifas_horario' AND entidad_id=$1`, [parkingId]);
    assert.equal(a.rowCount, 1);
  });

  test('la cotización, el cobro y la vista pública del ticket aplican el tramo', async () => {
    const quote = await request(app).post('/api/tickets/quote').set(auth('dueno')).send({ codigo_qr: codigo });
    assert.ok([300, 305].includes(quote.body.monto), `60 o 61 min a $5 (fue ${quote.body.monto})`);

    const pub = await request(app).get(`/api/tickets/publico/${codigo}`);
    assert.deepEqual(pub.body.tarifas_horario, TODO_EL_DIA_A_5);
    assert.ok([300, 305].includes(pub.body.monto));

    const cerca = await request(app).get('/api/parking/nearby').query({ lat: -33.4, lng: -70.6, radiusKm: 1 });
    assert.deepEqual(cerca.body.find(p => p.id === parkingId).tarifas_horario, TODO_EL_DIA_A_5);

    const close = await request(app).post('/api/tickets/close').set(auth('dueno')).send({ codigo_qr: codigo, metodo_pago: 'EFECTIVO' });
    assert.equal(close.status, 200);
    assert.ok([300, 305].includes(Number(close.body.monto)), `cobró ${close.body.monto}`);
  });

  test('un dueño no puede cambiar sus propios precios por horario', async () => {
    const r = await request(app).put(ruta()).set(auth('dueno')).send({ tarifas_horario: [{ desde: '00:00', hasta: '24:00', precio_minuto: 999 }] });
    assert.equal(r.status, 403);
  });

  test('rechaza tramos solapados, iguales, demasiados o con precio negativo', async () => {
    for (const tarifas_horario of [
      [{ desde: '20:00', hasta: '08:00', precio_minuto: 10 }, { desde: '07:00', hasta: '09:00', precio_minuto: 30 }],
      [{ desde: '08:00', hasta: '08:00', precio_minuto: 10 }],
      [{ desde: '00:00', hasta: '00:00', precio_minuto: 10 }],
      [{ desde: '24:00', hasta: '08:00', precio_minuto: 10 }],
      [{ desde: '08:00', hasta: '09:00', precio_minuto: -1 }],
      Array.from({ length: 5 }, (_, i) => ({ desde: `0${i}:00`, hasta: `0${i}:30`, precio_minuto: 10 }))
    ]) {
      const r = await request(app).put(ruta()).set(auth('admin')).send({ tarifas_horario });
      assert.equal(r.status, 400, JSON.stringify(tarifas_horario));
    }
  });

  test('una lista vacía vuelve al precio base todo el día (null)', async () => {
    const r = await request(app).put(ruta()).set(auth('admin')).send({ tarifas_horario: [] });
    assert.equal(r.status, 200);
    assert.equal(r.body.tarifas_horario, null);
  });
});
