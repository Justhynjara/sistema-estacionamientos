import { z } from 'zod';
import { normalizarPatente, esPatenteValida, MENSAJE_PATENTE } from './common.schema.js';

export const startReservationPaymentSchema = z.object({
  estacionamiento_id: z.string().uuid('Id inválido'),
  patente: z.preprocess(normalizarPatente, z.string({ message: 'Ingresa la patente' }).refine(esPatenteValida, MENSAJE_PATENTE))
});
