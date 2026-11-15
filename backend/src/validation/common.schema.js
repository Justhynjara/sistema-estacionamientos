import { z } from 'zod';

// Las patentes se escriben de muchas formas ("AB-1234", "ab 12 34", "BB·CD·12"): se guardan sin
// separadores y en mayúsculas. Toda patente chilena (antigua, nueva, moto o remolque) tiene al menos
// dos letras, así que un "12345" no es una patente.
export const normalizarPatente = v => typeof v === 'string' ? v.replace(/[\s.\-·]/g, '').toUpperCase() : v;
export const esPatenteValida = v => /^[A-Z0-9]{5,8}$/.test(v) && (v.match(/[A-Z]/g) || []).length >= 2;
export const MENSAJE_PATENTE = 'Patente inválida: usa el formato AB1234 o BBCD12';

export const idParamSchema = z.object({
  id: z.string().uuid('Id inválido').transform(s => s.toLowerCase())
});
