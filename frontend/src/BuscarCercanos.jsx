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
import { redirectToWebpay } from './utils/webpay.js';

const SOCKET_URL = API_ORIGIN;
const RADIUS_KM = 5;
const REROUTE_THRESHOLD_M = 30;

function emojiIcon(emoji) {
  return L.divIcon({
    html: `<div style="font-size:26px;line-height:26px;transform:translate(-50%,-100%)">${emoji}</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [0, 0]
  });
}
const userIcon = emojiIcon('🔵');
const destinoIcon = emojiIcon('🏁');
const parkingIcon = emojiIcon('🅿️');

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

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
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
  return <span className="badge ok">⏱️ Válida por {min}:{String(seg).padStart(2, '0')} min</span>;
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
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [reservaError, setReservaError] = useState('');
  const [reservandoId, setReservandoId] = useState(null);
  const [reservaPendiente, setReservaPendiente] = useState(null);
  const [patenteReserva, setPatenteReserva] = useState('');
  const lastRoutedFrom = useRef(null);
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());
  const manualModeRef = useRef(false);

  useEffect(() => { manualModeRef.current = manualMode; }, [manualMode]);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoError('Tu navegador no soporta geolocalización'); return; }
    const watchId = navigator.geolocation.watchPosition(
      pos => { if (!manualModeRef.current) setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { if (!manualModeRef.current) setGeoError('No se pudo obtener tu ubicación automáticamente. Escribe tu dirección o haz clic en el mapa para marcarla.'); },
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
      () => setGeoError('No se pudo obtener tu ubicación automáticamente. Escribe tu dirección o haz clic en el mapa para marcarla.'),
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

async function buscarCercaDe(destCoords) {
    setError(''); setLoading(true); setSelectedId(null); setSelectedRoute(null);
    try {
      if (!destCoords) throw new Error('Aún no se ha obtenido tu ubicación actual');
      setDestinoCoords(destCoords);

      const r = await api.get('/parking/nearby', { params: { lat: destCoords.lat, lng: destCoords.lng, radiusKm: RADIUS_KM } });
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
    if (!destino.trim()) { await buscarCercaDe(userPos); return; }
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

  return (
    <div>
      <div className="card">
        <h2><span className="step">1</span>Tu ubicación de partida</h2>
        <p>Se usa tu GPS automáticamente. Si falla o prefieres otra, escribe una dirección o haz clic directamente en el mapa.</p>
        {geoError && <p className="badge off">⚠️ {geoError}</p>}
        <form onSubmit={usarOrigenEscrito} className="row-form">
          <AddressAutocomplete
            placeholder="Tu dirección de partida (ej: Av. Providencia 1234, Santiago)"
            ariaLabel="Tu dirección de partida"
            value={origen}
            onChange={setOrigen}
            onSelect={setManualLocation}
          />
          <button disabled={origenLoading}>{origenLoading && <span className="spinner"/>}{origenLoading ? 'Ubicando...' : 'Usar esta dirección'}</button>
          <button type="button" onClick={usarGPS} className="secondary">📍 Usar mi GPS</button>
        </form>
        <p className={'badge ' + (userPos ? 'ok' : 'off')}>{userPos ? (manualMode ? '📌 Ubicación fijada manualmente' : '🛰️ Ubicación por GPS') : '⏳ Sin ubicación aún'}</p>
      </div>

      <div className="card">
        <h2><span className="step">2</span>Destino</h2>
        {error && <p className="badge off">⚠️ {error}</p>}
        <form onSubmit={buscar} className="row-form">
          <AddressAutocomplete
            placeholder="Destino (ej: Plaza de Armas, Curicó) — vacío = buscar cerca de mí"
            ariaLabel="Destino"
            value={destino}
            onChange={setDestino}
            onSelect={onDestinoSeleccionado}
          />
          <button disabled={loading}>{loading && <span className="spinner"/>}{loading ? 'Buscando...' : '🔎 Buscar estacionamientos'}</button>
        </form>
      </div>

      {reservaPendiente && (
        <div className="card">
          <h3>🎫 Reservar cupo en {reservaPendiente.nombre}</h3>
          <p>Ingresa la patente del vehículo que va a estacionar. Para confirmar, se te pedirá un micropago de <strong>$100 CLP</strong> por Webpay — evita reservas falsas y tu cupo queda apartado por <strong>10 minutos</strong>.</p>
          {reservaError && <p className="badge off">⚠️ {reservaError}</p>}
          <form onSubmit={confirmarReserva} className="row-form">
            <input
              placeholder="Patente (ej: AB1234)"
              aria-label="Patente del vehículo"
              value={patenteReserva}
              onChange={e => setPatenteReserva(e.target.value.toUpperCase())}
              autoFocus
              required
            />
            <button disabled={reservandoId === reservaPendiente.id}>{reservandoId === reservaPendiente.id && <span className="spinner" />}💳 Pagar $100 y reservar</button>
            <button type="button" className="secondary" onClick={() => setReservaPendiente(null)}>Cancelar</button>
          </form>
        </div>
      )}

      {reserva && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h3>🎫 Reserva confirmada en {reserva.nombre}</h3>
          <p>Muestra este código QR al llegar para validar tu cupo, o descárgalo:</p>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <QRCodeCanvas value={reserva.codigo} downloadable filename={`reserva-${reserva.codigo.slice(0, 8)}`} />
          </div>
          <p style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '.8rem', wordBreak: 'break-all' }}>{reserva.codigo}</p>
          <Countdown expira={reserva.expira} />
          <div className="row-form" style={{ justifyContent: 'center', marginTop: 10 }}>
            {reserva.latitud && reserva.longitud && (
              <button type="button" className="secondary" onClick={() => abrirWaze({ latitud: reserva.latitud, longitud: reserva.longitud })}>🧭 Navegar con Waze</button>
            )}
            <button type="button" onClick={() => imprimirTicket({
              nombreEstacionamiento: reserva.nombre,
              direccion: reserva.direccion,
              codigo: reserva.codigo,
              detalle: [['Válido hasta', new Date(reserva.expira).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })]],
              pie: 'Presenta este comprobante al llegar'
            })}>🖨️ Imprimir</button>
            <button type="button" className="secondary" onClick={() => setReserva(null)}>Cerrar</button>
          </div>
        </div>
      )}
      {reservaError && <p className="badge off">⚠️ {reservaError}</p>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: 360, width: '100%' }}>
          <RecenterMap center={[center.lat, center.lng]} />
          <ClickToSetLocation onSelect={setManualLocation} />
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {userPos && (
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>Tu ubicación {manualMode ? '(fijada manualmente)' : '(GPS)'}<br />Haz clic en otro punto del mapa para moverla</Popup>
            </Marker>
          )}
          {destinoCoords && (
            <Marker position={[destinoCoords.lat, destinoCoords.lng]} icon={destinoIcon}>
              <Popup>Destino</Popup>
            </Marker>
          )}
          {parkings.map(p => (
            <Marker key={p.id} position={[Number(p.latitud), Number(p.longitud)]} icon={parkingIcon}>
              <Popup>
                <strong>{p.nombre}</strong><br />
                {p.cupos_disponibles} / {p.cupo_maximo} disponibles<br />
                <button onClick={() => verRuta(p)}>Ver ruta</button>
              </Popup>
            </Marker>
          ))}
          {selectedRoute && <Polyline positions={selectedRoute.coords} color="#1f6feb" weight={5} />}
        </MapContainer>
      </div>

      <div className="grid">
        {parkings.map(p => (
          <div className={'card' + (selectedId === p.id ? ' selected' : '')} key={p.id}>
            <h3>{p.nombre}</h3>
            <p>{p.direccion}</p>
            <p>💰 ${Number(p.precio_hora).toLocaleString('es-CL')} / hora</p>
            <p className={'badge ' + (p.cupos_disponibles > 0 ? 'ok' : 'off')}>🅿️ {p.cupos_disponibles} / {p.cupo_maximo} disponibles</p>
            <p>📍 {p.distancia_km.toFixed(2)} km del destino</p>
            {p.ruta && <p>🚗 {p.ruta.distanciaKm.toFixed(1)} km · ⏱️ {Math.round(p.ruta.duracionMin)} min desde tu ubicación</p>}
            <div className="row-form">
              <button onClick={() => verRuta(p)} disabled={p.cupos_disponibles <= 0}>
                {selectedId === p.id ? '✅ Ruta trazada' : '🗺️ Ver ruta'}
              </button>
              <button type="button" className="secondary" onClick={() => abrirWaze(p)}>
                🧭 Navegar con Waze
              </button>
              <button type="button" className="secondary" onClick={() => iniciarReserva(p)} disabled={p.cupos_disponibles <= 0}>
                🎫 Reservar cupo
              </button>
            </div>
          </div>
        ))}
        {!loading && parkings.length === 0 && !error && (
          <div className="empty-state">Ingresa un destino y presiona "Buscar estacionamientos" para ver opciones cercanas.</div>
        )}
      </div>
    </div>
  );
}
