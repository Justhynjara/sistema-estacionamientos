export const up = pgm => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(120) NOT NULL,
      email VARCHAR(180) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol VARCHAR(20) NOT NULL CHECK (rol IN ('USUARIO','CLIENTE','ADMIN')),
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS estacionamientos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cliente_id UUID REFERENCES usuarios(id),
      nombre VARCHAR(150) NOT NULL,
      direccion VARCHAR(255) NOT NULL,
      latitud NUMERIC(10,7) NOT NULL,
      longitud NUMERIC(10,7) NOT NULL,
      precio_hora NUMERIC(10,2) NOT NULL CHECK (precio_hora >= 0),
      cupo_maximo INTEGER NOT NULL CHECK (cupo_maximo > 0),
      cupos_disponibles INTEGER NOT NULL CHECK (cupos_disponibles >= 0),
      estado BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (cupos_disponibles <= cupo_maximo)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      estacionamiento_id UUID NOT NULL REFERENCES estacionamientos(id),
      codigo_qr TEXT UNIQUE NOT NULL,
      patente VARCHAR(12),
      fecha_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_salida TIMESTAMPTZ,
      estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
      monto NUMERIC(10,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS parametros_sistema (
      clave VARCHAR(60) PRIMARY KEY,
      valor VARCHAR(255) NOT NULL,
      descripcion VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_parking_location ON estacionamientos(latitud, longitud);
    CREATE INDEX IF NOT EXISTS idx_tickets_parking ON tickets(estacionamiento_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(codigo_qr);
  `);
};

export const down = false;
