import { describe, test, expect } from 'vitest';
import { variacion, etiquetaDia, formatPorcentaje, rangoFechas, clpCorto } from './estadisticas.js';

describe('textos de las estadísticas', () => {
  test('variación respecto del período anterior', () => {
    expect(variacion(1250, 1000)).toEqual({ tendencia: 'sube', texto: '+25 % vs. período anterior' });
    expect(variacion(600, 1000)).toEqual({ tendencia: 'baja', texto: '−40 % vs. período anterior' });
    expect(variacion(1000, 1000).tendencia).toBe('igual');
    expect(variacion(500, 0).texto).toBe('sin movimiento el período anterior');
    expect(variacion(0, 0).tendencia).toBe('igual');
  });

  test('etiquetas de día y porcentaje', () => {
    expect(etiquetaDia('2026-10-13', 2)).toBe('Mar 13');
    expect(etiquetaDia('2026-10-05', 1)).toBe('Lun 5');
    expect(formatPorcentaje(12.5)).toBe('12,5 %');
    expect(formatPorcentaje(25)).toBe('25 %');
  });

  test('rango de fechas y montos cortos', () => {
    expect(rangoFechas('2026-10-11', '2026-10-17')).toBe('11 al 17 oct');
    expect(rangoFechas('2026-09-18', '2026-10-17')).toBe('18 sep al 17 oct');
    expect(clpCorto(800)).toBe('$800');
    expect(clpCorto(1500)).toBe('$1,5 mil');
    expect(clpCorto(13240)).toBe('$13 mil');
  });
});
