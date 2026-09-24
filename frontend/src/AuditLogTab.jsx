import { useEffect, useState } from 'react';
import { api } from './services/api.js';

const ENTIDAD_LABEL = { usuario: 'Usuario', parametro: 'Parámetro', estacionamiento: 'Estacionamiento', solicitud: 'Solicitud' };
const ACCION_LABEL = {
  'usuario.crear': 'Creó usuario',
  'usuario.cambiar_estado': 'Cambió estado de usuario',
  'usuario.cambiar_rol': 'Cambió rol de usuario',
  'parametro.actualizar': 'Actualizó parámetro',
  'estacionamiento.crear': 'Creó estacionamiento',
  'estacionamiento.actualizar_cupo': 'Actualizó cupo',
  'estacionamiento.actualizar_tarifa': 'Actualizó tarifa',
  'solicitud.revisar': 'Revisó solicitud',
  'solicitud.procesar': 'Procesó solicitud'
};

function detalleTexto(entrada) {
  if (!entrada.detalle) return '—';
  try {
    return Object.entries(entrada.detalle).map(([k, v]) => `${k}: ${v}`).join(', ');
  } catch { return '—'; }
}

export default function AuditLogTab() {
  const [entradas, setEntradas] = useState([]);
  const [entidad, setEntidad] = useState('');
  const [loading, setLoading] = useState(true);

  function cargar() {
    setLoading(true);
    api.get('/admin/audit-log', { params: { entidad: entidad || undefined, limit: 100 } })
      .then(r => setEntradas(r.data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, [entidad]);

  return (
    <div>
      <div className="card">
        <h2>Auditoría</h2>
        <p style={{ color: 'var(--text-muted)' }}>Quién hizo qué acción administrativa y cuándo — usuarios, parámetros, estacionamientos y solicitudes.</p>
        <div className="row-form">
          <select value={entidad} onChange={e => setEntidad(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todo</option>
            {Object.entries(ENTIDAD_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>

      {loading && <p><span className="spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'rgba(67,56,202,.2)' }} />Cargando...</p>}

      {!loading && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {entradas.map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleString('es-CL')}</td>
                  <td>{e.usuario_nombre || '—'}{e.usuario_email ? ` (${e.usuario_email})` : ''}</td>
                  <td>{ACCION_LABEL[e.accion] || e.accion}</td>
                  <td>{detalleTexto(e)}</td>
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
