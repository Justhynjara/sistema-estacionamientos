import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { coincideConTipoDeclarado } from '../utils/imagenSniff.js';

// Imágenes mínimas válidas (fixtures estándar de 1x1 píxel).
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const JPEG_1PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

describe('coincideConTipoDeclarado: los bytes reales deben coincidir con lo que declara el data URI', () => {
  test('acepta un PNG real declarado como png', () => {
    assert.equal(coincideConTipoDeclarado(PNG_1PX, 'png'), true);
  });

  test('acepta un JPEG real declarado como jpeg o jpg', () => {
    assert.equal(coincideConTipoDeclarado(JPEG_1PX, 'jpeg'), true);
    assert.equal(coincideConTipoDeclarado(JPEG_1PX, 'jpg'), true);
  });

  test('rechaza texto plano disfrazado de imagen', () => {
    const falso = 'data:image/png;base64,' + Buffer.from('esto no es una imagen').toString('base64');
    assert.equal(coincideConTipoDeclarado(falso, 'png'), false);
  });

  test('rechaza una imagen real cuando el tipo declarado no coincide con sus bytes', () => {
    assert.equal(coincideConTipoDeclarado(PNG_1PX, 'webp'), false);
    assert.equal(coincideConTipoDeclarado(JPEG_1PX, 'png'), false);
  });
});
