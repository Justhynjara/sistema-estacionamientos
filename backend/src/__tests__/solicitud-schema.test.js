import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearSolicitudSchema, revisarSolicitudSchema } from '../validation/solicitud.schema.js';

const base = {
  nombre_solicitante: 'Ana Pérez', email: 'ana@example.com', nombre_establecimiento: 'Parking Centro',
  direccion: 'Calle 123, Curicó', latitud: -34.98, longitud: -71.23, precio_minuto: 20, tarifa_minima: 500, cupo_estimado: 10
};
const errores = r => r.success ? [] : r.error.issues.map(i => i.message);

describe('postulación de estacionamiento', () => {
  test('una tarifa que la base redondea a 0 se rechaza igual que un 0', () => {
    const r = crearSolicitudSchema.safeParse({ ...base, precio_minuto: 0.00001, tarifa_minima: 0.004 });
    assert.equal(r.success, false);
    assert.ok(errores(r).some(m => m.includes('mayor a 0')));
  });

  test('las tarifas se guardan con los decimales que admite la base', () => {
    const r = crearSolicitudSchema.safeParse({ ...base, precio_minuto: 16.666666, tarifa_minima: 499.999 });
    assert.equal(r.success, true);
    assert.equal(r.data.precio_minuto, 16.6667);
    assert.equal(r.data.tarifa_minima, 500);
  });

  test('el teléfono acepta formatos chilenos y rechaza texto', () => {
    for (const telefono of ['+56 9 1234 5678', '912345678', '(2) 2123-4567', '', null]) {
      assert.equal(crearSolicitudSchema.safeParse({ ...base, telefono }).success, true, String(telefono));
    }
    for (const telefono of ['abc-no-es-telefono', '123', '+56 9 1234 5678 9999 99']) {
      assert.equal(crearSolicitudSchema.safeParse({ ...base, telefono }).success, false, telefono);
    }
  });

  test('los cupos y el email no superan lo que admite la base', () => {
    assert.equal(crearSolicitudSchema.safeParse({ ...base, cupo_estimado: 3000000000 }).success, false);
    assert.equal(crearSolicitudSchema.safeParse({ ...base, email: 'a'.repeat(175) + '@example.com' }).success, false);
  });
});

describe('revisión de soporte', () => {
  test('rechazar exige un motivo para el solicitante; aprobar no', () => {
    assert.equal(revisarSolicitudSchema.safeParse({ estado: 'RECHAZADA', comentario: '  ' }).success, false);
    assert.equal(revisarSolicitudSchema.safeParse({ estado: 'RECHAZADA' }).success, false);
    assert.equal(revisarSolicitudSchema.safeParse({ estado: 'RECHAZADA', comentario: 'Faltan fotos del acceso' }).success, true);
    assert.equal(revisarSolicitudSchema.safeParse({ estado: 'APROBADA' }).success, true);
  });

  test('un estado inválido se explica en español', () => {
    const r = revisarSolicitudSchema.safeParse({ estado: 'OTRA' });
    assert.equal(r.success, false);
    assert.ok(errores(r).every(m => !/invalid/i.test(m)), errores(r).join(' | '));
  });
});
