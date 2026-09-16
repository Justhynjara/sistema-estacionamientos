// Se elimina el cobro por Webpay del lado del dueño (en la práctica nadie paga así en el local:
// el cajero cobra con su propio POS físico del banco). En su lugar, al cerrar un ticket se
// registra con qué medio pagó el conductor (efectivo, débito o crédito), igual que ya se hacía
// para el vuelto en efectivo, pero ahora también para tarjeta.
export const up = pgm => {
  pgm.sql(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20)
      CHECK (metodo_pago IN ('EFECTIVO','DEBITO','CREDITO'));
  `);
};

export const down = false;
