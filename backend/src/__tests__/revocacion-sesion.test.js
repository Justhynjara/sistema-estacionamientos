import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

// El token de sesión dura 8 h y lleva el rol adentro. Si la API confiara solo en el token, a un
// dueño o administrador desactivado (o al que se le quitó el rol) le seguiría funcionando la
// sesión hasta que expire. Estas pruebas exigen que la cuenta se revise contra la base de datos
// en cada petición autenticada.
const suffix = Date.now();
const emailDueno = `revocacion_dueno_${suffix}@demo.cl`;
const emailAdmin = `revocacion_admin_${suffix}@demo.cl`;
let duenoId, adminId;

function tokenDe(id, email, rol) {
  return jwt.sign({ id, email, rol }, env.jwtSecret, { expiresIn: '8h' });
}

describe('seguridad: las sesiones se revocan al desactivar o degradar la cuenta', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 4);
    duenoId = (await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Dueño Revocación',$1,$2,'CLIENTE') RETURNING id`,
      [emailDueno, hash]
    )).rows[0].id;
    adminId = (await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Admin Revocación',$1,$2,'ADMIN') RETURNING id`,
      [emailAdmin, hash]
    )).rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=ANY($1)', [[emailDueno, emailAdmin]]);
    await pool.end();
  });

  test('un dueño activo con token válido sí accede a sus rutas', async () => {
    const r = await request(app).get('/api/tickets/active').set('Authorization', `Bearer ${tokenDe(duenoId, emailDueno, 'CLIENTE')}`);
    assert.equal(r.status, 200);
  });

  test('un dueño desactivado pierde el acceso aunque su token no haya expirado', async () => {
    const token = tokenDe(duenoId, emailDueno, 'CLIENTE');
    await pool.query('UPDATE usuarios SET activo=false WHERE id=$1', [duenoId]);
    const r = await request(app).get('/api/tickets/active').set('Authorization', `Bearer ${token}`);
    await pool.query('UPDATE usuarios SET activo=true WHERE id=$1', [duenoId]);
    assert.equal(r.status, 401);
  });

  test('un administrador degradado a USUARIO pierde las rutas de administración', async () => {
    const token = tokenDe(adminId, emailAdmin, 'ADMIN');
    await pool.query(`UPDATE usuarios SET rol='USUARIO' WHERE id=$1`, [adminId]);
    const r = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 403);
  });

  test('una cuenta eliminada no puede seguir usando su token', async () => {
    const hash = await bcrypt.hash('clave12345', 4);
    const email = `revocacion_borrada_${suffix}@demo.cl`;
    const id = (await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Borrada',$1,$2,'CLIENTE') RETURNING id`, [email, hash]
    )).rows[0].id;
    const token = tokenDe(id, email, 'CLIENTE');
    await pool.query('DELETE FROM usuarios WHERE id=$1', [id]);
    const r = await request(app).get('/api/parking/mine').set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 401);
  });

  test('rechaza tokens sin firma (alg "none") y tokens firmados con otra clave', async () => {
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: adminId, email: emailAdmin, rol: 'ADMIN' })}.`;
    const otraClave = jwt.sign({ id: adminId, email: emailAdmin, rol: 'ADMIN' }, 'clave-que-no-es-la-del-servidor');
    for (const token of [sinFirma, otraClave]) {
      const r = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
      assert.equal(r.status, 401);
    }
  });
});
