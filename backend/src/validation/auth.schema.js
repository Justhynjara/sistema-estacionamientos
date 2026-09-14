import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida')
});

export const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(['USUARIO', 'CLIENTE', 'ADMIN']).optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});
