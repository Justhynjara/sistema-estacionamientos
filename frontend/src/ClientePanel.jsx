import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import QRCodeCanvas from './QRCode.jsx';
import Pagination, { usePagination } from './Pagination.jsx';
import { imprimirTicket } from './utils/print.js';

function Tabs({ tab, setTab }) {
  const tabs = [['estacionamientos', '🅿️ Mis estacionamientos'], ['dashboard', '📊 Dashboard de tickets']];
  return (
    <div className="tabs">
      {tabs.map(([k, label]) => (
        <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</button>
      ))}
    </div>
  );
}

function todayStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function redirectToWebpay(url, token) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token_ws';
  input.value = token;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

function tiempoTranscurrido(iso) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

function GestionTicketPanel({ reloadParking }) {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [cobro, setCobro] = useState(null);
  const [activos, setActivos] = useState([]);

  function cargarActivos() {
    api.get('/tickets/active').then(r => setActivos(r.data)).catch(() => {});
  }
  useEffect(() => {
    cargarActivos();
    const id = setInterval(cargarActivos, 20000);
    return () => clearInterval(id);
  }, []);

  async function validarReserva(qr) {
    const c = qr || codigo.trim();
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

  async function iniciarCobroEfectivo(qr) {
    const c = qr || codigo.trim();
    if (!c) return;
    setLoading('efectivo'); setMensaje(null); setCobro(null);
    try {
      const q = await api.post('/tickets/quote', { codigo_qr: c });
      setCobro({
        codigo: c,
        monto: Number(q.data.monto),
        patente: q.data.patente,
        estacionamiento_nombre: q.data.estacionamiento_nombre,
        direccion: q.data.estacionamiento_direccion,
        fecha_entrada: q.data.fecha_entrada,
        recibido: ''
      });
    } catch (err) { setMensaje({ tipo: 'off', texto: err.response?.data?.error || 'No se pudo calcular el cobro' }); }
    finally { setLoading(''); }
  }

  async function confirmarCobroEfectivo() {
    if (!cobro) return;
    const recibido = Number(cobro.recibido);
    if (!recibido || recibido < cobro.monto) return;
    setLoading('efectivo-confirm');
    try {
      const r = await api.post('/tickets/close', { codigo_qr: cobro.codigo });
      const monto = Number(r.data.monto);
      const vuelto = recibido - monto;
      setMensaje({
        tipo: 'ok',
        texto: vuelto >= 0
          ? `Cobro registrado: $${monto.toLocaleString('es-CL')} — Vuelto: $${vuelto.toLocaleString('es-CL')}`
          : `Cobro registrado: $${monto.toLocaleString('es-CL')} — Faltan $${Math.abs(vuelto).toLocaleString('es-CL')} (el tiempo avanzó a la hora siguiente)`,
        imprimir: () => imprimirTicket({
          nombreEstacionamiento: r.data.estacionamiento_nombre,
          direccion: r.data.estacionamiento_direccion,
          codigo: r.data.codigo_qr,
          detalle: [
            ['Patente', r.data.patente || '—'],
            ['Entrada', new Date(r.data.fecha_entrada).toLocaleString('es-CL')],
            ['Salida', new Date().toLocaleString('es-CL')],
            ['Total a pagar', `$${monto.toLocaleString('es-CL')}`],
            ['Recibido', `$${recibido.toLocaleString('es-CL')}`],
            ['Vuelto', `$${Math.max(0, vuelto).toLocaleString('es-CL')}`]
          ],
          pie: 'Comprobante de pago — Gracias por su preferencia'
        })
      });
      setCobro(null); setCodigo('');
      reloadParking(); cargarActivos();
    } catch (err) { setMensaje({ tipo: 'off', texto: err.response?.data?.error || 'No se pudo cerrar el ticket' }); }
    finally { setLoading(''); }
  }

  async function cobrarWebpay(qr) {
    const c = qr || codigo.trim();
    if (!c) return;
    setLoading('webpay'); setMensaje(null); setCobro(null);
    try {
      const r = await api.post('/payments/webpay/start', { codigo_qr: c });
      redirectToWebpay(r.data.url, r.data.token);
    } catch (err) {
      setMensaje({ tipo: 'off', texto: err.response?.data?.error || 'No se pudo iniciar el pago' });
      setLoading('');
    }
  }

  const vuelto = cobro && cobro.recibido ? Number(cobro.recibido) - cobro.monto : null;

  return (
    <>
      <div className="card">
        <h3>Vehículos activos</h3>
        {activos.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay vehículos dentro en este momento.</p>}
        {activos.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Patente</th><th>Estacionamiento</th><th>Entrada</th><th>Tiempo</th><th></th></tr></thead>
              <tbody>
                {activos.map(t => (
                  <tr key={t.id}>
                    <td>{t.patente || '—'}</td>
                    <td>{t.estacionamiento_nombre}</td>
                    <td>{fmtHora(t.fecha_entrada)}</td>
                    <td>{tiempoTranscurrido(t.fecha_entrada)}</td>
                    <td>
                      <div className="row-form" style={{ margin: 0 }}>
                        <button type="button" className="secondary" disabled={!!loading} onClick={() => iniciarCobroEfectivo(t.codigo_qr)}>💵 Efectivo</button>
                        <button type="button" disabled={!!loading} onClick={() => cobrarWebpay(t.codigo_qr)}>💳 Webpay</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cobro && (
        <div className="card">
          <h3>Cobro en efectivo — {cobro.patente || 'sin patente'}</h3>
          <p>{cobro.estacionamiento_nombre}</p>
          <p style={{ fontSize: '1.3rem', fontWeight: 800 }}>Total a pagar: ${cobro.monto.toLocaleString('es-CL')}</p>
          <div className="row-form">
            <input
              type="number"
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
            <button type="button" onClick={confirmarCobroEfectivo} disabled={!cobro.recibido || vuelto < 0 || loading === 'efectivo-confirm'}>
              {loading === 'efectivo-confirm' && <span className="spinner" />}✅ Confirmar cobro
            </button>
            <button type="button" className="secondary" onClick={() => setCobro(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Validar reserva o cobrar con código</h3>
        <p>Si el conductor te muestra el código (QR escaneado o reserva), ingrésalo aquí.</p>
        {mensaje && (
          <p className={'badge ' + mensaje.tipo}>
            {mensaje.texto}
            {mensaje.imprimir && <button type="button" className="secondary" style={{ marginLeft: 10 }} onClick={mensaje.imprimir}>🖨️ Imprimir comprobante</button>}
          </p>
        )}
        <div className="row-form">
          <input placeholder="Código del ticket o reserva" value={codigo} onChange={e => setCodigo(e.target.value)} aria-label="Código del ticket o reserva" />
        </div>
        <div className="row-form">
          <button type="button" onClick={() => validarReserva()} disabled={!!loading}>{loading === 'checkin' && <span className="spinner" />}✅ Validar reserva</button>
          <button type="button" onClick={() => iniciarCobroEfectivo()} disabled={!!loading} className="secondary">💵 Cobrar en efectivo</button>
          <button type="button" onClick={() => cobrarWebpay()} disabled={!!loading}>{loading === 'webpay' && <span className="spinner" />}💳 Cobrar con Webpay</button>
        </div>
      </div>
    </>
  );
}

function EstacionamientosTab({ parking, reloadParking }) {
  const [ticketEmitido, setTicketEmitido] = useState(null);

  async function emitirTicket(p) {
    const patente = prompt('Patente del vehículo (opcional)') || null;
    try {
      const r = await api.post('/tickets', { estacionamiento_id: p.id, patente });
      setTicketEmitido({ codigo: r.data.codigo_qr, nombre: p.nombre, direccion: p.direccion, patente: r.data.patente, fechaEntrada: r.data.fecha_entrada, precioHora: p.precio_hora });
      reloadParking();
    } catch (err) { alert(err.response?.data?.error || 'Error al emitir ticket'); }
  }
  return (
    <div>
      {ticketEmitido && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h3>🎫 Ticket emitido en {ticketEmitido.nombre}</h3>
          <p>Entrega este código QR al conductor:</p>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <QRCodeCanvas value={ticketEmitido.codigo} downloadable filename={`ticket-${ticketEmitido.codigo.slice(0, 8)}`} />
          </div>
          <p style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '.8rem', wordBreak: 'break-all' }}>{ticketEmitido.codigo}</p>
          <div className="row-form" style={{ justifyContent: 'center' }}>
            <button type="button" onClick={() => imprimirTicket({
              nombreEstacionamiento: ticketEmitido.nombre,
              direccion: ticketEmitido.direccion,
              codigo: ticketEmitido.codigo,
              detalle: [
                ['Patente', ticketEmitido.patente || '—'],
                ['Entrada', new Date(ticketEmitido.fechaEntrada).toLocaleString('es-CL')],
                ['Precio/hora', `$${Number(ticketEmitido.precioHora).toLocaleString('es-CL')}`]
              ],
              pie: 'Conserve este ticket para retirar su vehículo'
            })}>🖨️ Imprimir ticket</button>
            <button type="button" className="secondary" onClick={() => setTicketEmitido(null)}>Cerrar</button>
          </div>
        </div>
      )}
      <div className="grid">
        {parking.map(p => (
          <div className="card" key={p.id}>
            <h3>{p.nombre}</h3>
            <p>{p.direccion}</p>
            <p>💰 ${Number(p.precio_hora).toLocaleString('es-CL')} / hora</p>
            <p className={'badge ' + (p.cupos_disponibles > 0 ? 'ok' : 'off')}>🅿️ {p.cupos_disponibles} / {p.cupo_maximo} disponibles</p>
            <button onClick={() => emitirTicket(p)} disabled={p.cupos_disponibles <= 0}>🎫 Emitir ticket</button>
          </div>
        ))}
        {parking.length === 0 && <div className="empty-state">Aún no tienes estacionamientos asignados. Pide al administrador que registre uno a tu nombre.</div>}
      </div>
      {parking.length > 0 && <GestionTicketPanel reloadParking={reloadParking} />}
    </div>
  );
}

function exportarCSV(tickets, fecha) {
  const encabezado = ['Estacionamiento', 'Patente', 'Entrada', 'Salida', 'Estado', 'Cobro'];
  const filas = tickets.map(t => [
    t.estacionamiento_nombre,
    t.patente || '',
    t.fecha_entrada ? new Date(t.fecha_entrada).toLocaleString('es-CL') : '',
    t.fecha_salida ? new Date(t.fecha_salida).toLocaleString('es-CL') : '',
    t.estado,
    t.monto != null ? Number(t.monto) : ''
  ]);
  const csv = [encabezado, ...filas]
    .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
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

  useEffect(() => {
    setLoading(true);
    api.get('/tickets/dashboard', { params: { estacionamiento_id: estacionamientoId || undefined, fecha } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [estacionamientoId, fecha]);

  const maxEntradas = data ? Math.max(1, ...data.flujoPorHora.map(h => h.entradas)) : 1;
  const { pageItems: ticketsPagina, page: ticketsPage, setPage: setTicketsPage, totalPages: ticketsTotalPages } = usePagination(data?.tickets || [], 10);

  return (
    <div>
      <div className="card">
        <div className="row-form">
          <select value={estacionamientoId} onChange={e => setEstacionamientoId(e.target.value)} aria-label="Filtrar por estacionamiento">
            <option value="">Todos mis estacionamientos</option>
            {parking.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={todayStr()} aria-label="Filtrar por fecha" />
        </div>
      </div>

      {loading && <p><span className="spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'rgba(67,56,202,.2)' }} />Cargando datos...</p>}

      {data && !loading && (
        <>
          <div className="grid">
            <div className="card">
              <h3>🎫 Tickets emitidos</h3>
              <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{data.totalTickets}</p>
            </div>
            <div className="card">
              <h3>💰 Total cobrado</h3>
              <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>${data.totalCobrado.toLocaleString('es-CL')}</p>
            </div>
            <div className="card">
              <h3>🔥 Hora de mayor flujo</h3>
              {data.horaPico
                ? <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{String(data.horaPico.hora).padStart(2, '0')}:00 – {String(data.horaPico.hora + 1).padStart(2, '0')}:00<br /><small style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{data.horaPico.entradas} vehículos ingresados</small></p>
                : <p style={{ color: 'var(--text-muted)' }}>Sin movimiento este día</p>}
            </div>
          </div>

          <div className="card">
            <h3>Flujo de vehículos por hora</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, marginTop: 12 }}>
              {data.flujoPorHora.map(h => (
                <div key={h.hora} title={`${h.hora}:00 — ${h.entradas} vehículos`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(3, (h.entradas / maxEntradas) * 100)}%`,
                    background: h.entradas > 0 ? 'linear-gradient(180deg,var(--primary-light),var(--primary))' : '#e5e7eb',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height .2s ease'
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
              {data.flujoPorHora.map(h => (
                <div key={h.hora} style={{ flex: 1, textAlign: 'center', fontSize: '.62rem', color: 'var(--text-muted)' }}>
                  {h.hora % 3 === 0 ? h.hora : ''}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Detalle de tickets</h3>
              <button type="button" className="secondary" onClick={() => exportarCSV(data.tickets, fecha)} disabled={data.tickets.length === 0}>⬇️ Exportar CSV</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Estacionamiento</th><th>Patente</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Cobro</th></tr></thead>
                <tbody>
                  {ticketsPagina.map(t => (
                    <tr key={t.id}>
                      <td>{t.estacionamiento_nombre}</td>
                      <td>{t.patente || '—'}</td>
                      <td>{fmtHora(t.fecha_entrada)}</td>
                      <td>{fmtHora(t.fecha_salida)}</td>
                      <td><span className={'badge ' + (t.estado === 'ACTIVO' ? 'ok' : 'off')} style={t.estado !== 'ACTIVO' ? { color: 'var(--text-muted)', background: '#f0f0f5' } : {}}>{t.estado}</span></td>
                      <td>{t.monto != null ? `$${Number(t.monto).toLocaleString('es-CL')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.tickets.length === 0 && <div className="empty-state">No hay tickets emitidos ese día.</div>}
            </div>
            <Pagination page={ticketsPage} totalPages={ticketsTotalPages} onChange={setTicketsPage} />
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientePanel() {
  const [tab, setTab] = useState('estacionamientos');
  const [parking, setParking] = useState([]);
  const reloadParking = () => api.get('/parking/mine').then(r => setParking(r.data));
  useEffect(() => { reloadParking(); }, []);

  return (
    <div>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'estacionamientos' && <EstacionamientosTab parking={parking} reloadParking={reloadParking} />}
      {tab === 'dashboard' && <DashboardTab parking={parking} />}
    </div>
  );
}
