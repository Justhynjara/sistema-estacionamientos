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
// La cámara no existe en jsdom: el lector se reemplaza por un botón que "lee" el texto que el test
// deja en globalThis.__qrLeido.
vi.mock('./QRScanner.jsx', () => ({ default: ({ onResult }) => <button type="button" onClick={() => onResult(globalThis.__qrLeido)}>SimularLectura</button> }));

vi.mock('./services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  guardarSesionNativa: vi.fn()
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

  test('sin sesión, muestra la búsqueda y, aparte, el acceso para dueños y administradores', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Encuentra estacionamiento cerca de tu destino' })).toBeInTheDocument();
    expect(screen.getByText('MockBuscarCercanos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acceso dueños/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Administras un estacionamiento?' })).toBeInTheDocument();
  });


  test('el acceso de dueño/admin lleva al formulario de login', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('MockBuscarCercanos');

    await user.click(screen.getByRole('button', { name: /acceso dueños/i }));

    expect(screen.getByRole('heading', { name: /acceso cliente \/ administrador/i })).toBeInTheDocument();
  });

  test('login exitoso muestra el panel según el rol (la sesión queda en una cookie, no en localStorage)', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 'fake-jwt', user: { id: '1', nombre: 'Cliente Demo', email: 'cliente@demo.cl', rol: 'CLIENTE' } }
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('MockBuscarCercanos');
    await user.click(screen.getByRole('button', { name: /acceso dueños/i }));

    await user.type(screen.getByLabelText('Email'), 'cliente@demo.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('MockClientePanel')).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull(); // ya no se guarda nada ahí
  });

  test('login con credenciales inválidas muestra una alerta y no navega a ningún panel', async () => {
    api.post.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('MockBuscarCercanos');
    await user.click(screen.getByRole('button', { name: /acceso dueños/i }));

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
    await screen.findByText('MockBuscarCercanos');
    await user.click(screen.getByRole('button', { name: /acceso dueños/i }));
    await user.type(screen.getByLabelText('Email'), 'cliente@demo.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await screen.findByText('MockClientePanel');

    await user.click(screen.getByRole('button', { name: 'Salir' }));

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(await screen.findByText('MockBuscarCercanos')).toBeInTheDocument();
  });

  describe('enlace del QR del ticket (?ticket=...)', () => {
    const ticketActivo = { data: { estado: 'ACTIVO', codigo_qr: 'abc123', patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', precio_minuto: 20, tarifa_minima: 500, fecha_entrada: new Date().toISOString(), ahora: new Date().toISOString() } };

    test('sin sesión, el conductor ve su tiempo y monto en vez de la landing', async () => {
      window.history.replaceState({}, '', '/?ticket=abc123');
      api.get.mockImplementation(url => (url === '/auth/me' ? Promise.reject(SIN_SESION) : Promise.resolve(ticketActivo)));
      render(<App />);

      expect(await screen.findByLabelText('Monto a pagar')).toBeInTheDocument();
      expect(screen.queryByText('MockBuscarCercanos')).not.toBeInTheDocument();
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

  describe('cambio de contraseña obligatorio al primer ingreso', () => {
    const usuarioMarcado = { id: '9', nombre: 'Nuevo Dueño', email: 'nuevo@demo.cl', rol: 'CLIENTE', debeCambiarPassword: true };

    test('un usuario marcado ve la pantalla obligatoria, no su panel', async () => {
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: usuarioMarcado })
        : Promise.resolve({ data: [] })));
      render(<App />);

      expect(await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })).toBeInTheDocument();
      expect(screen.queryByText('MockClientePanel')).not.toBeInTheDocument();
    });

    test('tras login, si la respuesta marca el cambio, va a la pantalla obligatoria', async () => {
      api.post.mockResolvedValueOnce({
        data: { token: 'fake-jwt', user: { id: '9', nombre: 'Nuevo Dueño', email: 'nuevo@demo.cl', rol: 'CLIENTE' }, debeCambiarPassword: true }
      });
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText('MockBuscarCercanos');
      await user.click(screen.getByRole('button', { name: /acceso dueños/i }));
      await user.type(screen.getByLabelText('Email'), 'nuevo@demo.cl');
      await user.type(screen.getByLabelText('Contraseña'), 'claveTemporal1');
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

      expect(await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })).toBeInTheDocument();
      expect(screen.queryByText('MockClientePanel')).not.toBeInTheDocument();
    });

    test('completar el cambio llama a /auth/change-password y desbloquea el panel', async () => {
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: usuarioMarcado })
        : Promise.resolve({ data: [] })));
      api.post.mockResolvedValue({ data: { mensaje: 'Contraseña actualizada correctamente' } });
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('heading', { name: /crea tu nueva contraseña/i });

      await user.type(screen.getByLabelText('Contraseña actual'), 'claveTemporal1');
      await user.type(screen.getByLabelText('Nueva contraseña'), 'miClaveNueva9');
      await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'miClaveNueva9');
      await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));

      expect(await screen.findByText('MockClientePanel')).toBeInTheDocument();
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', { passwordActual: 'claveTemporal1', passwordNueva: 'miClaveNueva9' });
    });

    test('si la confirmación no coincide, avisa y no llama a la API', async () => {
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: usuarioMarcado })
        : Promise.resolve({ data: [] })));
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('heading', { name: /crea tu nueva contraseña/i });

      await user.type(screen.getByLabelText('Contraseña actual'), 'claveTemporal1');
      await user.type(screen.getByLabelText('Nueva contraseña'), 'miClaveNueva9');
      await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'otraDistinta9');
      await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));

      expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalledWith('/auth/change-password', expect.anything());
    });
  });

  describe('páginas legales (?legal=...)', () => {
    test('la landing enlaza a las tres páginas legales desde el pie de página', async () => {
      render(<App />);
      await screen.findByText('MockBuscarCercanos');

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
      expect(screen.queryByText('MockBuscarCercanos')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /volver/i }));
      expect(await screen.findByText('MockBuscarCercanos')).toBeInTheDocument();
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
    await screen.findByText('MockBuscarCercanos');

    expect(screen.getByText(/usamos una sola cookie/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/usamos una sola cookie/i)).not.toBeInTheDocument();

    // Simula recargar la página: como ya se cerró antes, no debe volver a mostrarse.
    const { unmount } = render(<App />);
    await screen.findAllByText('MockBuscarCercanos');
    expect(screen.queryByText(/usamos una sola cookie/i)).not.toBeInTheDocument();
    unmount();
  });

  test('al volver de Webpay sin cupo y con el cobro anulado, avisa claramente que no se cobró nada', async () => {
    window.history.replaceState({}, '', '/?pago=reembolsado&monto=100');
    render(<App />);
    expect(await screen.findByRole('button', { name: /anulamos el cobro de \$100 en webpay, así que no se te cobrará nada/i })).toBeInTheDocument();
  });

  test('si la anulación quedó pendiente, muestra a quién escribir y la orden de compra', async () => {
    window.history.replaceState({}, '', '/?pago=sin_cupo&monto=100&orden=RABC123');
    render(<App />);
    const aviso = await screen.findByRole('button', { name: /todavía no logramos anular el cobro/i });
    expect(aviso).toHaveTextContent('orden de compra RABC123');
    expect(aviso).toHaveTextContent('@');
  });

  describe('botón de cámara para escanear el QR del ticket', () => {
    const CODIGO = '3f2b8c1e-9a4d-4c6b-8e2f-1a2b3c4d5e6f';

    test('sin sesión: leer el QR muestra la vista pública del ticket (tiempo y monto)', async () => {
      const ticket = {
        estado: 'ACTIVO', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', patente: 'AB1234',
        fecha_entrada: new Date(Date.now() - 30 * 60000).toISOString(), precio_minuto: 20, tarifa_minima: 0, ahora: new Date().toISOString()
      };
      api.get.mockImplementation(url => (url === '/auth/me' ? Promise.reject(SIN_SESION)
        : url === `/tickets/publico/${CODIGO}` ? Promise.resolve({ data: ticket }) : Promise.resolve({ data: [] })));
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: /escanear mi ticket/i }));
      globalThis.__qrLeido = `https://estacionamientos-web.onrender.com/?ticket=${CODIGO}`;
      await user.click(screen.getByRole('button', { name: 'SimularLectura' }));

      expect(await screen.findByRole('article', { name: 'Tu ticket de estacionamiento' })).toBeInTheDocument();
      expect(await screen.findByLabelText('Tiempo estacionado')).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith(`/tickets/publico/${CODIGO}`);
      expect(new URL(window.location.href).searchParams.get('ticket')).toBe(CODIGO);
    });

    test('un QR que no es de un ticket se rechaza y la cámara sigue abierta', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: /escanear mi ticket/i }));
      globalThis.__qrLeido = 'https://restaurante.example/menu';
      await user.click(screen.getByRole('button', { name: 'SimularLectura' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/no es un ticket de este sistema/i);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: 'Tu ticket de estacionamiento' })).not.toBeInTheDocument();
    });

    test('un dueño con sesión que escanea va directo al cobro de ese ticket', async () => {
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: { id: 'd1', nombre: 'Dueño', email: 'd@x.cl', rol: 'CLIENTE' } })
        : Promise.resolve({ data: [] })));
      const user = userEvent.setup();
      render(<App />);
      await user.click(await screen.findByRole('button', { name: /escanear para cobrar/i }));
      globalThis.__qrLeido = CODIGO;
      await user.click(screen.getByRole('button', { name: 'SimularLectura' }));

      expect(await screen.findByText(`MockClientePanel:${CODIGO}`)).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: 'Tu ticket de estacionamiento' })).not.toBeInTheDocument();
    });

    test('administración y soporte no tienen el botón de cámara', async () => {
      api.get.mockImplementation(url => (url === '/auth/me'
        ? Promise.resolve({ data: { id: 'a1', nombre: 'Admin', email: 'a@x.cl', rol: 'ADMIN' } })
        : Promise.resolve({ data: [] })));
      render(<App />);
      await screen.findByText('MockAdminPanel');
      expect(screen.queryByRole('button', { name: /escanear/i })).not.toBeInTheDocument();
    });
  });
});
