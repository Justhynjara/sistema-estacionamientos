import { z } from 'zod';

export const createUserSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(['USUARIO', 'CLIENTE', 'ADMIN'])
});

export const updateUserStatusSchema = z.object({
  activo: z.boolean()
});

export const updateUserRoleSchema = z.object({
  rol: z.enum(['USUARIO', 'CLIENTE', 'ADMIN'])
});

export const updateParamSchema = z.object({
  valor: z.string().trim().min(1).max(255)
});
