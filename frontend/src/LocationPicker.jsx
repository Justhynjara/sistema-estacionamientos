import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocode } from './utils/geo.js';
import Icon from './Icon.jsx';

const SANTIAGO = { lat: -33.4489, lng: -70.6693 };

// Alfiler dibujado (no un emoji): la punta queda exactamente sobre el punto marcado.
const icon = L.divIcon({ html: '<div class="map-pin"></div>', className: '', iconSize: [20, 20], iconAnchor: [3, 24] });

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 15); }, [center, map]);
  return null;
}

function ClickToPick({ onPick }) {
  useMapEvents({ click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const center = value || SANTIAGO;

  async function buscarDireccion(e) {
    e.preventDefault();
    if (!busqueda.trim()) return;
    setBuscando(true); setError('');
    try {
      const coords = await geocode(busqueda.trim());
      onChange(coords);
    } catch (err) { setError(err.message || 'No se encontró esa dirección'); }
    finally { setBuscando(false); }
  }

  return (
    <div style={{ margin: '6px 0 14px' }}>
      <div className="row-form">
        <input placeholder="Buscar dirección para ubicar en el mapa" value={busqueda} onChange={e => setBusqueda(e.target.value)} aria-label="Buscar dirección" />
        <button type="button" onClick={buscarDireccion} disabled={buscando} className="secondary">{buscando ? <span className="spinner" /> : <Icon name="search" />}{buscando ? 'Buscando...' : 'Buscar'}</button>
      </div>
      {error && <p className="badge off">{error}</p>}
      <p className="muted small" style={{ margin: '8px 0 6px' }}>O haz clic directamente en el mapa para fijar la ubicación exacta.</p>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--rule)' }}>
        <MapContainer center={[center.lat, center.lng]} zoom={value ? 15 : 12} style={{ height: 260, width: '100%' }}>
          <RecenterMap center={value ? [value.lat, value.lng] : null} />
          <ClickToPick onPick={onChange} />
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {value && <Marker position={[value.lat, value.lng]} icon={icon} />}
        </MapContainer>
      </div>
      {value && <p className="badge ok" style={{ marginTop: 8 }}>Ubicación marcada: <span className="mono">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</span></p>}
    </div>
  );
}
