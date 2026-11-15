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

  test('rechaza un archivo que solo copia la firma inicial de la imagen (políglota)', () => {
    const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const poliglota = Buffer.concat([firmaPng, Buffer.from('<html><script>alert(1)</script></html>')]);
    assert.equal(coincideConTipoDeclarado('data:image/png;base64,' + poliglota.toString('base64'), 'png'), false);
    const jpegCortado = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('no termina como JPEG')]);
    assert.equal(coincideConTipoDeclarado('data:image/jpeg;base64,' + jpegCortado.toString('base64'), 'jpeg'), false);
  });
});
