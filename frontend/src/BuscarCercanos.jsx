import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { api, API_ORIGIN } from './services/api.js';
import QRCodeCanvas from './QRCode.jsx';
import AddressAutocomplete from './AddressAutocomplete.jsx';
import { geocode } from './utils/geo.js';
import { imprimirTicket } from './utils/print.js';
import { qrPayload } from './utils/qr.js';
import { redirectToWebpay } from './utils/webpay.js';
import Icon from './Icon.jsx';
import Capacidad from './Capacidad.jsx';
import Tarifa from './Tarifa.jsx';
import EstadoHorario from './EstadoHorario.jsx';
import { textoEstado } from './utils/horario.js';
import { formatCLP } from './utils/tarifa.js';
import { FILTROS_INICIALES, HORAS_ESTADIA, aplicarFiltros } from './utils/filtros.js';

const SOCKET_URL = API_ORIGIN;
// Con destino se buscan estacionamientos para dejar el auto y caminar: radio corto. Sin destino
// (el conductor solo quiere estacionar cerca de donde está) se amplía a 15 km a la redonda.
const RADIO_DESTINO_KM = 5;
const RADIO_CERCA_KM = 15;
const REROUTE_THRESHOLD_M = 30;

// Marcadores dibujados con el mismo lenguaje que la lista: tu ubicación es el origen de la línea,
// el destino es la estación final y cada estacionamiento es una parada con el número de la lista.
function divIcon(html, size) {
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
}
const userIcon = divIcon('<div class="map-yo"></div>', 18);
const destinoIcon = divIcon('<div class="map-destino"></div>', 16);
function paradaIcon(n, lleno, sel, cerrado) {
  return divIcon(`<div class="map-stop${cerrado ? ' cerrado' : lleno ? ' lleno' : ''}${sel ? ' sel' : ''}"><span>${n}</span></div>`, 34);
}

// Fuera de su horario un estacionamiento se muestra, pero no se puede reservar ni ir hacia él.
const estaCerrado = p => p.horario_estado ? !p.horario_estado.abierto : false;

function formatDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

// La misma distancia separada en cifra y unidad, para destacar la cifra.
function partesDistancia(km) {
  return km < 1
    ? { valor: String(Math.round(km * 1000)), unidad: 'm' }
    : { valor: km.toFixed(1).replace('.', ','), unidad: 'km' };
}

// Lo que le importa a quien estaciona es cuánto camina hasta su destino: a paso normal
// (unos 80 m por minuto), redondeado hacia arriba y nunca menos de un minuto.
const METROS_POR_MINUTO_A_PIE = 80;
function minutosAPie(km) {
  return Math.max(1, Math.ceil((km * 1000) / METROS_POR_MINUTO_A_PIE));
}

const GEO_ERROR = 'No pudimos leer tu GPS. Escribe una dirección o toca el mapa.';

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function routeSummary(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.code !== 'Ok') return null;
  const route = data.routes[0];
  return { distanciaKm: route.distance / 1000, duracionMin: route.duration / 60 };
}

async function routeGeometry(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.code !== 'Ok') throw new Error('No se pudo calcular la ruta');
  const route = data.routes[0];
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanciaKm: route.distance / 1000,
    duracionMin: route.duration / 60
  };
}

// Recentra solo cuando cambian las coordenadas (no en cada render: una actualización de cupos por
// socket no debe devolver el mapa al centro si el conductor lo movió).
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

// Tras cada búsqueda, encuadra la partida, el destino y todos los resultados: con 15 km de radio
// los más lejanos quedarían fuera del zoom por defecto.
function AjustarVista({ clave, puntos }) {
  const map = useMap();
  useEffect(() => {
    if (!clave || puntos.length < 2) return;
    map.fitBounds(L.latLngBounds(puntos), { padding: [48, 48], maxZoom: 15 });
  }, [clave, map]);
  return null;
}

