import { describe, test, expect, vi, afterEach } from 'vitest';
import { imprimirTicket } from './print.js';

describe('imprimirTicket', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  test('escapa los datos del estacionamiento: un nombre con HTML no inyecta scripts en el comprobante', async () => {
    vi.useFakeTimers();
    let html = '';
    const win = { document: { write: t => { html = t; }, open() {}, close() {} }, focus() {}, print() {} };
    vi.spyOn(window, 'open').mockReturnValue(win);

    await imprimirTicket({
      nombreEstacionamiento: '<img src=x onerror="fetch(\'//evil.test\')">Parking',
      direccion: '<script>alert(1)</script>',
      codigo: 'abc"><svg onload=alert(1)>',
      detalle: [['Patente', '<b>AB1234</b>']]
    });

    expect(html).not.toMatch(/<img src=x|<script>|<svg|<b>AB1234/);
    expect(html).toContain('&lt;img src=x onerror=&quot;fetch(&#39;//evil.test&#39;)&quot;&gt;Parking');
    expect(html).toContain('&lt;b&gt;AB1234&lt;/b&gt;');
  });
});
