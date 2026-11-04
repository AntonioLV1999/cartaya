import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { crearEntorno, agenteConSesion, ayudante } from './test/entorno.js';

const MB = 1024 * 1024;
const jpeg = (tamano) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(tamano - 4, 7)]);
const png = () => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(100, 1)]);
const webp = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(100, 2)]);
const pdf = () => Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n');

let e;
let agente;
let plato;
beforeEach(async () => {
  e = crearEntorno();
  agente = await agenteConSesion(e.app);
  const h = ayudante(agente);
  const c = await h.categoria('Desayunos');
  plato = await h.plato(c.id, 'Tostada con tomate', { precio: '2,80' });
});
afterEach(() => e.cerrar());

const fotosEnDisco = () => readdirSync(join(e.dataDir, 'fotos'));
const fotoEnCarta = async () => (await request(e.app).get('/api/carta')).body.categorias[0].platos[0].foto;
const subir = (tipo, cuerpo) => agente.put(`/api/admin/platos/${plato.id}/foto`).set('Content-Type', tipo).send(cuerpo);

test('Subir una foto válida', async () => {
  const r = await subir('image/jpeg', jpeg(3 * MB));
  assert.equal(r.status, 200);
  assert.match(r.body.foto, /^\/fotos\/[0-9a-f-]{36}\.jpg$/);
  const url = await fotoEnCarta();
  assert.equal(url, r.body.foto);
  const servida = await request(e.app).get(url);
  assert.equal(servida.status, 200);
  assert.equal(servida.headers['content-type'], 'image/jpeg');
  assert.match(servida.headers['cache-control'], /max-age=31536000/);
  assert.match(servida.headers['cache-control'], /immutable/);
});

test('Subir una foto válida: PNG y WebP también, y al sustituir se borra la anterior', async () => {
  const primera = await subir('image/png', png());
  assert.equal(primera.status, 200);
  const segunda = await subir('image/webp', webp());
  assert.equal(segunda.status, 200);
  assert.notEqual(primera.body.foto, segunda.body.foto, 'nombre nuevo en cada sustitución');
  assert.deepEqual(fotosEnDisco(), [segunda.body.foto.replace('/fotos/', '')]);
  assert.equal((await request(e.app).get(primera.body.foto)).status, 404);
});

test('Foto demasiado grande', async () => {
  const r = await subir('image/jpeg', jpeg(8 * MB));
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'foto', mensaje: 'La foto es demasiado grande: el máximo es 5 MB.' });
  assert.equal(await fotoEnCarta(), null);
  assert.deepEqual(fotosEnDisco(), []);
});

test('Foto demasiado grande: justo 5 MB se acepta', async () => {
  assert.equal((await subir('image/jpeg', jpeg(5 * MB))).status, 200);
});

test('Formato no admitido', async () => {
  const mensaje = { campo: 'foto', mensaje: 'Formato no admitido: solo se admiten fotos JPEG, PNG o WebP.' };
  const comoPdf = await subir('application/pdf', pdf());
  assert.equal(comoPdf.status, 422);
  assert.deepEqual(comoPdf.body, mensaje);
  // Un PDF que se hace pasar por JPEG se detecta por su contenido.
  const disfrazado = await subir('image/jpeg', pdf());
  assert.equal(disfrazado.status, 422);
  assert.deepEqual(disfrazado.body, mensaje);
  const gif = await subir('image/gif', Buffer.from('GIF89a'));
  assert.equal(gif.status, 422);
  assert.equal(await fotoEnCarta(), null);
  assert.deepEqual(fotosEnDisco(), []);
});

test('Quitar la foto', async () => {
  const subida = await subir('image/jpeg', jpeg(1000));
  const r = await agente.delete(`/api/admin/platos/${plato.id}/foto`);
  assert.equal(r.status, 200);
  assert.equal(r.body.foto, null);
  assert.equal(await fotoEnCarta(), null);
  assert.equal(existsSync(join(e.dataDir, subida.body.foto)), false);
  assert.deepEqual(fotosEnDisco(), []);
});

test('Foto: no se puede subir a un plato inexistente y no deja ficheros huérfanos', async () => {
  const r = await agente.put('/api/admin/platos/999/foto').set('Content-Type', 'image/png').send(png());
  assert.equal(r.status, 404);
  assert.deepEqual(fotosEnDisco(), []);
});
