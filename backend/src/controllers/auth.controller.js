import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { sendMail } from '../utils/mailer.js';

const RESET_TOKEN_TTL_MIN = 30;
const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_MIN = 15;

// El rate-limit por IP (authLimiter) no alcanza contra un atacante que reparte sus intentos
// entre muchas IPs distintas apuntando siempre a la misma cuenta. Este bloqueo es por cuenta.
// El mensaje de error se mantiene idéntico en todos los casos (no existe, contraseña incorrecta,
// cuenta bloqueada) para no filtrar por respuesta si un email está registrado o no — mismo
// criterio que ya se usa en forgot-password.
export async function login(req,res){
  const {email,password}=req.body;
  const r=await pool.query('SELECT * FROM usuarios WHERE email=$1 AND activo=true',[email]);
  const u=r.rows[0];

  if(u && u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date())
    return res.status(401).json({error:'Credenciales inválidas'});

  const passwordOk = u && await bcrypt.compare(password,u.password_hash);
  if(!u || !passwordOk){
    if(u){
      const intentos=u.intentos_fallidos+1;
      if(intentos>=LOGIN_MAX_INTENTOS){
        await pool.query(
          `UPDATE usuarios SET intentos_fallidos=0, bloqueado_hasta=NOW() + ($1 || ' minutes')::interval WHERE id=$2`,
          [LOGIN_BLOQUEO_MIN,u.id]
        );
      } else {
        await pool.query('UPDATE usuarios SET intentos_fallidos=$1 WHERE id=$2',[intentos,u.id]);
      }
    }
    return res.status(401).json({error:'Credenciales inválidas'});
  }

  if(u.intentos_fallidos>0 || u.bloqueado_hasta)
    await pool.query('UPDATE usuarios SET intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=$1',[u.id]);

  const token=jwt.sign({id:u.id,email:u.email,rol:u.rol},env.jwtSecret,{expiresIn:'8h'});
  res.json({token,user:{id:u.id,nombre:u.nombre,email:u.email,rol:u.rol}});
}

export async function me(req,res){
  const r=await pool.query('SELECT id,nombre,email,rol FROM usuarios WHERE id=$1 AND activo=true',[req.user.id]);
  if(!r.rowCount) return res.status(401).json({error:'Sesión inválida'});
  res.json(r.rows[0]);
}

// Registro público: siempre crea cuentas rol USUARIO (buscar/reservar).
// Roles con privilegios (CLIENTE, SOPORTE, ADMIN) solo los crea un ADMIN vía /api/admin/users.
export async function register(req,res){
  const {nombre,email,password}=req.body;
  const hash=await bcrypt.hash(password,10);
  try {
    const r=await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES($1,$2,$3,'USUARIO')
       RETURNING id,nombre,email,rol`,[nombre,email,hash]
    );
    res.status(201).json(r.rows[0]);
  } catch { res.status(409).json({error:'Email ya registrado'}); }
}

export async function forgotPassword(req,res){
  const {email}=req.body;
  const respuestaGenerica={mensaje:'Si el correo existe en el sistema, se envió un enlace de recuperación.'};
  const r=await pool.query('SELECT id,nombre FROM usuarios WHERE email=$1 AND activo=true',[email]);
  if(!r.rowCount) return res.json(respuestaGenerica);

  const usuario=r.rows[0];
  const token=crypto.randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt=new Date(Date.now()+RESET_TOKEN_TTL_MIN*60000);

  await pool.query(
    `INSERT INTO password_resets(usuario_id,token_hash,expires_at) VALUES($1,$2,$3)`,
    [usuario.id,tokenHash,expiresAt]
  );

  const link=`${env.frontendUrl}/?reset=${token}`;
  await sendMail({
    to: email,
    subject: 'Recupera tu contraseña — Sistema de Estacionamientos',
    html: `<p>Hola ${usuario.nombre},</p><p>Haz clic en el siguiente enlace para definir una nueva contraseña (válido por ${RESET_TOKEN_TTL_MIN} minutos):</p><p><a href="${link}">${link}</a></p><p>Si no solicitaste esto, ignora este correo.</p>`
  });

  res.json(respuestaGenerica);
}

export async function resetPassword(req,res){
  const {token,password}=req.body;
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');

  const r=await pool.query(
    `SELECT * FROM password_resets
     WHERE token_hash=$1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  if(!r.rowCount) return res.status(400).json({error:'El enlace de recuperación es inválido o expiró'});

  const reset=r.rows[0];
  const hash=await bcrypt.hash(password,10);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2',[hash,reset.usuario_id]);
    await client.query('UPDATE password_resets SET used_at=NOW() WHERE id=$1',[reset.id]);
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }

  res.json({mensaje:'Contraseña actualizada correctamente'});
}
