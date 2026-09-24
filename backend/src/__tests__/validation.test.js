import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, registerSchema } from '../validation/auth.schema.js';
import { createParkingSchema, nearbyQuerySchema } from '../validation/parking.schema.js';
import { createTicketSchema } from '../validation/ticket.schema.js';

describe('validation schemas', () => {
  test('loginSchema rechaza email inválido', () => {
    const r = loginSchema.safeParse({ email: 'no-es-email', password: '123' });
    assert.equal(r.success, false);
  });

  test('loginSchema acepta credenciales válidas y normaliza el email', () => {
    const r = loginSchema.safeParse({ email: 'Test@Demo.CL', password: 'algo' });
    assert.equal(r.success, true);
    assert.equal(r.data.email, 'test@demo.cl');
  });

  test('registerSchema exige contraseña de al menos 8 caracteres', () => {
    const r = registerSchema.safeParse({ nombre: 'Ana', email: 'a@a.cl', password: '1234567' });
    assert.equal(r.success, false);
  });

  test('createParkingSchema exige cupo_maximo positivo', () => {
    const r = createParkingSchema.safeParse({
      cliente_id: '11111111-1111-4111-8111-111111111111',
      nombre: 'Test', direccion: 'Calle 1', latitud: -33, longitud: -70,
      precio_minuto: 20, cupo_maximo: 0
    });
    assert.equal(r.success, false);
  });

  test('nearbyQuerySchema convierte strings de query a numeros', () => {
    const r = nearbyQuerySchema.safeParse({ lat: '-33.45', lng: '-70.66', radiusKm: '5' });
    assert.equal(r.success, true);
    assert.equal(r.data.lat, -33.45);
    assert.equal(typeof r.data.radiusKm, 'number');
  });

  test('createTicketSchema exige un uuid valido de estacionamiento', () => {
    const r = createTicketSchema.safeParse({ estacionamiento_id: 'no-es-uuid' });
    assert.equal(r.success, false);
  });

  test('createTicketSchema pasa la patente a mayusculas', () => {
    const r = createTicketSchema.safeParse({ estacionamiento_id: '11111111-1111-4111-8111-111111111111', patente: 'ab1234' });
    assert.equal(r.success, true);
    assert.equal(r.data.patente, 'AB1234');
  });
});
