// El QR del ticket es un enlace a la web (no el código pelado): así, si el conductor lo escanea con
// la cámara del teléfono, abre la página con su tiempo y monto; y si lo abre el dueño con sesión
// iniciada, va directo a cobrar. En la app Android window.location.origin es https://localhost, por
// eso la URL pública se puede fijar con VITE_WEB_URL.
export const WEB_URL = (import.meta.env.VITE_WEB_URL || window.location.origin).replace(/\/$/, '');

export function qrPayload(codigo) {
  return `${WEB_URL}/?ticket=${encodeURIComponent(codigo)}`;
}

// Acepta lo que entregue el escáner o lo que pegue el dueño: el enlace completo del QR nuevo
// o el código pelado de los tickets impresos antes de este cambio.
export function extraerCodigoQR(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  try {
    const codigo = new URL(t).searchParams.get('ticket');
    if (codigo) return codigo.trim();
  } catch { /* no es una URL: es el código directo */ }
  return t;
}
