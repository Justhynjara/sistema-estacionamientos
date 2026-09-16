import { pool } from '../config/database.js';
import { generateQR } from '../utils/generateQR.js';
import { getIO } from '../sockets/io.js';

const RESERVATION_TTL_MIN_DEFAULT = 10;

async function getReservationTtlMin(){
  const r=await pool.query(`SELECT valor FROM parametros_sistema WHERE clave='reserva_ttl_min'`);
  const min=Number(r.rows[0]?.valor);
  return Number.isFinite(min) && min>0 ? min : RESERVATION_TTL_MIN_DEFAULT;
}

export async function calcularMonto(ticketId, fechaEntrada, precioHora){
  const hours=Math.max(1, Math.ceil((Date.now()-new Date(fechaEntrada).getTime())/3600000));
  const bruto=hours*Number(precioHora);
  const dep=await pool.query(
    `SELECT monto FROM payments WHERE ticket_id=$1 AND tipo='RESERVA' AND estado='APROBADO' LIMIT 1`,
    [ticketId]
  );
  const descuento=dep.rowCount ? Number(dep.rows[0].monto) : 0;
  const monto=Math.max(0, bruto-descuento);
  return { horas:hours, bruto, descuento, monto };
}

export function emitCupos(estacionamientoId, cuposDisponibles, cupoMaximo){
  const io = getIO();
  if(!io) return;
  io.to(`parking:${estacionamientoId}`).emit('cuposActualizados', {
    estacionamiento_id: estacionamientoId,
    cupos_disponibles: cuposDisponibles,
    cupo_maximo: cupoMaximo
  });
}

