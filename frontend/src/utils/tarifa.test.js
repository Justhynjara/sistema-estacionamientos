import { describe, test, expect } from 'vitest';
import { calcularTarifa, formatTarifa, formatDuracion, formatCronometro, formatCLP, costoEstimado } from './tarifa.js';

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
  test('un precio por hora convertido a minuto (1000/60) no cobra pesos de más en horas enteras', () => {
    expect(calcularTarifa(T0, 16.6667, 1000, min(120)).bruto).toBe(2000);
    expect(calcularTarifa(T0, 16.6667, 1000, min(600)).bruto).toBe(10000);
  });
});

describe('formatos', () => {
  test('formatTarifa muestra el mínimo solo si existe', () => {
    expect(formatTarifa({ precio_minuto: 25, tarifa_minima: 500 })).toBe('$25/min · mínimo $500');
    expect(formatTarifa({ precio_minuto: '25.00', tarifa_minima: '0.00' })).toBe('$25/min');
    // La base guarda 4 decimales (16.6667): se muestran solo 2, sin arrastrar ceros.
    expect(formatTarifa({ precio_minuto: '16.6667', tarifa_minima: '1000.00' })).toBe('$16,67/min · mínimo $1.000');
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

// Mismos casos que backend/src/__tests__/tarifa.test.js (tarifa por horario).
// T0 = 1 de enero de 2026, 07:00 en Chile (UTC-3).
describe('tarifa por horario (espejo del backend)', () => {
  const NOCHE = [{ desde: '20:00', hasta: '08:00', precio_minuto: 10 }];
  const utc = s => new Date(s).getTime();

  test('sin tramos el cobro es idéntico al de siempre', () => {
    expect(calcularTarifa(T0, 20, 500, min(90), null)).toEqual(calcularTarifa(T0, 20, 500, min(90)));
  });
  test('cada minuto se cobra al precio del tramo en que empieza', () => {
    expect(calcularTarifa(T0, 20, 0, min(120), NOCHE).bruto).toBe(60 * 10 + 60 * 20);
  });
  test('un tramo que cruza la medianoche cubre ambos lados', () => {
    expect(calcularTarifa(utc('2026-01-02T02:30:00Z'), 20, 0, utc('2026-01-02T03:30:00Z'), NOCHE).bruto).toBe(600);
  });
  test('"24:00" cierra el tramo al final del día', () => {
    const tramos = [{ desde: '18:00', hasta: '24:00', precio_minuto: 30 }];
    expect(calcularTarifa(utc('2026-01-01T20:30:00Z'), 20, 0, utc('2026-01-01T21:30:00Z'), tramos).bruto).toBe(30 * 20 + 30 * 30);
  });
  test('el valor base mínimo se sigue aplicando', () => {
    expect(calcularTarifa(T0, 20, 1000, min(30), NOCHE).bruto).toBe(1000);
  });
  test('al terminar el horario de verano la hora 23:00 se repite', () => {
    const tramos = [{ desde: '23:00', hasta: '24:00', precio_minuto: 100 }];
    expect(calcularTarifa(utc('2026-04-05T01:30:00Z'), 1, 0, utc('2026-04-05T03:30:00Z'), tramos).bruto).toBe(30 + 90 * 100);
  });
  test('el costo estimado parte desde ahora y respeta los tramos', () => {
    const p = { precio_minuto: 20, tarifa_minima: 0, tarifas_horario: NOCHE };
    expect(costoEstimado(p, 2, T0)).toBe(1800);
    expect(costoEstimado({ precio_minuto: 20, tarifa_minima: 500 }, 2, T0)).toBe(2400);
  });
  test('el texto de la tarifa incluye los tramos', () => {
    expect(formatTarifa({ precio_minuto: 20, tarifa_minima: 500, tarifas_horario: NOCHE })).toBe('$20/min · 20:00–08:00 $10/min · mínimo $500');
    expect(formatTarifa({ precio_minuto: 20, tarifa_minima: 0, tarifas_horario: [{ desde: '00:00', hasta: '24:00', precio_minuto: 5 }] })).toBe('$20/min · todo el día $5/min');
  });
});
