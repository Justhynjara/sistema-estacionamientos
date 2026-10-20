import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { realIp } from '../middleware/rateLimit.middleware.js';

const pedido = headers => ({ headers, ip: '10.0.0.1' });

// Encabezados tal como llegan en Render (copiados de los logs reales).
describe('IP real del cliente para los límites de intentos', () => {
  test('pedido directo a la API: usa CF-Connecting-IP', () => {
    assert.equal(realIp(pedido({ 'cf-connecting-ip': '179.60.85.102', 'x-forwarded-for': '179.60.85.102, 104.23.213.85, 10.26.16.133' })), '179.60.85.102');
  });

  test('pedido por la web (/api reenviado por Render): usa la IP del cliente, no la del proxy', () => {
    assert.equal(realIp(pedido({
      'cf-connecting-ip': '74.220.48.253',
      'x-forwarded-for': '179.60.85.102, 172.68.23.46, 172.68.23.46,74.220.48.253, 172.68.15.245, 10.27.0.14'
    })), '179.60.85.102');
  });

  test('por la web, un X-Forwarded-For inventado no cambia la IP', () => {
    assert.equal(realIp(pedido({
      'cf-connecting-ip': '74.220.48.248',
      'x-forwarded-for': '1.2.3.4,74.220.48.248,9.9.9.9,179.60.85.102, 172.71.151.167, 172.71.151.167,74.220.48.248, 172.69.48.205, 10.26.16.133'
    })), '179.60.85.102');
  });

  test('pedido directo con X-Forwarded-For inventado: se ignora', () => {
    assert.equal(realIp(pedido({
      'cf-connecting-ip': '179.60.85.102',
      'x-forwarded-host': 'estacionamientos-web.onrender.com',
      'x-forwarded-for': '1.1.1.1,2.2.2.2,3.3.3.3,179.60.85.102, 104.23.213.85, 10.26.16.133'
    })), '179.60.85.102');
  });
});
