import { z } from 'zod';

const fotoDataUri = z.string()
  .max(2_800_000, 'Foto demasiado pesada (máx. ~2MB por foto)')
  .refine(s => /^data:image\/(png|jpe?g|webp);base64,/.test(s), 'Formato de foto inválido');

export const crearSolicitudSchema = z.object({
  nombre_solicitante: z.string().trim().min(2, 'Nombre muy corto').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  telefono: z.string().trim().max(30).optional().nullable(),
  nombre_establecimiento: z.string().trim().min(2, 'Nombre muy corto').max(150),
  direccion: z.string().trim().min(4, 'Dirección muy corta').max(255),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  precio_minuto: z.number().nonnegative('El precio no puede ser negativo').max(100000, 'El precio por minuto no puede superar $100.000'),
  tarifa_minima: z.number().nonnegative('El valor mínimo no puede ser negativo').max(10000000, 'El valor mínimo no puede superar $10.000.000').optional().default(0),
  cupo_estimado: z.number().int('Debe ser un número entero').positive('Debe ser mayor a 0'),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  fotos: z.array(fotoDataUri).max(4, 'Máximo 4 fotos').optional().default([])
}).refine(d => d.precio_minuto > 0 || d.tarifa_minima > 0, {
  message: 'Indica un precio por minuto o un valor base mínimo mayor a 0',
  path: ['precio_minuto']
});

export const revisarSolicitudSchema = z.object({
  estado: z.enum(['APROBADA', 'RECHAZADA']),
  comentario: z.string().trim().max(1000).optional().nullable()
});

export const listSolicitudesQuerySchema = z.object({
  estado: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PROCESADA']).optional()
});
