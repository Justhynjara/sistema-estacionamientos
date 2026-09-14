import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeCanvas({ value, size = 180 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }, () => {});
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 12, background: 'white', padding: 8, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }} />;
}
