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
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
    CHECK (estado IN ('RESERVADO','ACTIVO','PAGADO','CERRADO','CANCELADO')),
  monto NUMERIC(10,2),
  reserva_expira TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parametros_sistema (
  clave VARCHAR(60) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  ticket_id UUID REFERENCES tickets(id),
  tipo VARCHAR(20) NOT NULL DEFAULT 'COBRO' CHECK (tipo IN ('COBRO','RESERVA')),
  estacionamiento_id UUID REFERENCES estacionamientos(id),
  patente VARCHAR(12),
  buy_order VARCHAR(26) NOT NULL,
  token TEXT,
  monto NUMERIC(10,2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'INICIADO' CHECK (estado IN ('INICIADO','APROBADO','RECHAZADO')),
  response_code INTEGER,
  authorization_code VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_location ON estacionamientos(latitud, longitud);
CREATE INDEX IF NOT EXISTS idx_tickets_parking ON tickets(estacionamiento_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(codigo_qr);
CREATE INDEX IF NOT EXISTS idx_tickets_parking_fecha ON tickets(estacionamiento_id, fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_password_resets_usuario ON password_resets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_payments_ticket ON payments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_payments_token ON payments(token);
