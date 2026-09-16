import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn() }
}));

import ClientePanel from './ClientePanel.jsx';
import { api } from './services/api.js';

const parking = [{ id: 'p1', nombre: 'Parking Centro', direccion: 'Centro', precio_hora: 1500, cupo_maximo: 10, cupos_disponibles: 5 }];
const activo = { id: 't1', codigo_qr: 'QR-1', patente: 'AB1234', fecha_entrada: new Date().toISOString(), estado: 'ACTIVO', estacionamiento_id: 'p1', estacionamiento_nombre: 'Parking Centro', precio_hora: 1500 };

// Hay dos botones "💰 Cobrar" (uno por fila de la tabla, otro para cobrar por código manual).
// Este helper espera a que la fila del ticket cargue y hace click en el de la fila, no en el
// del código manual (que estaría vacío y no haría nada).
async function clickCobrarDeLaFila(user) {
  await screen.findByText('AB1234');
  const botones = screen.getAllByRole('button', { name: /💰 cobrar/i });
  await user.click(botones[0]);
}

describe('ClientePanel — cobro sin Webpay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(url => {
      if (url === '/parking/mine') return Promise.resolve({ data: parking });
      if (url === '/tickets/active') return Promise.resolve({ data: [activo] });
      return Promise.resolve({ data: [] });
    });
  });

  test('el cobro pide elegir método (efectivo/débito/crédito) antes de mostrar el monto recibido', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/tickets/quote') {
        return Promise.resolve({ data: { monto: 3000, descuentoReserva: 0, patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', fecha_entrada: activo.fecha_entrada } });
      }
    });
    const user = userEvent.setup();
    render(<ClientePanel />);

    await clickCobrarDeLaFila(user);

    expect(await screen.findByText('Total a pagar: $3.000')).toBeInTheDocument();
    expect(screen.queryByLabelText('Monto recibido')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /💵 efectivo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /💳 débito/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /💳 crédito/i })).toBeInTheDocument();
    // No hay ningún botón de Webpay: el cobro del dueño ya no pasa por ahí.
    expect(screen.queryByText(/webpay/i)).not.toBeInTheDocument();
  });

  test('cobro con tarjeta: no pide monto recibido y cierra el ticket con el método elegido', async () => {
    api.post.mockImplementation((url, body) => {
      if (url === '/tickets/quote') {
        return Promise.resolve({ data: { monto: 3000, descuentoReserva: 0, patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', fecha_entrada: activo.fecha_entrada } });
      }
      if (url === '/tickets/close') {
        return Promise.resolve({ data: { estado: 'CERRADO', monto: 3000, codigo_qr: body.codigo_qr, metodo_pago: body.metodo_pago, patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', fecha_entrada: activo.fecha_entrada, descuentoReserva: 0 } });
      }
    });
    const user = userEvent.setup();
    render(<ClientePanel />);

    await clickCobrarDeLaFila(user);
    await screen.findByText('Total a pagar: $3.000');
    await user.click(screen.getByRole('button', { name: /💳 débito/i }));

    expect(screen.queryByLabelText('Monto recibido')).not.toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: /confirmar cobro con débito/i });
    await user.click(confirmar);

    expect(await screen.findByText(/cobro registrado \(débito\): \$3\.000/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/tickets/close', { codigo_qr: 'QR-1', metodo_pago: 'DEBITO' });
  });

  test('cobro en efectivo: exige un monto recibido suficiente antes de habilitar confirmar', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/tickets/quote') {
        return Promise.resolve({ data: { monto: 3000, descuentoReserva: 0, patente: 'AB1234', estacionamiento_nombre: 'Parking Centro', estacionamiento_direccion: 'Centro', fecha_entrada: activo.fecha_entrada } });
      }
    });
    const user = userEvent.setup();
    render(<ClientePanel />);

    await clickCobrarDeLaFila(user);
    await screen.findByText('Total a pagar: $3.000');
    await user.click(screen.getByRole('button', { name: /💵 efectivo/i }));

    const input = screen.getByLabelText('Monto recibido');
    const confirmar = screen.getByRole('button', { name: /confirmar cobro/i });
    expect(confirmar).toBeDisabled();

    await user.type(input, '2000');
    expect(confirmar).toBeDisabled();
    expect(screen.getByText(/falta: \$1\.000/i)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '5000');
    expect(confirmar).not.toBeDisabled();
    expect(screen.getByText(/vuelto: \$2\.000/i)).toBeInTheDocument();
  });
});
