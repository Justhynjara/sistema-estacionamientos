import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import { formatTarifa } from './utils/tarifa.js';
import Icon from './Icon.jsx';

const ESTADO_LABEL = {
  PENDIENTE: { texto: 'Pendiente de soporte', cls: 'info' },
  APROBADA: { texto: 'Aprobada — falta crear acceso', cls: 'ok' },
  RECHAZADA: { texto: 'Rechazada', cls: 'off' },
  PROCESADA: { texto: 'Procesada', cls: 'ok' }
};

function DetalleSolicitud({ s, onCerrar, onProcesar, procesando }) {
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    api.get(`/solicitudes/${s.id}`).then(r => setDetalle(r.data));
  }, [s.id]);

  return (
    <div className="card">
      <div className="card-head">
        <h3>{s.nombre_establecimiento}</h3>
        <button type="button" className="secondary small" onClick={onCerrar}>Cerrar</button>
      </div>
      <p><strong>Solicitante:</strong> {s.nombre_solicitante} — {s.email}{s.telefono ? ` — ${s.telefono}` : ''}</p>
      <p><strong>Dirección:</strong> {s.direccion}</p>
      <p><strong>Tarifa:</strong> {formatTarifa(s)} &nbsp; <strong>Cupos estimados:</strong> {s.cupo_estimado}</p>
      {s.descripcion && <p><strong>Descripción:</strong> {s.descripcion}</p>}
      {s.comentario_soporte && <p className="badge info">Nota de soporte: {s.comentario_soporte}</p>}
      {detalle?.fotos?.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          {detalle.fotos.map((f, i) => (
            <img key={i} src={f} alt={`Foto ${i + 1} de ${s.nombre_establecimiento}`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--rule)' }} />
          ))}
        </div>
      )}
      {s.estado === 'APROBADA' && (
        <div className="row-form" style={{ marginTop: 12 }}>
          <button type="button" disabled={procesando} onClick={() => onProcesar(s.id)}>
            {procesando ? <span className="spinner" /> : <Icon name="check" />}Marcar como procesada (ya creé el usuario y el estacionamiento)
          </button>
        </div>
      )}
    </div>
  );
}

export default function SolicitudesTab() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtro, setFiltro] = useState('APROBADA');
  const [seleccionada, setSeleccionada] = useState(null);
  const [procesando, setProcesando] = useState(false);

  function cargar() {
    api.get('/solicitudes', { params: { estado: filtro || undefined } }).then(r => setSolicitudes(r.data));
  }
  useEffect(() => { cargar(); }, [filtro]);

  async function procesar(id) {
    setProcesando(true);
    try {
      await api.patch(`/solicitudes/${id}/procesar`);
      setSeleccionada(null);
      cargar();
    } catch (err) { alert(err.response?.data?.error || 'No se pudo marcar como procesada'); }
    finally { setProcesando(false); }
  }

  return (
    <>
      <div className="card">
        <h3>Solicitudes de nuevos clientes</h3>
        <p className="lead">
          Cuando soporte aprueba una postulación, aparece aquí. Crea el usuario (pestaña Usuarios) y registra el estacionamiento
          (pestaña Estacionamientos) con los datos de la solicitud, y luego márcala como procesada.
        </p>
        <div className="row-form">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar por estado">
            <option value="APROBADA">Aprobadas (por procesar)</option>
            <option value="PROCESADA">Procesadas</option>
            <option value="PENDIENTE">Pendientes de soporte</option>
            <option value="RECHAZADA">Rechazadas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      {seleccionada && (
        <DetalleSolicitud s={seleccionada} onCerrar={() => setSeleccionada(null)} onProcesar={procesar} procesando={procesando} />
      )}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Establecimiento</th><th>Solicitante</th><th>Tarifa</th><th>Cupos</th><th>Estado</th><th><span className="sr-only">Acción</span></th></tr></thead>
          <tbody>
            {solicitudes.map(s => (
              <tr key={s.id}>
                <td>{s.nombre_establecimiento}</td>
                <td>{s.nombre_solicitante}</td>
                <td className="mono">{formatTarifa(s)}</td>
                <td className="mono">{s.cupo_estimado}</td>
                <td><span className={'badge ' + ESTADO_LABEL[s.estado].cls}>{ESTADO_LABEL[s.estado].texto}</span></td>
                <td className="acciones"><button type="button" className="secondary small" onClick={() => setSeleccionada(s)}>Ver detalle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {solicitudes.length === 0 && <div className="empty-state">No hay solicitudes en este estado.</div>}
      </div>
    </>
  );
}
