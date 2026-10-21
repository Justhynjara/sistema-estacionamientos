// Cambio de contraseña obligatorio al primer ingreso: un usuario creado por el admin nace con una
// clave temporal y queda marcado para cambiarla. Hasta que lo haga, el backend lo bloquea de todo
// endpoint protegido (salvo /me, /logout y /change-password): no basta con redirigir en la web.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const suffix = Date.now();
const adminEmail = `admin_pwc_${suffix}@demo.cl`;
const nuevoEmail = `creado_pwc_${suffix}@demo.cl`;
const publicoEmail = `publico_pwc_${suffix}@demo.cl`;
const CLAVE_TEMP = 'claveTemporal1';
const CLAVE_NUEVA = 'miClaveNueva9';

let tokenAdmin, tokenNuevo, nuevoId;

describe('cambio de contraseña obligatorio al primer ingreso', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 10);
    const admin = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Admin PWC',$1,$2,'ADMIN') RETURNING id`,
      [adminEmail, hash]
    );
    await admin.rows[0].id;
    const login = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'clave12345' });
    tokenAdmin = login.body.token;
  });

  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=ANY($1)', [[adminEmail, nuevoEmail, publicoEmail]]);
    await pool.end();
  });

  test('un usuario creado por el admin nace marcado para cambiar la contraseña', async () => {
    const crear = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Creado PWC', email: nuevoEmail, password: CLAVE_TEMP, rol: 'CLIENTE' });
    assert.equal(crear.status, 201);
    nuevoId = crear.body.id;

    const r = await pool.query('SELECT debe_cambiar_password FROM usuarios WHERE id=$1', [nuevoId]);
    assert.equal(r.rows[0].debe_cambiar_password, true);
  });

  test('el registro público NO queda marcado (la persona ya eligió su clave)', async () => {
    const reg = await request(app).post('/api/auth/register')
      .send({ nombre: 'Publico PWC', email: publicoEmail, password: 'clavePublica9' });
    assert.equal(reg.status, 201);
    const r = await pool.query('SELECT debe_cambiar_password FROM usuarios WHERE email=$1', [publicoEmail]);
    assert.equal(r.rows[0].debe_cambiar_password, false);
  });

  test('al iniciar sesión, la respuesta avisa que debe cambiar la contraseña', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: nuevoEmail, password: CLAVE_TEMP });
    assert.equal(login.status, 200);
    assert.equal(login.body.debeCambiarPassword, true);
    tokenNuevo = login.body.token;
  });

  test('/me está permitido y también informa el flag', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenNuevo}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.debeCambiarPassword, true);
  });

  test('el backend bloquea cualquier endpoint protegido con code PASSWORD_CHANGE_REQUIRED', async () => {
    const res = await request(app).get('/api/tickets/active').set('Authorization', `Bearer ${tokenNuevo}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
  });

  test('change-password rechaza la clave actual incorrecta', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenNuevo}`)
      .send({ passwordActual: 'equivocada9', passwordNueva: CLAVE_NUEVA });
    assert.equal(res.status, 401);
  });

  test('change-password rechaza una clave nueva demasiado corta', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenNuevo}`)
      .send({ passwordActual: CLAVE_TEMP, passwordNueva: 'corta' });
    assert.equal(res.status, 400);
  });

  test('change-password rechaza una clave nueva igual a la actual', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenNuevo}`)
      .send({ passwordActual: CLAVE_TEMP, passwordNueva: CLAVE_TEMP });
    assert.equal(res.status, 400);
  });

  test('al cambiar la clave: se limpia el flag, el endpoint se desbloquea y el login deja de avisar', async () => {
    const cambio = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenNuevo}`)
      .send({ passwordActual: CLAVE_TEMP, passwordNueva: CLAVE_NUEVA });
    assert.equal(cambio.status, 200);

    const r = await pool.query('SELECT debe_cambiar_password FROM usuarios WHERE id=$1', [nuevoId]);
    assert.equal(r.rows[0].debe_cambiar_password, false);

    // El mismo token (misma sesión) ya no está bloqueado.
    const activo = await request(app).get('/api/tickets/active').set('Authorization', `Bearer ${tokenNuevo}`);
    assert.equal(activo.status, 200);

    // Entrar con la clave nueva ya no pide cambio.
    const login = await request(app).post('/api/auth/login').send({ email: nuevoEmail, password: CLAVE_NUEVA });
    assert.equal(login.status, 200);
    assert.equal(login.body.debeCambiarPassword, false);
  });
});
