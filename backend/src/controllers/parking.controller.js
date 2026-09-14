import { pool } from '../config/database.js';
export async function listParking(req,res){
  const r=await pool.query(`SELECT id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles
    FROM estacionamientos WHERE estado=true ORDER BY nombre`);
  res.json(r.rows);
}
export async function nearbyParking(req,res){
  const lat=Number(req.query.lat);
  const lng=Number(req.query.lng);
  const radiusKm=Number(req.query.radiusKm) || 5;
  if(!Number.isFinite(lat) || !Number.isFinite(lng))
    return res.status(400).json({error:'Parámetros lat y lng requeridos'});
  const r=await pool.query(
    `SELECT * FROM (
       SELECT id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles,
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
  res.json(r.rows);
}
export async function myParking(req,res){
  const r=await pool.query(`SELECT id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles,estado
    FROM estacionamientos WHERE cliente_id=$1 ORDER BY nombre`,[req.user.id]);
  res.json(r.rows);
}
export async function getParking(req,res){
  const r=await pool.query('SELECT * FROM estacionamientos WHERE id=$1',[req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  res.json(r.rows[0]);
}
export async function createParking(req,res){
  const {cliente_id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo}=req.body;
  const r=await pool.query(`INSERT INTO estacionamientos
    (cliente_id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles)
    VALUES($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
    [cliente_id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo]);
  res.status(201).json(r.rows[0]);
}
export async function updateCapacity(req,res){
  const {cupo_maximo}=req.body;
  const r=await pool.query(`UPDATE estacionamientos
    SET cupo_maximo=$1, cupos_disponibles=LEAST($1,cupos_disponibles)
    WHERE id=$2 RETURNING *`,[cupo_maximo,req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'No encontrado'});
  res.json(r.rows[0]);
}
