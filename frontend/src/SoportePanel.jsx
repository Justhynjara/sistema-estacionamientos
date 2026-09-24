import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import { formatTarifa } from './utils/tarifa.js';

const ESTADO_LABEL = {
  PENDIENTE: { texto: 'Pendiente', cls: 'off' },
  APROBADA: { texto: 'Aprobada', cls: 'ok' },
  RECHAZADA: { texto: 'Rechazada', cls: 'off' },
  PROCESADA: { texto: 'Procesada', cls: 'ok' }
};

function RevisionSolicitud({ id, onRevisado }) {
  const [detalle, setDetalle] = useState(null);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState('');

  useEffect(() => { api.get(`/solicitudes/${id}`).then(r => setDetalle(r.data)); }, [id]);

  async function revisar(estado) {
    setLoading(estado);
    try {
      await api.patch(`/solicitudes/${id}/revision`, { estado, comentario: comentario.trim() || null });
      onRevisado();
    } catch (err) { alert(err.response?.data?.error || 'No se pudo registrar la revisión'); }
    finally { setLoading(''); }
  }

  if (!detalle) return <p><span className="spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'rgba(67,56,202,.2)' }} />Cargando...</p>;

  return (
    <div className="card">
      <h3>{detalle.nombre_establecimiento}</h3>
      <p><strong>Solicitante:</strong> {detalle.nombre_solicitante} — {detalle.email}{detalle.telefono ? ` — ${detalle.telefono}` : ''}</p>
      <p><strong>Dirección:</strong> {detalle.direccion}{detalle.latitud ? ` (${Number(detalle.latitud).toFixed(5)}, ${Number(detalle.longitud).toFixed(5)})` : ''}</p>
      <p><strong>Tarifa propuesta:</strong> {formatTarifa(detalle)} &nbsp; <strong>Cupos estimados:</strong> {detalle.cupo_estimado}</p>
      {detalle.descripcion && <p><strong>Descripción del solicitante:</strong> {detalle.descripcion}</p>}

      {detalle.fotos?.length > 0 ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
          {detalle.fotos.map((f, i) => (
            <img key={i} src={f} alt={`Foto ${i + 1}`} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : <p className="badge off">⚠️ No adjuntó fotos</p>}

      <div style={{ marginTop: 14 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Checklist sugerido antes de aprobar:</p>
        <ul style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: '0 0 12px', paddingLeft: 20 }}>
          <li>¿Las fotos muestran un espacio real y accesible para vehículos?</li>
          <li>¿La dirección y ubicación en el mapa coinciden con las fotos?</li>
          <li>¿La tarifa (precio por minuto y valor base mínimo) y los cupos declarados son razonables para la zona?</li>
          <li>¿Los datos de contacto (email/teléfono) son válidos y responden?</li>
        </ul>
      </div>

      <textarea
        placeholder="Comentario para el solicitante o para el equipo (opcional)"
        value={comentario}
        onChange={e => setComentario(e.target.value)}
        rows={2}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', margin: '6px 0 14px', font: 'inherit' }}
      />
      <div className="row-form">
        <button type="button" onClick={() => revisar('APROBADA')} disabled={!!loading}>{loading === 'APROBADA' && <span className="spinner" />}✅ Aprobar</button>
        <button type="button" className="secondary" onClick={() => revisar('RECHAZADA')} disabled={!!loading}>{loading === 'RECHAZADA' && <span className="spinner" />}❌ Rechazar</button>
      </div>
    </div>
  );
}

export default function SoportePanel() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtro, setFiltro] = useState('PENDIENTE');
  const [seleccionadaId, setSeleccionadaId] = useState(null);

  function cargar() {
    api.get('/solicitudes', { params: { estado: filtro || undefined } }).then(r => setSolicitudes(r.data));
    setSeleccionadaId(null);
  }
  useEffect(() => { cargar(); }, [filtro]);

  return (
    <div>
      <div className="card">
        <h2>Solicitudes de nuevos estacionamientos</h2>
        <p style={{ color: 'var(--text-muted)' }}>Revisa los datos y fotos de cada postulación para validar si cumple los requisitos antes de aprobarla.</p>
        <div className="row-form">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar por estado">
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADA">Aprobadas</option>
            <option value="RECHAZADA">Rechazadas</option>
            <option value="PROCESADA">Procesadas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      {seleccionadaId && <RevisionSolicitud id={seleccionadaId} onRevisado={cargar} />}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Establecimiento</th><th>Solicitante</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {solicitudes.map(s => (
              <tr key={s.id}>
                <td>{s.nombre_establecimiento}</td>
                <td>{s.nombre_solicitante}</td>
                <td>{new Date(s.created_at).toLocaleDateString('es-CL')}</td>
                <td><span className={'badge ' + ESTADO_LABEL[s.estado].cls}>{ESTADO_LABEL[s.estado].texto}</span></td>
                <td><button type="button" className="secondary" onClick={() => setSeleccionadaId(s.id)}>Revisar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {solicitudes.length === 0 && <div className="empty-state">No hay solicitudes en este estado.</div>}
      </div>
    </div>
  );
}
