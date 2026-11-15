import { z } from 'zod';
import { coincideConTipoDeclarado } from '../utils/imagenSniff.js';

const fotoDataUri = z.string()
  .max(2_800_000, 'Foto demasiado pesada (máx. ~2MB por foto)')
  .refine(s => /^data:image\/(png|jpe?g|webp);base64,/.test(s), 'Formato de foto inválido')
  // El encabezado "data:image/png;..." lo pone quien envía el archivo: no basta para confiar en
  // que el contenido sea realmente una imagen. Se compara contra la firma real de los primeros
  // bytes, para no guardar en la base ni mostrarle a soporte un archivo distinto disfrazado de foto.
  .refine(s => coincideConTipoDeclarado(s, s.match(/^data:image\/([a-z]+);/)[1]), 'El archivo no es una imagen válida');

// Las columnas guardan precio_minuto NUMERIC(12,4) y tarifa_minima NUMERIC(10,2): se redondea igual
// que la base ANTES de validar, para que un 0.00001 no pase el "mayor a 0" y luego se guarde como 0.
const redondear = decimales => v => Math.round(v * 10 ** decimales) / 10 ** decimales;

// Teléfono chileno (o internacional) con o sin +, espacios, guiones o paréntesis: 8 a 12 dígitos.
const telefonoValido = s => s === '' || (/^\+?[\d\s().-]+$/.test(s) && (s.match(/\d/g) || []).length >= 8 && (s.match(/\d/g) || []).length <= 12);

export const crearSolicitudSchema = z.object({
  nombre_solicitante: z.string().trim().min(2, 'Nombre muy corto').max(120),
  email: z.string().trim().toLowerCase().max(180, 'Email demasiado largo').email('Email inválido'),
  telefono: z.string().trim().max(30).refine(telefonoValido, 'Teléfono inválido: usa un formato como +56 9 1234 5678').optional().nullable(),
  nombre_establecimiento: z.string().trim().min(2, 'Nombre muy corto').max(150),
  direccion: z.string().trim().min(4, 'Dirección muy corta').max(255),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  precio_minuto: z.number().nonnegative('El precio no puede ser negativo').max(100000, 'El precio por minuto no puede superar $100.000').transform(redondear(4)),
  tarifa_minima: z.number().nonnegative('El valor mínimo no puede ser negativo').max(10000000, 'El valor mínimo no puede superar $10.000.000').transform(redondear(2)).optional().default(0),
  cupo_estimado: z.number().int('Debe ser un número entero').positive('Debe ser mayor a 0').max(100000, 'Los cupos no pueden superar 100.000'),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  fotos: z.array(fotoDataUri).max(4, 'Máximo 4 fotos').optional().default([]),
  // Señuelo antibot: un campo que una persona real nunca ve ni llena (oculto visualmente en el
  // formulario), pero que un bot que autocompleta todos los campos sí suele rellenar. Si llega
  // con algo, la ruta responde éxito sin crear nada, para no delatarle al bot que fue detectado.
  sitio_web: z.string().max(200).optional().default('')
}).refine(d => d.precio_minuto > 0 || d.tarifa_minima > 0, {
  message: 'Indica un precio por minuto o un valor base mínimo mayor a 0',
  path: ['precio_minuto']
});

export const revisarSolicitudSchema = z.object({
  estado: z.enum(['APROBADA', 'RECHAZADA'], { message: 'El estado debe ser APROBADA o RECHAZADA' }),
  comentario: z.string().trim().max(1000, 'El comentario no puede superar 1000 caracteres').optional().nullable()
// Un rechazo sin motivo deja al solicitante sin saber qué corregir: el comentario es obligatorio.
}).refine(d => d.estado !== 'RECHAZADA' || !!d.comentario, {
  message: 'Indica el motivo del rechazo para el solicitante',
  path: ['comentario']
});

export const listSolicitudesQuerySchema = z.object({
  estado: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PROCESADA'], { message: 'Estado de solicitud inválido' }).optional()
});
