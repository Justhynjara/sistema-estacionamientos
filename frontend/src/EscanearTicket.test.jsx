import { describe, test, expect } from 'vitest';
import { codigoDeTicket } from './EscanearTicket.jsx';

// El código real lo genera backend/src/utils/generateQR.js: 18 bytes en hexadecimal.
const HEX36 = '042c181d4c9e93b3b745ae0f3c5d1e2a7b9c';

describe('codigoDeTicket', () => {
  test('acepta el enlace del QR con el código que emite el sistema (36 hex)', () => {
    expect(codigoDeTicket(`https://estacionamientos-web.onrender.com/?ticket=${HEX36}`)).toBe(HEX36);
    expect(codigoDeTicket(HEX36)).toBe(HEX36);
  });

  test('sigue aceptando los códigos UUID de tickets antiguos', () => {
    const uuid = '5f3c9a1e-7b2d-4e8f-9a6c-1d2e3f4a5b6c';
    expect(codigoDeTicket(`https://x.cl/?ticket=${uuid}`)).toBe(uuid);
  });

  test('rechaza QR que no son tickets', () => {
    expect(codigoDeTicket('https://restaurante.example/menu')).toBe('');
    expect(codigoDeTicket('hola')).toBe('');
    expect(codigoDeTicket('https://x.cl/?ticket=no-es-un-codigo')).toBe('');
  });
});
