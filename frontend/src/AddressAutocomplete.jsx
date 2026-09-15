import { useEffect, useRef, useState } from 'react';
import { searchAddresses } from './utils/geo.js';

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, ariaLabel }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleChange(e) {
    const texto = e.target.value;
    onChange(texto);
    setAbierto(true);
    clearTimeout(debounceRef.current);
    if (texto.trim().length < 3) { setSugerencias([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try { setSugerencias(await searchAddresses(texto)); }
      catch { setSugerencias([]); }
      finally { setBuscando(false); }
    }, 350);
  }

  function elegir(s) {
    onChange(s.label);
    setSugerencias([]);
    setAbierto(false);
    onSelect({ lat: s.lat, lng: s.lng });
  }

  const mostrarPanel = abierto && (buscando || sugerencias.length > 0);

  return (
    <div ref={boxRef} className="address-autocomplete">
      <input
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        onFocus={() => setAbierto(true)}
        autoComplete="off"
      />
      {mostrarPanel && (
        <div className="address-suggestions">
          {buscando && <div className="hint">Buscando direcciones...</div>}
          {!buscando && sugerencias.map((s, i) => (
            <div className="item" key={i} onClick={() => elegir(s)}>
              <span>📍</span><span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
