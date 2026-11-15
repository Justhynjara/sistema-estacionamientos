import { z } from 'zod';
import { normalizarPatente, esPatenteValida, MENSAJE_PATENTE } from './common.schema.js';

const uuid = z.string().uuid('Id inválido');
// Formato de patente chilena, antigua (BB1234) o nueva (BBBB12), tolerante a otros formatos
// (motos, remolques, diplomáticas). Vacío/null se deja pasar: no todos los tickets manuales
// registran patente al momento de emitir.
const patente = z.preprocess(normalizarPatente, z.string().max(12)
  .refine(v => v === '' || esPatenteValida(v), MENSAJE_PATENTE).optional().nullable());

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
  metodo_pago: z.enum(['EFECTIVO', 'DEBITO', 'CREDITO'], { message: 'Selecciona el método de pago' }),
  // Cotización firmada que devolvió /tickets/quote: congela el monto unos minutos.
  cotizacion: z.string().max(2000).optional()
});

export const codigoParamSchema = z.object({
  codigo_qr: z.string().trim().min(4).max(100)
});

export const checkinSchema = z.object({
  codigo_qr: z.string().trim().min(4)
});

export const dashboardQuerySchema = z.object({
  estacionamiento_id: uuid.optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe tener formato YYYY-MM-DD')
    // El formato no basta: "2026-13-45" o "2026-02-30" llegaban a la base y respondían 500.
    .refine(f => { const d = new Date(f + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().startsWith(f); }, 'Fecha inexistente')
    .optional()
});

// Estadísticas de los últimos 7 o 30 días.
export const estadisticasQuerySchema = z.object({
  estacionamiento_id: uuid.optional(),
  dias: z.enum(['7', '30'], { message: 'El período debe ser 7 o 30 días' }).default('7').transform(Number)
});

export const activeQuerySchema = z.object({
  estacionamiento_id: uuid.optional()
});
