import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';

// Cuentas de ejemplo de seeds.sql (entorno local). Son públicas en el repositorio: si siguen
// activas en producción con su clave por defecto, cualquiera puede entrar con ellas.
export const EMAILS_DEMO = ['admin@demo.cl', 'cliente@demo.cl', 'soporte@demo.cl', 'usuario@demo.cl'];
const CLAVE_DEMO = 'password';

// Devuelve los emails de la lista que existen, están activos y siguen con la clave por defecto.
export async function cuentasConClaveDemo(emails = EMAILS_DEMO) {
  const r = await pool.query('SELECT email,password_hash FROM usuarios WHERE email=ANY($1) AND activo=true', [emails]);
  const expuestas = [];
  for (const u of r.rows) {
    if (await bcrypt.compare(CLAVE_DEMO, u.password_hash)) expuestas.push(u.email);
  }
  return expuestas;
}

// Revisión al arrancar (solo en producción, para no ensuciar el desarrollo local con avisos):
// no bloquea el arranque, deja advertencias visibles en los logs.
export async function auditarSeguridadInicial(logger) {
  if (!env.isProduction) return;
  const expuestas = await cuentasConClaveDemo();
  if (expuestas.length) {
    logger.warn({ cuentas: expuestas },
      'SEGURIDAD: hay cuentas de ejemplo activas con la clave pública "password". Desactívalas o elimínalas desde el panel de administración.');
  }
  if (env.jwtSecret === 'dev_secret' || env.jwtSecret.length < 32) {
    logger.warn('SEGURIDAD: JWT_SECRET es el valor de desarrollo o tiene menos de 32 caracteres. Define uno largo y aleatorio.');
  }
}
