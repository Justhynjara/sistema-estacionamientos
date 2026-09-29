// Archivo aparte de auth.test.js: cada login que hace cuenta contra authLimiter (10 cada 15 min
// por IP), y ese archivo ya usa varios en sus propios tests. node --test corre cada archivo en su
// propio proceso, así que aquí el cupo del limitador es independiente.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const email = `cookie_${Date.now()}@demo.cl`;
const password = 'clave12345';

describe('sesión por cookie httpOnly', () => {
  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=$1', [email]);
    await pool.end();
  });

  test('login exitoso deja una cookie de sesión httpOnly (la web ya no usa localStorage)', async () => {
    await request(app).post('/api/auth/register').send({ nombre: 'Cookie Test', email, password });
    const res = await request(app).post('/api/auth/login').send({ email, password });
    const cookie = res.headers['set-cookie']?.find(c => c.startsWith('token='));
    assert.ok(cookie, 'debe fijar la cookie "token"');
    assert.match(cookie, /HttpOnly/i);
    // En test NODE_ENV no es 'production': SameSite=Lax y sin Secure (igual que en desarrollo local).
    assert.match(cookie, /SameSite=Lax/i);
  });

  test('/auth/me funciona solo con la cookie de sesión, sin encabezado Authorization', async () => {
    const agent = request.agent(app); // conserva cookies entre peticiones, como un navegador
    await agent.post('/api/auth/login').send({ email, password });
    const res = await agent.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.email, email);
  });

  test('logout borra la cookie y la sesión deja de servir', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });
    assert.equal((await agent.get('/api/auth/me')).status, 200);

    const salida = await agent.post('/api/auth/logout');
    assert.equal(salida.status, 200);
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });
});
