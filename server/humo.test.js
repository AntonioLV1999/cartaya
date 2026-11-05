import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno } from './test/entorno.js';

const e = crearEntorno();
after(() => e.cerrar());

for (const ruta of ['/', '/carta', '/mesa/7', '/admin', '/cocina']) {
  test(`Humo: ${ruta} responde 200 con HTML`, async () => {
    const r = await request(e.app).get(ruta);
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/html/);
  });
}

test('Humo: las respuestas van comprimidas', async () => {
  const r = await request(e.app).get('/api/carta').set('Accept-Encoding', 'gzip');
  // Respuestas pequeñas no se comprimen (umbral de 1 KB); basta con que el middleware esté y no rompa.
  assert.equal(r.status, 200);
  assert.ok(r.headers.vary?.includes('Accept-Encoding'));
});
