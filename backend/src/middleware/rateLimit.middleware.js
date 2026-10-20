import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Render sirve esta API detrás de Cloudflare. Con `trust proxy` activo, Express arma req.ip a
// partir de X-Forwarded-For — pero X-Forwarded-For es un header que CUALQUIERA puede mandar con
// cualquier valor, y con trust proxy=1 Express confía en el último valor tal cual llega. Un
// atacante puede rotar un X-Forwarded-For distinto en cada request y evadir el límite por IP por
// completo (confirmado en pruebas). CF-Connecting-IP en cambio lo pone Cloudflare mismo con la IP
// real de la conexión TCP, sobrescribiendo cualquier valor que el cliente haya intentado mandar
// con ese nombre — no es falsificable desde fuera de la red de Cloudflare.
//
// ipKeyGenerator normaliza IPv6 (un cliente IPv6 suele tener un bloque entero para sí mismo y
// podría "rotar" de dirección dentro de ese bloque tan fácil como rotaría X-Forwarded-For si no
// se trunca a un prefijo de subred).
//
// La web publicada llama a la API a través de su propio dominio (estacionamientos-web.onrender.com
// reenvía /api/* aquí, para que la cookie de sesión sea del mismo sitio). En ese caso quien se
// conecta a Cloudflare es el proxy de Render, no el teléfono: CF-Connecting-IP trae la IP del
// proxy, igual para todos, y el límite de intentos sería uno solo para todo el mundo. La IP real
// del cliente queda en X-Forwarded-For, tres posiciones antes de la del proxy (cliente, borde de
// Cloudflare repetido, proxy). Se busca la ÚLTIMA aparición del proxy: lo que el cliente haya
// inventado en X-Forwarded-For queda siempre a la izquierda de su IP real y no mueve esa posición.
// Solo se hace si CF-Connecting-IP es del proxy de Render (74.220.48.0/24, visto en los logs): un
// pedido directo a la API trae ahí la IP real del cliente, y si se le aplicara esta regla bastaría
// con inventar un X-Forwarded-For para elegir la IP. Si Render cambia esa red, el límite pasa a ser
// compartido entre todos (más estricto), nunca evitable.
const IP_VALIDA = /^[0-9a-fA-F:.]+$/;
const PROXY_RENDER = /^74\.220\.48\.\d{1,3}$/;

export function realIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  let ip = (typeof cf === 'string' && IP_VALIDA.test(cf)) ? cf : req.ip;
  const xff = req.headers['x-forwarded-for'];
  if (ip === cf && PROXY_RENDER.test(cf) && typeof xff === 'string') {
    const saltos = xff.split(',').map(s => s.trim());
    const i = saltos.lastIndexOf(cf);
    if (i >= 3 && IP_VALIDA.test(saltos[i - 3])) ip = saltos[i - 3];
  }
  return ipKeyGenerator(ip);
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  message: { error: 'Demasiados intentos. Intenta nuevamente en unos minutos.' }
});

export const reservaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  message: { error: 'Demasiadas reservas seguidas. Intenta nuevamente en unos minutos.' }
});

// La vista pública del ticket se refresca sola cada 30 s en cada teléfono con el QR abierto
// (~30 consultas por cuarto de hora por página). El límite deja margen para varias personas detrás
// de la misma IP (redes móviles comparten IP) y corta a quien la use para saturar la base.
export const ticketPublicoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  message: { error: 'Demasiadas consultas. Intenta nuevamente en unos minutos.' }
});

// GET /tickets/reserva/:codigo_qr no tenía ningún límite: quedaba abierto a cualquiera sin
// restricción. El código es imposible de adivinar (144 bits al azar), así que esto es solo para
// que nadie lo use para saturar la base, no para evitar fuga de datos.
export const reservaPublicaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realIp,
  message: { error: 'Demasiadas consultas. Intenta nuevamente en unos minutos.' }
});
