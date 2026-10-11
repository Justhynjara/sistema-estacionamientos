// Estados para un micropago de reserva que Transbank aprobó pero cuya reserva no se pudo crear
// (el último cupo se ocupó entre que el conductor empezó a pagar y el commit). Ese cobro se anula
// en Webpay (ver payment.service.js):
// - REEMBOLSADO: Transbank confirmó la reversa/anulación; el conductor no queda con el cargo.
// - REEMBOLSO_PENDIENTE: la anulación falló (p. ej. Transbank no respondió); el barrido periódico
//   la reintenta. Ninguno de los dos cuenta como abono de reserva en el dashboard del dueño.
// reembolso_tipo guarda lo que respondió Transbank (REVERSED o NULLIFIED) como respaldo ante un reclamo.
export const up = pgm => {
  pgm.sql(`
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_estado_check;
    ALTER TABLE payments ADD CONSTRAINT payments_estado_check
      CHECK (estado IN ('INICIADO','APROBADO','RECHAZADO','EXPIRADO','REEMBOLSADO','REEMBOLSO_PENDIENTE'));
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS reembolso_tipo VARCHAR(20);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS reembolsado_at TIMESTAMPTZ;
  `);
};

export const down = false;
