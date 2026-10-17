// Tiempo restante de una reserva. La reserva dura pocos minutos (10 por defecto), así que bajo los
// últimos 3 se avisa al conductor y se destaca en la lista del dueño.
export const AVISO_RESERVA_MIN = 3;

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
