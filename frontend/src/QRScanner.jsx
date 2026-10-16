import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Lector de QR con la cámara trasera. Usa el BarcodeDetector nativo del navegador (Chrome en
// Android) y, donde no existe (Safari en iPhone, Firefox), decodifica los cuadros del video con
// jsQR, que se descarga solo en ese caso para no cargarlo a todos.
export default function QRScanner({ onResult, onClose, ayuda = 'Apunta la cámara al código QR del ticket o la reserva.', titulo = 'Escanear código QR', tituloId }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  // El callback se lee desde una ref: si el padre pasa una función nueva en cada render, la cámara
  // no debe reiniciarse por eso.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let activo = true;
    let stream = null;
    let rafId = null;

    async function crearLector() {
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async video => (await detector.detect(video))[0]?.rawValue || null;
      }
      const { default: jsQR } = await import('jsqr');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      return async video => {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return null;
        // Basta con una versión reducida del cuadro: el QR ocupa buena parte de la imagen.
        const escala = Math.min(1, 640 / Math.max(w, h));
        canvas.width = Math.round(w * escala); canvas.height = Math.round(h * escala);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
      };
    }

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Abre el sitio en Chrome o Safari actualizados, o usa la app de cámara del teléfono.');
        return;
      }
      try {
        const leer = await crearLector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (!activo || !videoRef.current) return;
          try {
            const texto = await leer(videoRef.current);
            if (texto && activo) { onResultRef.current(texto); return; }
          } catch { /* cuadro sin código, seguir intentando */ }
          rafId = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setError(e?.name === 'NotAllowedError'
          ? 'No diste permiso para usar la cámara. Actívalo en la configuración del navegador para este sitio e intenta de nuevo.'
          : 'No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    }
    iniciar();

    return () => {
      activo = false;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="card centrado">
      <div className="card-head">
        <h3 id={tituloId}><Icon name="camera" /> {titulo}</h3>
        <button type="button" className="secondary small" onClick={onClose}>Cerrar</button>
      </div>
      {error && <p className="badge off" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      {!error && (
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Vista de la cámara"
          style={{ width: '100%', maxWidth: 360, borderRadius: 8, background: '#0e1726', marginTop: 10 }}
        />
      )}
      <p className="muted small" style={{ marginTop: 10 }}>{ayuda}</p>
    </div>
  );
}
