import { z } from 'zod';

export const startPaymentSchema = z.object({
  codigo_qr: z.string().trim().min(4)
});
