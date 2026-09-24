import { describe, test, expect } from 'vitest';
import { calcularTarifa, formatTarifa, formatDuracion, formatCronometro, formatCLP } from './tarifa.js';

const T0 = new Date('2026-01-01T10:00:00Z').getTime();
const min = n => T0 + n * 60000;

// Estos casos son los mismos que backend/src/__tests__/tarifa.test.js: si difieren, el conductor
// vería en su teléfono un monto distinto al que le cobra el dueño.
describe('calcularTarifa (espejo del backend)', () => {
  test('una estadía corta paga el valor base mínimo', () => {
    expect(calcularTarifa(T0, 20, 500, min(10))).toEqual({ minutos: 10, bruto: 500 });
  });
  test('pasado el mínimo, cobra minutos × precio por minuto', () => {
    expect(calcularTarifa(T0, 20, 500, min(60))).toEqual({ minutos: 60, bruto: 1200 });
  });
  test('cualquier fracción cuenta como minuto completo', () => {
    expect(calcularTarifa(T0, 20, 0, T0 + 60 * 60000 + 1)).toEqual({ minutos: 61, bruto: 1220 });
  });
  test('siempre se cobra al menos 1 minuto', () => {
    expect(calcularTarifa(T0, 20, 0, T0)).toEqual({ minutos: 1, bruto: 20 });
  });
  test('redondea hacia arriba y no se infla por punto flotante', () => {
    expect(calcularTarifa(T0, 12.5, 0, min(3)).bruto).toBe(38);
    expect(calcularTarifa(T0, 0.1, 0, min(30)).bruto).toBe(3);
  });
});

describe('formatos', () => {
  test('formatTarifa muestra el mínimo solo si existe', () => {
    expect(formatTarifa({ precio_minuto: 25, tarifa_minima: 500 })).toBe('$25/min · mínimo $500');
    expect(formatTarifa({ precio_minuto: '25.00', tarifa_minima: '0.00' })).toBe('$25/min');
  });
  test('formatDuracion', () => {
    expect(formatDuracion(45)).toBe('45 min');
    expect(formatDuracion(83)).toBe('1 h 23 min');
    expect(formatDuracion(120)).toBe('2 h');
  });
  test('formatCronometro', () => {
    expect(formatCronometro(3725000)).toBe('01:02:05');
    expect(formatCronometro(-500)).toBe('00:00:00');
  });
  test('formatCLP usa separador de miles chileno', () => {
    expect(formatCLP(12500)).toBe('$12.500');
  });
});
