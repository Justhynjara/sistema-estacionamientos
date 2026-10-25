import { pool } from '../config/database.js';
import { registrarAuditoria } from '../services/audit.service.js';
import { estadoHorario } from '../utils/horario.js';

// Cada estacionamiento sale con su horario y con el estado calculado en este momento (abierto o
// cerrado, y cuándo cambia), para que la web no tenga que repetir el cálculo en hora de Chile.
const conHorario = fila => ({ ...fila, horario_estado: estadoHorario(fila.horario) });
export async function listParking(req,res){
  const r=await pool.query(`SELECT id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles,horario,tarifas_horario
    FROM estacionamientos WHERE estado=true ORDER BY nombre`);
  res.json(r.rows.map(conHorario));
}
export async function nearbyParking(req,res){
  const lat=Number(req.query.lat);
  const lng=Number(req.query.lng);
  const radiusKm=Number(req.query.radiusKm) || 5;
  if(!Number.isFinite(lat) || !Number.isFinite(lng))
    return res.status(400).json({error:'Parámetros lat y lng requeridos'});
  const r=await pool.query(
    `SELECT * FROM (
       SELECT id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles,horario,tarifas_horario,
         (6371 * acos(
           LEAST(1, cos(radians($1)) * cos(radians(latitud)) * cos(radians(longitud) - radians($2))
             + sin(radians($1)) * sin(radians(latitud)))
         )) AS distancia_km
       FROM estacionamientos
       WHERE estado=true
     ) t
     WHERE distancia_km <= $3
     ORDER BY distancia_km ASC`,
    [lat,lng,radiusKm]
  );
  res.json(r.rows.map(conHorario));
}
export async function myParking(req,res){
  const r=await pool.query(`SELECT id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles,estado,horario,tarifas_horario
    FROM estacionamientos WHERE cliente_id=$1 ORDER BY nombre`,[req.user.id]);
  res.json(r.rows.map(conHorario));
}
export async function getParking(req,res){
  // Endpoint público: nunca cliente_id (identifica al dueño) ni created_at, que no aportan nada
  // a quien busca estacionamiento y no deberían quedar expuestos a cualquiera.
  const r=await pool.query(`SELECT id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles,estado,horario,tarifas_horario
    FROM estacionamientos WHERE id=$1`,[req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  res.json(conHorario(r.rows[0]));
}
export async function createParking(req,res){
  const {cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo}=req.body;
  const r=await pool.query(`INSERT INTO estacionamientos
    (cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
    [cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo]);
  await registrarAuditoria(req.user.id, 'estacionamiento.crear', 'estacionamiento', r.rows[0].id, { nombre, cliente_id, cupo_maximo });
  res.status(201).json(r.rows[0]);
}
export async function updateCapacity(req,res){
  const {cupo_maximo}=req.body;
  const r=await pool.query(`UPDATE estacionamientos
    SET cupo_maximo=$1, cupos_disponibles=LEAST($1,cupos_disponibles)
    WHERE id=$2 RETURNING *`,[cupo_maximo,req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  await registrarAuditoria(req.user.id, 'estacionamiento.actualizar_cupo', 'estacionamiento', r.rows[0].id, { cupo_maximo });
  res.json(r.rows[0]);
}
export async function updatePricing(req,res){
  const {precio_minuto,tarifa_minima}=req.body;
  const r=await pool.query(`UPDATE estacionamientos SET precio_minuto=$1, tarifa_minima=$2
    WHERE id=$3 RETURNING *`,[precio_minuto,tarifa_minima,req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  await registrarAuditoria(req.user.id, 'estacionamiento.actualizar_tarifa', 'estacionamiento', r.rows[0].id, { precio_minuto, tarifa_minima });
  res.json(r.rows[0]);
}
// Listado para el panel de administración: a diferencia de listParking (público), incluye
// cliente_id y los estacionamientos desactivados, porque el admin necesita ver y poder corregir
// a quién pertenece cada uno (la vista pública lo oculta a propósito, ver getParking). También
// suma cuántos tickets tiene cada uno: sirve para detectar duplicados (dos estacionamientos con
// nombre parecido, uno vacío y otro con las ventas reales, cada uno con un dueño distinto).
export async function listParkingAdmin(req,res){
  const r=await pool.query(`SELECT e.id,e.nombre,e.direccion,e.latitud,e.longitud,e.precio_minuto,e.tarifa_minima,e.cupo_maximo,e.cupos_disponibles,e.estado,e.cliente_id,e.horario,e.tarifas_horario,
      COUNT(t.id)::int AS total_tickets,
      COUNT(t.id) FILTER (WHERE t.estado IN ('ACTIVO','RESERVADO'))::int AS tickets_activos
    FROM estacionamientos e
    LEFT JOIN tickets t ON t.estacionamiento_id=e.id
    GROUP BY e.id
    ORDER BY e.nombre`);
  res.json(r.rows.map(conHorario));
}
// Solo se eliminan estacionamientos sin movimientos: si tiene tickets o pagos en su historial, la
// FK lo impide (error 23503) y se responde 409 explicando por qué, para no destruir registros
// financieros/contables. Para sacar de circulación uno con historial, el camino es desactivarlo.
export async function deleteParking(req,res){
  const e=await pool.query('SELECT id,nombre,cliente_id FROM estacionamientos WHERE id=$1',[req.params.id]);
  if(!e.rowCount) return res.status(404).json({error:'No encontrado'});
  const est=e.rows[0];
  try {
    await pool.query('DELETE FROM estacionamientos WHERE id=$1',[est.id]);
  } catch (err) {
    if(err.code==='23503')
      return res.status(409).json({error:'No se puede eliminar: el estacionamiento tiene tickets o pagos en su historial. Solo puedes eliminar estacionamientos sin movimientos.'});
    throw err;
  }
  await registrarAuditoria(req.user.id, 'estacionamiento.eliminar', 'estacionamiento', est.id, { nombre: est.nombre, cliente_id: est.cliente_id });
  res.json({ ok: true });
}
export async function updateOwner(req,res){
  const {cliente_id}=req.body;
  const due=await pool.query(`SELECT rol FROM usuarios WHERE id=$1`,[cliente_id]);
  if(!due.rowCount || due.rows[0].rol!=='CLIENTE')
    return res.status(400).json({error:'El nuevo dueño debe ser un usuario con rol CLIENTE'});
  const anterior=await pool.query(`SELECT cliente_id FROM estacionamientos WHERE id=$1`,[req.params.id]);
  if(!anterior.rowCount) return res.status(404).json({error:'No encontrado'});
  const r=await pool.query(`UPDATE estacionamientos SET cliente_id=$1 WHERE id=$2 RETURNING *`,[cliente_id,req.params.id]);
  await registrarAuditoria(req.user.id, 'estacionamiento.cambiar_dueno', 'estacionamiento', r.rows[0].id, { cliente_id_anterior: anterior.rows[0].cliente_id, cliente_id_nuevo: cliente_id });
  res.json(r.rows[0]);
}

async function guardarHorario(req,res,{soloDelDueno}){
  const {horario}=req.body;
  const params=[horario===null ? null : JSON.stringify(horario), req.params.id];
  const r=await pool.query(
    `UPDATE estacionamientos SET horario=$1 WHERE id=$2 ${soloDelDueno ? 'AND cliente_id=$3' : ''} RETURNING *`,
    soloDelDueno ? [...params, req.user.id] : params
  );
  // Al dueño no se le dice si el estacionamiento existe pero es de otro: 404 en ambos casos.
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  await registrarAuditoria(req.user.id, 'estacionamiento.actualizar_horario', 'estacionamiento', r.rows[0].id, { horario });
  res.json(conHorario(r.rows[0]));
}
// El administrador puede fijar el horario de cualquier estacionamiento; el dueño, solo de los suyos.
export const updateHorario=(req,res)=>guardarHorario(req,res,{soloDelDueno:false});
export const updateMiHorario=(req,res)=>guardarHorario(req,res,{soloDelDueno:true});

// Tramos con otro precio por minuto según la hora. Como el precio base, solo lo cambia el
// administrador; queda en la auditoría.
export async function updateTarifasHorario(req,res){
  const {tarifas_horario}=req.body;
  const r=await pool.query(`UPDATE estacionamientos SET tarifas_horario=$1 WHERE id=$2 RETURNING *`,
    [tarifas_horario===null ? null : JSON.stringify(tarifas_horario), req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  await registrarAuditoria(req.user.id, 'estacionamiento.actualizar_tarifas_horario', 'estacionamiento', r.rows[0].id, { tarifas_horario });
  res.json(conHorario(r.rows[0]));
}
