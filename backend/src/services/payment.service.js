import crypto from 'crypto';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { webpayTransaction } from './webpay.service.js';
import { emitCupos } from './ticket.service.js';

function buyOrderFor(ticketId) {
  return ('T' + ticketId.replace(/-/g, '')).slice(0, 26);
}

export async function startPayment(codigoQr, clienteId) {
  const t = await pool.query(
    `SELECT t.*, e.cliente_id, e.precio_hora
     FROM tickets t JOIN estacionamientos e ON e.id = t.estacionamiento_id
     WHERE t.codigo_qr = $1`,
    [codigoQr]
  );
  if (!t.rowCount) throw new Error('Ticket no encontrado');
  const ticket = t.rows[0];
  if (ticket.cliente_id !== clienteId) throw new Error('Este ticket no pertenece a uno de tus estacionamientos');
  if (ticket.estado !== 'ACTIVO') throw new Error('Solo se pueden cobrar tickets activos');

  const horas = Math.max(1, Math.ceil((Date.now() - new Date(ticket.fecha_entrada).getTime()) / 3600000));
  const monto = horas * Number(ticket.precio_hora);
  const buyOrder = buyOrderFor(ticket.id);
  const sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 26);

  const tx = webpayTransaction();
  const resp = await tx.create(buyOrder, sessionId, monto, env.webpay.returnUrl);

  await pool.query(
    `INSERT INTO payments(ticket_id,buy_order,token,monto,estado) VALUES($1,$2,$3,$4,'INICIADO')`,
    [ticket.id, buyOrder, resp.token, monto]
  );

  return { url: resp.url, token: resp.token };
}

export async function confirmPayment(token) {
  const p = await pool.query('SELECT * FROM payments WHERE token = $1', [token]);
  if (!p.rowCount) throw new Error('Pago no encontrado');
  const payment = p.rows[0];

  const tx = webpayTransaction();
  const result = await tx.commit(token);
  const aprobado = result.response_code === 0 && result.status === 'AUTHORIZED';

  await pool.query(
    `UPDATE payments SET estado=$1, response_code=$2, authorization_code=$3 WHERE id=$4`,
    [aprobado ? 'APROBADO' : 'RECHAZADO', result.response_code, result.authorization_code, payment.id]
  );

  if (aprobado) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [payment.ticket_id]);
      const ticket = t.rows[0];
      await client.query(
        `UPDATE tickets SET estado='PAGADO', fecha_salida=NOW(), monto=$1 WHERE id=$2`,
        [payment.monto, payment.ticket_id]
      );
      const upd = await client.query(
        `UPDATE estacionamientos SET cupos_disponibles=LEAST(cupo_maximo,cupos_disponibles+1)
         WHERE id=$1 RETURNING cupos_disponibles,cupo_maximo`,
        [ticket.estacionamiento_id]
      );
      await client.query('COMMIT');
      emitCupos(ticket.estacionamiento_id, upd.rows[0].cupos_disponibles, upd.rows[0].cupo_maximo);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  return { aprobado, ticketId: payment.ticket_id, monto: Number(payment.monto) };
}
