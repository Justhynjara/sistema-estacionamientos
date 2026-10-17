import { useState } from 'react';
import Icon from './Icon.jsx';
import { formatCLP } from './utils/tarifa.js';

const MAX_TRAMOS = 4;
const NUEVO = { desde: '20:00', hasta: '08:00', precio_minuto: '' };

// Editor de la tarifa por horario: hasta 4 tramos del día con otro precio por minuto. onGuardar
// recibe la lista en el formato de la API (o null si no queda ninguno) y devuelve una promesa; si
// falla, el mensaje del servidor (p. ej. tramos solapados) se muestra aquí mismo.
export default function TarifasHorarioEditor({ nombre, precioBase, tarifas, onGuardar, onCancelar }) {
  const [tramos, setTramos] = useState(() => (tarifas || []).map(t => ({ ...t, hasta: t.hasta === '24:00' ? '00:00' : t.hasta, precio_minuto: String(t.precio_minuto) })));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiar = (i, cambios) => setTramos(ts => ts.map((t, j) => (j === i ? { ...t, ...cambios } : t)));
  const quitar = i => setTramos(ts => ts.filter((_, j) => j !== i));

  async function guardar(e) {
    e.preventDefault();
    // En el selector de hora no existe "24:00": terminar a las 00:00 es terminar a medianoche, y
    // de 00:00 a 00:00 es el día completo.
    const lista = tramos.map(t => ({
      desde: t.desde,
      hasta: t.desde === '00:00' && t.hasta === '00:00' ? '24:00' : t.hasta,
      precio_minuto: Number(t.precio_minuto)
    }));
    if (lista.some(t => t.desde === t.hasta)) { setError('Cada tramo debe empezar y terminar a horas distintas.'); return; }
    setGuardando(true); setError('');
    try { await onGuardar(lista.length ? lista : null); }
    catch (err) { setError(err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.error || 'No se pudo guardar la tarifa por horario'); setGuardando(false); }
  }

  return (
    <form className="horario-editor" onSubmit={guardar} aria-label={`Tarifa por horario de ${nombre}`}>
      <p className="muted small" style={{ margin: 0 }}>
        Hora de Chile, todos los días. Cada minuto se cobra al precio del tramo en que empieza; fuera de los tramos
        rige el precio base de {formatCLP(precioBase)}/min. Si el tramo termina antes de empezar, cruza la medianoche
        (por ejemplo, 20:00 a 08:00 para una tarifa nocturna). El valor base mínimo se sigue aplicando.
      </p>
      {tramos.length === 0 && <p className="small" style={{ margin: 0 }}>Sin tramos: se cobra {formatCLP(precioBase)}/min a toda hora.</p>}
      <div className="horario-dias">
        {tramos.map((t, i) => (
          <fieldset className="horario-dia" key={i}>
            <legend>Tramo {i + 1}</legend>
            <span className="horario-horas">
              <input type="time" value={t.desde} onChange={e => cambiar(i, { desde: e.target.value })} aria-label={`Tramo ${i + 1}: desde`} required />
              <span aria-hidden="true">a</span>
              <input type="time" value={t.hasta} onChange={e => cambiar(i, { hasta: e.target.value })} aria-label={`Tramo ${i + 1}: hasta`} required />
            </span>
            <span className="horario-horas">
              <span aria-hidden="true">$</span>
              <input
                type="number" min="0" max="100000" step="any" inputMode="decimal" required
                value={t.precio_minuto} onChange={e => cambiar(i, { precio_minuto: e.target.value })}
                aria-label={`Tramo ${i + 1}: precio por minuto en pesos`} style={{ width: '7em' }}
              />
              <span aria-hidden="true">/min</span>
            </span>
            <button type="button" className="link-button small" onClick={() => quitar(i)}>Quitar</button>
          </fieldset>
        ))}
      </div>
      {tramos.length < MAX_TRAMOS && (
        <button type="button" className="secondary small" style={{ justifySelf: 'start' }} onClick={() => setTramos(ts => [...ts, { ...NUEVO }])}>
          <Icon name="plus" size={16} />Agregar tramo
        </button>
      )}
      {error && <p className="badge off" role="alert">{error}</p>}
      <div className="row-form">
        <button disabled={guardando}>{guardando ? <span className="spinner" /> : <Icon name="checkCircle" size={16} />}Guardar tarifa por horario</button>
        <button type="button" className="secondary" onClick={onCancelar} disabled={guardando}>Cancelar</button>
      </div>
    </form>
  );
}
