// Archivo aparte a propósito: hay que fijar NODE_ENV antes de importar la app (env.js lee
// process.env al cargarse). Los `import` estáticos se izan por delante de cualquier otra línea
// del archivo, así que fijar la variable de entorno "antes" en el código no basta: hace falta un
// `import()` dinámico para garantizar el orden. node --test corre cada archivo en su propio
// proceso, así que esto no afecta a los demás tests.
process.env.NODE_ENV = 'production';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
const { app } = await import('../app.js');

describe('redirección a HTTPS en producción', () => {
  test('una petición que llega como http (según el proxy) se redirige a https', async () => {
    const res = await request(app).get('/health').set('X-Forwarded-Proto', 'http');
    assert.equal(res.status, 301);
    assert.match(res.headers.location, /^https:\/\//);
  });

  test('una petición que ya llega como https no se toca', async () => {
    const res = await request(app).get('/health').set('X-Forwarded-Proto', 'https');
    assert.equal(res.status, 200);
  });
});
