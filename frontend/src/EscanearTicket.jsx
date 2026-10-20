import { useEffect, useRef, useState } from 'react';
import QRScanner from './QRScanner.jsx';
import Icon from './Icon.jsx';
import { extraerCodigoQR } from './utils/qr.js';

// Los tickets y reservas se emiten con un código hexadecimal aleatorio (generateQR en el backend:
// 18 bytes = 36 caracteres); los más antiguos usaban UUID. Cualquier otro QR (un menú, un enlace
// cualquiera) se rechaza en vez de abrir una vista de ticket vacía.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{32,64}$/i;
export function codigoDeTicket(texto) {
  const c = extraerCodigoQR(texto);
  return UUID.test(c) || HEX.test(c) ? c : '';
}

// Botón flotante, visible solo en teléfonos (lo decide el CSS), que abre la cámara para leer el
// QR de un ticket. Qué pasa con el código lo decide quien lo usa: el conductor ve su tiempo y
// monto; el dueño con sesión iniciada va directo al cobro.
export default function EscanearTicket({ onCodigo, rotulo = 'Escanear QR', ayuda }) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState('');
  // Cambiar la clave reinicia el lector tras leer un QR que no es de un ticket.
  const [intento, setIntento] = useState(0);
  const overlayRef = useRef(null);
  const botonRef = useRef(null);

  function cerrar() {
    setAbierto(false); setAviso('');
    botonRef.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    overlayRef.current?.querySelector('button')?.focus();
    const onKey = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierto]);

  function leido(texto) {
    const c = codigoDeTicket(texto);
    if (!c) {
      setAviso('Ese código QR no es un ticket de este sistema. Apunta al QR impreso en tu ticket o en tu reserva.');
      setIntento(n => n + 1);
      return;
    }
    setAbierto(false); setAviso('');
    onCodigo(c);
  }

  return (
    <>
      <button ref={botonRef} type="button" className="escanear-fab" onClick={() => { setAbierto(true); setIntento(n => n + 1); }}>
        <Icon name="camera" size={20} />{rotulo}
      </button>
      {abierto && (
        <div ref={overlayRef} className="escaner-overlay" role="dialog" aria-modal="true" aria-labelledby="escaner-titulo">
          <div className="escaner-caja">
            <QRScanner key={intento} onResult={leido} onClose={cerrar} ayuda={ayuda} titulo={rotulo} tituloId="escaner-titulo" />
            {aviso && <p className="badge off escaner-aviso" role="alert">{aviso}</p>}
          </div>
        </div>
      )}
    </>
  );
}
