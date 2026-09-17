import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const suffix = Date.now();
const noAdminEmail = `no_admin_${suffix}@demo.cl`;
const nuevoUsuarioEmail = `creado_por_admin_${suffix}@demo.cl`;
let tokenAdmin, tokenNoAdmin, nuevoUsuarioId;

describe('admin: auditoría y control de acceso', () => {
  before(async () => {
    const loginAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@demo.cl', password: 'password' });
    tokenAdmin = loginAdmin.body.token;

    await request(app).post('/api/auth/register').send({ nombre: 'No Admin', email: noAdminEmail, password: 'clave12345' });
    const loginNoAdmin = await request(app).post('/api/auth/login').send({ email: noAdminEmail, password: 'clave12345' });
    tokenNoAdmin = loginNoAdmin.body.token;
  });

  after(async () => {
    if (nuevoUsuarioId) await pool.query('DELETE FROM audit_log WHERE entidad_id=$1', [nuevoUsuarioId]);
    await pool.query('DELETE FROM usuarios WHERE email=ANY($1)', [[noAdminEmail, nuevoUsuarioEmail]]);
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
    assert.equal(entrada.usuario_email, 'admin@demo.cl');
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
});
