import { describe, test, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComoFunciona from './ComoFunciona.jsx';

describe('Cómo funciona', () => {
  test('muestra el video con su transcripción y los cuatro pasos', () => {
    render(<ComoFunciona />);
    expect(screen.getByRole('heading', { name: 'Del destino al cupo, en cuatro pasos' })).toBeInTheDocument();
    const video = screen.getByLabelText(/video: cómo se usa la app/i);
    expect(video.querySelector('source')).toHaveAttribute('src', '/video/como-funciona.mp4');
    expect(video).toHaveAttribute('preload', 'none');
    expect(screen.getByText('Leer lo que muestra el video')).toBeInTheDocument();
    for (const paso of ['Busca', 'Compara', 'Reserva', 'Escanea tu ticket']) {
      expect(screen.getByRole('heading', { name: paso })).toBeInTheDocument();
    }
  });

  test('las instrucciones cambian según el dispositivo elegido', async () => {
    const user = userEvent.setup();
    render(<ComoFunciona />);
    // jsdom no es Android ni iPhone: parte en "Computador".
    expect(screen.getByRole('radio', { name: 'Computador' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'iPhone' }));
    expect(screen.getByRole('list', { name: /instalar en iphone con safari/i })).toHaveTextContent(/agregar a pantalla de inicio/i);
    await user.click(screen.getByRole('radio', { name: 'Android' }));
    expect(screen.getByRole('list', { name: /instalar en android con chrome/i })).toHaveTextContent(/instalar app/i);
  });

  test('si el navegador ofrece instalar, aparece el botón y abre el aviso del navegador', async () => {
    const user = userEvent.setup();
    render(<ComoFunciona />);
    expect(screen.queryByRole('button', { name: /instalar app ahora/i })).not.toBeInTheDocument();

    const evento = new Event('beforeinstallprompt');
    evento.prompt = vi.fn();
    evento.userChoice = Promise.resolve({ outcome: 'accepted' });
    act(() => { window.dispatchEvent(evento); });

    await user.click(await screen.findByRole('button', { name: /instalar app ahora/i }));
    expect(evento.prompt).toHaveBeenCalled();
    expect(await screen.findByText(/ya la tienes instalada/i)).toBeInTheDocument();
  });
});
