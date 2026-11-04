import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { sembrar } from '../scripts/seed.js';
import { abrirBD } from './db.js';
import { crearApp } from './app.js';

async function conCarpeta(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'cartaya-semilla-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('Semilla: el catálogo de ejemplo se carga sin errores en una BD vacía', async () => {
  await conCarpeta(async (dir) => {
    const r = sembrar({ dataDir: dir });
    assert.ok(r.platos >= 20);
    const db = abrirBD(join(dir, 'cartaya.db'));
    const carta = (await request(crearApp({ db, passwordHash: '', dataDir: dir })).get('/api/carta')).body;
    assert.equal(carta.categorias[0].nombre, 'Desayunos');
    assert.equal(carta.categorias.flatMap((c) => c.platos).length, r.platos);
    db.close();
    assert.throws(() => sembrar({ dataDir: dir }), /vacía/, 'no se carga dos veces');
  });
});

test('Semilla: la variante de rendimiento tiene 150 platos activos con foto', async () => {
  await conCarpeta((dir) => {
    const r = sembrar({ dataDir: dir, rendimiento: true });
    assert.deepEqual(r, { categorias: 10, platos: 150, conFoto: 150 });
    const fotos = readdirSync(join(dir, 'fotos'));
    assert.equal(fotos.length, 150);
    const media = fotos.reduce((s, f) => s + statSync(join(dir, 'fotos', f)).size, 0) / fotos.length;
    assert.ok(media > 20_000 && media < 300_000, `peso medio de foto parecido a una foto reducida: ${Math.round(media / 1000)} KB`);
  });
});
