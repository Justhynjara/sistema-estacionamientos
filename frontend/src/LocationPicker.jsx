import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocode } from './utils/geo.js';

const SANTIAGO = { lat: -33.4489, lng: -70.6693 };

function pinIcon() {
  return L.divIcon({
    html: '<div style="font-size:26px;line-height:26px;transform:translate(-50%,-100%)">📍</div>',
    className: '', iconSize: [26, 26], iconAnchor: [0, 0]
  });
}
const icon = pinIcon();

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
        <button type="button" onClick={buscarDireccion} disabled={buscando} className="secondary">{buscando ? 'Buscando...' : '🔎 Buscar'}</button>
      </div>
      {error && <p className="badge off">⚠️ {error}</p>}
      <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>O haz clic directamente en el mapa para fijar la ubicación exacta.</p>
      <div style={{ borderRadius: 12, overflow: 'hidden' }}>
        <MapContainer center={[center.lat, center.lng]} zoom={value ? 15 : 12} style={{ height: 260, width: '100%' }}>
          <RecenterMap center={value ? [value.lat, value.lng] : null} />
          <ClickToPick onPick={onChange} />
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {value && <Marker position={[value.lat, value.lng]} icon={icon} />}
        </MapContainer>
      </div>
      {value && <p className="badge ok" style={{ marginTop: 8 }}>📍 {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}
    </div>
  );
}
