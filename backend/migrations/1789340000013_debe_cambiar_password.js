// El admin crea usuarios con privilegios (CLIENTE, SOPORTE, ADMIN) asignándoles una clave
// temporal. Esta bandera obliga a esa persona a definir su propia contraseña en el primer
// ingreso: hasta que lo haga, el backend la bloquea de todo endpoint protegido (ver
// auth.middleware.js). Los usuarios existentes y el registro público quedan en FALSE porque
// ya eligieron su propia clave.
export const up = pgm => {
  pgm.sql(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;
  `);
};

export const down = false;
