import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// BuscarCercanos monta un mapa Leaflet real, que no funciona bien en jsdom (mediciones de DOM
// que el navegador headless no implementa). Los paneles autenticados hacen sus propias llamadas
// de red en useEffect. Ninguno de los dos es lo que este test verifica (el shell/routing de
// App), así que se reemplazan por stubs simples.
vi.mock('./BuscarCercanos.jsx', () => ({ default: () => <div>MockBuscarCercanos</div> }));
vi.mock('./ClientePanel.jsx', () => ({ default: () => <div>MockClientePanel</div> }));
vi.mock('./AdminPanel.jsx', () => ({ default: () => <div>MockAdminPanel</div> }));
vi.mock('./SoportePanel.jsx', () => ({ default: () => <div>MockSoportePanel</div> }));

vi.mock('./services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn() }
}));

import App from './App.jsx';
import { api } from './services/api.js';

describe('App', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.clearAllMocks(); });

  test('sin sesión, muestra la landing con los dos accesos separados (usuario / dueño-admin)', async () => {
    render(<App />);
    expect(await screen.findByText('Busco estacionamiento')).toBeInTheDocument();
    expect(screen.getByText('Soy dueño o administrador')).toBeInTheDocument();
    expect(screen.getByText('MockBuscarCercanos')).toBeInTheDocument();
  });

  test('el acceso de dueño/admin lleva al formulario de login', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Busco estacionamiento');

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(screen.getByRole('heading', { name: /acceso cliente \/ administrador/i })).toBeInTheDocument();
  });

  test('login exitoso guarda el token y muestra el panel según el rol', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 'fake-jwt', user: { id: '1', nombre: 'Cliente Demo', email: 'cliente@demo.cl', rol: 'CLIENTE' } }
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Busco estacionamiento');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await user.type(screen.getByLabelText('Email'), 'cliente@demo.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('MockClientePanel')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('fake-jwt');
    expect(screen.getByText('CLIENTE')).toBeInTheDocument();
  });

  test('login con credenciales inválidas muestra una alerta y no guarda token', async () => {
    api.post.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Busco estacionamiento');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await user.type(screen.getByLabelText('Email'), 'cliente@demo.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Credenciales inválidas'));
    expect(localStorage.getItem('token')).toBeNull();
    // Sigue en la pantalla de login, no navegó a ningún panel.
    expect(screen.getByRole('heading', { name: /acceso cliente \/ administrador/i })).toBeInTheDocument();
  });
});
