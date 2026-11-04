import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearPrecio, eurosACentimos, centimosATexto } from './precio.js';

test('Formato del precio', () => {
  assert.equal(formatearPrecio(1200), '12,00 €');
});

test('Formato del precio: 2,80 € y 0,05 €', () => {
  assert.equal(formatearPrecio(280), '2,80 €');
  assert.equal(formatearPrecio(5), '0,05 €');
  assert.equal(formatearPrecio(350), '3,50 €');
});

test('Precio en euros a céntimos', () => {
  assert.equal(eurosACentimos('4,50'), 450);
  assert.equal(eurosACentimos('4.5'), 450);
  assert.equal(eurosACentimos('4'), 400);
  assert.equal(eurosACentimos(1.6), 160);
  assert.equal(eurosACentimos('0,05'), 5);
  for (const malo of ['0', '0,00', '-1', '1,555', 'abc', '', null, '1,2,3']) {
    assert.equal(eurosACentimos(malo), null, String(malo));
  }
});

test('Céntimos a texto del formulario', () => {
  assert.equal(centimosATexto(450), '4,50');
});
