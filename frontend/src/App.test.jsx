import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// BuscarCercanos monta un mapa Leaflet real, que no funciona bien en jsdom (mediciones de DOM
// que el navegador headless no implementa). Los paneles autenticados hacen sus propias llamadas
// de red en useEffect. Ninguno de los dos es lo que este test verifica (el shell/routing de
// App), así que se reemplazan por stubs simples.
vi.mock('./BuscarCercanos.jsx', () => ({ default: () => <div>MockBuscarCercanos</div> }));
vi.mock('./ClientePanel.jsx', () => ({ default: ({ ticketInicial }) => <div>MockClientePanel{ticketInicial ? `:${ticketInicial}` : ''}</div> }));
vi.mock('./AdminPanel.jsx', () => ({ default: () => <div>MockAdminPanel</div> }));
vi.mock('./SoportePanel.jsx', () => ({ default: () => <div>MockSoportePanel</div> }));

vi.mock('./services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn() }
}));

import App from './App.jsx';
import { api } from './services/api.js';

describe('App', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.clearAllMocks(); window.history.replaceState({}, '', '/'); });

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
  describe('enlace del QR del ticket (?ticket=...)', () => {
    const ticketActivo = { data: { estado: 'ACTIVO', codigo_qr: 'abc123', patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', precio_minuto: 20, tarifa_minima: 500, fecha_entrada: new Date().toISOString(), ahora: new Date().toISOString() } };

    test('sin sesión, el conductor ve su tiempo y monto en vez de la landing', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockResolvedValue(ticketActivo);
      render(<App />);

      expect(await screen.findByLabelText('Monto a pagar')).toBeInTheDocument();
      expect(screen.queryByText('Busco estacionamiento')).not.toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/tickets/publico/abc123');
    });

    test('desde esa vista, "Soy el dueño" lleva al login', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockResolvedValue(ticketActivo);
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole('button', { name: /soy el dueño/i }));
      expect(screen.getByRole('heading', { name: /acceso cliente \/ administrador/i })).toBeInTheDocument();
    });

    test('un dueño con sesión iniciada va directo a su panel de cobro con ese código', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      localStorage.setItem('token', 'fake-jwt');
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: { id: '1', nombre: 'Cliente Demo', email: 'cliente@demo.cl', rol: 'CLIENTE' } })
        : Promise.resolve(ticketActivo)));
      render(<App />);

      expect(await screen.findByText('MockClientePanel:abc123')).toBeInTheDocument();
      expect(screen.queryByLabelText('Monto a pagar')).not.toBeInTheDocument();
    });

    test('un admin con sesión que abre el enlace ve la vista pública, no el panel de cobro', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      localStorage.setItem('token', 'fake-jwt');
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: { id: '2', nombre: 'Admin', email: 'admin@demo.cl', rol: 'ADMIN' } })
        : Promise.resolve(ticketActivo)));
      render(<App />);

      expect(await screen.findByLabelText('Monto a pagar')).toBeInTheDocument();
      expect(screen.queryByText('MockAdminPanel')).not.toBeInTheDocument();
    });
  });
});
