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
function realIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  const ip = (typeof cf === 'string' && /^[0-9a-fA-F:.]+$/.test(cf)) ? cf : req.ip;
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
