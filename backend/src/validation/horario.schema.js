import { z } from 'zod';

// Formato en src/utils/horario.js. "24:00" solo vale como hora de cierre (fin del día).
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (usa HH:MM, de 00:00 a 23:59)');
const horaCierre = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Hora inválida (usa HH:MM, de 00:00 a 24:00)');

const turno = z.object({ abre: hora, cierra: horaCierre })
  .refine(t => t.abre !== t.cierra, { message: 'La hora de apertura y la de cierre no pueden ser iguales', path: ['cierra'] });

// null = abierto las 24 horas todos los días. Si no, exactamente 7 días (0 = domingo), cada uno
// cerrado (null) o con su turno.
export const horarioSchema = z.object({
  horario: z.array(turno.nullable()).length(7, 'El horario debe tener los 7 días de la semana').nullable()
});
