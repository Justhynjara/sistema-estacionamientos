export async function geocode(texto) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(texto)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await r.json();
  if (!data.length) throw new Error('No se encontró esa dirección');
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}
