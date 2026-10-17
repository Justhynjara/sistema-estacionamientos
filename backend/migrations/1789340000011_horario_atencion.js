// Horario de atención por estacionamiento (ver src/utils/horario.js para el formato).
// NULL = abierto las 24 horas: los estacionamientos existentes siguen funcionando igual hasta que
// su dueño o un administrador definan un horario.
export const up = pgm => {
  pgm.sql(`ALTER TABLE estacionamientos ADD COLUMN IF NOT EXISTS horario JSONB;`);
};

export const down = pgm => {
  pgm.sql(`ALTER TABLE estacionamientos DROP COLUMN IF EXISTS horario;`);
};