export async function createTicket(estacionamientoId, patente, clienteId){
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const p=await client.query(
      'SELECT * FROM estacionamientos WHERE id=$1 AND estado=true FOR UPDATE',
      [estacionamientoId]
    );
    if(!p.rowCount) throw new Error('Estacionamiento no encontrado');
    if(p.rows[0].cliente_id !== clienteId) throw new Error('Este estacionamiento no te pertenece');
    if(p.rows[0].cupos_disponibles <= 0) throw new Error('Sin cupos disponibles');

    const qr=generateQR();
    const t=await client.query(
      `INSERT INTO tickets(estacionamiento_id,codigo_qr,patente)
       VALUES($1,$2,$3) RETURNING *`, [estacionamientoId,qr,patente || null]
    );
    const upd=await client.query(
      'UPDATE estacionamientos SET cupos_disponibles=cupos_disponibles-1 WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo',
      [estacionamientoId]
    );
    await client.query('COMMIT');
    emitCupos(estacionamientoId, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
    return t.rows[0];
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function closeTicket(qr, clienteId, metodoPago){
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const t=await client.query(
      `SELECT t.*, e.precio_hora, e.cupo_maximo, e.cliente_id, e.nombre AS estacionamiento_nombre, e.direccion AS estacionamiento_direccion
       FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
       WHERE t.codigo_qr=$1 AND t.estado='ACTIVO' FOR UPDATE`, [qr]
    );
    if(!t.rowCount) throw new Error('Ticket activo no encontrado');
    const row=t.rows[0];
    if(row.cliente_id !== clienteId) throw new Error('Este ticket no pertenece a uno de tus estacionamientos');
    const {monto,descuento}=await calcularMonto(row.id,row.fecha_entrada,row.precio_hora);
    await client.query(
      `UPDATE tickets SET fecha_salida=NOW(), estado='CERRADO', monto=$1, metodo_pago=$2 WHERE id=$3`,
      [monto,metodoPago,row.id]
    );
    const upd=await client.query(
      `UPDATE estacionamientos
       SET cupos_disponibles=LEAST(cupo_maximo,cupos_disponibles+1)
       WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo`, [row.estacionamiento_id]
    );
    await client.query('COMMIT');
    emitCupos(row.estacionamiento_id, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
    return {...row,monto,descuentoReserva:descuento,estado:'CERRADO',metodo_pago:metodoPago};
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function quoteTicket(qr, clienteId){
  const t=await pool.query(
    `SELECT t.*, e.precio_hora, e.cliente_id, e.nombre AS estacionamiento_nombre, e.direccion AS estacionamiento_direccion
     FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
     WHERE t.codigo_qr=$1 AND t.estado='ACTIVO'`, [qr]
  );
  if(!t.rowCount) throw new Error('Ticket activo no encontrado');
  const row=t.rows[0];
  if(row.cliente_id !== clienteId) throw new Error('Este ticket no pertenece a uno de tus estacionamientos');
  const {monto,descuento}=await calcularMonto(row.id,row.fecha_entrada,row.precio_hora);
  return {...row, monto, descuentoReserva:descuento};
}

export async function activeTickets(clienteId, estacionamientoId){
  const r=await pool.query(
    `SELECT t.id,t.codigo_qr,t.patente,t.fecha_entrada,t.estado,t.reserva_expira,
            e.id AS estacionamiento_id,e.nombre AS estacionamiento_nombre,e.precio_hora
     FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
     WHERE e.cliente_id=$1 AND t.estado IN ('ACTIVO','RESERVADO')
       AND ($2::uuid IS NULL OR t.estacionamiento_id=$2)
     ORDER BY t.estado DESC, t.fecha_entrada ASC`,
    [clienteId, estacionamientoId || null]
  );
  return r.rows;
}

export async function reserveTicket(estacionamientoId, patente){
  const ttlMin=await getReservationTtlMin();
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const p=await client.query(
      'SELECT * FROM estacionamientos WHERE id=$1 AND estado=true FOR UPDATE',
      [estacionamientoId]
    );
    if(!p.rowCount) throw new Error('Estacionamiento no encontrado');
    if(p.rows[0].cupos_disponibles <= 0) throw new Error('Sin cupos disponibles');

    const qr=generateQR();
    const expira=new Date(Date.now()+ttlMin*60000);
    const t=await client.query(
      `INSERT INTO tickets(estacionamiento_id,codigo_qr,patente,estado,reserva_expira)
       VALUES($1,$2,$3,'RESERVADO',$4) RETURNING *`, [estacionamientoId,qr,patente || null,expira]
    );
    const upd=await client.query(
      'UPDATE estacionamientos SET cupos_disponibles=cupos_disponibles-1 WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo',
      [estacionamientoId]
    );
    await client.query('COMMIT');
    emitCupos(estacionamientoId, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
    return t.rows[0];
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function getReservaPublica(qr){
  const r=await pool.query(
    `SELECT t.codigo_qr,t.patente,t.estado,t.reserva_expira,
            e.nombre AS estacionamiento_nombre,e.direccion AS estacionamiento_direccion,
            e.latitud,e.longitud
     FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
     WHERE t.codigo_qr=$1 AND t.estado IN ('RESERVADO','ACTIVO')`, [qr]
  );
  if(!r.rowCount) throw new Error('Reserva no encontrada o ya expiró');
  return r.rows[0];
}

export async function checkinTicket(qr, clienteId){
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const t=await client.query(
      `SELECT t.*, e.cliente_id
       FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
       WHERE t.codigo_qr=$1 AND t.estado='RESERVADO' FOR UPDATE`, [qr]
    );
    if(!t.rowCount) throw new Error('Reserva no encontrada o ya utilizada');
    const row=t.rows[0];
    if(row.cliente_id !== clienteId) throw new Error('Esta reserva no pertenece a uno de tus estacionamientos');
    if(new Date(row.reserva_expira) < new Date()){
      await client.query(`UPDATE tickets SET estado='CANCELADO' WHERE id=$1`,[row.id]);
      const upd=await client.query(
        `UPDATE estacionamientos SET cupos_disponibles=LEAST(cupo_maximo,cupos_disponibles+1)
         WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo`, [row.estacionamiento_id]
      );
      await client.query('COMMIT');
      emitCupos(row.estacionamiento_id, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
      throw new Error('La reserva expiró y el cupo fue liberado');
    }
    const upd=await client.query(
      `UPDATE tickets SET estado='ACTIVO', fecha_entrada=NOW(), reserva_expira=NULL WHERE id=$1 RETURNING *`,
      [row.id]
    );
    await client.query('COMMIT');
    return upd.rows[0];
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function releaseExpiredReservations(){
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const expired=await client.query(
      `SELECT id,estacionamiento_id FROM tickets WHERE estado='RESERVADO' AND reserva_expira < NOW() FOR UPDATE`
    );
    for(const row of expired.rows){
      await client.query(`UPDATE tickets SET estado='CANCELADO' WHERE id=$1`,[row.id]);
      const upd=await client.query(
        `UPDATE estacionamientos SET cupos_disponibles=LEAST(cupo_maximo,cupos_disponibles+1)
         WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo`, [row.estacionamiento_id]
      );
      emitCupos(row.estacionamiento_id, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
    }
    await client.query('COMMIT');
    return expired.rowCount;
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export function startReservationSweeper(logger){
  setInterval(() => {
    releaseExpiredReservations().catch(err => logger?.error({err}, 'Error liberando reservas expiradas'));
  }, 60000);
}

export async function ticketsDashboard(clienteId, estacionamientoId, fecha){
  const params=[clienteId, estacionamientoId || null, fecha || null];

  const tickets=await pool.query(
    `SELECT t.id,t.codigo_qr,t.patente,t.fecha_entrada,t.fecha_salida,t.estado,t.monto,t.metodo_pago,e.nombre AS estacionamiento_nombre
     FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
     WHERE e.cliente_id=$1
       AND ($2::uuid IS NULL OR t.estacionamiento_id=$2)
       AND t.fecha_entrada >= COALESCE($3::date, CURRENT_DATE)
       AND t.fecha_entrada < COALESCE($3::date, CURRENT_DATE) + INTERVAL '1 day'
     ORDER BY t.fecha_entrada DESC`,
    params
  );

  const totales=await pool.query(
    `SELECT COUNT(*)::int AS total_tickets, COALESCE(SUM(t.monto),0) AS total_cobrado
     FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
     WHERE e.cliente_id=$1
       AND ($2::uuid IS NULL OR t.estacionamiento_id=$2)
       AND t.fecha_entrada >= COALESCE($3::date, CURRENT_DATE)
       AND t.fecha_entrada < COALESCE($3::date, CURRENT_DATE) + INTERVAL '1 day'`,
    params
  );

  const flujo=await pool.query(
    `SELECT EXTRACT(HOUR FROM t.fecha_entrada)::int AS hora, COUNT(*)::int AS entradas
     FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
     WHERE e.cliente_id=$1
       AND ($2::uuid IS NULL OR t.estacionamiento_id=$2)
       AND t.fecha_entrada >= COALESCE($3::date, CURRENT_DATE)
       AND t.fecha_entrada < COALESCE($3::date, CURRENT_DATE) + INTERVAL '1 day'
     GROUP BY hora ORDER BY hora`,
    params
  );

  const porHora=Array.from({length:24},(_,hora)=>({hora,entradas:0}));
  flujo.rows.forEach(r=>{ porHora[r.hora].entradas=r.entradas; });
  const horaPico=porHora.reduce((max,h)=>h.entradas>max.entradas?h:max, porHora[0]);

  return {
    tickets: tickets.rows,
    totalTickets: totales.rows[0].total_tickets,
    totalCobrado: Number(totales.rows[0].total_cobrado),
    flujoPorHora: porHora,
    horaPico: horaPico.entradas>0 ? horaPico : null
  };
}
