import crypto from 'crypto';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { webpayTransaction } from './webpay.service.js';
import { reserveTicket } from './ticket.service.js';

const STALE_PAYMENT_MIN = 30; // Transbank invalida el token bastante antes de esto.

// Un pago queda en INICIADO si el usuario nunca vuelve de Webpay (cerró la pestaña, perdió
// conexión, etc.). Sin este barrido esos registros quedan "colgados" para siempre y ensucian
// cualquier reporte/panel que revise pagos pendientes. No libera cupos: startReservationPayment
// nunca reserva un cupo antes de que Transbank confirme el pago.
export async function releaseStalePayments() {
  const r = await pool.query(
    `UPDATE payments SET estado='EXPIRADO'
     WHERE estado='INICIADO' AND created_at < NOW() - ($1 || ' minutes')::interval
     RETURNING id`,
    [STALE_PAYMENT_MIN]
  );
  return r.rowCount;
}

export function startPaymentSweeper(logger) {
  setInterval(() => {
    releaseStalePayments().catch(err => logger?.error({ err }, 'Error liberando pagos vencidos'));
  }, 5 * 60000);
}

async function getReservaMontoClp() {
  const r = await pool.query(`SELECT valor FROM parametros_sistema WHERE clave='reserva_monto_clp'`);
  const monto = Number(r.rows[0]?.valor);
  return Number.isFinite(monto) && monto >= 100 ? monto : 100;
}

export async function startReservationPayment(estacionamientoId, patente) {
  const p = await pool.query('SELECT id,cupos_disponibles,estado FROM estacionamientos WHERE id=$1', [estacionamientoId]);
  if (!p.rowCount || !p.rows[0].estado) throw new Error('Estacionamiento no encontrado');
  if (p.rows[0].cupos_disponibles <= 0) throw new Error('Sin cupos disponibles');

  const monto = await getReservaMontoClp();
  const buyOrder = ('R' + crypto.randomUUID().replace(/-/g, '')).slice(0, 26);
  const sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 26);

  const tx = webpayTransaction();
  const resp = await tx.create(buyOrder, sessionId, monto, env.webpay.returnUrl);

  await pool.query(
    `INSERT INTO payments(tipo,estacionamiento_id,patente,buy_order,token,monto,estado)
     VALUES('RESERVA',$1,$2,$3,$4,$5,'INICIADO')`,
    [estacionamientoId, patente || null, buyOrder, resp.token, monto]
  );

  return { url: resp.url, token: resp.token, monto };
}

// El cobro al cerrar un ticket ya no pasa por Webpay: en la práctica el cajero cobra con su
// propio POS físico (débito/crédito) o en efectivo, y solo registra el medio usado (ver
// ticket.service.closeTicket). El único pago real que sigue pasando por Transbank es el
// micropago anti-fraude de la reserva pública (startReservationPayment más arriba).
export async function confirmPayment(token) {
  const p = await pool.query(`SELECT * FROM payments WHERE token = $1 AND tipo='RESERVA'`, [token]);
  if (!p.rowCount) throw new Error('Pago no encontrado');
  const payment = p.rows[0];

  const tx = webpayTransaction();
  const result = await tx.commit(token);
  const aprobado = result.response_code === 0 && result.status === 'AUTHORIZED';

  await pool.query(
    `UPDATE payments SET estado=$1, response_code=$2, authorization_code=$3 WHERE id=$4`,
    [aprobado ? 'APROBADO' : 'RECHAZADO', result.response_code, result.authorization_code, payment.id]
  );

  if (!aprobado) return { aprobado, monto: Number(payment.monto) };
  let reserva;
  try {
    reserva = await reserveTicket(payment.estacionamiento_id, payment.patente);
  } catch (e) {
    // El pago se aprobó pero el cupo se agotó justo antes de confirmar (carrera poco frecuente).
    return { aprobado: false, monto: Number(payment.monto), error: e.message };
  }
  await pool.query(`UPDATE payments SET ticket_id=$1 WHERE id=$2`, [reserva.id, payment.id]);
  return { aprobado, monto: Number(payment.monto), codigoQr: reserva.codigo_qr };
}
