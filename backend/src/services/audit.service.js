import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

// Best-effort: si falla el registro de auditoría, no debe tumbar la acción administrativa real
// que la disparó (crear un usuario, cambiar un rol, etc. importa más que dejar la traza).
export async function registrarAuditoria(usuarioId, accion, entidad, entidadId, detalle = null) {
  try {
    await pool.query(
      `INSERT INTO audit_log(usuario_id,accion,entidad,entidad_id,detalle) VALUES($1,$2,$3,$4,$5::jsonb)`,
      [usuarioId, accion, entidad, entidadId != null ? String(entidadId) : null, detalle ? JSON.stringify(detalle) : null]
    );
  } catch (err) {
    logger.error({ err, accion, entidad, entidadId }, 'No se pudo registrar la auditoría');
  }
}

export async function listAuditoria({ limit = 50, entidad = null, accion = null } = {}) {
  const r = await pool.query(
    `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.detalle, a.created_at,
            u.nombre AS usuario_nombre, u.email AS usuario_email
     FROM audit_log a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE ($1::text IS NULL OR a.entidad = $1)
       AND ($2::text IS NULL OR a.accion = $2)
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [entidad, accion, limit]
  );
  return r.rows;
}