function ClickToSetLocation({ onSelect }) {
  useMapEvents({ click(e) { onSelect({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function Countdown({ expira }) {
  const [restanteMs, setRestanteMs] = useState(new Date(expira) - new Date());
  useEffect(() => {
    const id = setInterval(() => setRestanteMs(new Date(expira) - new Date()), 1000);
    return () => clearInterval(id);
  }, [expira]);
  if (restanteMs <= 0) return <span className="badge off">La reserva expiró</span>;
  const min = Math.floor(restanteMs / 60000);
  const seg = Math.floor((restanteMs % 60000) / 1000);
  return <span className="badge ok">Válida por <span className="mono">{min}:{String(seg).padStart(2, '0')}</span> min</span>;
}

export default function BuscarCercanos({ reservaCodigoInicial } = {}) {
  const [userPos, setUserPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [origen, setOrigen] = useState('');
  const [origenLoading, setOrigenLoading] = useState(false);
  const [destino, setDestino] = useState('');
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(false);
  // 'destino': opciones junto al destino escrito; 'cerca': sin destino, alrededor de tu partida.
  // null mientras no se ha buscado nada.
  const [modo, setModo] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [reservaError, setReservaError] = useState('');
  const [reservandoId, setReservandoId] = useState(null);
  const [reservaPendiente, setReservaPendiente] = useState(null);
  const [patenteReserva, setPatenteReserva] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const lastRoutedFrom = useRef(null);
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());
  const manualModeRef = useRef(false);

  useEffect(() => { manualModeRef.current = manualMode; }, [manualMode]);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoError('Tu navegador no tiene GPS. Escribe una dirección o toca el mapa.'); return; }
    const watchId = navigator.geolocation.watchPosition(
      pos => { if (!manualModeRef.current) setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { if (!manualModeRef.current) setGeoError(GEO_ERROR); },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!reservaCodigoInicial) return;
    api.get(`/tickets/reserva/${reservaCodigoInicial}`)
      .then(r => setReserva({
        codigo: r.data.codigo_qr,
        nombre: r.data.estacionamiento_nombre,
        direccion: r.data.estacionamiento_direccion,
        expira: r.data.reserva_expira,
        latitud: r.data.latitud,
        longitud: r.data.longitud
      }))
      .catch(() => setReservaError('Tu pago se procesó, pero no pudimos recuperar el comprobante de la reserva. Si el pago fue aprobado, contacta al estacionamiento.'));
  }, [reservaCodigoInicial]);

  function setManualLocation(coords) {
    setUserPos(coords);
    setManualMode(true);
    setGeoError('');
  }

  function usarGPS() {
    setManualMode(false);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(GEO_ERROR),
      { enableHighAccuracy: true }
    );
  }

  async function usarOrigenEscrito(e) {
    e.preventDefault();
    if (!origen.trim()) return;
    setOrigenLoading(true); setError('');
    try {
      const coords = await geocode(origen.trim());
      setManualLocation(coords);
    } catch (err) {
      setError(err.message || 'No se encontró esa dirección');
    } finally {
      setOrigenLoading(false);
    }
  }

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('cuposActualizados', data => {
      setParkings(prev => prev.map(x => x.id === data.estacionamiento_id
        ? { ...x, cupos_disponibles: data.cupos_disponibles, cupo_maximo: data.cupo_maximo }
        : x));
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, []);

  function subscribeCupos(list) {
    const socket = socketRef.current;
    if (!socket) return;
    const nuevos = new Set(list.map(p => p.id));
    joinedRoomsRef.current.forEach(id => { if (!nuevos.has(id)) socket.emit('leaveParking', id); });
    nuevos.forEach(id => { if (!joinedRoomsRef.current.has(id)) socket.emit('joinParking', id); });
    joinedRoomsRef.current = nuevos;
  }

  async function buscarCercaDe(destCoords, modoBusqueda = 'destino') {
    setError(''); setLoading(true); setSelectedId(null); setSelectedRoute(null);
    try {
      if (!destCoords) throw new Error('Aún no se ha obtenido tu ubicación actual');
      setModo(modoBusqueda);
      // Sin destino no hay una "estación final" que marcar: el centro es tu propia ubicación.
      setDestinoCoords(modoBusqueda === 'destino' ? destCoords : null);

      const radiusKm = modoBusqueda === 'cerca' ? RADIO_CERCA_KM : RADIO_DESTINO_KM;
      const r = await api.get('/parking/nearby', { params: { lat: destCoords.lat, lng: destCoords.lng, radiusKm } });
      const candidatos = r.data.slice(0, 8);

      if (userPos) {
        const conRuta = await Promise.all(candidatos.map(async p => {
          try {
            const resumen = await routeSummary(userPos, { lat: Number(p.latitud), lng: Number(p.longitud) });
            return { ...p, ruta: resumen };
          } catch { return { ...p, ruta: null }; }
        }));
        setParkings(conRuta);
        subscribeCupos(conRuta);
      } else {
        setParkings(candidatos);
        subscribeCupos(candidatos);
      }
    } catch (err) {
      setError(err.message || 'Error al buscar estacionamientos');
      setParkings([]);
    } finally {
      setLoading(false);
    }
  }

  async function buscar(e) {
    e.preventDefault();
    if (!destino.trim()) {
      if (!userPos) {
        setError('Para buscar sin destino necesitamos tu partida: activa el GPS, escribe una dirección en "Desde" o toca el mapa.');
        return;
      }
      await buscarCercaDe(userPos, 'cerca');
      return;
    }
    setError(''); setLoading(true);
    try {
      const destCoords = await geocode(destino.trim());
      await buscarCercaDe(destCoords);
    } catch (err) {
      setError(err.message || 'No se encontró esa dirección');
      setParkings([]);
      setLoading(false);
    }
  }

  function onDestinoSeleccionado(coords) {
    buscarCercaDe(coords);
  }

  async function verRuta(p) {
    if (estaCerrado(p)) return;
    if (!userPos) { setError('Aún no se ha obtenido tu ubicación actual'); return; }
    setSelectedId(p.id);
    try {
      const ruta = await routeGeometry(userPos, { lat: Number(p.latitud), lng: Number(p.longitud) });
      setSelectedRoute(ruta);
      lastRoutedFrom.current = userPos;
    } catch (err) {
      setError(err.message || 'No se pudo trazar la ruta');
    }
  }

  function abrirWaze(p) {
    const url = `https://waze.com/ul?ll=${p.latitud},${p.longitud}&navigate=yes`;
    window.open(url, '_blank', 'noopener');
  }

  function iniciarReserva(p) {
    if (estaCerrado(p)) return;
    setReservaPendiente(p);
    setPatenteReserva('');
    setReservaError('');
  }

  async function confirmarReserva(e) {
    e.preventDefault();
    const p = reservaPendiente;
    if (!p || !patenteReserva.trim()) return;
    setReservandoId(p.id); setReservaError('');
    try {
      const r = await api.post('/payments/webpay/reserve-start', { estacionamiento_id: p.id, patente: patenteReserva.trim() });
      redirectToWebpay(r.data.url, r.data.token);
    } catch (err) {
      setReservaError(err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.error || 'No se pudo iniciar el pago de la reserva');
      setReservandoId(null);
    }
  }

  useEffect(() => {
    if (!selectedId || !userPos || !lastRoutedFrom.current) return;
    if (haversineMeters(lastRoutedFrom.current, userPos) < REROUTE_THRESHOLD_M) return;
    const p = parkings.find(x => x.id === selectedId);
    if (!p) return;
    routeGeometry(userPos, { lat: Number(p.latitud), lng: Number(p.longitud) })
      .then(ruta => { setSelectedRoute(ruta); lastRoutedFrom.current = userPos; })
      .catch(() => {});
  }, [userPos, selectedId, parkings]);

  const center = destinoCoords || userPos || { lat: -33.4489, lng: -70.6693 };

  const lista = aplicarFiltros(parkings, filtros);
  const ocultos = parkings.length - lista.length;
  const cambiarFiltro = cambios => setFiltros(f => ({ ...f, ...cambios }));
  const gpsActivo = Boolean(userPos) && !manualMode;
  const origenHint = origenLoading ? 'Ubicando la dirección…'
    : geoError ? geoError
    : !userPos ? 'Esperando tu GPS… también puedes escribir una dirección o tocar el mapa.'
    : manualMode ? 'Partida fijada a mano. Toca el mapa para moverla.'
    : 'Partida: tu ubicación por GPS.';

  return (
    <div className="buscador">
      <div className="buscador-col">
        <section className="rail" aria-label="Buscar estacionamiento">
          <div className="rail-stop">
            <div className="rail-track"><span className="rail-node" /></div>
            <div className="rail-body">
              <form onSubmit={usarOrigenEscrito}>
                <p className="field-label">Desde</p>
                <div className="inputline">
                  <AddressAutocomplete
                    placeholder="Tu ubicación o una dirección"
                    ariaLabel="Tu dirección de partida"
                    value={origen}
                    onChange={setOrigen}
                    onSelect={setManualLocation}
                  />
                  <button
                    type="button"
                    className={'gps-toggle' + (gpsActivo ? ' on' : '')}
                    onClick={usarGPS}
                    aria-pressed={gpsActivo}
                    aria-label="Usar mi ubicación por GPS"
                    title="Usar mi ubicación por GPS"
                  >
                    {origenLoading ? <span className="spinner" /> : <Icon name="gps" size={20} />}
                  </button>
                </div>
                <button className="sr-only" disabled={origenLoading}>Usar esta dirección de partida</button>
              </form>
              <p className={'campo-hint' + (geoError ? ' error' : '')} role="status">{origenHint}</p>
            </div>
          </div>
          <div className="rail-stop">
            <div className="rail-track"><span className="rail-node dest" /></div>
            <div className="rail-body">
              <form onSubmit={buscar}>
                <p className="field-label">Hacia</p>
                <AddressAutocomplete
                  placeholder="Destino (ej: Plaza de Armas, Curicó)"
                  ariaLabel="Destino"
                  value={destino}
                  onChange={setDestino}
                  onSelect={onDestinoSeleccionado}
                />
                <p className="small muted" style={{ margin: '6px 0 0' }}>Déjalo vacío para ver los estacionamientos a {RADIO_CERCA_KM} km de ti.</p>
                {error && <p className="badge off" role="alert">{error}</p>}
                <button className="go" disabled={loading}>{loading ? <span className="spinner" /> : <Icon name="search" />}{loading ? 'Buscando...' : 'Buscar estacionamientos'}</button>
              </form>
            </div>
          </div>
        </section>

        {reservaPendiente && (
          <section className="panel-accion" aria-labelledby="reserva-titulo">
            <h3 id="reserva-titulo"><Icon name="ticket" />Reservar cupo en {reservaPendiente.nombre}</h3>
            <p className="small">Ingresa la patente del vehículo que va a estacionar. Para confirmar, se te pedirá un micropago de <strong>$100 CLP</strong> por Webpay — evita reservas falsas y tu cupo queda apartado por <strong>10 minutos</strong>. Si llegas a tiempo, se descuenta de lo que pagues al salir; si la reserva expira sin usarse, <strong>el monto no se reembolsa</strong>. Si el último cupo se ocupa mientras pagas, anulamos el cobro automáticamente.</p>
            {reservaError && <p className="badge off">{reservaError}</p>}
            <form onSubmit={confirmarReserva}>
              <label htmlFor="patente-reserva">Patente</label>
              <input
                id="patente-reserva"
                className="mono"
                placeholder="AB1234"
                aria-label="Patente del vehículo"
                value={patenteReserva}
                onChange={e => setPatenteReserva(e.target.value.toUpperCase())}
                autoFocus
                required
              />
              <div className="row-form">
                <button disabled={reservandoId === reservaPendiente.id}>{reservandoId === reservaPendiente.id ? <span className="spinner" /> : <Icon name="card" />}Pagar $100 y reservar</button>
                <button type="button" className="secondary" onClick={() => setReservaPendiente(null)}>Cancelar</button>
              </div>
            </form>
          </section>
        )}

        {reserva && (
          <section className="panel-accion centrado" aria-labelledby="reserva-ok-titulo">
            <h3 id="reserva-ok-titulo" style={{ justifyContent: 'center' }}><Icon name="checkCircle" />Reserva confirmada en {reserva.nombre}</h3>
            <p className="small muted">Muestra este código QR al llegar para validar tu cupo, o descárgalo.</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
              <QRCodeCanvas value={qrPayload(reserva.codigo)} downloadable filename={`reserva-${reserva.codigo.slice(0, 8)}`} label="Código QR de tu reserva" />
            </div>
            <p className="codigo-largo">{reserva.codigo}</p>
            <Countdown expira={reserva.expira} />
            <div className="row-form" style={{ marginTop: 12 }}>
              {reserva.latitud && reserva.longitud && (
                <button type="button" className="secondary" onClick={() => abrirWaze({ latitud: reserva.latitud, longitud: reserva.longitud })}><Icon name="nav" />Navegar con Waze</button>
              )}
              <button type="button" onClick={() => imprimirTicket({
                nombreEstacionamiento: reserva.nombre,
                direccion: reserva.direccion,
                codigo: reserva.codigo,
                detalle: [['Válido hasta', new Date(reserva.expira).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })]],
                pie: 'Presenta este comprobante al llegar'
              })}><Icon name="printer" />Imprimir</button>
              <button type="button" className="secondary" onClick={() => setReserva(null)}>Cerrar</button>
            </div>
          </section>
        )}
        {reservaError && !reservaPendiente && <p className="badge off">{reservaError}</p>}

        <section className="opciones" aria-labelledby="opciones-titulo">
          <div className="opciones-cabecera">
          <h2 id="opciones-titulo">
            {modo === 'cerca'
              ? (lista.length > 0
                  ? `${lista.length} ${lista.length === 1 ? 'opción' : 'opciones'} a ${RADIO_CERCA_KM} km de ti`
                  : `Estacionamientos a ${RADIO_CERCA_KM} km de ti`)
              : (lista.length > 0
                  ? `${lista.length} ${lista.length === 1 ? 'opción' : 'opciones'} junto a tu destino`
                  : 'Opciones junto a tu destino')}
          </h2>
          {parkings.length > 1 && (
            <select className="orden" value={filtros.orden} onChange={e => cambiarFiltro({ orden: e.target.value })} aria-label="Ordenar resultados">
              <option value="distancia">Más cerca primero</option>
              <option value="precio">Más barato primero</option>
            </select>
          )}
          </div>
          {parkings.length > 0 && (
            <p className="meta">
              {filtros.orden === 'precio'
                ? `Ordenadas por lo que cuesta quedarse ${filtros.horas} h.`
                : modo === 'cerca' ? 'Ordenadas por distancia desde tu ubicación.' : 'Ordenadas por distancia al destino.'} Los cupos se actualizan en tiempo real.
              {ocultos > 0 && ` ${ocultos} ${ocultos === 1 ? 'oculta' : 'ocultas'} por los filtros.`}
            </p>
          )}
          {parkings.length > 0 && (
            <div className="filtros" role="group" aria-label="Filtrar resultados">
              <div className="filtros-fila">
                <button type="button" className="filtro" aria-pressed={filtros.soloAbiertos} onClick={() => cambiarFiltro({ soloAbiertos: !filtros.soloAbiertos })}>
                  {filtros.soloAbiertos && <Icon name="checkCircle" size={14} />}Solo abiertos
                </button>
                <button type="button" className="filtro" aria-pressed={filtros.soloConCupos} onClick={() => cambiarFiltro({ soloConCupos: !filtros.soloConCupos })}>
                  {filtros.soloConCupos && <Icon name="checkCircle" size={14} />}Solo con cupos
                </button>
              </div>
              <div className="filtros-fila estadia" role="radiogroup" aria-label="Cuánto tiempo te quedarías">
                <span className="filtros-etiqueta">Me quedo</span>
                {HORAS_ESTADIA.map(h => (
                  <button key={h} type="button" role="radio" className="filtro" aria-checked={filtros.horas === h} onClick={() => cambiarFiltro({ horas: h })}>
                    <span className="num">{h}</span> h
                  </button>
                ))}
              </div>
            </div>
          )}
          {lista.length > 0 ? (
            <ol className="paradas">
              {lista.map(p => {
                const lleno = p.cupos_disponibles <= 0;
                const cerrado = estaCerrado(p);
                const sel = selectedId === p.id;
                return (
                  <li className={'parada' + (cerrado ? ' cerrado' : lleno ? ' lleno' : '') + (sel ? ' sel' : '')} key={p.id}>
                    <span className="k" aria-hidden="true">{p.n}</span>
                    <div className="top">
                      <div>
                        <h3>{p.nombre}</h3>
                        <p className="addr">{p.direccion}</p>
                        <p className="horario-linea"><EstadoHorario estado={p.horario_estado} /></p>
                      </div>
                      {modo === 'cerca' && p.distancia_km < 0.05 ? (
                        <div className="dist">
                          <b className="aqui">Aquí</b>
                          <small>a menos de 50 m</small>
                        </div>
                      ) : modo === 'cerca' ? (
                        <div className="dist">
                          <b><span className="num">{partesDistancia(p.distancia_km).valor}</span> {partesDistancia(p.distancia_km).unidad}</b>
                          <small>de ti</small>
                        </div>
                      ) : (
                        <div className="dist">
                          <b><span className="num">{minutosAPie(p.distancia_km)}</span> min</b>
                          <small>a pie · <span className="num">{formatDistancia(p.distancia_km)}</span></small>
                        </div>
                      )}
                    </div>
                    <Capacidad libres={p.cupos_disponibles} total={p.cupo_maximo} />
                    <div className="datos">
                      <span><Icon name="coin" size={16} /><Tarifa {...p} /></span>
                      <span className="costo" title="Estimado. El cobro final depende del tiempo real.">
                        <Icon name="clock" size={16} />
                        <span><span className="num">{filtros.horas}</span> h ≈ <b className="num">{formatCLP(p.costo)}</b></span>
                      </span>
                      {p.ruta && p.ruta.duracionMin >= 1 && <span><Icon name="car" size={16} /><span><span className="num">{Math.round(p.ruta.duracionMin)}</span> min en auto desde tu partida</span></span>}
                    </div>
                    <div className="acciones">
                      <button type="button" className="dark small" onClick={() => iniciarReserva(p)} disabled={lleno || cerrado}>
                        {cerrado ? 'Cerrado ahora' : lleno ? 'Sin cupos' : 'Reservar · $100'}
                      </button>
                      <button type="button" className="secondary small" onClick={() => verRuta(p)} disabled={lleno || cerrado} aria-pressed={sel}>
                        <Icon name="route" size={16} />{sel ? 'Ruta trazada' : 'Ver ruta'}
                      </button>
                      <button type="button" className="waze" onClick={() => abrirWaze(p)} disabled={cerrado}>
                        <Icon name="nav" size={16} />Navegar con Waze
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : parkings.length > 0 ? (
            <div className="empty-state">
              <p style={{ margin: '0 0 10px' }}>Ninguna de las {parkings.length} opciones cumple {filtros.soloAbiertos && filtros.soloConCupos ? 'los filtros "solo abiertos" y "solo con cupos"' : filtros.soloAbiertos ? 'el filtro "solo abiertos"' : 'el filtro "solo con cupos"'}.</p>
              <button type="button" className="secondary small" onClick={() => cambiarFiltro({ soloAbiertos: false, soloConCupos: false })}>Quitar filtros</button>
            </div>
          ) : (
            !loading && !error && (
              <div className="empty-state">
                {modo === 'cerca'
                  ? `No hay estacionamientos disponibles a ${RADIO_CERCA_KM} km de tu ubicación.`
                  : modo === 'destino'
                    ? `No encontramos estacionamientos a ${RADIO_DESTINO_KM} km de ese destino. Prueba con otro, o déjalo vacío para buscar a ${RADIO_CERCA_KM} km de ti.`
                    : `Escribe un destino, o déjalo vacío para ver los estacionamientos a ${RADIO_CERCA_KM} km de ti, y presiona "Buscar estacionamientos".`}
              </div>
            )
          )}
        </section>
      </div>

      <div className="buscador-mapa">
        <ul className="mapa-leyenda" aria-label="Leyenda del mapa">
          <li><i className="ley-ruta" aria-hidden="true" />Tu ruta</li>
          <li><i className="ley-stop" aria-hidden="true" />Con cupos</li>
          <li><i className="ley-stop lleno" aria-hidden="true" />Lleno</li>
          <li><i className="ley-stop cerrado" aria-hidden="true" />Cerrado</li>
        </ul>
        <MapContainer center={[center.lat, center.lng]} zoom={14}>
          <RecenterMap lat={center.lat} lng={center.lng} />
          <AjustarVista
            clave={lista.length ? `${modo}:${lista.map(p => p.id).join(',')}` : ''}
            puntos={[
              ...(userPos ? [[userPos.lat, userPos.lng]] : []),
              ...(destinoCoords ? [[destinoCoords.lat, destinoCoords.lng]] : []),
              ...lista.map(p => [Number(p.latitud), Number(p.longitud)])
            ]}
          />
          <ClickToSetLocation onSelect={setManualLocation} />
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {selectedRoute && <Polyline positions={selectedRoute.coords} pathOptions={{ color: '#ffffff', weight: 11, opacity: 1 }} />}
          {selectedRoute && <Polyline positions={selectedRoute.coords} pathOptions={{ color: '#0b5cad', weight: 6, opacity: 1 }} />}
          {userPos && (
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>Tu ubicación {manualMode ? '(fijada a mano)' : '(GPS)'}<br />Haz clic en otro punto del mapa para moverla</Popup>
            </Marker>
          )}
          {destinoCoords && (
            <Marker position={[destinoCoords.lat, destinoCoords.lng]} icon={destinoIcon}>
              <Popup>Destino</Popup>
            </Marker>
          )}
          {lista.map(p => (
            <Marker key={p.id} position={[Number(p.latitud), Number(p.longitud)]} icon={paradaIcon(p.n, p.cupos_disponibles <= 0, selectedId === p.id, estaCerrado(p))}>
              <Popup>
                <strong>{p.n}. {p.nombre}</strong><br />
                {estaCerrado(p)
                  ? `Cerrado · ${textoEstado(p.horario_estado).detalle}`
                  : p.cupos_disponibles > 0 ? `${p.cupos_disponibles} libres de ${p.cupo_maximo}` : 'Lleno'}<br />
                <button type="button" onClick={() => verRuta(p)} disabled={p.cupos_disponibles <= 0 || estaCerrado(p)}>Ver ruta</button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
