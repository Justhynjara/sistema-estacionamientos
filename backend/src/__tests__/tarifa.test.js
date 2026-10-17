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

// Tarifa por horario. T0 = 1 de enero de 2026, 07:00 en Chile (UTC-3, horario de verano).
describe('tarifa por horario (tramos con otro precio por minuto)', () => {
  const NOCHE = [{ desde: '20:00', hasta: '08:00', precio_minuto: 10 }];
  const utc = s => new Date(s).getTime();

  test('sin tramos el cobro es idéntico al de siempre', () => {
    assert.deepEqual(calcularTarifa(T0, 20, 500, min(90), null), calcularTarifa(T0, 20, 500, min(90)));
    assert.deepEqual(calcularTarifa(T0, 20, 500, min(90), []), calcularTarifa(T0, 20, 500, min(90)));
  });

  test('cada minuto se cobra al precio del tramo en que empieza', () => {
    // 07:00–08:00 nocturno ($10) y 08:00–09:00 base ($20).
    assert.equal(calcularTarifa(T0, 20, 0, min(120), NOCHE).bruto, 60 * 10 + 60 * 20);
  });

  test('un tramo que cruza la medianoche cubre ambos lados', () => {
    // 23:30 a 00:30 en Chile, todo dentro de 20:00–08:00.
    assert.equal(calcularTarifa(utc('2026-01-02T02:30:00Z'), 20, 0, utc('2026-01-02T03:30:00Z'), NOCHE).bruto, 600);
  });

  test('"24:00" cierra el tramo al final del día', () => {
    // 17:30 a 18:30 en Chile: 30 min base ($20) y 30 min en 18:00–24:00 ($30).
    const tramos = [{ desde: '18:00', hasta: '24:00', precio_minuto: 30 }];
    assert.equal(calcularTarifa(utc('2026-01-01T20:30:00Z'), 20, 0, utc('2026-01-01T21:30:00Z'), tramos).bruto, 30 * 20 + 30 * 30);
  });

  test('el valor base mínimo se sigue aplicando sobre el total', () => {
    assert.equal(calcularTarifa(T0, 20, 1000, min(30), NOCHE).bruto, 1000);
  });

  test('al terminar el horario de verano la hora 23:00 se repite y se cobra dos veces al precio del tramo', () => {
    // 4 de abril de 2026: a las 24:00 (UTC-3) el reloj vuelve a las 23:00 (UTC-4).
    // 22:30–23:00 base, 23:00–24:00 tramo, 23:00–23:30 (otra vez) tramo.
    const tramos = [{ desde: '23:00', hasta: '24:00', precio_minuto: 100 }];
    assert.equal(calcularTarifa(utc('2026-04-05T01:30:00Z'), 1, 0, utc('2026-04-05T03:30:00Z'), tramos).bruto, 30 * 1 + 90 * 100);
  });

  test('entrada con segundos: los minutos siguen al reloj de la entrada', () => {
    // 07:59:30 → el primer minuto empieza a las 07:59 (nocturno), el segundo a las 08:00 (base).
    const entrada = T0 + 59 * 60000 + 30000;
    assert.equal(calcularTarifa(entrada, 20, 0, entrada + 120000, NOCHE).bruto, 10 + 20);
  });

  test('una estadía de un día completo suma sin error de redondeo', () => {
    const tramos = [{ desde: '00:00', hasta: '12:00', precio_minuto: 16.6667 }];
    // Un día desde las 07:00: 12 h a $16.6667 (= $12.000) y 12 h a $20.
    assert.equal(calcularTarifa(T0, 20, 0, min(1440), tramos).bruto, 12000 + 12 * 60 * 20);
  });
});
