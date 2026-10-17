import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estadoHorario, motivoNoReservable, relojLocal } from '../utils/horario.js';

// Instantes fijos en hora de Chile. Octubre de 2026 es horario de verano (UTC-3).
// 2026-10-14 es miércoles (dia_semana 3).
const chile = (fechaHora) => new Date(`${fechaHora}-03:00`);
const turno = (abre, cierra) => ({ abre, cierra });
const semana = (fn) => Array.from({ length: 7 }, (_, d) => fn(d));
const lunAVie = semana(d => (d >= 1 && d <= 5 ? turno('08:00', '20:00') : null));

describe('horario de atención', () => {
  test('lee la hora de Chile aunque el servidor esté en UTC', () => {
    assert.deepEqual(relojLocal(chile('2026-10-14T09:30:00')), { dia: 3, minuto: 9 * 60 + 30 });
  });

  test('sin horario definido está siempre abierto', () => {
    const e = estadoHorario(null, chile('2026-10-14T03:00:00'));
    assert.equal(e.abierto, true);
    assert.equal(e.siempre, true);
  });

  test('dentro del turno: abierto y dice a qué hora cierra hoy', () => {
    const e = estadoHorario(lunAVie, chile('2026-10-14T10:00:00'));
    assert.equal(e.abierto, true);
    assert.deepEqual(e.cambio, { tipo: 'cierra', hora: '20:00', en_dias: 0, dia_semana: 3 });
    assert.equal(e.minutos_para_cambio, 600);
  });

  test('antes de abrir: cerrado y abre hoy', () => {
    const e = estadoHorario(lunAVie, chile('2026-10-14T07:15:00'));
    assert.equal(e.abierto, false);
    assert.deepEqual(e.cambio, { tipo: 'abre', hora: '08:00', en_dias: 0, dia_semana: 3 });
  });

  test('viernes en la noche: cerrado y abre el lunes', () => {
    const e = estadoHorario(lunAVie, chile('2026-10-16T21:00:00'));
    assert.equal(e.abierto, false);
    assert.deepEqual(e.cambio, { tipo: 'abre', hora: '08:00', en_dias: 3, dia_semana: 1 });
  });

  test('turno que cruza la medianoche (20:00 a 02:00) sigue abierto a la 01:00 del día siguiente', () => {
    const noche = semana(() => turno('20:00', '02:00'));
    const e = estadoHorario(noche, chile('2026-10-15T01:00:00'));
    assert.equal(e.abierto, true);
    assert.deepEqual(e.cambio, { tipo: 'cierra', hora: '02:00', en_dias: 0, dia_semana: 4 });
    assert.equal(estadoHorario(noche, chile('2026-10-15T03:00:00')).abierto, false);
  });

  test('00:00 a 24:00 todos los días equivale a siempre abierto', () => {
    const e = estadoHorario(semana(() => turno('00:00', '24:00')), chile('2026-10-14T23:59:00'));
    assert.equal(e.abierto, true);
    assert.equal(e.siempre, true);
  });

  test('cerrado todos los días: cerrado y sin próxima apertura', () => {
    const e = estadoHorario(semana(() => null), chile('2026-10-14T12:00:00'));
    assert.equal(e.abierto, false);
    assert.equal(e.cambio, null);
  });

  test('no se puede reservar si está cerrado o si cierra antes de que venza la reserva', () => {
    assert.match(motivoNoReservable(lunAVie, 10, chile('2026-10-14T07:00:00')), /cerrado/);
    assert.match(motivoNoReservable(lunAVie, 10, chile('2026-10-14T19:55:00')), /cierra a las 20:00/);
    assert.equal(motivoNoReservable(lunAVie, 10, chile('2026-10-14T19:45:00')), null);
    assert.equal(motivoNoReservable(null, 10, chile('2026-10-14T03:00:00')), null);
  });
});
