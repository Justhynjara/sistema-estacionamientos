import { z } from 'zod';

export const startPaymentSchema = z.object({
  codigo_qr: z.string().trim().min(4)
});

export const startReservationPaymentSchema = z.object({
  estacionamiento_id: z.string().uuid('Id inválido'),
  patente: z.string().trim().toUpperCase().min(2, 'Ingresa la patente del vehículo').max(12)
});
