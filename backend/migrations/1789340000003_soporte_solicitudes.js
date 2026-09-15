export const up = pgm => {
  pgm.sql(`
    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('USUARIO','CLIENTE','ADMIN','SOPORTE'));

    CREATE TABLE IF NOT EXISTS solicitudes_cliente (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre_solicitante VARCHAR(120) NOT NULL,
      email VARCHAR(180) NOT NULL,
      telefono VARCHAR(30),
      nombre_establecimiento VARCHAR(150) NOT NULL,
      direccion VARCHAR(255) NOT NULL,
      latitud NUMERIC(10,7),
      longitud NUMERIC(10,7),
      precio_hora NUMERIC(10,2) NOT NULL CHECK (precio_hora >= 0),
      cupo_estimado INTEGER NOT NULL CHECK (cupo_estimado > 0),
      descripcion TEXT,
      fotos JSONB NOT NULL DEFAULT '[]',
      estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','PROCESADA')),
      comentario_soporte TEXT,
      revisado_por UUID REFERENCES usuarios(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_cliente(estado);
  `);
};

export const down = false;
