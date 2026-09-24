import { describe, test, expect } from 'vitest';
import { qrPayload, extraerCodigoQR, WEB_URL } from './qr.js';

describe('QR del ticket', () => {
  test('el contenido del QR es un enlace a la web con el código', () => {
    const url = qrPayload('abc123def456');
    expect(url).toBe(`${WEB_URL}/?ticket=abc123def456`);
    expect(new URL(url).searchParams.get('ticket')).toBe('abc123def456');
  });

  test('extrae el código de un enlace escaneado', () => {
    expect(extraerCodigoQR(qrPayload('abc123def456'))).toBe('abc123def456');
    expect(extraerCodigoQR('https://otra.web/?ticket=XYZ789&x=1')).toBe('XYZ789');
  });

  test('acepta el código pelado de tickets impresos antes del cambio', () => {
    expect(extraerCodigoQR('  abc123def456  ')).toBe('abc123def456');
  });

  test('un texto vacío o una URL sin ticket no inventa un código', () => {
    expect(extraerCodigoQR('')).toBe('');
    expect(extraerCodigoQR(null)).toBe('');
    expect(extraerCodigoQR('https://otra.web/')).toBe('https://otra.web/');
  });
});
