import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { registrarAuditoria, listAuditoria } from '../services/audit.service.js';

const ROLES_VALIDOS = ['USUARIO', 'CLIENTE', 'ADMIN', 'SOPORTE'];

export async function listUsers(req, res) {
  const r = await pool.query(
    `SELECT id,nombre,email,rol,activo,created_at FROM usuarios ORDER BY created_at DESC`
  );
  res.json(r.rows);
}

export async function createUser(req, res) {
  const { nombre, email, password, rol } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES($1,$2,$3,$4)
       RETURNING id,nombre,email,rol,activo,created_at`,
      [nombre, email, hash, rol]
    );
    await registrarAuditoria(req.user.id, 'usuario.crear', 'usuario', r.rows[0].id, { email, rol });
    res.status(201).json(r.rows[0]);
  } catch { res.status(409).json({ error: 'Email ya registrado' }); }
}

export async function updateUserStatus(req, res) {
  const { activo } = req.body;
  if (typeof activo !== 'boolean') return res.status(400).json({ error: 'activo debe ser boolean' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio estado' });
  const r = await pool.query(
    `UPDATE usuarios SET activo=$1 WHERE id=$2 RETURNING id,nombre,email,rol,activo`,
    [activo, req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  await registrarAuditoria(req.user.id, 'usuario.cambiar_estado', 'usuario', r.rows[0].id, { activo });
  res.json(r.rows[0]);
}

export async function updateUserRole(req, res) {
  const { rol } = req.body;
  if (!ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  const r = await pool.query(
    `UPDATE usuarios SET rol=$1 WHERE id=$2 RETURNING id,nombre,email,rol,activo`,
    [rol, req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  await registrarAuditoria(req.user.id, 'usuario.cambiar_rol', 'usuario', r.rows[0].id, { rol });
  res.json(r.rows[0]);
}

export async function listParams(req, res) {
  const r = await pool.query(
    `SELECT clave,valor,descripcion,updated_at FROM parametros_sistema ORDER BY clave`
  );
  res.json(r.rows);
}

export async function updateParam(req, res) {
  const { valor } = req.body;
  if (!valor && valor !== '0') return res.status(400).json({ error: 'valor requerido' });
  const r = await pool.query(
    `UPDATE parametros_sistema SET valor=$1, updated_at=NOW() WHERE clave=$2
     RETURNING clave,valor,descripcion,updated_at`,
    [String(valor), req.params.clave]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Parámetro no encontrado' });
  await registrarAuditoria(req.user.id, 'parametro.actualizar', 'parametro', r.rows[0].clave, { valor: r.rows[0].valor });
  res.json(r.rows[0]);
}

export async function auditLog(req, res) {
  res.json(await listAuditoria(req.query));
}
