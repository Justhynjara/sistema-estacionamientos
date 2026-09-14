import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const email = `test_${Date.now()}@demo.cl`;
const password = 'clave12345';

describe('auth', () => {
  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=$1', [email]);
    await pool.end();
  });

  test('rechaza registro con contraseña corta', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Test', email, password: '123' });
    assert.equal(res.status, 400);
  });

  test('registra un usuario nuevo', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Test User', email, password });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, email);
    assert.equal(res.body.rol, 'USUARIO');
  });

  test('rechaza email duplicado', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Otro', email, password });
    assert.equal(res.status, 409);
  });

  test('rechaza login con contraseña incorrecta', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta123' });
    assert.equal(res.status, 401);
  });

  test('login exitoso devuelve token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, email);
  });

  test('/auth/me requiere token', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('/auth/me devuelve el usuario con token válido', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, email);
  });

  test('/auth/me rechaza token inválido', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token-invalido');
    assert.equal(res.status, 401);
  });

  test('forgot-password responde igual exista o no el email (sin filtrar usuarios)', async () => {
    const r1 = await request(app).post('/api/auth/forgot-password').send({ email });
    const r2 = await request(app).post('/api/auth/forgot-password').send({ email: 'no-existe-nadie@demo.cl' });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.body.mensaje, r2.body.mensaje);
  });
});
