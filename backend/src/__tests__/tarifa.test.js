import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcularTarifa } from '../utils/tarifa.js';

const T0 = new Date('2026-01-01T10:00:00Z').getTime();
const min = n => T0 + n * 60000;

describe('tarifa por minuto con valor base mínimo', () => {
  test('una estadía corta paga el valor base mínimo', () => {
    const r = calcularTarifa(T0, 20, 500, min(10));
    assert.equal(r.minutos, 10);
    assert.equal(r.bruto, 500);
  });

  test('pasado el mínimo, cobra minutos × precio por minuto', () => {
    const r = calcularTarifa(T0, 20, 500, min(60));
    assert.equal(r.minutos, 60);
    assert.equal(r.bruto, 1200);
  });

  test('cualquier fracción cuenta como minuto completo', () => {
    const r = calcularTarifa(T0, 20, 0, T0 + 60 * 60000 + 1);
    assert.equal(r.minutos, 61);
    assert.equal(r.bruto, 1220);
  });

  test('siempre se cobra al menos 1 minuto, incluso recién entrando', () => {
    const r = calcularTarifa(T0, 20, 0, T0);
    assert.equal(r.minutos, 1);
    assert.equal(r.bruto, 20);
  });

  test('el total en pesos se redondea hacia arriba', () => {
    const r = calcularTarifa(T0, 12.5, 0, min(3));
    assert.equal(r.bruto, 38);
  });

  test('un precio con decimales no se infla por error de punto flotante', () => {
    const r = calcularTarifa(T0, 0.1, 0, min(30));
    assert.equal(r.bruto, 3);
  });

  test('acepta los valores numéricos como texto, tal como los entrega Postgres', () => {
    const r = calcularTarifa(T0, '25.00', '500.00', min(30));
    assert.equal(r.bruto, 750);
  });

  test('un precio por hora convertido a minuto (1000/60) no cobra pesos de más en horas enteras', () => {
    assert.equal(calcularTarifa(T0, 16.6667, 1000, min(60)).bruto, 1000);
    assert.equal(calcularTarifa(T0, 16.6667, 1000, min(120)).bruto, 2000);
    assert.equal(calcularTarifa(T0, 16.6667, 1000, min(600)).bruto, 10000);
  });
});
