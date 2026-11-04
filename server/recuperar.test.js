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

const archivarPlato = (id) => agente.post(`/api/admin/platos/${id}/archivar`).send({});
const archivarCategoria = (id) => agente.post(`/api/admin/categorias/${id}/archivar`).send({});
const platosDe = async (categoriaId) =>
  (await agente.get(`/api/admin/platos?categoriaId=${categoriaId}`)).body.map((p) => p.nombre);
const carta = async () => (await request(e.app).get('/api/carta')).body;

test('Ver los archivados', async () => {
  const raciones = await h.categoria('Raciones');
  const croquetas = await h.plato(raciones.id, 'Croquetas');
  await archivarPlato(croquetas.id);
  const verano = await h.categoria('Especiales de verano');
  await archivarCategoria(verano.id);
  const r = await agente.get('/api/admin/archivados');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.platos.map((p) => p.nombre), ['Croquetas']);
  assert.equal(r.body.platos[0].categoriaNombre, 'Raciones');
  assert.equal(r.body.platos[0].categoriaArchivada, false);
  assert.deepEqual(r.body.categorias.map((c) => c.nombre), ['Especiales de verano']);
});

test('Recuperar un plato', async () => {
  const raciones = await h.categoria('Raciones');
  const croquetas = await h.plato(raciones.id, 'Croquetas');
  await h.plato(raciones.id, 'Tortilla');
  await agente.patch(`/api/admin/platos/${croquetas.id}`).send({ agotado: true });
  await archivarPlato(croquetas.id);
  const r = await agente.post(`/api/admin/platos/${croquetas.id}/recuperar`).send({});
  assert.equal(r.status, 200);
  assert.equal(r.body.agotado, false, 'vuelve disponible');
  assert.deepEqual(await platosDe(raciones.id), ['Tortilla', 'Croquetas']);
  const enCarta = (await carta()).categorias[0].platos.find((p) => p.nombre === 'Croquetas');
  assert.ok(enCarta);
  assert.equal(enCarta.agotado, false);
  assert.deepEqual((await agente.get('/api/admin/archivados')).body.platos, []);
});

test('Recuperar un plato de una categoría archivada', async () => {
  const verano = await h.categoria('Especiales de verano');
  const bebidas = await h.categoria('Bebidas');
  await h.plato(bebidas.id, 'Café');
  const horchata = await h.plato(verano.id, 'Horchata');
  await archivarPlato(horchata.id);
  await archivarCategoria(verano.id);

  const sinElegir = await agente.post(`/api/admin/platos/${horchata.id}/recuperar`).send({});
  assert.equal(sinElegir.status, 422);
  assert.equal(sinElegir.body.campo, 'categoriaId');
  assert.match(sinElegir.body.mensaje, /elija una categoría activa/);
  assert.deepEqual(await platosDe(bebidas.id), ['Café']);

  const archivada = await agente.post(`/api/admin/platos/${horchata.id}/recuperar`).send({ categoriaId: verano.id });
  assert.equal(archivada.status, 422);

  const r = await agente.post(`/api/admin/platos/${horchata.id}/recuperar`).send({ categoriaId: bebidas.id });
  assert.equal(r.status, 200);
  assert.deepEqual(await platosDe(bebidas.id), ['Café', 'Horchata']);
});

test('Recuperar una categoría', async () => {
  await h.categoria('Desayunos');
  const verano = await h.categoria('Especiales de verano');
  const horchata = await h.plato(verano.id, 'Horchata');
  await archivarPlato(horchata.id);
  await archivarCategoria(verano.id);
  await h.categoria('Bebidas');

  const r = await agente.post(`/api/admin/categorias/${verano.id}/recuperar`).send({});
  assert.equal(r.status, 200);
  const activas = (await agente.get('/api/admin/categorias')).body;
  assert.deepEqual(activas.map((c) => c.nombre), ['Desayunos', 'Bebidas', 'Especiales de verano']);
  assert.equal(activas[2].platosActivos, 0, 'vuelve sin platos activos');
  assert.ok(!(await carta()).categorias.some((c) => c.nombre === 'Especiales de verano'), 'no sale en la carta vacía');
  // Sus platos se recuperan uno a uno.
  await agente.post(`/api/admin/platos/${horchata.id}/recuperar`).send({});
  assert.ok((await carta()).categorias.some((c) => c.nombre === 'Especiales de verano'));
});

test('Recuperar una categoría con nombre repetido', async () => {
  const vieja = await h.categoria('bebidas');
  await archivarCategoria(vieja.id);
  await h.categoria('Bebidas');
  const r = await agente.post(`/api/admin/categorias/${vieja.id}/recuperar`).send({});
  assert.equal(r.status, 422);
  assert.equal(r.body.mensaje, 'Ya existe una categoría con ese nombre.');
  assert.deepEqual((await agente.get('/api/admin/categorias')).body.map((c) => c.nombre), ['Bebidas']);
});

test('Recuperar: algo que no está archivado no se recupera', async () => {
  const c = await h.categoria('Bebidas');
  const p = await h.plato(c.id, 'Café');
  assert.equal((await agente.post(`/api/admin/platos/${p.id}/recuperar`).send({})).status, 422);
  assert.equal((await agente.post(`/api/admin/categorias/${c.id}/recuperar`).send({})).status, 422);
});
