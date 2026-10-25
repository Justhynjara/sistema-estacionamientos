import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}));

import AdminPanel from './AdminPanel.jsx';
import { api } from './services/api.js';

const users = [
  { id: '1', nombre: 'Alfredo', email: 'alfredo@x.cl', rol: 'USUARIO', activo: false },
  { id: '2', nombre: 'Manuel', email: 'manuel@x.cl', rol: 'CLIENTE', activo: true },
  { id: '3', nombre: 'QA Control', email: 'qa@x.cl', rol: 'ADMIN', activo: true },
  { id: 'me', nombre: 'justhyn', email: 'just@x.cl', rol: 'ADMIN', activo: true }
];
const parking = [
  { id: 'p1', nombre: 'Estacionamiento Centro', direccion: 'Centro 1', cupo_maximo: 5, cupos_disponibles: 5, precio_minuto: 10, tarifa_minima: 100, cliente_id: '2', horario: null, tarifas_horario: null, total_tickets: 0, tickets_activos: 0 },
  { id: 'p2', nombre: 'Estacionamiento Con Historial', direccion: 'Sur 2', cupo_maximo: 8, cupos_disponibles: 8, precio_minuto: 15, tarifa_minima: 200, cliente_id: '2', horario: null, tarifas_horario: null, total_tickets: 3, tickets_activos: 1 }
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(url => {
    if (url === '/admin/users') return Promise.resolve({ data: users });
    if (url === '/admin/parking') return Promise.resolve({ data: parking });
    if (url === '/admin/params') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  api.delete.mockResolvedValue({ data: { ok: true } });
});
afterEach(() => vi.restoreAllMocks());

describe('AdminPanel — filtro de usuarios', () => {
  test('busca por nombre/email y filtra por rol y estado, con contador', async () => {
    const user = userEvent.setup();
    render(<AdminPanel user={{ id: 'me' }} />);

    // Parte mostrando los 4 usuarios.
    expect(await screen.findByText('Alfredo')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 4 de 4');

    // Buscar "manuel" deja solo esa fila.
    await user.type(screen.getByLabelText('Buscar usuarios'), 'manuel');
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 1 de 4');
    expect(screen.getByText('Manuel')).toBeInTheDocument();
    expect(screen.queryByText('Alfredo')).not.toBeInTheDocument();

    // Limpiar y filtrar por estado Inactivo deja solo a Alfredo.
    await user.clear(screen.getByLabelText('Buscar usuarios'));
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'INACTIVO');
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 1 de 4');
    expect(screen.getByText('Alfredo')).toBeInTheDocument();
    expect(screen.queryByText('Manuel')).not.toBeInTheDocument();

    // Filtrar por rol CLIENTE (con estado de nuevo en Todos) deja solo a Manuel.
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'TODOS');
    await user.selectOptions(screen.getByLabelText('Filtrar por rol'), 'CLIENTE');
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 1 de 4');
    expect(screen.getByText('Manuel')).toBeInTheDocument();
    expect(screen.queryByText('QA Control')).not.toBeInTheDocument();
  });

  test('un filtro sin coincidencias muestra el mensaje vacío', async () => {
    const user = userEvent.setup();
    render(<AdminPanel user={{ id: 'me' }} />);
    await screen.findByText('Alfredo');
    await user.type(screen.getByLabelText('Buscar usuarios'), 'zzzzz');
    expect(screen.getByText(/Ningún usuario coincide/)).toBeInTheDocument();
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 0 de 4');
  });
});

describe('AdminPanel — eliminar estacionamiento', () => {
  test('elimina uno sin movimientos tras confirmar; el que tiene tickets queda deshabilitado', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<AdminPanel user={{ id: 'me' }} />);

    await user.click(await screen.findByRole('tab', { name: /estacionamientos/i }));
    expect(await screen.findByText('Estacionamiento Centro')).toBeInTheDocument();

    // El que tiene historial no se puede eliminar: botón deshabilitado.
    const eliminarHistorial = screen.getByRole('button', { name: /eliminar estacionamiento con historial/i });
    expect(eliminarHistorial).toBeDisabled();

    // El que no tiene movimientos sí: click → confirm → DELETE al endpoint correcto.
    await user.click(screen.getByRole('button', { name: /eliminar estacionamiento centro/i }));
    expect(window.confirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/admin/parking/p1');
  });

  test('si se cancela la confirmación no se llama al backend', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<AdminPanel user={{ id: 'me' }} />);

    await user.click(await screen.findByRole('tab', { name: /estacionamientos/i }));
    await screen.findByText('Estacionamiento Centro');
    await user.click(screen.getByRole('button', { name: /eliminar estacionamiento centro/i }));
    expect(api.delete).not.toHaveBeenCalled();
  });
});
