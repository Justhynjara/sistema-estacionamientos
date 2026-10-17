// Tarifa por minuto con valor base mínimo: se cobra el mayor entre el mínimo y (minutos × precio por minuto).
// Los minutos se redondean hacia arriba (cualquier fracción cuenta como minuto completo, mínimo 1)
// y el total en pesos también, para no cobrar de menos ni trabajar con centavos.
//
// Tarifa por horario (opcional, columna estacionamientos.tarifas_horario, JSONB):
//   null                                   -> todo el día al precio por minuto base.
//   [{ desde: 'HH:MM', hasta: 'HH:MM', precio_minuto }]  (hasta 4 tramos, sin solaparse)
//       Cada minuto de la estadía se cobra al precio del tramo en que empieza, en hora de Chile;
//       fuera de los tramos rige el precio base. Si hasta <= desde, el tramo cruza la medianoche
//       (ej. 20:00 a 08:00 = tarifa nocturna). '24:00' vale como fin del día.
// El valor base mínimo se aplica igual sobre el total.
const ZONA_HORARIA = 'America/Santiago';
const MIN_DIA = 24 * 60;
const HORA_MS = 3600000;
const reloj = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

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

// Suma de los precios de cada minuto. Se cuentan los minutos de cada precio y se multiplica al
// final: sumar 16.6667 miles de veces acumularía error de punto flotante.
function sumaPorMinuto(inicioMs, minutos, precioBase, tarifasHorario) {
  if (!tarifasHorario?.length) return minutos * Number(precioBase);
  const conteo = new Map();
  let local = minutoLocal(inicioMs);
  for (let i = 0; i < minutos; i++) {
    if (i > 0) {
      const t = inicioMs + i * 60000;
      // Chile cambia de horario en horas UTC exactas: al cruzar una se vuelve a leer el reloj
      // local, y entremedio basta con avanzar un minuto.
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
  // Se redondea a décimas de peso antes del ceil: evita que 0.1 × 3 dé 0.30000000000000004 → 1, y que un
  // precio por hora convertido a minuto (1000/60 = 16.6667) cobre $1 de más al completar horas enteras.
  const porTiempo = Math.ceil(Math.round(sumaPorMinuto(inicio, minutos, precioMinuto, tarifasHorario) * 10) / 10);
  return { minutos, bruto: Math.max(Number(tarifaMinima), porTiempo) };
}
