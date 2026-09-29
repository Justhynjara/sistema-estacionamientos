import { describe, test, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./utils/geo.js', () => ({ searchAddresses: vi.fn() }));

import AddressAutocomplete from './AddressAutocomplete.jsx';
import { searchAddresses } from './utils/geo.js';

// AddressAutocomplete es un componente controlado (value/onChange los maneja quien lo usa): un
// wrapper con estado real, igual que LocationPicker o SolicitudClienteForm en la app de verdad.
function Wrapper({ onSelect }) {
  const [value, setValue] = useState('');
  return <AddressAutocomplete value={value} onChange={setValue} onSelect={onSelect} placeholder="Dirección" ariaLabel="Dirección" />;
}

describe('AddressAutocomplete — sugerencias operables con teclado', () => {
  afterEach(() => vi.clearAllMocks());

  test('cada sugerencia es un botón real: se llega con Tab y se activa con Enter, no solo con el mouse', async () => {
    searchAddresses.mockResolvedValue([
      { label: 'Av. Providencia 1234, Santiago', lat: -33.4, lng: -70.6 },
      { label: 'Av. Providencia 5678, Santiago', lat: -33.41, lng: -70.61 }
    ]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Wrapper onSelect={onSelect} />);

    await user.type(screen.getByLabelText('Dirección'), 'Av. Providencia');
    const opcion = await screen.findByRole('option', { name: /av\. providencia 1234/i });

    // Es un <button>, no un <div onClick>: por eso aparece con role="option" y puede recibir foco.
    expect(opcion.tagName).toBe('BUTTON');
    opcion.focus();
    expect(opcion).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith({ lat: -33.4, lng: -70.6 });
  });

  test('Escape cierra el panel de sugerencias', async () => {
    searchAddresses.mockResolvedValue([{ label: 'Calle Falsa 123', lat: -33, lng: -70 }]);
    const user = userEvent.setup();
    render(<Wrapper onSelect={() => {}} />);

    await user.type(screen.getByLabelText('Dirección'), 'Calle Falsa');
    await screen.findByRole('option', { name: /calle falsa/i });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
