import { z } from 'zod';

export const updateUserStatusSchema = z.object({
  activo: z.boolean()
});

export const updateUserRoleSchema = z.object({
  rol: z.enum(['USUARIO', 'CLIENTE', 'ADMIN'])
});

export const updateParamSchema = z.object({
  valor: z.string().trim().min(1).max(255)
});
