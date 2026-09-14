export const up = pgm => {
  pgm.sql(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reserva_expira TIMESTAMPTZ;

    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_estado_check;
    ALTER TABLE tickets ADD CONSTRAINT tickets_estado_check
      CHECK (estado IN ('RESERVADO','ACTIVO','PAGADO','CERRADO','CANCELADO'));

    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id),
      buy_order VARCHAR(26) NOT NULL,
      token TEXT,
      monto NUMERIC(10,2) NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'INICIADO' CHECK (estado IN ('INICIADO','APROBADO','RECHAZADO')),
      response_code INTEGER,
      authorization_code VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_parking_fecha ON tickets(estacionamiento_id, fecha_entrada);
    CREATE INDEX IF NOT EXISTS idx_password_resets_usuario ON password_resets(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_payments_ticket ON payments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_payments_token ON payments(token);
  `);
};

export const down = false;
