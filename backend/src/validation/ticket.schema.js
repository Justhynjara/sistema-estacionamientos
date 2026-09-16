import { z } from 'zod';

const uuid = z.string().uuid('Id inválido');
// Formato de patente chilena, antigua (BB1234) o nueva (BBBB12), tolerante a otros formatos
// (motos, remolques, diplomáticas). Vacío/null se deja pasar: no todos los tickets manuales
// registran patente al momento de emitir.
const patente = z.string().trim().toUpperCase()
  .refine(v => v === '' || /^[A-Z0-9]{5,8}$/.test(v), 'Patente inválida (5 a 8 caracteres alfanuméricos)')
  .max(12).optional().nullable();

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

// El cobro real (a diferencia de la cotización) siempre debe registrar con qué medio pagó el
// conductor: efectivo, o tarjeta de débito/crédito cobrada en el POS físico del local.
export const closeTicketWithMethodSchema = closeTicketSchema.extend({
  metodo_pago: z.enum(['EFECTIVO', 'DEBITO', 'CREDITO'], { message: 'Selecciona el método de pago' })
});

export const checkinSchema = z.object({
  codigo_qr: z.string().trim().min(4)
});

export const dashboardQuerySchema = z.object({
  estacionamiento_id: uuid.optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD').optional()
});

export const activeQuerySchema = z.object({
  estacionamiento_id: uuid.optional()
});
