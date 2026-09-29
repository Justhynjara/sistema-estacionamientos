import { env } from '../config/env.js';

export const COOKIE_NAME = 'token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // igual al expiresIn del JWT (8h)

// SameSite=None es obligatorio porque la web y la API viven en subdominios distintos de
// onrender.com (para efectos de cookies, dominios distintos): el navegador nunca la mandaría con
// Lax o Strict. None exige Secure, así que en local (http, sin TLS) se cae a Lax — ahí web y API
// están en localhost con puertos distintos, que los navegadores sí tratan como mismo sitio.
function opciones() {
  return env.isProduction
    ? { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: MAX_AGE_MS }
    : { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: MAX_AGE_MS };
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, opciones());
}

export function clearSessionCookie(res) {
  const { maxAge, ...resto } = opciones();
  res.clearCookie(COOKIE_NAME, resto);
}
