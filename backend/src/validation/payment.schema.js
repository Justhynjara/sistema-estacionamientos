import { z } from 'zod';

export const startReservationPaymentSchema = z.object({
  estacionamiento_id: z.string().uuid('Id inválido'),
  patente: z.string().trim().toUpperCase()
    .regex(/^[A-Z0-9]{5,8}$/, 'Ingresa una patente válida (5 a 8 caracteres alfanuméricos)')
});
