import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Estadisticas from './Estadisticas.jsx';
import { api } from './services/api.js';

vi.mock('./services/api.js', () => ({
  api: { get: vi.fn() }
}));

const dia = (fecha, dia_semana, cobrado, vehiculos) => ({ fecha, dia_semana, cobrado, cobros: cobrado ? 1 : 0, vehiculos });
const datos = {
  dias: 7, desde: '2026-10-11', hasta: '2026-10-17',
  porDia: [
    dia('2026-10-11', 7, 0, 0), dia('2026-10-12', 1, 3000, 2), dia('2026-10-13', 2, 0, 0), dia('2026-10-14', 3, 9000, 5),
    dia('2026-10-15', 4, 0, 0), dia('2026-10-16', 5, 3000, 1), dia('2026-10-17', 6, 0, 0)
  ],
  total: { cobrado: 15000, cobros: 3, vehiculos: 8, ticketPromedio: 5000, permanenciaPromedioMin: 95 },
  anterior: { cobrado: 12000, vehiculos: 10 },
  ocupacionPromedio: 12.5,
  horaPico: { hora: 18, entradas: 4 },
  diaPico: { dia_semana: 3, entradas: 5 }
};

describe('Estadisticas', () => {
  beforeEach(() => { api.get.mockReset(); });

  test('muestra totales, la variación con el período anterior y el mayor movimiento', async () => {
    api.get.mockResolvedValue({ data: datos });
    render(<Estadisticas estacionamientoId="" dias={7} />);

    expect(await screen.findByText('$15.000')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/tickets/estadisticas', { params: { estacionamiento_id: undefined, dias: 7 } });
    expect(screen.getByText('+25 % vs. período anterior')).toBeInTheDocument();
    expect(screen.getByText('−20 % vs. período anterior')).toBeInTheDocument();
    expect(screen.getByText('12,5 %')).toBeInTheDocument();
    expect(screen.getByText('18:00–19:00')).toBeInTheDocument();
    expect(screen.getByText(/el día más activo es el miércoles/)).toBeInTheDocument();
    // El gráfico se describe en texto para lectores de pantalla.
    expect(screen.getByRole('img', { name: /el día con más cobros fue el mié 14, con \$9\.000/i })).toBeInTheDocument();
  });

  test('sin cobros muestra un estado vacío en lugar del gráfico', async () => {
    api.get.mockResolvedValue({ data: { ...datos, porDia: datos.porDia.map(d => ({ ...d, cobrado: 0 })), total: { ...datos.total, cobrado: 0, ticketPromedio: null } } });
    render(<Estadisticas estacionamientoId="" dias={7} />);
    expect(await screen.findByText(/sin cobros en estos 7 días/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('si falla la carga, avisa y permite reintentar', async () => {
    api.get.mockImplementation(() => Promise.reject({ response: { data: { error: 'Servidor no disponible' } } }));
    render(<Estadisticas estacionamientoId="" dias={30} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor no disponible');
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
