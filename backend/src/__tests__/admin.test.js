import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const suffix = Date.now();
const adminEmail = `admin_test_${suffix}@demo.cl`;
const noAdminEmail = `no_admin_${suffix}@demo.cl`;
const nuevoUsuarioEmail = `creado_por_admin_${suffix}@demo.cl`;
let tokenAdmin, tokenNoAdmin, adminId, nuevoUsuarioId, parkingId;

describe('admin: auditoría y control de acceso', () => {
  before(async () => {
    const hash = await bcrypt.hash('clave12345', 10);
    const admin = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Admin Test',$1,$2,'ADMIN') RETURNING id`,
      [adminEmail, hash]
    );
    adminId = admin.rows[0].id;
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'clave12345' });
    tokenAdmin = loginAdmin.body.token;

    await request(app).post('/api/auth/register').send({ nombre: 'No Admin', email: noAdminEmail, password: 'clave12345' });
    const loginNoAdmin = await request(app).post('/api/auth/login').send({ email: noAdminEmail, password: 'clave12345' });
    tokenNoAdmin = loginNoAdmin.body.token;

    // 'moneda' solo existe como fila por defecto vía seeds.sql (entorno local); en CI la
    // base de datos parte limpia con solo las migraciones, así que la aseguramos acá.
    await pool.query(
      `INSERT INTO parametros_sistema(clave,valor,descripcion) VALUES('moneda','CLP','Moneda del sistema') ON CONFLICT (clave) DO NOTHING`
    );
  });

  after(async () => {
    await pool.query('DELETE FROM audit_log WHERE usuario_id=$1', [adminId]);
    if (parkingId) await pool.query('DELETE FROM estacionamientos WHERE id=$1', [parkingId]);
    await pool.query('DELETE FROM usuarios WHERE email=ANY($1)', [[adminEmail, noAdminEmail, nuevoUsuarioEmail]]);
    await pool.end();
  });

  test('un usuario sin rol ADMIN no puede ver el log de auditoría', async () => {
    const res = await request(app).get('/api/admin/audit-log').set('Authorization', `Bearer ${tokenNoAdmin}`);
    assert.equal(res.status, 403);
  });

  test('crear un usuario deja una entrada de auditoría', async () => {
    const crear = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Creado Por Admin', email: nuevoUsuarioEmail, password: 'clave12345', rol: 'USUARIO' });
    assert.equal(crear.status, 201);
    nuevoUsuarioId = crear.body.id;

    const log = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .query({ entidad: 'usuario' });
    assert.equal(log.status, 200);
    const entrada = log.body.find(e => e.entidad_id === nuevoUsuarioId);
    assert.ok(entrada, 'debe existir una entrada de auditoría para el usuario recién creado');
    assert.equal(entrada.accion, 'usuario.crear');
    assert.equal(entrada.usuario_email, adminEmail);
  });

  test('actualizar un parámetro deja una entrada de auditoría', async () => {
    await request(app)
      .put('/api/admin/params/moneda')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: 'CLP' });

    const log = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .query({ entidad: 'parametro' });
    assert.equal(log.status, 200);
    assert.ok(log.body.some(e => e.entidad_id === 'moneda' && e.accion === 'parametro.actualizar'));
  });

  test('el admin puede cambiar la tarifa de un estacionamiento y queda auditado', async () => {
    const p = await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,'Parking Tarifa Test','Calle X',-33.45,-70.66,10,300,5,5) RETURNING id`,
      [adminId]
    );
    parkingId = p.rows[0].id;

    const res = await request(app)
      .put(`/api/admin/parking/${parkingId}/pricing`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ precio_minuto: 35, tarifa_minima: 700 });
    assert.equal(res.status, 200);
    assert.equal(Number(res.body.precio_minuto), 35);
    assert.equal(Number(res.body.tarifa_minima), 700);

    const log = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .query({ entidad: 'estacionamiento' });
    assert.ok(log.body.some(e => e.entidad_id === parkingId && e.accion === 'estacionamiento.actualizar_tarifa'));
  });

  test('un usuario sin rol ADMIN no puede cambiar tarifas', async () => {
    const res = await request(app)
      .put('/api/admin/parking/11111111-1111-4111-8111-111111111111/pricing')
      .set('Authorization', `Bearer ${tokenNoAdmin}`)
      .send({ precio_minuto: 1, tarifa_minima: 1 });
    assert.equal(res.status, 403);
  });

  test('la tarifa no acepta valores negativos', async () => {
    const res = await request(app)
      .put('/api/admin/parking/11111111-1111-4111-8111-111111111111/pricing')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ precio_minuto: -5, tarifa_minima: 0 });
    assert.equal(res.status, 400);
  });
});
