import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import Icon from './Icon.jsx';

export default function QRCodeCanvas({ value, size = 180, downloadable = false, filename = 'codigo-qr', label = 'Código QR' }) {
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
    <div className="qr">
      {/* Un <canvas> no tiene texto alternativo por su cuenta: sin esto, un lector de pantalla no
          anuncia nada donde va el QR. */}
      <canvas ref={canvasRef} width={size} height={size} role="img" aria-label={label} />
      {downloadable && <button type="button" className="secondary small" onClick={descargar}><Icon name="download" size={16} />Descargar QR</button>}
    </div>
  );
}
