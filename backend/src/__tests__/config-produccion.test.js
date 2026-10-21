import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { problemasDeConfiguracion } from '../config/env.js';

const base = {
  jwtSecret: 'x'.repeat(40),
  databaseUrl: 'postgres://u:p@host/db',
  webpay: { commerceCode: '', apiKey: '' }
};

describe('validación de configuración para producción', () => {
  test('una configuración con secretos fuertes no reporta problemas', () => {
    assert.deepEqual(problemasDeConfiguracion(base), []);
  });

  test('JWT_SECRET ausente o con el valor público "dev_secret" es un problema', () => {
    assert.equal(problemasDeConfiguracion({ ...base, jwtSecret: 'dev_secret' }).length, 1);
    assert.equal(problemasDeConfiguracion({ ...base, jwtSecret: '' }).length, 1);
  });

  test('JWT_SECRET demasiado corto es un problema', () => {
    const p = problemasDeConfiguracion({ ...base, jwtSecret: 'corto' });
    assert.equal(p.length, 1);
    assert.match(p[0], /32 caracteres/);
  });

  test('DATABASE_URL ausente es un problema', () => {
    assert.ok(problemasDeConfiguracion({ ...base, databaseUrl: undefined }).some(m => /DATABASE_URL/.test(m)));
  });

  test('Webpay sin credenciales NO es un problema (cae a integración pública)', () => {
    assert.deepEqual(problemasDeConfiguracion(base), []);
  });
});
