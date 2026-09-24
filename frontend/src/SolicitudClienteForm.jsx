import { useState } from 'react';
import { api } from './services/api.js';
import LocationPicker from './LocationPicker.jsx';
import { comprimirImagen } from './utils/imageCompress.js';

const MAX_FOTOS = 4;

const initialForm = {
  nombre_solicitante: '', email: '', telefono: '',
  nombre_establecimiento: '', direccion: '',
  precio_minuto: '', tarifa_minima: '', cupo_estimado: '', descripcion: ''
};

export default function SolicitudClienteForm({ onCerrar }) {
  const [form, setForm] = useState(initialForm);
  const [ubicacion, setUbicacion] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function agregarFotos(e) {
    const archivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!archivos.length) return;
    if (fotos.length + archivos.length > MAX_FOTOS) {
      setError(`Puedes subir hasta ${MAX_FOTOS} fotos`);
      return;
    }
    setComprimiendo(true); setError('');
    try {
      const nuevas = await Promise.all(archivos.map(comprimirImagen));
      setFotos(f => [...f, ...nuevas]);
    } catch {
      setError('No se pudo procesar alguna imagen');
    } finally {
      setComprimiendo(false);
    }
  }

  function quitarFoto(i) {
    setFotos(f => f.filter((_, idx) => idx !== i));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!ubicacion) { setError('Marca la ubicación del estacionamiento en el mapa'); return; }
    setLoading(true);
    try {
      await api.post('/solicitudes', {
        ...form,
        latitud: ubicacion.lat,
        longitud: ubicacion.lng,
        precio_minuto: Number(form.precio_minuto),
        tarifa_minima: Number(form.tarifa_minima || 0),
        cupo_estimado: Number(form.cupo_estimado),
        fotos
      });
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.error || 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>✅ ¡Solicitud enviada!</h2>
        <p>Nuestro equipo de soporte revisará tu postulación y los requisitos de tu estacionamiento. Te contactaremos a <strong>{form.email}</strong> con el resultado.</p>
        <p style={{ color: 'var(--text-muted)' }}>Si es aprobada, un administrador creará tu usuario de acceso y luego un equipo coordinará la instalación y configuración en terreno.</p>
        <button type="button" onClick={onCerrar}>Volver</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>📋 Postula tu estacionamiento</h2>
          <p style={{ color: 'var(--text-muted)' }}>Cuéntanos sobre tu estacionamiento. Nuestro equipo de soporte revisará los datos y fotos para validar que cumple los requisitos.</p>
        </div>
        <button type="button" className="secondary" onClick={onCerrar}>Cerrar</button>
      </div>
      {error && <p className="badge off">⚠️ {error}</p>}
      <form onSubmit={enviar}>
        <div className="row-form">
          <input placeholder="Tu nombre" value={form.nombre_solicitante} onChange={e => setForm({ ...form, nombre_solicitante: e.target.value })} required />
          <input type="email" placeholder="Tu email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Teléfono (opcional)" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
        </div>
        <input placeholder="Nombre del establecimiento" value={form.nombre_establecimiento} onChange={e => setForm({ ...form, nombre_establecimiento: e.target.value })} required />
        <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} required />
        <LocationPicker value={ubicacion} onChange={setUbicacion} />
        <div className="row-form">
          <input type="number" min="0" step="any" placeholder="Precio por minuto (CLP)" aria-label="Precio por minuto" max="100000" value={form.precio_minuto} onChange={e => setForm({ ...form, precio_minuto: e.target.value })} required />
          <input type="number" min="0" step="any" placeholder="Valor base mínimo (CLP)" aria-label="Valor base mínimo" max="10000000" value={form.tarifa_minima} onChange={e => setForm({ ...form, tarifa_minima: e.target.value })} />
        </div>
        <div className="row-form">
          <input type="number" min="1" placeholder="Cupos estimados" value={form.cupo_estimado} onChange={e => setForm({ ...form, cupo_estimado: e.target.value })} required />
        </div>
        <textarea
          placeholder="Cuéntanos más: horarios, tipo de vehículos, seguridad, techado, etc. (opcional)"
          value={form.descripcion}
          onChange={e => setForm({ ...form, descripcion: e.target.value })}
          rows={3}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', margin: '6px 0 14px', font: 'inherit' }}
        />

        <label htmlFor="solicitud-fotos" style={{ fontWeight: 600, fontSize: '.9rem' }}>Fotos de la ubicación y el establecimiento (hasta {MAX_FOTOS})</label>
        <div className="row-form" style={{ marginTop: 6 }}>
          <input id="solicitud-fotos" type="file" accept="image/*" multiple onChange={agregarFotos} disabled={comprimiendo || fotos.length >= MAX_FOTOS} />
          {comprimiendo && <span className="spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'rgba(67,56,202,.2)' }} />}
        </div>
        {fotos.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', marginBottom: 14 }}>
            {fotos.map((f, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={f} alt={`Foto ${i + 1}`} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }} />
                <button type="button" className="secondary" onClick={() => quitarFoto(i)} aria-label={`Quitar foto ${i + 1}`} title={`Quitar foto ${i + 1}`} style={{ position: 'absolute', top: 4, right: 4, padding: '2px 8px', fontSize: '.75rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button disabled={loading || comprimiendo}>{loading && <span className="spinner" />}Enviar solicitud</button>
      </form>
    </div>
  );
}
