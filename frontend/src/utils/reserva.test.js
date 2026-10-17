import { describe, test, expect } from 'vitest';
import { estadoReserva, formatRestante } from './reserva.js';

const T0 = new Date('2026-01-01T10:00:00Z').getTime();
const en = min => new Date(T0 + min * 60000).toISOString();

describe('estado de la reserva', () => {
  test('con más de 3 minutos está vigente sin aviso', () => {
    expect(estadoReserva(en(7), T0)).toEqual({ restanteMs: 7 * 60000, vencida: false, porVencer: false });
  });
  test('desde los 3 minutos restantes queda "por vencer"', () => {
    expect(estadoReserva(en(3), T0).porVencer).toBe(true);
    expect(estadoReserva(en(0.5), T0).porVencer).toBe(true);
    expect(estadoReserva(en(3.01), T0).porVencer).toBe(false);
  });
  test('pasada la hora está vencida y nunca da tiempo negativo', () => {
    expect(estadoReserva(en(-2), T0)).toEqual({ restanteMs: 0, vencida: true, porVencer: false });
  });
  test('formatea minutos y segundos redondeando hacia arriba', () => {
    expect(formatRestante(185000)).toBe('3:05');
    expect(formatRestante(59001)).toBe('1:00');
    expect(formatRestante(0)).toBe('0:00');
  });
});
