// Archivo aparte: cada login cuenta contra authLimiter (10 por 15 min por IP), así que se aísla
// en su propio proceso (node --test corre cada archivo por separado) para no agotar el cupo.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const email = `timing_${Date.now()}@demo.cl`;
const password = 'clave12345';

async function mide(fn) {
  const t0 = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - t0) / 1e6; // ms
}

describe('el login no delata por tiempo si un email existe', () => {
  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=$1', [email]);
    await pool.end();
  });

  test('un email inexistente igual ejecuta el hash (bcrypt), no responde al instante', async () => {
    // Un bcrypt a coste 10 tarda decenas de ms; sin la comparación señuelo la ruta "no existe"
    // volvía en ~1-2 ms. El umbral distingue ambos casos sin depender de la máquina.
    const ms = await mide(() =>
      request(app).post('/api/auth/login').send({ email: `no_existe_${Date.now()}@demo.cl`, password })
    );
    assert.ok(ms > 20, `la respuesta para un email inexistente fue demasiado rápida (${ms.toFixed(1)} ms): el hash señuelo no se ejecutó`);
  });

  test('el mensaje de error es idéntico exista o no la cuenta', async () => {
    await request(app).post('/api/auth/register').send({ nombre: 'Timing', email, password });
    const noExiste = await request(app).post('/api/auth/login').send({ email: `nada_${Date.now()}@demo.cl`, password });
    const malaClave = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
    assert.equal(noExiste.status, 401);
    assert.equal(malaClave.status, 401);
    assert.equal(noExiste.body.error, malaClave.body.error);
  });
});
