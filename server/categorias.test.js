import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, agenteConSesion, ayudante } from './test/entorno.js';

let e;
let agente;
let h;
beforeEach(async () => {
  e = crearEntorno();
  agente = await agenteConSesion(e.app);
  h = ayudante(agente);
});
afterEach(() => e.cerrar());

const nombres = async () => (await agente.get('/api/admin/categorias')).body.map((c) => c.nombre);
const nombresEnCarta = async () => (await request(e.app).get('/api/carta')).body.categorias.map((c) => c.nombre);

test('Crear una categoría', async () => {
  await h.categoria('Desayunos');
  await h.categoria('Bebidas');
  const r = await agente.post('/api/admin/categorias').send({ nombre: '  Raciones  ' });
  assert.equal(r.status, 201);
  assert.equal(r.body.nombre, 'Raciones');
  assert.deepEqual(await nombres(), ['Desayunos', 'Bebidas', 'Raciones']);
});

test('Nombre de categoría vacío', async () => {
  for (const nombre of ['', '   ', undefined]) {
    const r = await agente.post('/api/admin/categorias').send({ nombre });
    assert.equal(r.status, 422);
    assert.deepEqual(r.body, { campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
  }
  assert.deepEqual(await nombres(), []);
});

test('Nombre de categoría repetido', async () => {
  await h.categoria('Bebidas');
  const r = await agente.post('/api/admin/categorias').send({ nombre: 'bebidas' });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'nombre', mensaje: 'Ya existe una categoría con ese nombre.' });
  assert.deepEqual(await nombres(), ['Bebidas']);
});

test('Nombre de categoría repetido: no distingue mayúsculas con tildes', async () => {
  await h.categoria('Cafés');
  assert.equal((await agente.post('/api/admin/categorias').send({ nombre: 'CAFÉS' })).status, 422);
});

test('Renombrar una categoría', async () => {
  const c = await h.categoria('Bocatas');
  await h.plato(c.id, 'Lomo');
  const r = await agente.patch(`/api/admin/categorias/${c.id}`).send({ nombre: 'Bocadillos' });
  assert.equal(r.status, 200);
  assert.deepEqual(await nombres(), ['Bocadillos']);
  assert.deepEqual(await nombresEnCarta(), ['Bocadillos']);
});

test('Renombrar una categoría: mantener su propio nombre con otras mayúsculas está permitido', async () => {
  const c = await h.categoria('bebidas');
  assert.equal((await agente.patch(`/api/admin/categorias/${c.id}`).send({ nombre: 'Bebidas' })).status, 200);
});

test('Subir una categoría', async () => {
  await h.categoria('Desayunos');
  await h.categoria('Bebidas');
  const bocadillos = await h.categoria('Bocadillos');
  const r = await agente.post(`/api/admin/categorias/${bocadillos.id}/subir`).send({});
  assert.equal(r.status, 200);
  assert.deepEqual(await nombres(), ['Desayunos', 'Bocadillos', 'Bebidas']);
  // Subir la primera no hace nada.
  const desayunos = (await agente.get('/api/admin/categorias')).body[0];
  await agente.post(`/api/admin/categorias/${desayunos.id}/subir`).send({});
  assert.deepEqual(await nombres(), ['Desayunos', 'Bocadillos', 'Bebidas']);
});

test('Bajar una categoría', async () => {
  const d = await h.categoria('Desayunos');
  await h.categoria('Bebidas');
  await agente.post(`/api/admin/categorias/${d.id}/bajar`).send({});
  assert.deepEqual(await nombres(), ['Bebidas', 'Desayunos']);
});

test('Archivar una categoría vacía', async () => {
  const c = await h.categoria('Especiales de verano');
  const r = await agente.post(`/api/admin/categorias/${c.id}/archivar`).send({});
  assert.equal(r.status, 204);
  assert.deepEqual(await nombres(), []);
  assert.deepEqual(await nombresEnCarta(), []);
  const fila = e.db.prepare('SELECT nombre, archivada_en FROM categorias WHERE id = ?').get(c.id);
  assert.equal(fila.nombre, 'Especiales de verano');
  assert.ok(fila.archivada_en);
});

test('Archivar una categoría con platos activos', async () => {
  const c = await h.categoria('Postres');
  for (const n of ['Flan', 'Natillas', 'Arroz con leche']) await h.plato(c.id, n);
  const r = await agente.post(`/api/admin/categorias/${c.id}/archivar`).send({});
  assert.equal(r.status, 422);
  assert.equal(r.body.mensaje, 'No se puede eliminar: primero archive o mueva sus 3 platos.');
  assert.deepEqual(await nombres(), ['Postres']);
});

test('Categorías: la lista indica cuántos platos activos tiene cada una', async () => {
  const c = await h.categoria('Postres');
  await h.plato(c.id, 'Flan');
  assert.equal((await agente.get('/api/admin/categorias')).body[0].platosActivos, 1);
});
