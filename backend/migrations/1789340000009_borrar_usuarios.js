// Permite borrar usuarios sin perder el historial: la auditoría y las revisiones de solicitudes
// que hizo un usuario quedan con usuario en NULL (el detalle de la auditoría conserva el email).
// Las contraseñas de recuperación ya se borraban en cascada. Un usuario que todavía es dueño de
// un estacionamiento sigue sin poder borrarse: la API lo avisa para reasignar el local primero.
const FKS = [
  { tabla: 'audit_log', columna: 'usuario_id' },
  { tabla: 'solicitudes_cliente', columna: 'revisado_por' }
];

export const up = pgm => {
  for (const { tabla, columna } of FKS) {
    pgm.sql(`
      DO $$
      DECLARE fk TEXT;
      BEGIN
        SELECT c.conname INTO fk
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.conrelid = '${tabla}'::regclass AND a.attname = '${columna}';
        IF fk IS NOT NULL THEN
          EXECUTE format('ALTER TABLE ${tabla} DROP CONSTRAINT %I', fk);
        END IF;
        ALTER TABLE ${tabla}
          ADD CONSTRAINT ${tabla}_${columna}_fkey FOREIGN KEY (${columna}) REFERENCES usuarios(id) ON DELETE SET NULL;
      END $$;
    `);
  }
};

export const down = false;
