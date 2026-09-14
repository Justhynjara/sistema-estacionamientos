import { z } from 'zod';

const uuid = z.string().uuid('Id inválido');

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).optional()
});

export const createParkingSchema = z.object({
  cliente_id: uuid,
  nombre: z.string().trim().min(2).max(150),
  direccion: z.string().trim().min(2).max(255),
  latitud: z.coerce.number().min(-90).max(90),
  longitud: z.coerce.number().min(-180).max(180),
  precio_hora: z.coerce.number().nonnegative(),
  cupo_maximo: z.coerce.number().int().positive()
});

export const updateCapacitySchema = z.object({
  cupo_maximo: z.coerce.number().int().positive()
});
