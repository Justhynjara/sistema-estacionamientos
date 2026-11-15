import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { registrarAuditoria, listAuditoria } from '../services/audit.service.js';

const ROLES_VALIDOS = ['USUARIO', 'CLIENTE', 'ADMIN', 'SOPORTE'];
// Comparación de ids a prueba de mayúsculas (la ruta ya los normaliza; esto es una segunda barrera).
const esMismo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Reglas de cada parámetro: antes se guardaba cualquier texto y el sistema volvía en silencio al
// valor por defecto, así que el admin veía guardado un valor que no se aplicaba.
const REGLAS_PARAMETRO = {
  reserva_monto_clp: { ok: v => /^\d+$/.test(v) && +v >= 100 && +v <= 100000, msg: 'El monto de la reserva debe ser un entero entre 100 y 100.000' },
  reserva_ttl_min: { ok: v => /^\d+$/.test(v) && +v >= 1 && +v <= 120, msg: 'La duración de la reserva debe ser un entero entre 1 y 120 minutos' },
  comision_plataforma: { ok: v => /^\d+(\.\d+)?$/.test(v) && +v >= 0 && +v <= 100, msg: 'La comisión debe ser un porcentaje entre 0 y 100' },
  moneda: { ok: v => /^[A-Z]{3}$/.test(v), msg: 'La moneda debe ser un código de 3 letras, como CLP' }
};

export async function listUsers(req, res) {
  const r = await pool.query(
    `SELECT id,nombre,email,rol,activo,created_at,
            (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
     FROM usuarios ORDER BY created_at DESC`
  );
  res.json(r.rows);
}

export async function createUser(req, res) {
  const { nombre, email, password, rol } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    // La clave la eligió el admin (es temporal): se obliga a la persona a cambiarla en su primer
    // ingreso. Hasta entonces el backend la bloquea de todo (ver auth.middleware.js).
    const r = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol,debe_cambiar_password) VALUES($1,$2,$3,$4,TRUE)
       RETURNING id,nombre,email,rol,activo,created_at`,
      [nombre, email, hash, rol]
    );
    await registrarAuditoria(req.user.id, 'usuario.crear', 'usuario', r.rows[0].id, { email, rol });
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
    throw err;
  }
}

export async function updateUserStatus(req, res) {
  const { activo } = req.body;
  if (typeof activo !== 'boolean') return res.status(400).json({ error: 'activo debe ser boolean' });
  if (esMismo(req.params.id, req.user.id)) return res.status(400).json({ error: 'No puedes cambiar tu propio estado' });
  // Reactivar también levanta un bloqueo por intentos fallidos: es la forma que tiene el admin de
  // desbloquear a alguien sin esperar los 15 minutos.
  const r = await pool.query(
    `UPDATE usuarios SET activo=$1,
       intentos_fallidos=CASE WHEN $1 THEN 0 ELSE intentos_fallidos END,
       bloqueado_hasta=CASE WHEN $1 THEN NULL ELSE bloqueado_hasta END
     WHERE id=$2 RETURNING id,nombre,email,rol,activo`,
    [activo, req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  await registrarAuditoria(req.user.id, 'usuario.cambiar_estado', 'usuario', r.rows[0].id, { email: r.rows[0].email, activo });
  res.json(r.rows[0]);
}

export async function updateUserRole(req, res) {
  const { rol } = req.body;
  if (!ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  if (esMismo(req.params.id, req.user.id)) return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  // Un dueño con estacionamientos debe seguir siendo CLIENTE: si no, sus recintos quedan sin nadie que
  // pueda gestionarlos.
  if (rol !== 'CLIENTE') {
    const duenio = await pool.query('SELECT COUNT(*)::int AS n FROM estacionamientos WHERE cliente_id=$1', [req.params.id]);
    if (duenio.rows[0].n > 0) return res.status(409).json({ error: 'Este usuario es dueño de estacionamientos. Reasígnalos antes de cambiarle el rol.' });
  }
  const r = await pool.query(
    `UPDATE usuarios SET rol=$1 WHERE id=$2 RETURNING id,nombre,email,rol,activo`,
    [rol, req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  await registrarAuditoria(req.user.id, 'usuario.cambiar_rol', 'usuario', r.rows[0].id, { email: r.rows[0].email, rol });
  res.json(r.rows[0]);
}

export async function deleteUser(req, res) {
  if (esMismo(req.params.id, req.user.id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  const u = await pool.query('SELECT id,nombre,email,rol FROM usuarios WHERE id=$1', [req.params.id]);
  if (!u.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  const user = u.rows[0];
  if (user.rol === 'ADMIN') {
    const otros = await pool.query(`SELECT COUNT(*)::int AS n FROM usuarios WHERE rol='ADMIN' AND activo=true AND id<>$1`, [user.id]);
    if (otros.rows[0].n === 0) return res.status(400).json({ error: 'No puedes eliminar al único administrador activo' });
  }
  try {
    await pool.query('DELETE FROM usuarios WHERE id=$1', [user.id]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Este usuario es dueño de uno o más estacionamientos. Reasígnalos antes de eliminarlo, o desactívalo.' });
    }
    throw err;
  }
  await registrarAuditoria(req.user.id, 'usuario.eliminar', 'usuario', user.id, { email: user.email, nombre: user.nombre, rol: user.rol });
  res.json({ ok: true });
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
  const regla = REGLAS_PARAMETRO[req.params.clave];
  if (regla && !regla.ok(String(valor).trim())) return res.status(400).json({ error: regla.msg });
  const r = await pool.query(
    `UPDATE parametros_sistema SET valor=$1, updated_at=NOW() WHERE clave=$2
     RETURNING clave,valor,descripcion,updated_at`,
    [String(valor).trim(), req.params.clave]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Parámetro no encontrado' });
  await registrarAuditoria(req.user.id, 'parametro.actualizar', 'parametro', r.rows[0].clave, { valor: r.rows[0].valor });
  res.json(r.rows[0]);
}

export async function auditLog(req, res) {
  res.json(await listAuditoria(req.query));
}
