import { describe, test, expect } from 'vitest';
import { aplicarFiltros, FILTROS_INICIALES } from './filtros.js';
import { costoEstimado } from './tarifa.js';

// Llegan ordenados por distancia, como los devuelve la API.
const cerca = { id: 1, precio_minuto: 30, tarifa_minima: 0, cupos_disponibles: 0, horario_estado: { abierto: true } };
const medio = { id: 2, precio_minuto: 15, tarifa_minima: 500, cupos_disponibles: 4, horario_estado: { abierto: false } };
const lejos = { id: 3, precio_minuto: 15, tarifa_minima: 0, cupos_disponibles: 2, horario_estado: { abierto: true } };
const todos = [cerca, medio, lejos];
const ids = l => l.map(p => p.id);

describe('costo estimado', () => {
  test('usa la misma fórmula que el cobro: minutos × precio, con el mínimo como piso', () => {
    expect(costoEstimado({ precio_minuto: 20, tarifa_minima: 500 }, 2)).toBe(2400);
    expect(costoEstimado({ precio_minuto: 2, tarifa_minima: 500 }, 1)).toBe(500);
    expect(costoEstimado({ precio_minuto: '12.5', tarifa_minima: '0' }, 1)).toBe(750);
  });
});

describe('filtros de la búsqueda', () => {
  test('sin filtros respeta el orden por distancia y numera desde 1', () => {
    const l = aplicarFiltros(todos, FILTROS_INICIALES);
    expect(ids(l)).toEqual([1, 2, 3]);
    expect(l.map(p => p.n)).toEqual([1, 2, 3]);
    expect(l[0].costo).toBe(3600); // 2 h a $30/min
  });

  test('"solo abiertos" y "solo con cupos" se combinan y la numeración se rehace', () => {
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, soloAbiertos: true }))).toEqual([1, 3]);
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, soloConCupos: true }))).toEqual([2, 3]);
    const ambos = aplicarFiltros(todos, { ...FILTROS_INICIALES, soloAbiertos: true, soloConCupos: true });
    expect(ids(ambos)).toEqual([3]);
    expect(ambos[0].n).toBe(1);
  });

  test('sin horario_estado (dato antiguo) se considera abierto', () => {
    expect(ids(aplicarFiltros([{ ...lejos, horario_estado: undefined }], { ...FILTROS_INICIALES, soloAbiertos: true }))).toEqual([3]);
  });

  test('ordenar por precio usa la estadía elegida; a igual costo queda el más cercano primero', () => {
    // 1 h: medio cuesta 900 (más que su mínimo de 500), lejos 900, cerca 1800.
    expect(ids(aplicarFiltros(todos, { ...FILTROS_INICIALES, orden: 'precio', horas: 1 }))).toEqual([2, 3, 1]);
    // Con un mínimo alto, en estadías cortas gana el que no tiene mínimo.
    const conMinimo = [{ ...medio, tarifa_minima: 5000 }, lejos];
    expect(ids(aplicarFiltros(conMinimo, { ...FILTROS_INICIALES, orden: 'precio', horas: 1 }))).toEqual([3, 2]);
  });

  test('no modifica la lista original', () => {
    const copia = structuredClone(todos);
    aplicarFiltros(todos, { ...FILTROS_INICIALES, orden: 'precio' });
    expect(todos).toEqual(copia);
  });
});
