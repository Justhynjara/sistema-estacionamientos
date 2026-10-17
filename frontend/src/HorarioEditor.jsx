import { useState } from 'react';
import Icon from './Icon.jsx';
import { DIAS, ORDEN_SEMANA } from './utils/horario.js';

const TODO_EL_DIA = { abre: '00:00', cierra: '24:00' };

// Pasa del formato guardado (null o 7 turnos) a una fila editable por día.
function aFilas(horario) {
  return Array.from({ length: 7 }, (_, d) => {
    const t = horario ? horario[d] : TODO_EL_DIA;
    if (!t) return { modo: 'cerrado', abre: '08:00', cierra: '20:00' };
    if (t.abre === '00:00' && t.cierra === '24:00') return { modo: '24h', abre: '08:00', cierra: '20:00' };
    return { modo: 'turno', abre: t.abre, cierra: t.cierra };
  });
}

function aHorario(filas) {
  const dias = filas.map(f => (f.modo === 'cerrado' ? null : f.modo === '24h' ? TODO_EL_DIA : { abre: f.abre, cierra: f.cierra }));
  // Los 7 días abiertos las 24 horas es lo mismo que no tener horario: se guarda como null.
  return dias.every(t => t && t.abre === '00:00' && t.cierra === '24:00') ? null : dias;
}

// Editor del horario semanal. onGuardar recibe el horario en el formato de la API y devuelve una
// promesa; si falla, el mensaje del servidor se muestra aquí mismo.
export default function HorarioEditor({ nombre, horario, onGuardar, onCancelar }) {
  const [filas, setFilas] = useState(() => aFilas(horario));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiar = (d, cambios) => setFilas(fs => fs.map((f, i) => (i === d ? { ...f, ...cambios } : f)));
  const copiarATodos = d => setFilas(fs => fs.map(() => ({ ...fs[d] })));
  const invalida = filas.find(f => f.modo === 'turno' && (!f.abre || !f.cierra || f.abre === f.cierra));

  async function guardar(e) {
    e.preventDefault();
    if (invalida) { setError('Revisa los horarios: la apertura y el cierre de un día no pueden ser iguales.'); return; }
    setGuardando(true); setError('');
    try { await onGuardar(aHorario(filas)); }
    catch (err) { setError(err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.error || 'No se pudo guardar el horario'); setGuardando(false); }
  }

  return (
    <form className="horario-editor" onSubmit={guardar} aria-label={`Horario de atención de ${nombre}`}>
      <p className="muted small" style={{ margin: 0 }}>
        Hora de Chile. Si la hora de cierre es menor que la de apertura, el turno termina al día siguiente (por ejemplo, 20:00 a 02:00).
        Mientras esté cerrado, los conductores lo ven como cerrado y no pueden reservar ni trazar la ruta.
      </p>
      <div className="horario-dias">
        {ORDEN_SEMANA.map(d => {
          const f = filas[d];
          return (
            <fieldset className="horario-dia" key={d}>
              <legend>{DIAS[d]}</legend>
              <select value={f.modo} onChange={e => cambiar(d, { modo: e.target.value })} aria-label={`${DIAS[d]}: tipo de horario`}>
                <option value="turno">Con horario</option>
                <option value="24h">Abierto 24 horas</option>
                <option value="cerrado">Cerrado</option>
              </select>
              {f.modo === 'turno' && (
                <span className="horario-horas">
                  <input type="time" value={f.abre} onChange={e => cambiar(d, { abre: e.target.value })} aria-label={`${DIAS[d]}: abre a las`} required />
                  <span aria-hidden="true">a</span>
                  <input type="time" value={f.cierra} onChange={e => cambiar(d, { cierra: e.target.value })} aria-label={`${DIAS[d]}: cierra a las`} required />
                </span>
              )}
              <button type="button" className="link-button small" onClick={() => copiarATodos(d)}>Usar en todos los días</button>
            </fieldset>
          );
        })}
      </div>
      {error && <p className="badge off" role="alert">{error}</p>}
      <div className="row-form">
        <button disabled={guardando}>{guardando ? <span className="spinner" /> : <Icon name="checkCircle" size={16} />}Guardar horario</button>
        <button type="button" className="secondary" onClick={onCancelar} disabled={guardando}>Cancelar</button>
      </div>
    </form>
  );
}
