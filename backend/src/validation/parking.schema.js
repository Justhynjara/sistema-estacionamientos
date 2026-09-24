import { z } from 'zod';

const uuid = z.string().uuid('Id inválido');

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).optional()
});

// Topes de cordura (y del tipo NUMERIC de la base: sin tope, un valor enorme daba error 500).
// Un estacionamiento no puede quedar gratis por error: hace falta algún precio o valor mínimo.
const precioMinuto = z.coerce.number().nonnegative().max(100000, 'El precio por minuto no puede superar $100.000');
const tarifaMinima = z.coerce.number().nonnegative().max(10000000, 'El valor mínimo no puede superar $10.000.000');
const tieneTarifa = d => d.precio_minuto > 0 || d.tarifa_minima > 0;
const sinTarifa = { message: 'Define un precio por minuto o un valor base mínimo mayor a 0', path: ['precio_minuto'] };

export const createParkingSchema = z.object({
  cliente_id: uuid,
  nombre: z.string().trim().min(2).max(150),
  direccion: z.string().trim().min(2).max(255),
  latitud: z.coerce.number().min(-90).max(90),
  longitud: z.coerce.number().min(-180).max(180),
  precio_minuto: precioMinuto,
  tarifa_minima: tarifaMinima.default(0),
  cupo_maximo: z.coerce.number().int().positive()
}).refine(tieneTarifa, sinTarifa);

export const updatePricingSchema = z.object({
  precio_minuto: precioMinuto,
  tarifa_minima: tarifaMinima
}).refine(tieneTarifa, sinTarifa);

export const updateCapacitySchema = z.object({
  cupo_maximo: z.coerce.number().int().positive()
});
