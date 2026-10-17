import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TarifasHorarioEditor from './TarifasHorarioEditor.jsx';
import Tarifa from './Tarifa.jsx';

describe('editor de tarifa por horario', () => {
  test('agrega un tramo nocturno y lo guarda en el formato de la API', async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(<TarifasHorarioEditor nombre="Parking Centro" precioBase={20} tarifas={null} onGuardar={onGuardar} onCancelar={() => {}} />);

    expect(screen.getByText(/sin tramos: se cobra \$20\/min a toda hora/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /agregar tramo/i }));
    await user.type(screen.getByLabelText('Tramo 1: precio por minuto en pesos'), '10');
    await user.click(screen.getByRole('button', { name: /guardar tarifa por horario/i }));

    expect(onGuardar).toHaveBeenCalledWith([{ desde: '20:00', hasta: '08:00', precio_minuto: 10 }]);
  });

  test('"hasta 00:00" se guarda como fin del día y 00:00 a 00:00 es el día completo', async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(<TarifasHorarioEditor nombre="P" precioBase={20} tarifas={[{ desde: '00:00', hasta: '24:00', precio_minuto: 5 }]} onGuardar={onGuardar} onCancelar={() => {}} />);
    expect(screen.getByLabelText('Tramo 1: hasta')).toHaveValue('00:00');
    await user.click(screen.getByRole('button', { name: /guardar tarifa por horario/i }));
    expect(onGuardar).toHaveBeenCalledWith([{ desde: '00:00', hasta: '24:00', precio_minuto: 5 }]);
  });

  test('quitar todos los tramos guarda null y un error del servidor se muestra', async () => {
    const onGuardar = vi.fn().mockRejectedValueOnce({ response: { data: { detalles: [{ mensaje: 'Los tramos no pueden solaparse' }] } } }).mockResolvedValue();
    const user = userEvent.setup();
    render(<TarifasHorarioEditor nombre="P" precioBase={20} tarifas={[{ desde: '20:00', hasta: '08:00', precio_minuto: 10 }]} onGuardar={onGuardar} onCancelar={() => {}} />);
    await user.click(screen.getByRole('button', { name: /guardar tarifa por horario/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Los tramos no pueden solaparse');
    await user.click(screen.getByRole('button', { name: 'Quitar' }));
    await user.click(screen.getByRole('button', { name: /guardar tarifa por horario/i }));
    expect(onGuardar).toHaveBeenLastCalledWith(null);
  });

  test('la tarifa mostrada al conductor incluye los tramos', () => {
    render(<Tarifa precio_minuto={20} tarifa_minima={500} tarifas_horario={[{ desde: '20:00', hasta: '08:00', precio_minuto: 10 }]} />);
    expect(screen.getByText(/20:00–08:00/)).toHaveTextContent('· 20:00–08:00 $10/min');
  });
});
