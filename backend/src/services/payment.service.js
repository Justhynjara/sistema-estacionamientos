import crypto from 'crypto';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
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
    retryPendingRefunds().catch(err => logger?.error({ err }, 'Error reintentando reembolsos pendientes'));
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
    // Sin reserva no hay nada que cobrar: se anula el cargo en Webpay en vez de quedarse con él.
    const reembolsado = await reembolsar(tx, payment);
    return { aprobado: false, reembolsado, monto: Number(payment.monto), buyOrder: payment.buy_order, error: e.message };
  }
  await pool.query(`UPDATE payments SET ticket_id=$1 WHERE id=$2`, [reserva.id, payment.id]);
  return { aprobado, monto: Number(payment.monto), codigoQr: reserva.codigo_qr };
}

// Webpay Plus responde REVERSED (reversa total: el cargo desaparece) o NULLIFIED (anulación, con
// response_code 0 si se aceptó) según cuánto tiempo pasó desde el pago.
function reembolsoAceptado(r) {
  return r?.type === 'REVERSED' || (r?.type === 'NULLIFIED' && r.response_code === 0);
}

async function marcarReembolsado(paymentId, tipo) {
  await pool.query(
    `UPDATE payments SET estado='REEMBOLSADO', reembolso_tipo=$1, reembolsado_at=NOW() WHERE id=$2`,
    [tipo, paymentId]
  );
}

async function anularEnWebpay(tx, payment) {
  const r = await tx.refund(payment.token, Number(payment.monto));
  if (!reembolsoAceptado(r)) throw new Error(`Transbank no aceptó el reembolso (${r?.type}, código ${r?.response_code})`);
  await marcarReembolsado(payment.id, r.type);
}

async function reembolsar(tx, payment) {
  try {
    await anularEnWebpay(tx, payment);
    return true;
  } catch (err) {
    // El conductor sigue con el cargo: queda pendiente para que retryPendingRefunds lo reintente.
    await pool.query(`UPDATE payments SET estado='REEMBOLSO_PENDIENTE' WHERE id=$1`, [payment.id]);
    logger.error({ err, paymentId: payment.id, buyOrder: payment.buy_order }, 'No se pudo reembolsar un pago de reserva sin cupo');
    return false;
  }
}

// Transbank solo permite consultar el estado de una transacción hasta 7 días después del pago.
const REFUND_RETRY_DAYS = 7;

// Reintenta los reembolsos que fallaron en confirmPayment. Antes de anular de nuevo se consulta el
// estado en Transbank: si el primer intento sí llegó (y lo que falló fue la respuesta), no se anula dos veces.
export async function retryPendingRefunds() {
  const pendientes = await pool.query(
    `SELECT * FROM payments
     WHERE estado='REEMBOLSO_PENDIENTE' AND created_at > NOW() - ($1 || ' days')::interval`,
    [REFUND_RETRY_DAYS]
  );
  let reembolsados = 0;
  for (const payment of pendientes.rows) {
    const tx = webpayTransaction();
    try {
      const estado = await tx.status(payment.token);
      if (estado.status === 'REVERSED' || estado.status === 'NULLIFIED') {
        await marcarReembolsado(payment.id, estado.status);
        reembolsados++;
      } else if (estado.status === 'AUTHORIZED') {
        await anularEnWebpay(tx, payment);
        reembolsados++;
      }
    } catch (err) {
      logger.error({ err, paymentId: payment.id, buyOrder: payment.buy_order }, 'Reintento de reembolso fallido');
    }
  }
  return reembolsados;
}
