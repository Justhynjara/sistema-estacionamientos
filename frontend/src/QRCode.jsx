import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeCanvas({ value, size = 180, downloadable = false, filename = 'codigo-qr' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }, () => {});
  }, [value, size]);

  function descargar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 12, background: 'white', padding: 8, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }} />
      {downloadable && <button type="button" className="secondary" onClick={descargar}>⬇️ Descargar QR</button>}
    </div>
  );
}
