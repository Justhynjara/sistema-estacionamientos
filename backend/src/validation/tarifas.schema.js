import { z } from 'zod';

// Formato en src/utils/tarifa.js. "24:00" solo vale como fin de un tramo.
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (usa HH:MM, de 00:00 a 23:59)');
const horaFin = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Hora inválida (usa HH:MM, de 00:00 a 24:00)');
const aMinutos = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

const tramo = z.object({
  desde: hora,
  hasta: horaFin,
  precio_minuto: z.number().nonnegative('El precio no puede ser negativo').max(100000, 'El precio por minuto no puede superar $100.000')
}).refine(t => t.desde !== t.hasta, { message: 'El tramo debe empezar y terminar a horas distintas', path: ['hasta'] });

// Minutos del día que cubre un tramo (cruza la medianoche si termina antes de empezar).
function minutosDe(t) {
  const d = aMinutos(t.desde);
  const h = aMinutos(t.hasta);
  const fin = h > d ? h : h + 1440;
  return Array.from({ length: fin - d }, (_, i) => (d + i) % 1440);
}

// null (o una lista vacía) = todo el día al precio base. Hasta 4 tramos que no se solapen.
export const tarifasHorarioSchema = z.object({
  tarifas_horario: z.array(tramo).max(4, 'Define como máximo 4 tramos').nullable()
}).superRefine((d, ctx) => {
  if (!d.tarifas_horario) return;
  const usado = new Set();
  d.tarifas_horario.forEach((t, i) => {
    for (const m of minutosDe(t)) {
      if (usado.has(m)) {
        ctx.addIssue({ code: 'custom', message: 'Los tramos no pueden solaparse', path: ['tarifas_horario', i] });
        return;
      }
      usado.add(m);
    }
  });
}).transform(d => ({ tarifas_horario: d.tarifas_horario?.length ? d.tarifas_horario : null }));
