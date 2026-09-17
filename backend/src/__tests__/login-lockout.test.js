import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../config/database.js';

// Este bloqueo es por cuenta (no por IP): protege contra un atacante que reparte sus intentos
// entre muchas IPs distintas apuntando siempre al mismo email. Va en su propio archivo porque
// necesita varios intentos fallidos seguidos y cada archivo de test corre en su propio proceso
// (por lo tanto con su propio contador de authLimiter, que es por-IP y compartiría presupuesto
// con auth.test.js si estuvieran en el mismo archivo).
const email = `lockout_${Date.now()}@demo.cl`;
const password = 'clave12345';

describe('login: bloqueo de cuenta tras intentos fallidos', () => {
  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=$1', [email]);
    await pool.end();
  });

  test('registra el usuario de prueba', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Lockout Test', email, password });
    assert.equal(res.status, 201);
  });

  test('bloquea la cuenta tras 5 intentos fallidos seguidos', async () => {
    let ultimaRespuesta;
    for (let i = 0; i < 5; i++) {
      ultimaRespuesta = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
      assert.equal(ultimaRespuesta.status, 401);
    }
    const r = await pool.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE email=$1', [email]);
    assert.equal(r.rows[0].intentos_fallidos, 0); // se resetea al bloquear
    assert.ok(new Date(r.rows[0].bloqueado_hasta) > new Date());
  });

  test('mientras está bloqueada, ni siquiera la contraseña correcta funciona', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Credenciales inválidas'); // mismo mensaje que cualquier otro rechazo, no filtra el motivo
  });

  test('una vez que expira el bloqueo, la contraseña correcta vuelve a funcionar y resetea el contador', async () => {
    await pool.query(`UPDATE usuarios SET bloqueado_hasta = NOW() - interval '1 minute' WHERE email=$1`, [email]);
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);

    const r = await pool.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE email=$1', [email]);
    assert.equal(r.rows[0].intentos_fallidos, 0);
    assert.equal(r.rows[0].bloqueado_hasta, null);
  });
});
