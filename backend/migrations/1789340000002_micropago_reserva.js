export const up = pgm => {
  pgm.sql(`
    ALTER TABLE payments ALTER COLUMN ticket_id DROP NOT NULL;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'COBRO'
      CHECK (tipo IN ('COBRO','RESERVA'));
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS estacionamiento_id UUID REFERENCES estacionamientos(id);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS patente VARCHAR(12);

    INSERT INTO parametros_sistema (clave,valor,descripcion) VALUES
    ('reserva_monto_clp','100','Monto del micropago (CLP) que se cobra para confirmar una reserva y evitar reservas falsas'),
    ('reserva_ttl_min','10','Minutos de validez de una reserva antes de liberar el cupo automáticamente')
    ON CONFLICT (clave) DO NOTHING;
  `);
};

export const down = false;
