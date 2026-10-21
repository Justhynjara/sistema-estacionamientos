import { env } from '../config/env.js';

export const COOKIE_NAME = 'token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // igual al expiresIn del JWT (8h)

// SameSite=Lax: la web llama a la API por su propio dominio (estacionamientos-web.onrender.com
// reenvía /api/* a la API), así que la cookie es del mismo sitio y Lax la manda sin problema.
// Lax además la bloquea en los POST que origina OTRA página: sin esto (como con SameSite=None,
// que usábamos cuando la web y la API vivían en dominios distintos) una página maliciosa podía
// hacer que el navegador de un usuario con sesión enviara la cookie en un POST falso (CSRF), por
// ejemplo contra /api/admin/users. La app nativa no usa cookie (va con Bearer), no le afecta.
// En local (http, sin TLS) Secure se apaga; Lax igual porque web y API están en localhost.
function opciones() {
  return env.isProduction
    ? { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE_MS }
    : { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: MAX_AGE_MS };
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, opciones());
}

export function clearSessionCookie(res) {
  const { maxAge, ...resto } = opciones();
  res.clearCookie(COOKIE_NAME, resto);
}
