// Archivo aparte, igual que https-redirect.test.js: hay que fijar NODE_ENV antes del `import` de
// la app (que se iza por delante de cualquier otra línea), así que se usa un `import()` dinámico.
process.env.NODE_ENV = 'production';

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
const { app } = await import('../app.js');
const { pool } = await import('../config/database.js');

const email = `prod_cookie_${Date.now()}@demo.cl`;
const password = 'clave12345';

describe('cookie de sesión en producción', () => {
  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=$1', [email]);
    await pool.end();
  });

  test('en producción la cookie exige Secure y SameSite=None (obligatorio entre subdominios distintos)', async () => {
    await request(app).post('/api/auth/register').send({ nombre: 'Prod Cookie', email, password });
    const res = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = res.headers['set-cookie']?.find(c => c.startsWith('token='));
    assert.ok(cookie, 'debe fijar la cookie "token"');
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=None/i);
    assert.match(cookie, /HttpOnly/i);
  });
});
