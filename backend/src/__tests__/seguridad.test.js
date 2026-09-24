import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { cuentasConClaveDemo } from '../services/seguridad.service.js';

const suffix = Date.now();
const conClaveDemo = `demo_expuesta_${suffix}@demo.cl`;
const conClaveReal = `demo_segura_${suffix}@demo.cl`;
const desactivada = `demo_inactiva_${suffix}@demo.cl`;

describe('seguridad: cuentas de ejemplo con clave pública', () => {
  after(async () => {
    await pool.query('DELETE FROM usuarios WHERE email=ANY($1)', [[conClaveDemo, conClaveReal, desactivada]]);
    await pool.end();
  });

  test('detecta solo las cuentas activas que siguen con la clave "password"', async () => {
    const hashDemo = await bcrypt.hash('password', 4);
    const hashReal = await bcrypt.hash('una-clave-larga-y-privada-9X', 4);
    await pool.query(`INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Expuesta',$1,$2,'ADMIN')`, [conClaveDemo, hashDemo]);
    await pool.query(`INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Segura',$1,$2,'ADMIN')`, [conClaveReal, hashReal]);
    await pool.query(`INSERT INTO usuarios(nombre,email,password_hash,rol,activo) VALUES('Inactiva',$1,$2,'ADMIN',false)`, [desactivada, hashDemo]);

    const expuestas = await cuentasConClaveDemo([conClaveDemo, conClaveReal, desactivada, 'no-existe@demo.cl']);
    assert.deepEqual(expuestas, [conClaveDemo]);
  });
});
