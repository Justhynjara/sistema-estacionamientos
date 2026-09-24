import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./services/api.js', () => ({ api: { get: vi.fn() } }));

import TicketPublico from './TicketPublico.jsx';
import { api } from './services/api.js';

const AHORA = new Date('2026-03-10T15:00:00Z').getTime();
const base = {
  codigo_qr: 'abc123', patente: 'AB1234',
  estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro de Santiago',
  precio_minuto: 20, tarifa_minima: 500, ahora: new Date(AHORA).toISOString()
};

describe('TicketPublico — lo que ve el conductor al escanear su QR', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  test('muestra el tiempo estacionado y el monto a pagar hasta ahora', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AHORA);
    api.get.mockResolvedValue({ data: { ...base, estado: 'ACTIVO', fecha_entrada: new Date(AHORA - 90 * 60000).toISOString() } });
    render(<TicketPublico codigo="abc123" onCerrar={() => {}} />);

    expect(await screen.findByLabelText('Tiempo estacionado')).toHaveTextContent('01:30:00');
    expect(screen.getByLabelText('Monto a pagar')).toHaveTextContent('$1.800');
    expect(screen.getByText(/\$20\/min · mínimo \$500/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/tickets/publico/abc123');
  });

  test('en una estadía corta explica que aún está en el valor base mínimo', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AHORA);
    api.get.mockResolvedValue({ data: { ...base, estado: 'ACTIVO', fecha_entrada: new Date(AHORA - 5 * 60000).toISOString() } });
    render(<TicketPublico codigo="abc123" onCerrar={() => {}} />);

    expect(await screen.findByLabelText('Monto a pagar')).toHaveTextContent('$500');
    expect(screen.getByText(/aún estás en el valor base mínimo/i)).toBeInTheDocument();
  });

  test('descuenta la reserva ya pagada', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AHORA);
    api.get.mockResolvedValue({ data: { ...base, estado: 'ACTIVO', descuentoReserva: 100, fecha_entrada: new Date(AHORA - 60 * 60000).toISOString() } });
    render(<TicketPublico codigo="abc123" onCerrar={() => {}} />);

    expect(await screen.findByLabelText('Monto a pagar')).toHaveTextContent('$1.100');
    expect(screen.getByText(/descuento por tu reserva ya pagada: -\$100/i)).toBeInTheDocument();
  });

  test('una reserva vigente muestra cuánto falta para que venza', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AHORA);
    api.get.mockResolvedValue({ data: { ...base, estado: 'RESERVADO', reserva_expira: new Date(AHORA + 7 * 60000).toISOString() } });
    render(<TicketPublico codigo="abc123" onCerrar={() => {}} />);

    expect(await screen.findByText(/reserva vigente: te quedan 7 min/i)).toBeInTheDocument();
  });

  test('un ticket cerrado muestra lo que se pagó', async () => {
    api.get.mockResolvedValue({ data: { ...base, estado: 'CERRADO', monto: 1800, minutos: 90, fecha_entrada: new Date(AHORA - 90 * 60000).toISOString(), fecha_salida: new Date(AHORA).toISOString() } });
    render(<TicketPublico codigo="abc123" onCerrar={() => {}} />);

    expect(await screen.findByText(/pagaste \$1\.800/i)).toBeInTheDocument();
    expect(screen.getByText(/estuviste 1 h 30 min/i)).toBeInTheDocument();
  });

  test('un código inexistente avisa que no se encontró el ticket', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    render(<TicketPublico codigo="nada" onCerrar={() => {}} />);
    expect(await screen.findByText(/no encontramos este ticket/i)).toBeInTheDocument();
  });

  test('el botón de dueño solo aparece si se le pasa la acción, y llama a iniciar sesión', async () => {
    api.get.mockResolvedValue({ data: { ...base, estado: 'ACTIVO', fecha_entrada: new Date().toISOString() } });
    const onEntrarDueno = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<TicketPublico codigo="abc123" onEntrarDueno={onEntrarDueno} onCerrar={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /soy el dueño/i }));
    expect(onEntrarDueno).toHaveBeenCalled();

    rerender(<TicketPublico codigo="abc123" onCerrar={() => {}} />);
    expect(screen.queryByRole('button', { name: /soy el dueño/i })).not.toBeInTheDocument();
  });
});
