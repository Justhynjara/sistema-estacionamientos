import crypto from 'crypto';
import { env } from '../config/env.js';

// Con precio por minuto, el monto que el dueño le dice al cliente cambiaría mientras este saca el
// dinero. La cotización congela el monto por unos minutos: el servidor la firma (HMAC, con una
// clave derivada del secreto JWT para que no sirva como token de sesión) y, al cerrar el ticket,
// la honra si sigue vigente y corresponde a ese mismo ticket.
export const COTIZACION_TTL_SEG = 180;

const clave = () => crypto.createHash('sha256').update(`cotizacion:${env.jwtSecret}`).digest();
const firma = cuerpo => crypto.createHmac('sha256', clave()).update(cuerpo).digest('base64url');

export function firmarCotizacion({ codigo_qr, monto, descuento, minutos }, ahora = Date.now()) {
  const expira = ahora + COTIZACION_TTL_SEG * 1000;
  const cuerpo = Buffer.from(JSON.stringify({ q: codigo_qr, m: monto, d: descuento, n: minutos, e: expira })).toString('base64url');
  return { token: `${cuerpo}.${firma(cuerpo)}`, expira: new Date(expira).toISOString() };
}

// Devuelve { monto, descuento, minutos } si la cotización es auténtica, vigente y del ticket
// pedido; en cualquier otro caso null (y el cierre recalcula con la hora actual).
export function verificarCotizacion(token, codigo_qr, ahora = Date.now()) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [cuerpo, f] = token.split('.');
  if (!cuerpo || !f) return null;
  const esperada = Buffer.from(firma(cuerpo));
  const recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
    if (d.q !== codigo_qr || !(d.e > ahora)) return null;
    if (![d.m, d.d, d.n].every(v => Number.isFinite(v) && v >= 0)) return null;
    return { monto: d.m, descuento: d.d, minutos: d.n };
  } catch { return null; }
}
