import { describe, test, expect, vi, afterEach } from 'vitest';
import { geocode, searchAddresses } from './geo.js';

describe('geocode', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  test('devuelve lat/lng numéricos del primer resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ lat: '-33.45', lon: '-70.66' }])
    }));

    const r = await geocode('Plaza de Armas, Santiago');
    expect(r).toEqual({ lat: -33.45, lng: -70.66 });
  });

  test('lanza error si no hay resultados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }));
    await expect(geocode('dirección inexistente')).rejects.toThrow(/no se encontró/i);
  });
});

describe('searchAddresses', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  test('no llama a la API con menos de 3 caracteres', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const r = await searchAddresses('ab');
    expect(r).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('mapea los resultados de Nominatim a {label, lat, lng}', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve([
        { display_name: 'Alameda 123, Santiago', lat: '-33.44', lon: '-70.65' }
      ])
    }));
    const r = await searchAddresses('Alameda 123');
    expect(r).toEqual([{ label: 'Alameda 123, Santiago', lat: -33.44, lng: -70.65 }]);
  });

  test('restringe la búsqueda a Chile (countrycodes=cl)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchSpy);
    await searchAddresses('Alameda');
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain('countrycodes=cl');
  });
});
