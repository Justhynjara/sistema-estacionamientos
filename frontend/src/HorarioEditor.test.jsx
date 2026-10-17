import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HorarioEditor from './HorarioEditor.jsx';
import { textoEstado, resumenHorario } from './utils/horario.js';

const turno = (abre, cierra) => ({ abre, cierra });

describe('textos del horario', () => {
  test('arma la frase según cuándo cambia el estado', () => {
    expect(textoEstado({ abierto: true, siempre: true })).toEqual({ abierto: true, etiqueta: 'Abierto', detalle: 'las 24 horas' });
    expect(textoEstado({ abierto: true, cambio: { tipo: 'cierra', hora: '20:00', en_dias: 0, dia_semana: 3 } }).detalle).toBe('cierra a las 20:00');
    expect(textoEstado({ abierto: false, cambio: { tipo: 'abre', hora: '08:00', en_dias: 1, dia_semana: 4 } }).detalle).toBe('abre mañana a las 08:00');
    expect(textoEstado({ abierto: false, cambio: { tipo: 'abre', hora: '08:00', en_dias: 3, dia_semana: 1 } }).detalle).toBe('abre el lunes a las 08:00');
    expect(textoEstado({ abierto: true, cambio: { tipo: 'cierra', hora: '00:00', en_dias: 1, dia_semana: 4 } }).detalle).toBe('cierra a medianoche');
    expect(textoEstado({ abierto: false, cambio: null })).toEqual({ abierto: false, etiqueta: 'Cerrado', detalle: 'sin horario de atención' });
  });

  test('resume la semana agrupando días seguidos iguales', () => {
    const lunAVie = [null, ...Array(5).fill(turno('08:00', '20:00')), turno('09:00', '14:00')];
    expect(resumenHorario(lunAVie)).toBe('Lun–Vie 08:00–20:00 · Sáb 09:00–14:00 · Dom cerrado');
    expect(resumenHorario(null)).toBe('Abierto las 24 horas, todos los días');
    expect(resumenHorario(Array(7).fill(null))).toBe('Cerrado todos los días');
  });
});

describe('editor de horario', () => {
  test('guarda el formato de la API: domingo cerrado y el resto con horario', async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(<HorarioEditor nombre="Parking Centro" horario={null} onGuardar={onGuardar} onCancelar={() => {}} />);

    await user.selectOptions(screen.getByLabelText('Lunes: tipo de horario'), 'turno');
    await user.click(screen.getAllByRole('button', { name: 'Usar en todos los días' })[0]);
    await user.selectOptions(screen.getByLabelText('Domingo: tipo de horario'), 'cerrado');
    await user.click(screen.getByRole('button', { name: /guardar horario/i }));

    const [horario] = onGuardar.mock.calls[0];
    expect(horario[0]).toBeNull();
    expect(horario.slice(1)).toEqual(Array(6).fill(turno('08:00', '20:00')));
  });

  test('los 7 días abiertos las 24 horas se guardan como "sin horario" (null)', async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(<HorarioEditor nombre="Parking Centro" horario={Array(7).fill(turno('08:00', '20:00'))} onGuardar={onGuardar} onCancelar={() => {}} />);
    await user.selectOptions(screen.getByLabelText('Lunes: tipo de horario'), '24h');
    await user.click(screen.getAllByRole('button', { name: 'Usar en todos los días' })[0]);
    await user.click(screen.getByRole('button', { name: /guardar horario/i }));
    expect(onGuardar).toHaveBeenCalledWith(null);
  });

  test('muestra el error del servidor si no se pudo guardar', async () => {
    const onGuardar = vi.fn().mockRejectedValue({ response: { data: { error: 'No encontrado' } } });
    const user = userEvent.setup();
    render(<HorarioEditor nombre="Parking Centro" horario={null} onGuardar={onGuardar} onCancelar={() => {}} />);
    await user.click(screen.getByRole('button', { name: /guardar horario/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontrado');
  });
});
