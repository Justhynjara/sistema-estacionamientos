import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import { calcularTarifa, formatCLP, formatCronometro, formatDuracion, formatTarifa } from './utils/tarifa.js';

const REFRESCO_MS = 30000;

function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

// Lo que ve quien escanea el QR del ticket con la cámara del teléfono (normalmente el conductor):
// cuánto lleva estacionado y cuánto tendría que pagar si saliera ahora. No requiere sesión.
export default function TicketPublico({ codigo, onEntrarDueno, onCerrar }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState('');
  const [desfase, setDesfase] = useState(0);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    let vivo = true;
    function cargar() {
      api.get(`/tickets/publico/${encodeURIComponent(codigo)}`)
        .then(r => {
          if (!vivo) return;
          setT(r.data);
          // El reloj del teléfono puede estar corrido: se mide contra la hora del servidor.
          setDesfase(new Date(r.data.ahora).getTime() - Date.now());
          setError('');
        })
        .catch(err => {
          if (!vivo) return;
          setError(err.response?.status === 404
            ? 'No encontramos este ticket. Revisa que el código QR esté completo.'
            : 'No pudimos cargar tu ticket. Intenta nuevamente en un momento.');
        });
    }
    cargar();
    const id = setInterval(cargar, REFRESCO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [codigo]);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ahoraServidor = ahora + desfase;

  function contenido() {
    if (error) return <p className="badge off">⚠️ {error}</p>;
    if (!t) return <p><span className="spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'rgba(67,56,202,.2)' }} />Cargando tu ticket…</p>;

    const encabezado = (
      <>
        <h2 style={{ marginBottom: 2 }}>🅿️ {t.estacionamiento_nombre}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{t.estacionamiento_direccion}{t.patente ? ` · Patente ${t.patente}` : ''}</p>
      </>
    );

    if (t.estado === 'ACTIVO') {
      const { minutos, bruto } = calcularTarifa(t.fecha_entrada, t.precio_minuto, t.tarifa_minima, ahoraServidor);
      const descuento = Number(t.descuentoReserva || 0);
      const monto = Math.max(0, bruto - descuento);
      const enMinimo = bruto === Number(t.tarifa_minima) && t.tarifa_minima > 0;
      return (
        <>
          {encabezado}
          <p style={{ margin: '14px 0 2px', color: 'var(--text-muted)' }}>Llevas estacionado</p>
          <p aria-label="Tiempo estacionado" style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {formatCronometro(ahoraServidor - new Date(t.fecha_entrada).getTime())}
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: 2 }}>Entraste a las {hora(t.fecha_entrada)} · {formatDuracion(minutos)} cobrados</p>

          <p style={{ margin: '18px 0 2px', color: 'var(--text-muted)' }}>Monto a pagar hasta ahora</p>
          <p aria-label="Monto a pagar" style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{formatCLP(monto)}</p>
          {descuento > 0 && <p className="badge ok">🎟️ Incluye descuento por tu reserva ya pagada: -{formatCLP(descuento)}</p>}
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
            Tarifa: {formatTarifa(t)}.{enMinimo ? ' Aún estás en el valor base mínimo.' : ''}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
            El monto sube por cada minuto que pasa. El valor final se calcula cuando pagas al salir, con el dueño del estacionamiento.
          </p>
        </>
      );
    }

    if (t.estado === 'RESERVADO') {
      const quedan = Math.max(0, Math.ceil((new Date(t.reserva_expira).getTime() - ahoraServidor) / 60000));
      return (
        <>
          {encabezado}
          {quedan > 0
            ? <p className="badge ok">🎫 Reserva vigente: te quedan {formatDuracion(quedan)} para llegar (hasta las {hora(t.reserva_expira)}).</p>
            : <p className="badge off">⌛ Tu reserva venció y el cupo puede haberse liberado.</p>}
          <p style={{ color: 'var(--text-muted)' }}>Muestra este QR al dueño al llegar para validar tu cupo. Tarifa: {formatTarifa(t)}.</p>
        </>
      );
    }

    if (t.estado === 'CERRADO') {
      return (
        <>
          {encabezado}
          <p className="badge ok">✅ Ticket cerrado{t.monto != null ? `: pagaste ${formatCLP(t.monto)}` : ''}.</p>
          <p style={{ color: 'var(--text-muted)' }}>Estuviste {formatDuracion(t.minutos)} (de las {hora(t.fecha_entrada)} a las {hora(t.fecha_salida)}). ¡Gracias por tu preferencia!</p>
        </>
      );
    }

    return (
      <>
        {encabezado}
        <p className="badge off">Este ticket ya no está vigente ({t.estado.toLowerCase()}).</p>
      </>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      {contenido()}
      <div className="row-form" style={{ marginTop: 16 }}>
        {onEntrarDueno && <button type="button" onClick={onEntrarDueno}>🔑 Soy el dueño: iniciar sesión para cobrar</button>}
        <button type="button" className="secondary" onClick={onCerrar}>← Ir al inicio</button>
      </div>
    </div>
  );
}
