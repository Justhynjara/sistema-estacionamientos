import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatBot from './ChatBot.jsx';

describe('ChatBot', () => {
  test('el panel está cerrado por defecto y se abre al presionar el botón flotante', async () => {
    const user = userEvent.setup();
    render(<ChatBot onAbrirSolicitud={() => {}} />);

    expect(screen.queryByText(/asistente/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));

    expect(screen.getByText('🤖 Asistente')).toBeInTheDocument();
  });

  test('responde con la FAQ correcta al hacer click en una sugerencia', async () => {
    const user = userEvent.setup();
    render(<ChatBot onAbrirSolicitud={() => {}} />);
    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));

    await user.click(screen.getByRole('button', { name: /cómo reservo un cupo/i }));

    expect(screen.getByText(/micropago de \$100 clp/i)).toBeInTheDocument();
  });

  test('responde con un fallback cuando la pregunta no coincide con ninguna FAQ', async () => {
    const user = userEvent.setup();
    render(<ChatBot onAbrirSolicitud={() => {}} />);
    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));

    await user.type(screen.getByLabelText(/escribe tu pregunta/i), 'asdkjhaskjdh sin sentido');
    await user.click(screen.getByRole('button', { name: /^enviar$/i }));

    expect(screen.getByText(/no tengo una respuesta exacta/i)).toBeInTheDocument();
  });

  test('el botón "¿Quieres ser cliente?" muestra la acción para abrir la solicitud y la dispara al hacer click', async () => {
    const user = userEvent.setup();
    const onAbrirSolicitud = vi.fn();
    render(<ChatBot onAbrirSolicitud={onAbrirSolicitud} />);
    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));

    await user.click(screen.getByRole('button', { name: /¿quieres ser cliente\?/i }));

    const completarBtn = screen.getByRole('button', { name: /completar solicitud/i });
    expect(completarBtn).toBeInTheDocument();

    await user.click(completarBtn);
    expect(onAbrirSolicitud).toHaveBeenCalledTimes(1);
  });
});
