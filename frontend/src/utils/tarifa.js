// Espejo de backend/src/utils/tarifa.js: el conductor ve el monto subir minuto a minuto sin
// consultar al servidor cada vez. El servidor sigue siendo quien calcula el cobro real.
// Con tarifa por horario, cada minuto se cobra al precio del tramo en que empieza (hora de Chile).
const MIN_DIA = 24 * 60;
const HORA_MS = 3600000;
const reloj = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const aMinutos = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function minutoLocal(ms) {
  const p = Object.fromEntries(reloj.formatToParts(ms).map(x => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

export function precioEnMinuto(minutoDelDia, tarifasHorario, precioBase) {
  for (const t of tarifasHorario || []) {
    const d = aMinutos(t.desde);
    const h = aMinutos(t.hasta);
    const dentro = d < h ? minutoDelDia >= d && minutoDelDia < h : minutoDelDia >= d || minutoDelDia < h;
    if (dentro) return Number(t.precio_minuto);
  }
  return Number(precioBase);
}

function sumaPorMinuto(inicioMs, minutos, precioBase, tarifasHorario) {
  if (!tarifasHorario?.length) return minutos * Number(precioBase);
  const conteo = new Map();
  let local = minutoLocal(inicioMs);
  for (let i = 0; i < minutos; i++) {
    if (i > 0) {
      const t = inicioMs + i * 60000;
      local = Math.floor(t / HORA_MS) !== Math.floor((t - 60000) / HORA_MS) ? minutoLocal(t) : (local + 1) % MIN_DIA;
    }
    const p = precioEnMinuto(local, tarifasHorario, precioBase);
    conteo.set(p, (conteo.get(p) || 0) + 1);
  }
  let suma = 0;
  for (const [p, n] of conteo) suma += n * p;
  return suma;
}

export function calcularTarifa(fechaEntrada, precioMinuto, tarifaMinima, ahora = Date.now(), tarifasHorario = null) {
  const inicio = new Date(fechaEntrada).getTime();
  const minutos = Math.max(1, Math.ceil((ahora - inicio) / 60000));
  const porTiempo = Math.ceil(Math.round(sumaPorMinuto(inicio, minutos, precioMinuto, tarifasHorario) * 10) / 10);
  return { minutos, bruto: Math.max(Number(tarifaMinima), porTiempo) };
}

// Lo que costaría quedarse una cantidad de horas entrando ahora (estimación para comparar antes de
// ir; el cobro real lo calcula el servidor al salir).
export function costoEstimado(p, horas, ahora = Date.now()) {
  return calcularTarifa(ahora, p.precio_minuto, p.tarifa_minima, ahora + horas * HORA_MS, p.tarifas_horario).bruto;
}

export function formatCLP(n) {
  return `$${Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 })}`;
}

// "$25/min · mínimo $500" (sin la parte del mínimo si no hay valor base), y los tramos por
// horario si los hay: "$25/min · 20:00–08:00 $10/min".
export function formatTarifa({ precio_minuto, tarifa_minima, tarifas_horario }) {
  const base = `${formatCLP(precio_minuto)}/min`;
  const partes = [base, ...(tarifas_horario || []).map(t => `${formatTramo(t)} ${formatCLP(t.precio_minuto)}/min`)];
  if (Number(tarifa_minima) > 0) partes.push(`mínimo ${formatCLP(tarifa_minima)}`);
  return partes.join(' · ');
}

// "20:00–08:00"; el día completo se lee "todo el día".
export function formatTramo({ desde, hasta }) {
  return desde === '00:00' && hasta === '24:00' ? 'todo el día' : `${desde}–${hasta}`;
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
