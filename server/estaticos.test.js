import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import request from 'supertest';
import { abrirBD } from './db.js';
import { crearApp } from './app.js';

const JS = `console.log(${JSON.stringify('carta '.repeat(500))});`;
let dir;
let db;
let app;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'cartaya-estaticos-'));
  const assets = join(dir, 'dist', 'assets');
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, 'carta-abc.js'), JS);
  writeFileSync(join(assets, 'carta-abc.js.br'), brotliCompressSync(JS));
  writeFileSync(join(assets, 'carta-abc.js.gz'), gzipSync(JS));
  writeFileSync(join(assets, 'sin-variantes.css'), 'body{color:#000}');
  db = abrirBD(':memory:');
  app = crearApp({ db, passwordHash: '', dataDir: join(dir, 'datos'), distDir: join(dir, 'dist') });
});
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const binario = (r) => r.buffer(true).parse((res, cb) => {
  const trozos = [];
  res.on('data', (t) => trozos.push(t));
  res.on('end', () => cb(null, Buffer.concat(trozos)));
});

test('Estáticos: con brotli aceptado se sirve la variante .br', async () => {
  const r = await binario(request(app).get('/assets/carta-abc.js').set('Accept-Encoding', 'gzip, deflate, br'));
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], 'br');
  assert.match(r.headers['content-type'], /^text\/javascript/);
  assert.match(r.headers.vary, /Accept-Encoding/);
  assert.match(r.headers['cache-control'], /immutable/);
  // supertest descomprime la respuesta: comprobamos que el contenido llega íntegro.
  assert.equal(r.body.toString(), JS);
  assert.ok(Number(r.headers['content-length']) < JS.length, 'se transfiere comprimido');
});

test('Estáticos: solo con gzip aceptado se sirve la variante .gz', async () => {
  const r = await binario(request(app).get('/assets/carta-abc.js').set('Accept-Encoding', 'gzip'));
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.equal(r.body.toString(), JS);
  assert.ok(Number(r.headers['content-length']) < JS.length, 'se transfiere comprimido');
});

test('Estáticos: sin compresión aceptada se sirve el original', async () => {
  const r = await request(app).get('/assets/carta-abc.js').set('Accept-Encoding', 'identity');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], undefined);
  assert.equal(r.text, JS);
});

test('Estáticos: un fichero sin variantes precomprimidas se sirve normalmente', async () => {
  const r = await request(app).get('/assets/sin-variantes.css').set('Accept-Encoding', 'br');
  assert.equal(r.status, 200);
  assert.equal(r.text, 'body{color:#000}');
});

test('Estáticos: no se sale de la carpeta de assets', async () => {
  const r = await request(app).get('/assets/..%2f..%2fpackage.json').set('Accept-Encoding', 'br');
  assert.notEqual(r.headers['content-encoding'], 'br');
});
