import { z } from 'zod';

const uuid = z.string().uuid('Id inválido');
const patente = z.string().trim().toUpperCase().max(12).optional().nullable();

export const createTicketSchema = z.object({
  estacionamiento_id: uuid,
  patente
});

export const reserveTicketSchema = z.object({
  estacionamiento_id: uuid,
  patente
});

export const closeTicketSchema = z.object({
  codigo_qr: z.string().trim().min(4)
});

export const checkinSchema = z.object({
  codigo_qr: z.string().trim().min(4)
});

export const dashboardQuerySchema = z.object({
  estacionamiento_id: uuid.optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD').optional()
});
