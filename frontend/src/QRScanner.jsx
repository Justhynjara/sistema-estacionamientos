import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function QRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  const [soportado, setSoportado] = useState(true);

  useEffect(() => {
    if (!('BarcodeDetector' in window)) { setSoportado(false); return; }
    let activo = true;
    let stream = null;
    let rafId = null;

    async function iniciar() {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (!activo || !videoRef.current) return;
          try {
            const codigos = await detector.detect(videoRef.current);
            if (codigos.length) { onResult(codigos[0].rawValue); return; }
          } catch { /* frame sin código, seguir intentando */ }
          rafId = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    }
    iniciar();

    return () => {
      activo = false;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onResult]);

  return (
    <div className="card centrado">
      <div className="card-head">
        <h3><Icon name="camera" /> Escanear código QR</h3>
        <button type="button" className="secondary small" onClick={onClose}>Cerrar</button>
      </div>
      {!soportado && <p className="badge off" style={{ marginTop: 10 }}>Tu navegador no soporta escaneo de QR. Usa el campo de código o busca por patente en la lista de arriba.</p>}
      {error && <p className="badge off" style={{ marginTop: 10 }}>{error}</p>}
      {soportado && !error && (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', maxWidth: 360, borderRadius: 8, background: '#0e1726', marginTop: 10 }}
        />
      )}
      <p className="muted small" style={{ marginTop: 10 }}>Apunta la cámara al código QR del ticket o la reserva.</p>
    </div>
  );
}
