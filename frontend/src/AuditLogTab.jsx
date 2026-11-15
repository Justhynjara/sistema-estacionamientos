import { useEffect, useState } from 'react';
import { api } from './services/api.js';

const ENTIDAD_LABEL = { usuario: 'Usuario', parametro: 'Parámetro', estacionamiento: 'Estacionamiento', solicitud: 'Solicitud' };
const ACCION_LABEL = {
  'usuario.crear': 'Creó usuario',
  'usuario.cambiar_estado': 'Cambió estado de usuario',
  'usuario.cambiar_rol': 'Cambió rol de usuario',
  'usuario.eliminar': 'Eliminó usuario',
  'parametro.actualizar': 'Actualizó parámetro',
  'estacionamiento.crear': 'Creó estacionamiento',
  'estacionamiento.actualizar_cupo': 'Actualizó cupo',
  'estacionamiento.actualizar_tarifa': 'Actualizó tarifa',
  'estacionamiento.cambiar_dueno': 'Cambió dueño de estacionamiento',
  'estacionamiento.actualizar_horario': 'Actualizó horario de atención',
  'estacionamiento.actualizar_tarifas_horario': 'Actualizó tarifas por horario',
  'estacionamiento.eliminar': 'Eliminó estacionamiento',
  'solicitud.revisar': 'Revisó solicitud',
  'solicitud.procesar': 'Procesó solicitud'
};

const CAMPO_LABEL = {
  email: 'email', rol: 'rol', activo: 'activo', valor: 'valor', nombre: 'nombre', cupo_maximo: 'cupo máximo',
  precio_minuto: 'precio por minuto', tarifa_minima: 'valor mínimo', estado: 'estado', comentario: 'comentario',
  cliente_id: 'dueño', cliente_id_anterior: 'dueño anterior', cliente_id_nuevo: 'dueño nuevo',
  horario: 'horario', tarifas_horario: 'tarifas por horario'
};
const corto = id => (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id.slice(0, 8) : id);

// Convierte el detalle guardado en texto legible: antes los horarios y tramos salían como
// "[object Object]" y los valores nulos como "null".
function valorTexto(k, v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (k === 'horario' && Array.isArray(v)) {
    const abiertos = v.filter(Boolean).length;
    return abiertos === 0 ? 'cerrado toda la semana' : `${abiertos} de 7 días con horario`;
  }
  if (k === 'tarifas_horario' && Array.isArray(v)) {
    return v.length ? v.map(t => `${t.desde}–${t.hasta} $${t.precio_minuto}/min`).join('; ') : 'solo precio base';
  }
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
  return String(corto(v));
}

function detalleTexto(entrada) {
  if (!entrada.detalle) return '—';
  if (entrada.accion === 'estacionamiento.actualizar_horario' && entrada.detalle.horario === null) return 'horario: abierto las 24 horas';
  if (entrada.accion === 'estacionamiento.actualizar_tarifas_horario' && entrada.detalle.tarifas_horario === null) return 'tarifas por horario: solo precio base';
  const partes = Object.entries(entrada.detalle)
    .map(([k, v]) => { const t = valorTexto(k, v); return t === null ? null : `${CAMPO_LABEL[k] || k}: ${t}`; })
    .filter(Boolean);
  return partes.length ? partes.join(', ') : '—';
}

// Sobre quién o qué se hizo la acción: un parámetro se nombra por su clave; lo demás, por su id corto.
function objetivoTexto(e) {
  if (!e.entidad_id) return '—';
  return e.entidad === 'parametro' ? e.entidad_id : `${ENTIDAD_LABEL[e.entidad] || e.entidad} ${corto(e.entidad_id)}`;
}

export default function AuditLogTab() {
  const [entradas, setEntradas] = useState([]);
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [limite, setLimite] = useState(100);
  const [loading, setLoading] = useState(true);

  function cargar() {
    setLoading(true);
    api.get('/admin/audit-log', { params: { entidad: entidad || undefined, accion: accion || undefined, limit: limite } })
      .then(r => setEntradas(r.data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, [entidad, accion, limite]);

  return (
    <div>
      <div className="card">
        <h2>Auditoría</h2>
        <p className="lead">Quién hizo qué acción administrativa y cuándo: usuarios, parámetros, estacionamientos y solicitudes.</p>
        <div className="row-form">
          <select value={entidad} onChange={e => setEntidad(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todo</option>
            {Object.entries(ENTIDAD_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={accion} onChange={e => setAccion(e.target.value)} aria-label="Filtrar por acción">
            <option value="">Todas las acciones</option>
            {Object.entries(ACCION_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={limite} onChange={e => setLimite(Number(e.target.value))} aria-label="Cantidad de registros">
            <option value={100}>Últimos 100</option>
            <option value={200}>Últimos 200</option>
          </select>
        </div>
      </div>

      {loading && <p className="loading-line"><span className="spinner" />Cargando...</p>}

      {!loading && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Sobre</th><th>Detalle</th></tr></thead>
            <tbody>
              {entradas.map(e => (
                <tr key={e.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('es-CL')}</td>
                  <td>{e.usuario_nombre || 'Usuario eliminado'}{e.usuario_email ? ` (${e.usuario_email})` : ''}</td>
                  <td>{ACCION_LABEL[e.accion] || e.accion}</td>
                  <td className="mono small">{objetivoTexto(e)}</td>
                  <td className="muted small">{detalleTexto(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entradas.length === 0 && <div className="empty-state">Sin registros de auditoría todavía.</div>}
        </div>
      )}
    </div>
  );
}
