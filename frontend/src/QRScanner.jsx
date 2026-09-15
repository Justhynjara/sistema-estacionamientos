import { useEffect, useRef, useState } from 'react';

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
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>📷 Escanear código QR</h3>
        <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
      </div>
      {!soportado && <p className="badge off" style={{ marginTop: 10 }}>Tu navegador no soporta escaneo de QR. Usa el campo de código o busca por patente en la lista de arriba.</p>}
      {error && <p className="badge off" style={{ marginTop: 10 }}>{error}</p>}
      {soportado && !error && (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', maxWidth: 360, borderRadius: 12, background: '#000', marginTop: 10 }}
        />
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: 10 }}>Apunta la cámara al código QR del ticket o la reserva.</p>
    </div>
  );
}
