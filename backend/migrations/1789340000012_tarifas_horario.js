// Tarifa por horario (ver src/utils/tarifa.js para el formato): tramos del día con otro precio por
// minuto. NULL = todo el día al precio base, así que los estacionamientos existentes cobran igual.
export const up = pgm => {
  pgm.sql(`ALTER TABLE estacionamientos ADD COLUMN IF NOT EXISTS tarifas_horario JSONB;`);
};

export const down = pgm => {
  pgm.sql(`ALTER TABLE estacionamientos DROP COLUMN IF EXISTS tarifas_horario;`);
};
