import { useEffect, useRef, useState } from 'react';
import { api } from './services/api.js';
import QRCodeCanvas from './QRCode.jsx';
import Pagination, { usePagination } from './Pagination.jsx';
import { imprimirTicket } from './utils/print.js';
import QRScanner from './QRScanner.jsx';
import { qrPayload, extraerCodigoQR } from './utils/qr.js';
import { formatDuracion, formatTarifa } from './utils/tarifa.js';
import Tarifa from './Tarifa.jsx';
import EstadoHorario from './EstadoHorario.jsx';
import HorarioEditor from './HorarioEditor.jsx';
import { resumenHorario } from './utils/horario.js';
import { estadoReserva, formatRestante } from './utils/reserva.js';
import Icon from './Icon.jsx';
import TabsBase from './Tabs.jsx';
import Capacidad from './Capacidad.jsx';
import Estadisticas from './Estadisticas.jsx';

// Un poco menos que el plazo del servidor (3 min), para no confirmar con una cotización que vence en el camino.
const COTIZACION_VIGENTE_MS = 170000;

const METODO_LABEL = { EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito' };
const ESTADO_TICKET = {
  ACTIVO: { texto: 'Dentro', cls: 'ok' },
  RESERVADO: { texto: 'Reservado', cls: 'info' },
  PAGADO: { texto: 'Pagado', cls: 'neutral' },
  CERRADO: { texto: 'Cerrado', cls: 'neutral' },
  CANCELADO: { texto: 'Cancelado', cls: 'off' }
};

const TABS = [['estacionamientos', 'Mis estacionamientos', 'building'], ['dashboard', 'Dashboard de tickets', 'chart']];
function Tabs({ tab, setTab }) {
  return <TabsBase tabs={TABS} tab={tab} setTab={setTab} label="Secciones del panel" />;
}

function todayStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

// En el dashboard un ticket puede haber entrado otro día (se cobró en la fecha consultada):
// en ese caso se muestra también el día para que no parezca una hora de hoy.
function fmtHoraEnDia(iso, fecha) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  const dia = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hora = fmtHora(iso);
  return dia === fecha ? hora : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hora}`;
}

function tiempoTranscurrido(iso) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

// Una reserva en sus últimos minutos se destaca: el dueño sabe que ese cupo puede liberarse pronto.
function EstadoActivo({ t, ahora }) {
  if (t.estado === 'ACTIVO') return <span className="badge ok">Dentro</span>;
  const { vencida, porVencer } = t.reserva_expira ? estadoReserva(t.reserva_expira, ahora) : {};
  if (vencida) return <span className="badge neutral">Reserva vencida</span>;
  if (porVencer) return <span className="badge warn">Por vencer</span>;
  return <span className="badge info">Reservado</span>;
}

function GestionTicketPanel({ reloadParking, ticketInicial, onTicketConsumido, estacionamientoId, estacionamientoNombre }) {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [cobro, setCobro] = useState(null);
  const [activos, setActivos] = useState([]);
  const [ahora, setAhora] = useState(Date.now());
  const hayReservas = activos.some(t => t.estado === 'RESERVADO');
  // El reloj solo corre mientras hay reservas que mostrar con cuenta regresiva.
  useEffect(() => {
    if (!hayReservas) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hayReservas]);
  const [escaneando, setEscaneando] = useState(false);
  // Tras leer un QR, la pantalla baja sola hasta el cobro (o el aviso): en el teléfono quedarían
  // debajo de la lista de vehículos, fuera de la vista.
  const irAlResultado = useRef(false);
  const cobroRef = useRef(null);
  const mensajeRef = useRef(null);
  useEffect(() => {
    if (!irAlResultado.current) return;
    const destino = cobroRef.current || mensajeRef.current;
    if (!destino) return;
    irAlResultado.current = false;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    destino.scrollIntoView?.({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
  }, [cobro, mensaje]);

  function cargarActivos() {
    api.get('/tickets/active', { params: { estacionamiento_id: estacionamientoId || undefined } }).then(r => setActivos(r.data)).catch(() => {});
  }
  useEffect(() => {
    cargarActivos();
    const id = setInterval(cargarActivos, 20000);
    return () => clearInterval(id);
  }, []);

  // Punto de entrada común para un código que llega por el escáner o por el enlace del QR
  // (el dueño escanea con la cámara del teléfono estando con sesión iniciada): si el vehículo
  // está dentro, va directo a cobrar; si es una reserva, deja el código listo para validarla.
  async function abrirCodigo(crudo) {
    const c = extraerCodigoQR(crudo);
    if (!c) return;
    irAlResultado.current = true;
    setCodigo(c); setMensaje(null); setCobro(null);
    try {
      const r = await api.get(`/tickets/publico/${encodeURIComponent(c)}`);
      if (r.data.estado === 'ACTIVO') return iniciarCobro(c);
      if (r.data.estado === 'RESERVADO') {
        setMensaje({ tipo: 'ok', texto: 'Reserva encontrada. Presiona "Validar reserva" para confirmar que el vehículo llegó.' });
      } else {
        setMensaje({ tipo: 'off', texto: r.data.estado === 'CERRADO' ? 'Este ticket ya fue cobrado y cerrado.' : 'Esta reserva expiró o fue cancelada.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'off', texto: err.response?.status === 404 ? 'No encontramos un ticket con ese código.' : 'No se pudo leer el código' });
    }
  }

  useEffect(() => {
    if (!ticketInicial) return;
    abrirCodigo(ticketInicial);
    onTicketConsumido?.();
  }, []);

  async function validarReserva(qr) {
    const c = extraerCodigoQR(qr || codigo);
    if (!c) return;
    setLoading('checkin'); setMensaje(null); setCobro(null);
    try {
      await api.post('/tickets/checkin', { codigo_qr: c });
      setMensaje({ tipo: 'ok', texto: 'Reserva validada: el vehículo ya está activo dentro del estacionamiento.' });
      setCodigo('');
      reloadParking(); cargarActivos();
    } catch (err) { setMensaje({ tipo: 'off', texto: err.response?.data?.error || 'No se pudo validar la reserva' }); }
    finally { setLoading(''); }
  }

  async function iniciarCobro(qr) {
    const c = extraerCodigoQR(qr || codigo);
    if (!c) return;
    setLoading('cobro'); setMensaje(null); setCobro(null);
    try {
      const q = await api.post('/tickets/quote', { codigo_qr: c });
      setCobro({
        codigo: c,
        monto: Number(q.data.monto),
        descuento: Number(q.data.descuentoReserva || 0),
        patente: q.data.patente,
        estacionamiento_nombre: q.data.estacionamiento_nombre,
        direccion: q.data.estacionamiento_direccion,
        fecha_entrada: q.data.fecha_entrada,
        minutos: q.data.minutos,
        tarifa: formatTarifa(q.data),
        cotizacion: q.data.cotizacion,
        cotizadoEn: Date.now(),
        metodo: null,
        recibido: ''
      });
    } catch (err) { setMensaje({ tipo: 'off', texto: err.response?.data?.error || 'No se pudo calcular el cobro' }); }
    finally { setLoading(''); }
  }

  async function confirmarCobro() {
    if (!cobro || !cobro.metodo) return;
    const esEfectivo = cobro.metodo === 'EFECTIVO';
    const recibido = esEfectivo ? Number(cobro.recibido) : cobro.monto;
    if (esEfectivo && (!recibido || recibido < cobro.monto)) return;
    // El monto mostrado queda congelado unos minutos (cotización firmada por el servidor). Si ya
    // pasó ese plazo, se vuelve a cotizar y se pide confirmar el monto actualizado en vez de
    // cobrar algo distinto a lo que el dueño le dijo al cliente.
    if (Date.now() - cobro.cotizadoEn > COTIZACION_VIGENTE_MS) {
      await iniciarCobro(cobro.codigo);
      setMensaje({ tipo: 'off', texto: 'Pasaron unos minutos: el monto se actualizó. Revísalo y confirma de nuevo.' });
      return;
    }
    setLoading('cobro-confirm');
    try {
      const r = await api.post('/tickets/close', { codigo_qr: cobro.codigo, metodo_pago: cobro.metodo, cotizacion: cobro.cotizacion });
      const monto = Number(r.data.monto);
      const vuelto = recibido - monto;
      setMensaje({
        tipo: 'ok',
        texto: esEfectivo
          ? (vuelto >= 0
              ? `Cobro registrado (Efectivo): $${monto.toLocaleString('es-CL')} — Vuelto: $${vuelto.toLocaleString('es-CL')}`
              : `Cobro registrado (Efectivo): $${monto.toLocaleString('es-CL')} — Faltan $${Math.abs(vuelto).toLocaleString('es-CL')} (el monto subió entre la cotización y el cobro)`)
          : `Cobro registrado (${METODO_LABEL[cobro.metodo]}): $${monto.toLocaleString('es-CL')}`,
        imprimir: () => imprimirTicket({
          nombreEstacionamiento: r.data.estacionamiento_nombre,
          direccion: r.data.estacionamiento_direccion,
          codigo: r.data.codigo_qr,
          detalle: [
            ['Patente', r.data.patente || '—'],
            ['Entrada', new Date(r.data.fecha_entrada).toLocaleString('es-CL')],
            ['Salida', new Date().toLocaleString('es-CL')],
            ...(r.data.descuentoReserva > 0 ? [['Descuento reserva pagada', `-$${Number(r.data.descuentoReserva).toLocaleString('es-CL')}`]] : []),
            ['Total a pagar', `$${monto.toLocaleString('es-CL')}`],
            ['Método de pago', METODO_LABEL[r.data.metodo_pago] || r.data.metodo_pago],
            ...(esEfectivo ? [['Recibido', `$${recibido.toLocaleString('es-CL')}`], ['Vuelto', `$${Math.max(0, vuelto).toLocaleString('es-CL')}`]] : [])
          ],
          pie: 'Comprobante de pago — Gracias por su preferencia'
        })
      });
      setCobro(null); setCodigo('');
      reloadParking(); cargarActivos();
    } catch (err) { setMensaje({ tipo: 'off', texto: err.response?.data?.error || 'No se pudo cerrar el ticket' }); }
    finally { setLoading(''); }
  }

  const vuelto = cobro && cobro.metodo === 'EFECTIVO' && cobro.recibido ? Number(cobro.recibido) - cobro.monto : null;

  return (
    <>
      <div className="card">
        <h3>Vehículos y reservas{estacionamientoNombre ? ` en ${estacionamientoNombre}` : ''}</h3>
        <p className="muted small">Busca por patente: no necesitas el código QR para validar o cobrar.</p>
        {activos.length === 0 && <div className="empty-state">No hay vehículos ni reservas pendientes en este momento.</div>}
        {activos.length > 0 && (
          <div className="table-wrap">
            <table className="table activos">
              <thead><tr><th>Patente</th>{!estacionamientoId && <th>Estacionamiento</th>}<th>Estado</th><th>Entrada</th><th>Tiempo</th><th><span className="sr-only">Acción</span></th></tr></thead>
              <tbody>
                {activos.map(t => (
                  <tr key={t.id}>
                    <td className="mono c-patente"><strong>{t.patente || '—'}</strong></td>
                    {!estacionamientoId && <td className="c-lugar">{t.estacionamiento_nombre}</td>}
                    <td className="c-estado"><EstadoActivo t={t} ahora={ahora} /></td>
                    <td className="mono c-entrada" data-label="Entrada">{fmtHora(t.fecha_entrada)}</td>
                    <td className="mono c-tiempo" data-label="Tiempo">{t.estado === 'RESERVADO' && t.reserva_expira
                      ? `vence en ${formatRestante(estadoReserva(t.reserva_expira, ahora).restanteMs)}`
                      : tiempoTranscurrido(t.fecha_entrada)}</td>
                    <td className="acciones">
                      {t.estado === 'RESERVADO'
                        ? <button type="button" className="small secondary" disabled={!!loading} onClick={() => validarReserva(t.codigo_qr)}><Icon name="check" size={16} />Validar</button>
                        : <button type="button" className="small" disabled={!!loading} onClick={() => iniciarCobro(t.codigo_qr)}><Icon name="coin" size={16} />Cobrar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cobro && (
        <div ref={cobroRef} className="card cobro">
          <div className="card-head">
            <h3>Cobro <span className="mono">{cobro.patente || 'sin patente'}</span></h3>
            <span className="badge info">{cobro.estacionamiento_nombre}</span>
          </div>
          {cobro.minutos != null && (
            <p className="muted"><Icon name="clock" size={16} /> {formatDuracion(cobro.minutos)} estacionado · Tarifa {cobro.tarifa}</p>
          )}
          {cobro.descuento > 0 && (
            <p className="badge ok">Descuento por reserva ya pagada: -${cobro.descuento.toLocaleString('es-CL')}</p>
          )}
          <p className="cobro-total">Total a pagar: ${cobro.monto.toLocaleString('es-CL')}</p>

          {!cobro.metodo && (
            <>
              <p className="field-label">¿Con qué medio pagó el conductor?</p>
              <div className="row-form">
                <button type="button" className="secondary" onClick={() => setCobro({ ...cobro, metodo: 'EFECTIVO' })}><Icon name="cash" />Efectivo</button>
                <button type="button" className="secondary" onClick={() => setCobro({ ...cobro, metodo: 'DEBITO' })}><Icon name="card" />Débito</button>
                <button type="button" className="secondary" onClick={() => setCobro({ ...cobro, metodo: 'CREDITO' })}><Icon name="card" />Crédito</button>
              </div>
            </>
          )}

          {cobro.metodo === 'EFECTIVO' && (
            <>
              <div className="row-form">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="¿Con cuánto le pagan?"
                  value={cobro.recibido}
                  onChange={e => setCobro({ ...cobro, recibido: e.target.value })}
                  aria-label="Monto recibido"
                  autoFocus
                />
              </div>
              {vuelto !== null && (
                <p className={'badge ' + (vuelto >= 0 ? 'ok' : 'off')}>
                  {vuelto >= 0 ? `Vuelto: $${vuelto.toLocaleString('es-CL')}` : `Falta: $${Math.abs(vuelto).toLocaleString('es-CL')}`}
                </p>
              )}
              <div className="row-form">
                <button type="button" onClick={confirmarCobro} disabled={!cobro.recibido || vuelto < 0 || loading === 'cobro-confirm'}>
                  {loading === 'cobro-confirm' ? <span className="spinner" /> : <Icon name="check" />}Confirmar cobro
                </button>
                <button type="button" className="secondary" onClick={() => setCobro({ ...cobro, metodo: null })}><Icon name="arrowLeft" size={16} />Cambiar método</button>
              </div>
            </>
          )}

          {(cobro.metodo === 'DEBITO' || cobro.metodo === 'CREDITO') && (
            <>
              <p className="badge info">Cobra ${cobro.monto.toLocaleString('es-CL')} en el POS ({METODO_LABEL[cobro.metodo]}) y confirma aquí.</p>
              <div className="row-form">
                <button type="button" onClick={confirmarCobro} disabled={loading === 'cobro-confirm'}>
                  {loading === 'cobro-confirm' ? <span className="spinner" /> : <Icon name="check" />}Confirmar cobro con {METODO_LABEL[cobro.metodo]}
                </button>
                <button type="button" className="secondary" onClick={() => setCobro({ ...cobro, metodo: null })}><Icon name="arrowLeft" size={16} />Cambiar método</button>
              </div>
            </>
          )}

          <div className="row-form" style={{ marginTop: 12 }}>
            <button type="button" className="link-button" onClick={() => setCobro(null)}>Cancelar cobro</button>
          </div>
        </div>
      )}

      {escaneando && (
        <QRScanner
          onResult={qr => { setEscaneando(false); abrirCodigo(qr); }}
          onClose={() => setEscaneando(false)}
        />
      )}

      <div className="card">
        <h3>Validar reserva o cobrar con código</h3>
        <p className="muted small">Escanea el QR del conductor: si ya está dentro te lleva directo a cobrar. También puedes ingresar el código a mano.</p>
        {mensaje && (
          <div ref={mensajeRef} className={'badge ' + mensaje.tipo}>
            <span style={{ flex: 1 }}>{mensaje.texto}</span>
            {mensaje.imprimir && <button type="button" className="secondary small" onClick={mensaje.imprimir}><Icon name="printer" size={16} />Imprimir comprobante</button>}
          </div>
        )}
        <div className="row-form">
          <input className="mono" placeholder="Código del ticket o reserva" value={codigo} onChange={e => setCodigo(e.target.value)} aria-label="Código del ticket o reserva" />
          <button type="button" className="secondary" onClick={() => setEscaneando(true)}><Icon name="camera" />Escanear QR</button>
        </div>
        <div className="row-form" style={{ marginTop: 10 }}>
          <button type="button" className="secondary" onClick={() => validarReserva()} disabled={!!loading}>{loading === 'checkin' ? <span className="spinner" /> : <Icon name="check" />}Validar reserva</button>
          <button type="button" onClick={() => iniciarCobro()} disabled={!!loading}>{loading === 'cobro' ? <span className="spinner" /> : <Icon name="coin" />}Cobrar</button>
        </div>
      </div>
    </>
  );
}

function EstacionamientosTab({ parking, reloadParking, ticketInicial, onTicketConsumido }) {
  const [ticketEmitido, setTicketEmitido] = useState(null);
  const [emitiendo, setEmitiendo] = useState(null); // { p, patente, loading }
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [editandoHorario, setEditandoHorario] = useState(null); // id del estacionamiento
  // Se fija solo en el montaje: el propio GestionTicketPanel limpia ticketInicial (para sacar el
  // código de la URL) apenas lo consume, y no queremos que ese cambio nos saque de este modo a
  // mitad del cobro (desmontando el panel justo cuando la cotización está por llegar).
  const [modoDirecto] = useState(() => !!ticketInicial);

  function iniciarEmision(p) {
    setEmitiendo({ p, patente: '', loading: false });
  }

  async function confirmarEmision() {
    const { p, patente } = emitiendo;
    setEmitiendo(e => ({ ...e, loading: true }));
    try {
      const r = await api.post('/tickets', { estacionamiento_id: p.id, patente: patente.trim().toUpperCase() || null });
      setTicketEmitido({ codigo: r.data.codigo_qr, nombre: p.nombre, direccion: p.direccion, patente: r.data.patente, fechaEntrada: r.data.fecha_entrada, tarifa: formatTarifa(p) });
      setEmitiendo(null);
      reloadParking();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al emitir ticket');
      setEmitiendo(e => ({ ...e, loading: false }));
    }
  }

  // Llegó por un enlace o un QR ya escaneado: el código identifica el ticket sin ambigüedad,
  // así que va directo al cobro/validación sin pedir primero que elija un estacionamiento.
  if (modoDirecto) {
    return <GestionTicketPanel reloadParking={reloadParking} ticketInicial={ticketInicial} onTicketConsumido={onTicketConsumido} />;
  }

  const seleccionado = parking.find(p => p.id === seleccionadoId) || null;

  if (!seleccionado) {
    return (
      <div>
        <div className="grid">
          {parking.map(p => (
            <div className="card" key={p.id}>
              <h3>{p.nombre}</h3>
              <p className="muted small" style={{ margin: 0 }}>{p.direccion}</p>
              <Capacidad libres={p.cupos_disponibles} total={p.cupo_maximo} />
              <p className="small" style={{ margin: 0 }}><Tarifa {...p} /></p>
              <p className="small" style={{ margin: 0 }}><EstadoHorario estado={p.horario_estado} /></p>
              <p className="muted small" style={{ margin: 0 }}><Icon name="clock" size={15} /> {resumenHorario(p.horario)}</p>
              {editandoHorario === p.id ? (
                <HorarioEditor
                  nombre={p.nombre}
                  horario={p.horario}
                  onCancelar={() => setEditandoHorario(null)}
                  onGuardar={async horario => { await api.put(`/parking/${p.id}/horario`, { horario }); setEditandoHorario(null); reloadParking(); }}
                />
              ) : (
                <div className="row-form">
                  <button type="button" onClick={() => setSeleccionadoId(p.id)} aria-label={`Abrir ${p.nombre}`}>Abrir<Icon name="arrowRight" size={16} /></button>
                  <button type="button" className="secondary" onClick={() => setEditandoHorario(p.id)} aria-label={`Horario de ${p.nombre}`}><Icon name="clock" size={16} />Horario</button>
                </div>
              )}
            </div>
          ))}
          {parking.length === 0 && <div className="empty-state">Aún no tienes estacionamientos asignados. Pide al administrador que registre uno a tu nombre.</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="link-button" onClick={() => setSeleccionadoId(null)} style={{ marginTop: 8 }}><Icon name="arrowLeft" size={16} />Volver a mis estacionamientos</button>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>{seleccionado.nombre}</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>{seleccionado.direccion} · <Tarifa {...seleccionado} /></p>
          </div>
          {!emitiendo && (
            <button type="button" onClick={() => iniciarEmision(seleccionado)} disabled={seleccionado.cupos_disponibles <= 0}><Icon name="ticket" />Emitir ticket en {seleccionado.nombre}</button>
          )}
        </div>
        <div style={{ marginTop: 14 }}><Capacidad libres={seleccionado.cupos_disponibles} total={seleccionado.cupo_maximo} /></div>
      </div>

      {emitiendo && (
        <div className="card">
          <h3>Emitir ticket en {emitiendo.p.nombre}</h3>
          <p className="muted small">{emitiendo.p.direccion}</p>
          <div className="row-form">
            <input
              className="mono"
              placeholder="Patente del vehículo (opcional)"
              value={emitiendo.patente}
              onChange={e => setEmitiendo({ ...emitiendo, patente: e.target.value })}
              aria-label="Patente del vehículo"
              autoFocus
            />
          </div>
          <div className="row-form" style={{ marginTop: 12 }}>
            <button type="button" onClick={confirmarEmision} disabled={emitiendo.loading}>
              {emitiendo.loading ? <span className="spinner" /> : <Icon name="check" />}Confirmar emisión en {emitiendo.p.nombre}
            </button>
            <button type="button" className="secondary" onClick={() => setEmitiendo(null)} disabled={emitiendo.loading}>Cancelar</button>
          </div>
        </div>
      )}
      {ticketEmitido && (
        <div className="card centrado">
          <h3>Ticket emitido en {ticketEmitido.nombre}</h3>
          <p className="muted">Entrega este código QR al conductor: con la cámara de su teléfono verá cuánto lleva estacionado y cuánto debe pagar.</p>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <QRCodeCanvas value={qrPayload(ticketEmitido.codigo)} downloadable filename={`ticket-${ticketEmitido.codigo.slice(0, 8)}`} label="Código QR del ticket" />
          </div>
          <p className="codigo-largo">{ticketEmitido.codigo}</p>
          <div className="row-form">
            <button type="button" onClick={() => imprimirTicket({
              nombreEstacionamiento: ticketEmitido.nombre,
              direccion: ticketEmitido.direccion,
              codigo: ticketEmitido.codigo,
              detalle: [
                ['Patente', ticketEmitido.patente || '—'],
                ['Entrada', new Date(ticketEmitido.fechaEntrada).toLocaleString('es-CL')],
                ['Tarifa', ticketEmitido.tarifa]
              ],
              pie: 'Conserve este ticket para retirar su vehículo'
            })}><Icon name="printer" />Imprimir ticket</button>
            <button type="button" className="secondary" onClick={() => setTicketEmitido(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <GestionTicketPanel key={seleccionado.id} reloadParking={reloadParking} estacionamientoId={seleccionado.id} estacionamientoNombre={seleccionado.nombre} />
    </div>
  );
}

function exportarCSV(tickets, fecha) {
  const encabezado = ['Estacionamiento', 'Patente', 'Entrada', 'Salida', 'Estado', 'Método', 'Cobro'];
  const filas = tickets.map(t => [
    t.estacionamiento_nombre,
    t.patente || '',
    t.fecha_entrada ? new Date(t.fecha_entrada).toLocaleString('es-CL') : '',
    t.fecha_salida ? new Date(t.fecha_salida).toLocaleString('es-CL') : '',
    t.estado,
    METODO_LABEL[t.metodo_pago] || '',
    t.monto != null ? Number(t.monto) : ''
  ]);
  // Excel en español usa ";" como separador de lista: con "," abre todo en una sola columna.
  // Un texto que empieza con = + - @ se neutraliza para que Excel no lo ejecute como fórmula.
  const celda = v => {
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [encabezado, ...filas]
    .map(fila => fila.map(celda).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tickets_${fecha}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DashboardTab({ parking }) {
  const [estacionamientoId, setEstacionamientoId] = useState('');
  const [fecha, setFecha] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  // 'dia': el detalle de una fecha; '7' / '30': estadísticas de los últimos días.
  const [vista, setVista] = useState('dia');

  // Igual que la tabla de vehículos activos, se refresca solo: si no, una venta recién cobrada no
  // aparece hasta que el dueño cambie el filtro o recargue la página a mano.
  useEffect(() => {
    if (vista !== 'dia') return;
    let cancelado = false;
    function cargar(mostrarSpinner) {
      if (mostrarSpinner) setLoading(true);
      api.get('/tickets/dashboard', { params: { estacionamiento_id: estacionamientoId || undefined, fecha } })
        .then(r => { if (!cancelado) { setData(r.data); setError(null); } })
        .catch(err => { if (!cancelado) setError(err.response?.data?.error || 'No se pudieron cargar los datos del dashboard.'); })
        .finally(() => { if (mostrarSpinner && !cancelado) setLoading(false); });
    }
    cargar(true);
    const id = setInterval(() => cargar(false), 20000);
    return () => { cancelado = true; clearInterval(id); };
  }, [estacionamientoId, fecha, recarga, vista]);

  const esHoy = fecha === todayStr();
  const maxEntradas = data ? Math.max(1, ...data.flujoPorHora.map(h => h.entradas)) : 1;
  const porMetodo = data?.cobradoPorMetodo;
  const abonos = data?.abonosReservas;
  const resumenFlujo = data
    ? (data.horaPico
        ? `Vehículos ingresados por hora. Mayor flujo entre las ${data.horaPico.hora}:00 y las ${data.horaPico.hora + 1}:00, con ${data.horaPico.entradas} vehículos.`
        : 'Vehículos ingresados por hora. Sin movimiento este día.')
    : '';
  const { pageItems: ticketsPagina, page: ticketsPage, setPage: setTicketsPage, totalPages: ticketsTotalPages } = usePagination(data?.tickets || [], 10);

  return (
    <div>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="row-form">
          <select value={estacionamientoId} onChange={e => setEstacionamientoId(e.target.value)} aria-label="Filtrar por estacionamiento">
            <option value="">Todos mis estacionamientos</option>
            {parking.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div className="segmentos" role="radiogroup" aria-label="Período">
            {[['dia', 'Un día'], ['7', '7 días'], ['30', '30 días']].map(([v, texto]) => (
              <button key={v} type="button" role="radio" className="filtro" aria-checked={vista === v} onClick={() => setVista(v)}>{texto}</button>
            ))}
          </div>
          {vista === 'dia' && <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={todayStr()} aria-label="Filtrar por fecha" />}
        </div>
      </div>

      {vista !== 'dia' && <Estadisticas estacionamientoId={estacionamientoId} dias={Number(vista)} />}

      {vista === 'dia' && loading && <p className="loading-line"><span className="spinner" />Cargando datos...</p>}

      {vista === 'dia' && error && !loading && (
        <div className="card" role="alert">
          <p className="badge off" style={{ margin: 0 }}>
            {data ? `${error} Se muestran los últimos datos cargados.` : error}
          </p>
          <div className="row-form" style={{ marginTop: 8 }}>
            <button type="button" className="secondary" onClick={() => setRecarga(n => n + 1)}><Icon name="refresh" />Reintentar</button>
          </div>
        </div>
      )}

      {vista === 'dia' && data && !loading && (
        <>
          <section className="tablero" aria-label="Resumen del día">
            <div className="celda">
              <h3>Vehículos ingresados</h3>
              <p className="cifra">{data.totalTickets}</p>
              {esHoy && data.vehiculosDentro != null && (
                <small>{data.vehiculosDentro} dentro ahora</small>
              )}
            </div>
            <div className="celda">
              <h3>Cobrado en caja</h3>
              <p className="cifra">${data.totalCobrado.toLocaleString('es-CL')}</p>
              {data.cobros != null && (
                <small>
                  {data.cobros} {data.cobros === 1 ? 'cobro' : 'cobros'}
                  {data.ticketPromedio != null && ` · promedio $${data.ticketPromedio.toLocaleString('es-CL')}`}
                </small>
              )}
              {porMetodo && data.totalCobrado > 0 && (
                <ul>
                  {['EFECTIVO', 'DEBITO', 'CREDITO'].map(m => (
                    <li key={m}><span>{METODO_LABEL[m]}</span> <strong>${porMetodo[m].toLocaleString('es-CL')}</strong></li>
                  ))}
                  {porMetodo.SIN_REGISTRO > 0 && (
                    <li><span>Sin medio registrado</span> <strong>${porMetodo.SIN_REGISTRO.toLocaleString('es-CL')}</strong></li>
                  )}
                </ul>
              )}
              {abonos && abonos.cantidad > 0 && (
                <p className="detalle" style={{ margin: '8px 0 0' }}>
                  Además: ${abonos.monto.toLocaleString('es-CL')} en {abonos.cantidad} {abonos.cantidad === 1 ? 'abono' : 'abonos'} de reserva pagados online (Webpay), descontados al cobrar.
                </p>
              )}
            </div>
            <div className="celda">
              <h3>Permanencia promedio</h3>
              {data.permanenciaPromedioMin != null
                ? <p className="cifra mediana">{formatDuracion(data.permanenciaPromedioMin)}</p>
                : <p className="detalle">Sin cobros este día</p>}
            </div>
            <div className="celda">
              <h3>Hora de mayor flujo</h3>
              {data.horaPico
                ? <><p className="cifra mediana">{String(data.horaPico.hora).padStart(2, '0')}:00–{String(data.horaPico.hora + 1).padStart(2, '0')}:00</p><small>{data.horaPico.entradas} {data.horaPico.entradas === 1 ? 'vehículo ingresado' : 'vehículos ingresados'}</small></>
                : <p className="detalle">Sin movimiento este día</p>}
            </div>
          </section>

          <div className="card">
            <h3>Flujo de vehículos por hora</h3>
            {!data.horaPico ? (
              <p className="flujo-vacio">Sin movimiento este día. Cuando ingresen vehículos, verás aquí cuántos entran en cada hora.</p>
            ) : (<>
            <div className="flujo" role="img" aria-label={resumenFlujo}>
              {data.flujoPorHora.map(h => (
                <div
                  key={h.hora}
                  title={`${h.hora}:00 — ${h.entradas} vehículos`}
                  className={'col' + (h.entradas === 0 ? ' cero' : '') + (data.horaPico && data.horaPico.hora === h.hora ? ' pico' : '')}
                >
                  <i style={{ height: `${Math.max(2, (h.entradas / maxEntradas) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flujo-ejes" aria-hidden="true">
              {data.flujoPorHora.map(h => (
                <span key={h.hora}>{h.hora % 3 === 0 ? h.hora : ''}</span>
              ))}
            </div>
            </>)}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Detalle de tickets</h3>
              <button type="button" className="secondary small" onClick={() => exportarCSV(data.tickets, fecha)} disabled={data.tickets.length === 0}><Icon name="download" size={16} />Exportar CSV</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Estacionamiento</th><th>Patente</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Método</th><th>Cobro</th></tr></thead>
                <tbody>
                  {ticketsPagina.map(t => (
                    <tr key={t.id}>
                      <td>{t.estacionamiento_nombre}</td>
                      <td className="mono">{t.patente || '—'}</td>
                      <td className="mono">{fmtHoraEnDia(t.fecha_entrada, fecha)}</td>
                      <td className="mono">{fmtHoraEnDia(t.fecha_salida, fecha)}</td>
                      <td><span className={'badge ' + (ESTADO_TICKET[t.estado]?.cls || 'neutral')}>{ESTADO_TICKET[t.estado]?.texto || t.estado}</span></td>
                      <td>{METODO_LABEL[t.metodo_pago] || '—'}</td>
                      <td className="mono">{t.monto != null ? `$${Number(t.monto).toLocaleString('es-CL')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.tickets.length === 0 && <div className="empty-state">No hay tickets emitidos ni cobrados ese día.</div>}
            </div>
            <Pagination page={ticketsPage} totalPages={ticketsTotalPages} onChange={setTicketsPage} />
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientePanel({ ticketInicial = null, onTicketConsumido }) {
  const [tab, setTab] = useState('estacionamientos');
  const [parking, setParking] = useState([]);
  const reloadParking = () => api.get('/parking/mine').then(r => setParking(r.data));
  useEffect(() => { reloadParking(); }, []);

  return (
    <div>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'estacionamientos' && <EstacionamientosTab parking={parking} reloadParking={reloadParking} ticketInicial={ticketInicial} onTicketConsumido={onTicketConsumido} />}
      {tab === 'dashboard' && <DashboardTab parking={parking} />}
    </div>
  );
}
