// Textos de las estadísticas del dueño (los datos los calcula la API en hora de Chile).
export const DIAS_SEMANA_ISO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CORTO_ISO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Cambio respecto del período anterior: "+25 %", "−40 %", "igual". Sin base para comparar
// (el período anterior en cero) no se inventa un porcentaje.
export function variacion(actual, anterior) {
  if (!anterior) {
    return actual > 0
      ? { tendencia: 'sube', texto: 'sin movimiento el período anterior' }
      : { tendencia: 'igual', texto: 'igual que el período anterior' };
  }
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return { tendencia: 'igual', texto: 'igual que el período anterior' };
  return { tendencia: pct > 0 ? 'sube' : 'baja', texto: `${pct > 0 ? '+' : '−'}${Math.abs(pct)} % vs. período anterior` };
}

// "2026-10-13" (martes) → "Mar 13"
export function etiquetaDia(fecha, diaSemanaIso) {
  return `${CORTO_ISO[diaSemanaIso - 1]} ${Number(fecha.slice(8, 10))}`;
}

export function formatPorcentaje(n) {
  return `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaMes = f => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;

// "11 al 17 oct" o, si cruza de mes, "18 sep al 17 oct".
export function rangoFechas(desde, hasta) {
  return desde.slice(0, 7) === hasta.slice(0, 7)
    ? `${Number(desde.slice(8, 10))} al ${diaMes(hasta)}`
    : `${diaMes(desde)} al ${diaMes(hasta)}`;
}

// 13200 → "$13 mil", 1500 → "$1,5 mil", 800 → "$800": montos cortos para rotular barras.
export function clpCorto(n) {
  if (n < 1000) return `$${n}`;
  return `$${(n / 1000).toLocaleString('es-CL', { maximumFractionDigits: n < 10000 ? 1 : 0 })} mil`;
}
