// Registro de auditoría: quién hizo qué acción administrativa y cuándo. Antes de esto, la única
// traza de "el admin X cambió el rol de Y" vivía en los logs efímeros de Render (pino), que no
// son consultables desde la app ni sobreviven mucho tiempo. Esta tabla es la fuente de verdad
// consultable vía GET /api/admin/audit-log.
export const up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID REFERENCES usuarios(id),
      accion VARCHAR(60) NOT NULL,
      entidad VARCHAR(60) NOT NULL,
      entidad_id VARCHAR(100),
      detalle JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entidad ON audit_log(entidad, entidad_id);
  `);
};

export const down = false;
