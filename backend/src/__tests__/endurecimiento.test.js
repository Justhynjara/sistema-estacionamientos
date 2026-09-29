import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { pool } from '../config/database.js';

const suffix = `${Date.now()}_end`;
const dueno = { email: `dueno_${suffix}@demo.cl`, password: 'clave12345' };
let parkingId;

describe('endurecimiento de seguridad', () => {
  before(async () => {
    const hash = await bcrypt.hash(dueno.password, 4);
    const u = await pool.query(
      `INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES('Dueño Endurecimiento',$1,$2,'CLIENTE') RETURNING id`,
      [dueno.email, hash]
    );
    const p = await pool.query(
      `INSERT INTO estacionamientos(cliente_id,nombre,direccion,latitud,longitud,precio_minuto,tarifa_minima,cupo_maximo,cupos_disponibles)
       VALUES($1,'Parking Endurecimiento','Calle Z',-33.45,-70.66,20,500,5,5) RETURNING id`,
      [u.rows[0].id]
    );
    parkingId = p.rows[0].id;
  });

  after(async () => {
    // Por si alguna aserción fallara antes de tiempo y alguna de las dos solicitudes de prueba
    // llegara a crearse (ninguna debería: una la bloquea el señuelo, la otra la validación).
    await pool.query(`DELETE FROM solicitudes_cliente WHERE email IN ('bot@evil.test','real@demo.cl')`);
    await pool.query('DELETE FROM estacionamientos WHERE id=$1', [parkingId]);
    await pool.query('DELETE FROM usuarios WHERE email=$1', [dueno.email]);
    await pool.end();
  });

  test('GET /api/parking/:id (público) no expone cliente_id ni created_at', async () => {
    const res = await request(app).get(`/api/parking/${parkingId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.nombre, 'Parking Endurecimiento');
    assert.equal('cliente_id' in res.body, false);
    assert.equal('created_at' in res.body, false);
  });

  test('GET /api/tickets/reserva/:codigo_qr valida el formato del código', async () => {
    const res = await request(app).get('/api/tickets/reserva/ab');
    assert.equal(res.status, 400);
  });

  test('GET /api/tickets/reserva/:codigo_qr tiene un límite de peticiones', async () => {
    const codigo = 'x'.repeat(40);
    let ultimo;
    for (let i = 0; i < 61; i++) {
      ultimo = await request(app).get(`/api/tickets/reserva/${codigo}`);
      if (ultimo.status === 429) break;
    }
    assert.equal(ultimo.status, 429);
  });

  test('el señuelo antibot de "postular estacionamiento" responde éxito sin crear nada', async () => {
    const antes = await pool.query(`SELECT COUNT(*)::int AS n FROM solicitudes_cliente WHERE email='bot@evil.test'`);
    const res = await request(app).post('/api/solicitudes').send({
      nombre_solicitante: 'Bot', email: 'bot@evil.test', nombre_establecimiento: 'Spam SpA', direccion: 'Calle Falsa 123',
      precio_minuto: 10, cupo_estimado: 1, sitio_web: 'http://spam.test'
    });
    assert.equal(res.status, 201);
    const despues = await pool.query(`SELECT COUNT(*)::int AS n FROM solicitudes_cliente WHERE email='bot@evil.test'`);
    assert.equal(despues.rows[0].n, antes.rows[0].n, 'no debe haber creado una fila');
  });

  test('una foto cuyo contenido no coincide con el tipo declarado es rechazada', async () => {
    const falsoPng = 'data:image/png;base64,' + Buffer.from('no soy una imagen').toString('base64');
    const res = await request(app).post('/api/solicitudes').send({
      nombre_solicitante: 'Persona Real', email: 'real@demo.cl', nombre_establecimiento: 'Estacionamiento X', direccion: 'Calle Falsa 123',
      precio_minuto: 10, cupo_estimado: 1, fotos: [falsoPng]
    });
    assert.equal(res.status, 400);
  });

  test('las respuestas incluyen cabeceras de seguridad (CSP, HSTS, Permissions-Policy)', async () => {
    const res = await request(app).get('/health');
    assert.ok(res.headers['content-security-policy']);
    assert.ok(res.headers['strict-transport-security']);
    assert.equal(res.headers['permissions-policy'], 'camera=(),microphone=(),geolocation=(),payment=()');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });
});
