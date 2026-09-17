// El rate-limit por IP (ver rateLimit.middleware.js) no protege una cuenta específica de un
// atacante que reparte sus intentos entre muchas IPs (proxies, botnet). Este bloqueo es por
// cuenta: tras varios intentos fallidos seguidos, esa cuenta puntual queda bloqueada un rato,
// sin importar desde qué IP se intente.
export const up = pgm => {
  pgm.sql(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;
  `);
};

export const down = false;
