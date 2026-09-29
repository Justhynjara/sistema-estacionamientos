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

const SIN_SESION = { response: { status: 401 } };

describe('App', () => {
  beforeEach(() => {
    localStorage.clear(); // aviso de cookies visto, etc. — no debe filtrarse entre tests
    // La sesión ya no vive en localStorage: se restaura preguntándole al servidor (GET /auth/me),
    // que el componente llama siempre al montar. Por defecto, sin sesión (401); cada test que
    // necesite otra cosa (una sesión ya iniciada, la vista pública del ticket) sobrescribe esto.
    api.get.mockImplementation(url => (url === '/auth/me' ? Promise.reject(SIN_SESION) : Promise.resolve({ data: [] })));
  });
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

  test('login exitoso muestra el panel según el rol (la sesión queda en una cookie, no en localStorage)', async () => {
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
    expect(screen.getByText('CLIENTE')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull(); // ya no se guarda nada ahí
  });

  test('login con credenciales inválidas muestra una alerta y no navega a ningún panel', async () => {
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
    // Sigue en la pantalla de login, no navegó a ningún panel.
    expect(screen.getByRole('heading', { name: /acceso cliente \/ administrador/i })).toBeInTheDocument();
  });

  test('"Salir" llama a /auth/logout (borra la cookie del lado del servidor) y vuelve a la landing', async () => {
    api.post.mockImplementation(url => (url === '/auth/login'
      ? Promise.resolve({ data: { token: 'fake-jwt', user: { id: '1', nombre: 'Cliente Demo', email: 'cliente@demo.cl', rol: 'CLIENTE' } } })
      : Promise.resolve({ data: { ok: true } })));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Busco estacionamiento');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await user.type(screen.getByLabelText('Email'), 'cliente@demo.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await screen.findByText('MockClientePanel');

    await user.click(screen.getByRole('button', { name: 'Salir' }));

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(await screen.findByText('Busco estacionamiento')).toBeInTheDocument();
  });

  describe('enlace del QR del ticket (?ticket=...)', () => {
    const ticketActivo = { data: { estado: 'ACTIVO', codigo_qr: 'abc123', patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', precio_minuto: 20, tarifa_minima: 500, fecha_entrada: new Date().toISOString(), ahora: new Date().toISOString() } };

    test('sin sesión, el conductor ve su tiempo y monto en vez de la landing', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockImplementation(url => (url === '/auth/me' ? Promise.reject(SIN_SESION) : Promise.resolve(ticketActivo)));
      render(<App />);

      expect(await screen.findByLabelText('Monto a pagar')).toBeInTheDocument();
      expect(screen.queryByText('Busco estacionamiento')).not.toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/tickets/publico/abc123');
    });

    test('desde esa vista, "Soy el dueño" lleva al login', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockImplementation(url => (url === '/auth/me' ? Promise.reject(SIN_SESION) : Promise.resolve(ticketActivo)));
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole('button', { name: /soy el dueño/i }));
      expect(screen.getByRole('heading', { name: /acceso cliente \/ administrador/i })).toBeInTheDocument();
    });

    test('un dueño con sesión iniciada va directo a su panel de cobro con ese código', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: { id: '1', nombre: 'Cliente Demo', email: 'cliente@demo.cl', rol: 'CLIENTE' } })
        : Promise.resolve(ticketActivo)));
      render(<App />);

      expect(await screen.findByText('MockClientePanel:abc123')).toBeInTheDocument();
      expect(screen.queryByLabelText('Monto a pagar')).not.toBeInTheDocument();
    });

    test('un admin con sesión que abre el enlace ve la vista pública, no el panel de cobro', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: { id: '2', nombre: 'Admin', email: 'admin@demo.cl', rol: 'ADMIN' } })
        : Promise.resolve(ticketActivo)));
      render(<App />);

      expect(await screen.findByLabelText('Monto a pagar')).toBeInTheDocument();
      expect(screen.queryByText('MockAdminPanel')).not.toBeInTheDocument();
    });
  });

  describe('páginas legales (?legal=...)', () => {
    test('la landing enlaza a las tres páginas legales desde el pie de página', async () => {
      render(<App />);
      await screen.findByText('Busco estacionamiento');

      expect(screen.getByRole('link', { name: 'Política de Privacidad' })).toHaveAttribute('href', '/?legal=privacidad');
      expect(screen.getByRole('link', { name: 'Términos y Condiciones' })).toHaveAttribute('href', '/?legal=terminos');
      expect(screen.getByRole('link', { name: 'Política de Cookies' })).toHaveAttribute('href', '/?legal=cookies');
    });

    test('abrir con ?legal=privacidad muestra la política de privacidad, y "Volver" regresa a la landing', async () => {
      window.history.replaceState({}, '', '/?legal=privacidad');
      const user = userEvent.setup();
      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Política de Privacidad' })).toBeInTheDocument();
      // Mientras se muestra la página legal, no se ve la landing por debajo.
      expect(screen.queryByText('Busco estacionamiento')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /volver/i }));
      expect(await screen.findByText('Busco estacionamiento')).toBeInTheDocument();
    });

    test('?legal=terminos y ?legal=cookies muestran su propio contenido', async () => {
      window.history.replaceState({}, '', '/?legal=terminos');
      const { unmount } = render(<App />);
      expect(await screen.findByRole('heading', { name: 'Términos y Condiciones' })).toBeInTheDocument();
      unmount();

      window.history.replaceState({}, '', '/?legal=cookies');
      render(<App />);
      expect(await screen.findByRole('heading', { name: 'Política de Cookies' })).toBeInTheDocument();
    });
  });

  test('el aviso de cookies se puede cerrar y no vuelve a aparecer en este navegador', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Busco estacionamiento');

    expect(screen.getByText(/usamos una sola cookie/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/usamos una sola cookie/i)).not.toBeInTheDocument();

    // Simula recargar la página: como ya se cerró antes, no debe volver a mostrarse.
    const { unmount } = render(<App />);
    await screen.findAllByText('Busco estacionamiento');
    expect(screen.queryByText(/usamos una sola cookie/i)).not.toBeInTheDocument();
    unmount();
  });
});
