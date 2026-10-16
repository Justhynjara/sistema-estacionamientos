import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import { calcularTarifa, formatCLP, formatCronometro, formatDuracion, formatTarifa } from './utils/tarifa.js';
import Icon, { SignE } from './Icon.jsx';

const REFRESCO_MS = 30000;

function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
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

  // Cabecera tipo letrero: el estacionamiento y su dirección, como el cartel de la entrada.
  function cabecera() {
    return (
      <div className="ticket-head">
        <SignE size={42} />
        <div>
          <h2>{t ? t.estacionamiento_nombre : 'Tu ticket'}</h2>
          {t && <p>{t.estacionamiento_direccion}{t.patente ? <> · Patente <span className="mono">{t.patente}</span></> : ''}</p>}
        </div>
      </div>
    );
  }

  function contenido() {
    if (error) return <p className="badge off">{error}</p>;
    if (!t) return <p className="loading-line"><span className="spinner" />Cargando tu ticket…</p>;

    const codigoTicket = <p className="ticket-codigo">Ticket N.º <span className="mono">{codigo}</span></p>;

    if (t.estado === 'ACTIVO') {
      const { minutos, bruto } = calcularTarifa(t.fecha_entrada, t.precio_minuto, t.tarifa_minima, ahoraServidor);
      const descuento = Number(t.descuentoReserva || 0);
      const monto = Math.max(0, bruto - descuento);
      const enMinimo = bruto === Number(t.tarifa_minima) && t.tarifa_minima > 0;
      return (
        <>
          {codigoTicket}
          <span className="badge ok">Vehículo dentro</span>
          <div className="ticket-metrica" style={{ marginTop: 12 }}>
            <p className="etq">Llevas estacionado</p>
            <p aria-label="Tiempo estacionado" className="valor">
              {formatCronometro(ahoraServidor - new Date(t.fecha_entrada).getTime())}
            </p>
            <p className="muted small" style={{ margin: 0 }}>Entraste a las <span className="mono">{hora(t.fecha_entrada)}</span> · {formatDuracion(minutos)} cobrados</p>
          </div>
          <div className="ticket-metrica" style={{ marginTop: 12 }}>
            <p className="etq">Monto a pagar hasta ahora</p>
            <p aria-label="Monto a pagar" className="valor">{formatCLP(monto)}</p>
            {descuento > 0 && <p className="badge ok">Incluye descuento por tu reserva ya pagada: -{formatCLP(descuento)}</p>}
            <p className="muted small">
              Tarifa: {formatTarifa(t)}.{enMinimo ? ' Aún estás en el valor base mínimo.' : ''}
            </p>
            <p className="muted small">
              El monto sube por cada minuto que pasa. El valor final se calcula cuando pagas al salir, con el dueño del estacionamiento.
            </p>
          </div>
        </>
      );
    }

    if (t.estado === 'RESERVADO') {
      const quedan = Math.max(0, Math.ceil((new Date(t.reserva_expira).getTime() - ahoraServidor) / 60000));
      return (
        <>
          {codigoTicket}
          {quedan > 0
            ? <p className="badge ok">Reserva vigente: te quedan {formatDuracion(quedan)} para llegar (hasta las {hora(t.reserva_expira)}).</p>
            : <p className="badge off">Tu reserva venció y el cupo puede haberse liberado.</p>}
          <p className="muted">Muestra este QR al dueño al llegar para validar tu cupo. Tarifa: {formatTarifa(t)}.</p>
        </>
      );
    }

    if (t.estado === 'CERRADO') {
      return (
        <>
          {codigoTicket}
          <p className="badge ok">Ticket cerrado{t.monto != null ? `: pagaste ${formatCLP(t.monto)}` : ''}.</p>
          <p className="muted">Estuviste {formatDuracion(t.minutos)} (de las {hora(t.fecha_entrada)} a las {hora(t.fecha_salida)}). Gracias por tu preferencia.</p>
        </>
      );
    }

    return (
      <>
        {codigoTicket}
        <p className="badge off">Este ticket ya no está vigente ({t.estado.toLowerCase()}).</p>
      </>
    );
  }

  return (
    <article className="ticket" aria-label="Tu ticket de estacionamiento">
      {cabecera()}
      <div className="ticket-body">
        {contenido()}
        <div className="ticket-acciones">
          {onEntrarDueno && <button type="button" className="dark" onClick={onEntrarDueno}><Icon name="key" />Soy el dueño: iniciar sesión para cobrar</button>}
          <button type="button" className="secondary" onClick={onCerrar}><Icon name="arrowLeft" size={16} />Ir al inicio</button>
        </div>
      </div>
    </article>
  );
}
