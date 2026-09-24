// La tarifa deja de ser "precio por hora" y pasa a ser "precio por minuto + valor base mínimo",
// como cobran la mayoría de los estacionamientos. Se convierte lo existente sin perder datos:
// precio_minuto = precio_hora / 60, y tarifa_minima = precio_hora (antes siempre se cobraba al
// menos 1 hora, así que el mínimo conserva ese comportamiento hasta que el admin lo ajuste).
// El bloque solo corre si la tabla todavía tiene precio_hora: una base creada desde init.sql ya
// nace con las columnas nuevas.
const TABLAS = ['estacionamientos', 'solicitudes_cliente'];

export const up = pgm => {
  for (const t of TABLAS) {
    pgm.sql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='${t}' AND column_name='precio_hora'
        ) THEN
          ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS precio_minuto NUMERIC(10,2) CHECK (precio_minuto >= 0);
          ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS tarifa_minima NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tarifa_minima >= 0);
          UPDATE ${t} SET precio_minuto = ROUND(precio_hora / 60.0, 2), tarifa_minima = precio_hora;
          ALTER TABLE ${t} ALTER COLUMN precio_minuto SET NOT NULL;
          ALTER TABLE ${t} DROP COLUMN precio_hora;
        END IF;
      END $$;
    `);
  }
  // Parámetro que nunca se usó en el cálculo (siempre se cobraba mínimo 1 hora fija en código).
  pgm.sql(`DELETE FROM parametros_sistema WHERE clave='tarifa_hora_minima';`);
};

export const down = false;
