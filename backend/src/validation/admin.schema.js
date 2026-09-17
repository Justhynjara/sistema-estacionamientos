import { z } from 'zod';

export const createUserSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(['USUARIO', 'CLIENTE', 'ADMIN', 'SOPORTE'])
});

export const updateUserStatusSchema = z.object({
  activo: z.boolean()
});

export const updateUserRoleSchema = z.object({
  rol: z.enum(['USUARIO', 'CLIENTE', 'ADMIN', 'SOPORTE'])
});

export const updateParamSchema = z.object({
  valor: z.string().trim().min(1).max(255)
});

// Allowlist de claves editables: evita que un bug de frontend (o un llamado directo a la API)
// cree o pise filas de parametros_sistema fuera de las que el sistema realmente usa.
export const paramClaveSchema = z.object({
  clave: z.enum(['comision_plataforma', 'tarifa_hora_minima', 'moneda', 'reserva_monto_clp', 'reserva_ttl_min'])
});

export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  entidad: z.enum(['usuario', 'parametro', 'estacionamiento', 'solicitud']).optional(),
  accion: z.string().trim().max(60).optional()
});
