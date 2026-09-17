import { pool } from '../config/database.js';
import { registrarAuditoria } from './audit.service.js';

export async function crearSolicitud(data) {
  const r = await pool.query(
    `INSERT INTO solicitudes_cliente
      (nombre_solicitante,email,telefono,nombre_establecimiento,direccion,latitud,longitud,precio_hora,cupo_estimado,descripcion,fotos)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     RETURNING id,estado,created_at`,
    [
      data.nombre_solicitante, data.email, data.telefono || null, data.nombre_establecimiento, data.direccion,
      data.latitud ?? null, data.longitud ?? null, data.precio_hora, data.cupo_estimado, data.descripcion || null,
      JSON.stringify(data.fotos || [])
    ]
  );
  return r.rows[0];
}

export async function listSolicitudes(estado) {
  const r = await pool.query(
    `SELECT id,nombre_solicitante,email,telefono,nombre_establecimiento,direccion,latitud,longitud,
            precio_hora,cupo_estimado,descripcion,estado,comentario_soporte,created_at,updated_at,
            jsonb_array_length(fotos) AS cantidad_fotos
     FROM solicitudes_cliente
     WHERE ($1::text IS NULL OR estado=$1)
     ORDER BY created_at DESC`,
    [estado || null]
  );
  return r.rows;
}

export async function getSolicitud(id) {
  const r = await pool.query(`SELECT * FROM solicitudes_cliente WHERE id=$1`, [id]);
  if (!r.rowCount) throw new Error('Solicitud no encontrada');
  return r.rows[0];
}

export async function revisarSolicitud(id, estado, comentario, revisorId) {
  const r = await pool.query(
    `UPDATE solicitudes_cliente SET estado=$1,comentario_soporte=$2,revisado_por=$3,updated_at=NOW()
     WHERE id=$4 AND estado='PENDIENTE'
     RETURNING id,estado,comentario_soporte`,
    [estado, comentario || null, revisorId, id]
  );
  if (!r.rowCount) throw new Error('La solicitud ya fue revisada o no existe');
  await registrarAuditoria(revisorId, 'solicitud.revisar', 'solicitud', id, { estado, comentario: comentario || null });
  return r.rows[0];
}

export async function marcarProcesada(id, adminId) {
  const r = await pool.query(
    `UPDATE solicitudes_cliente SET estado='PROCESADA',updated_at=NOW()
     WHERE id=$1 AND estado='APROBADA'
     RETURNING id,estado`,
    [id]
  );
  if (!r.rowCount) throw new Error('La solicitud no está aprobada o no existe');
  await registrarAuditoria(adminId, 'solicitud.procesar', 'solicitud', id);
  return r.rows[0];
}
