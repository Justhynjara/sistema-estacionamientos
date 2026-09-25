import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/estacionamientos';

// Datos propios de cada corrida (sufijo único + contraseñas aleatorias que no se guardan en ningún
// lado). Todo lo que se crea se borra en `limpiar()`, aunque la prueba falle a la mitad.
export async function crearEscenario() {
  const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
  const sufijo = `${Date.now()}${crypto.randomInt(1000)}`;

  async function usuario(nombre, rol) {
    const password = crypto.randomBytes(12).toString('base64url');
    const email = `e2e_${rol.toLowerCase()}_${sufijo}@e2e.test`;
    const r = await db.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES($1,$2,$3,$4) RETURNING id`,
      [nombre, email, await bcrypt.hash(password, 4), rol]
    );
    return { id: r.rows[0].id, nombre, email, password };
  }

  const dueno = await usuario(`Dueño E2E ${sufijo}`, 'CLIENTE');
  const admin = await usuario(`Admin E2E ${sufijo}`, 'ADMIN');
  const nombreParking = `Parking E2E ${sufijo}`;
  const parking = await db.query(
    `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
     VALUES($1,$2,'Calle E2E 123',-33.45,-70.66,20,500,5,5) RETURNING id`,
    [dueno.id, nombreParking]
  );
  // El último en crearse, para que el listado (más nuevos primero) lo muestre en la primera página.
  const victima = await usuario(`Victima E2E ${sufijo}`, 'USUARIO');

  return {
    db, sufijo, dueno, admin, victima,
    parking: { id: parking.rows[0].id, nombre: nombreParking },
    async limpiar() {
      const ids = [dueno.id, admin.id, victima.id];
      await db.query('DELETE FROM payments WHERE ticket_id IN (SELECT id FROM tickets WHERE estacionamiento_id=$1)', [parking.rows[0].id]);
      await db.query('DELETE FROM tickets WHERE estacionamiento_id=$1', [parking.rows[0].id]);
      await db.query('DELETE FROM estacionamientos WHERE id=$1', [parking.rows[0].id]);
      await db.query('DELETE FROM audit_log WHERE usuario_id=ANY($1) OR entidad_id=ANY($2)', [ids, ids.map(String)]);
      await db.query('DELETE FROM usuarios WHERE id=ANY($1)', [ids]);
      await db.end();
    }
  };
}
