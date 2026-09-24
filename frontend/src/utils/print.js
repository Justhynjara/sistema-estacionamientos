import QRCode from 'qrcode';
import { qrPayload } from './qr.js';

// Imprime un comprobante formateado para impresoras térmicas de recibos (ej. Epson TM-T20/TM-88)
// conectadas como impresora del sistema operativo (USB o red), usando el diálogo de impresión
// del navegador. El usuario debe elegir esa impresora una vez; el navegador recuerda la elección.
export async function imprimirTicket({
  nombreEstacionamiento,
  direccion,
  codigo,
  detalle = [], // [[etiqueta, valor], ...]
  pie = 'Gracias por su preferencia'
}) {
  // Abrir la ventana ANTES de cualquier await: los navegadores bloquean popups
  // que no ocurren de forma síncrona dentro del gesto de clic del usuario.
  const win = window.open('', 'imprimir_ticket', 'width=340,height=600');
  if (!win) {
    alert('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio e intenta de nuevo.');
    return;
  }
  win.document.write('<!doctype html><title>Ticket</title><body style="font-family:sans-serif;padding:20px">Generando comprobante…</body>');

  let qrDataUrl = '';
  try { qrDataUrl = await QRCode.toDataURL(qrPayload(codigo), { width: 300, margin: 1, errorCorrectionLevel: 'L' }); } catch { /* sin QR si falla */ }

  const filas = detalle
    .map(([k, v]) => `<div class="fila"><span>${k}</span><span>${v}</span></div>`)
    .join('');

  win.document.open();
  win.document.write(`<!doctype html><html><head><title>Ticket</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; width: 74mm; margin: 0 auto; padding: 10px 6px; font-size: 12px; color: #000; }
      h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
      p { margin: 2px 0; }
      .center { text-align: center; }
      .linea { border-top: 1px dashed #000; margin: 8px 0; }
      .fila { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
      img { display: block; margin: 10px auto; }
      .codigo { text-align: center; font-size: 10px; word-break: break-all; margin-top: 4px; }
    </style>
    </head><body>
      <h1>🅿️ ${nombreEstacionamiento || 'Estacionamiento'}</h1>
      ${direccion ? `<p class="center">${direccion}</p>` : ''}
      <div class="linea"></div>
      ${filas}
      <div class="linea"></div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" width="150" height="150"/>` : ''}
      <p class="codigo">${codigo}</p>
      <div class="linea"></div>
      <p class="center">${pie}</p>
      <p class="center">${new Date().toLocaleString('es-CL')}</p>
    </body></html>`);
  win.document.close();

  setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* usuario cerró la ventana */ }
  }, 350);
}
