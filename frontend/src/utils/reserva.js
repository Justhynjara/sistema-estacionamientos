// Tiempo restante de una reserva. La reserva dura pocos minutos (10 por defecto), así que bajo los
// últimos 3 se avisa al conductor y se destaca en la lista del dueño.
export const AVISO_RESERVA_MIN = 3;

// La última reserva pagada se recuerda en este navegador: si el conductor recarga o vuelve atrás
// después de pagar, el comprobante (con su QR) sigue disponible mientras la reserva esté vigente.
export const CLAVE_ULTIMA_RESERVA = 'ultima_reserva';

export function estadoReserva(expira, ahora = Date.now()) {
  const restanteMs = Math.max(0, new Date(expira).getTime() - ahora);
  return {
    restanteMs,
    vencida: restanteMs === 0,
    porVencer: restanteMs > 0 && restanteMs <= AVISO_RESERVA_MIN * 60000
  };
}

// 185000 → "3:05"
export function formatRestante(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
