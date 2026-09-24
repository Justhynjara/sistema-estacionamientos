// Espejo de backend/src/utils/tarifa.js: el conductor ve el monto subir minuto a minuto sin
// consultar al servidor cada vez. El servidor sigue siendo quien calcula el cobro real.
export function calcularTarifa(fechaEntrada, precioMinuto, tarifaMinima, ahora = Date.now()) {
  const minutos = Math.max(1, Math.ceil((ahora - new Date(fechaEntrada).getTime()) / 60000));
  const porTiempo = Math.ceil(Math.round(minutos * Number(precioMinuto) * 10) / 10);
  return { minutos, bruto: Math.max(Number(tarifaMinima), porTiempo) };
}

export function formatCLP(n) {
  return `$${Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 })}`;
}

// "$25/min · mínimo $500" (sin la parte del mínimo si no hay valor base)
export function formatTarifa({ precio_minuto, tarifa_minima }) {
  const base = `${formatCLP(precio_minuto)}/min`;
  return Number(tarifa_minima) > 0 ? `${base} · mínimo ${formatCLP(tarifa_minima)}` : base;
}

// 45 → "45 min", 83 → "1 h 23 min", 120 → "2 h"
export function formatDuracion(minutos) {
  const m = Math.max(0, Math.floor(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

// 3725000 ms → "01:02:05": cronómetro del tiempo que lleva estacionado
export function formatCronometro(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}
