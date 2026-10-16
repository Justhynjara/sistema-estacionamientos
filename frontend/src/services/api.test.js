import { describe, test, expect, vi, beforeEach } from 'vitest';

// Responde con el encabezado Authorization que habría salido en la petición, sin red.
const adaptador = config => Promise.resolve({ data: config.headers.Authorization ?? null, status: 200, statusText: 'OK', headers: {}, config });

async function cargar(nativa) {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => nativa } }));
  const mod = await import('./api.js');
  mod.api.defaults.adapter = adaptador;
  return mod;
}

describe('sesión en la app nativa (iOS/Android)', () => {
  beforeEach(() => vi.doUnmock('@capacitor/core'));

  test('en la app nativa, tras iniciar sesión las peticiones llevan el token en Authorization', async () => {
    const { api, guardarSesionNativa } = await cargar(true);
    expect((await api.get('/auth/me')).data).toBeNull();
    guardarSesionNativa('token-de-prueba');
    expect((await api.get('/auth/me')).data).toBe('Bearer token-de-prueba');
    guardarSesionNativa(null);
    expect((await api.get('/auth/me')).data).toBeNull();
  });

  test('en el navegador no se guarda ni se envía el token: la sesión va solo en la cookie httpOnly', async () => {
    const { api, guardarSesionNativa } = await cargar(false);
    guardarSesionNativa('token-de-prueba');
    expect((await api.get('/auth/me')).data).toBeNull();
    expect(api.defaults.withCredentials).toBe(true);
  });

  test('un 401 en la app nativa borra el token guardado', async () => {
    const { api, guardarSesionNativa } = await cargar(true);
    guardarSesionNativa('token-vencido');
    api.defaults.adapter = config => Promise.reject(Object.assign(new Error('401'), { config, response: { status: 401 } }));
    await expect(api.get('/tickets/active')).rejects.toThrow();
    api.defaults.adapter = adaptador;
    expect((await api.get('/auth/me')).data).toBeNull();
  });
});
