import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { COOKIE_NAME } from '../utils/sessionCookie.js';

// El navegador (web) manda el token en una cookie httpOnly: JavaScript nunca puede leerla, así que
// un XSS ya no puede robarla con algo tan simple como `fetch(atacante, {body: localStorage.token})`
// como pasaba antes. El encabezado Authorization se mantiene para scripts, pruebas automáticas y
// cualquier cliente que no sea el navegador (no lo usa la web en producción).
export function auth(req,res,next){
  const header=req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[COOKIE_NAME];
  if(!token) return res.status(401).json({error:'Token requerido'});
  try {
    req.user=jwt.verify(token, env.jwtSecret);
    next();
  } catch { res.status(401).json({error:'Token inválido'}); }
}
