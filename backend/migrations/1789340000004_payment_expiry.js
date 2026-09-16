// Agrega el estado EXPIRADO a payments: distingue un pago que Transbank rechazó (RECHAZADO)
// de uno que el usuario simplemente nunca terminó de confirmar (se fue de la página, cerró
// la pestaña, etc.). El barrido periódico (ver payment.service.js) marca como EXPIRADO los
// pagos que llevan demasiado tiempo en INICIADO.
export const up = pgm => {
  pgm.sql(`
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_estado_check;
    ALTER TABLE payments ADD CONSTRAINT payments_estado_check
      CHECK (estado IN ('INICIADO','APROBADO','RECHAZADO','EXPIRADO'));
  `);
};

export const down = false;
