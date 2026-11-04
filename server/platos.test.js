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

const platosDe = async (categoriaId) =>
  (await agente.get(`/api/admin/platos?categoriaId=${categoriaId}`)).body.map((p) => p.nombre);
const carta = async () => (await request(e.app).get('/api/carta')).body;
const platoEnCarta = async (nombre) =>
  (await carta()).categorias.flatMap((c) => c.platos).find((p) => p.nombre === nombre);

// ---------- Crear y editar ----------

test('Crear un plato', async () => {
  const c = await h.categoria('Bocadillos');
  await h.plato(c.id, 'Calamares');
  const r = await agente
    .post('/api/admin/platos')
    .send({ categoriaId: c.id, nombre: 'Lomo con queso', precio: '4,50', alergenos: ['leche', 'gluten'] });
  assert.equal(r.status, 201);
  assert.equal(r.body.precioCentimos, 450);
  assert.deepEqual(r.body.alergenos, ['gluten', 'leche']);
  assert.equal(r.body.agotado, false);
  assert.deepEqual(await platosDe(c.id), ['Calamares', 'Lomo con queso']);
  const enCarta = await platoEnCarta('Lomo con queso');
  assert.equal(enCarta.precioCentimos, 450);
});

test('Crear un plato: el nombre es obligatorio', async () => {
  const c = await h.categoria('Bocadillos');
  const r = await agente.post('/api/admin/platos').send({ categoriaId: c.id, nombre: ' ', precio: '1', sinAlergenos: true });
  assert.equal(r.status, 422);
  assert.equal(r.body.campo, 'nombre');
});

test('Crear un plato: exige una categoría activa', async () => {
  const r = await agente.post('/api/admin/platos').send({ categoriaId: 999, nombre: 'Té', precio: '1', sinAlergenos: true });
  assert.equal(r.status, 422);
  assert.equal(r.body.campo, 'categoriaId');
});

test('Precio no válido', async () => {
  const c = await h.categoria('Bebidas');
  for (const precio of ['0', '0,00', '-1', '-1,50', '1,555', 'gratis', '', undefined]) {
    const r = await agente.post('/api/admin/platos').send({ categoriaId: c.id, nombre: 'Agua', precio, sinAlergenos: true });
    assert.equal(r.status, 422, `precio ${precio}`);
    assert.equal(r.body.campo, 'precio');
    assert.match(r.body.mensaje, /El precio no es válido/);
  }
  assert.deepEqual(await platosDe(c.id), []);
});

test('Descripción demasiado larga', async () => {
  const c = await h.categoria('Bebidas');
  const r = await agente
    .post('/api/admin/platos')
    .send({ categoriaId: c.id, nombre: 'Café', precio: '1,20', sinAlergenos: true, descripcion: 'a'.repeat(141) });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'descripcion', mensaje: 'La descripción admite como máximo 140 caracteres.' });
  const ok = await agente
    .post('/api/admin/platos')
    .send({ categoriaId: c.id, nombre: 'Café', precio: '1,20', sinAlergenos: true, descripcion: 'ñ'.repeat(140) });
  assert.equal(ok.status, 201);
});

test('Cambiar el precio de un plato', async () => {
  const c = await h.categoria('Bebidas');
  const p = await h.plato(c.id, 'Café con leche', { precio: '1,50' });
  const r = await agente.patch(`/api/admin/platos/${p.id}`).send({ precio: '1,60' });
  assert.equal(r.status, 200);
  assert.equal((await platoEnCarta('Café con leche')).precioCentimos, 160);
});

test('Editar un plato: los campos no enviados se conservan', async () => {
  const c = await h.categoria('Bebidas');
  const p = await h.plato(c.id, 'Café', { precio: '1,20', descripcion: 'Natural', alergenos: ['leche'], sinAlergenos: false });
  const r = await agente.patch(`/api/admin/platos/${p.id}`).send({ nombre: 'Café solo' });
  assert.equal(r.status, 200);
  assert.equal(r.body.precioCentimos, 120);
  assert.equal(r.body.descripcion, 'Natural');
  assert.deepEqual(r.body.alergenos, ['leche']);
});

test('Mover un plato a otra categoría', async () => {
  const raciones = await h.categoria('Raciones');
  const bocadillos = await h.categoria('Bocadillos');
  await h.plato(bocadillos.id, 'Calamares');
  const tortilla = await h.plato(raciones.id, 'Tortilla');
  await h.plato(raciones.id, 'Croquetas');
  const r = await agente.patch(`/api/admin/platos/${tortilla.id}`).send({ categoriaId: bocadillos.id });
  assert.equal(r.status, 200);
  assert.deepEqual(await platosDe(bocadillos.id), ['Calamares', 'Tortilla']);
  assert.deepEqual(await platosDe(raciones.id), ['Croquetas']);
});

// ---------- Ordenar ----------

test('Bajar un plato', async () => {
  const c = await h.categoria('Bebidas');
  const cafe = await h.plato(c.id, 'Café');
  await h.plato(c.id, 'Té');
  await h.plato(c.id, 'Zumo');
  const r = await agente.post(`/api/admin/platos/${cafe.id}/bajar`).send({});
  assert.equal(r.status, 200);
  assert.deepEqual(await platosDe(c.id), ['Té', 'Café', 'Zumo']);
  assert.deepEqual((await carta()).categorias[0].platos.map((p) => p.nombre), ['Té', 'Café', 'Zumo']);
});

test('Subir un plato', async () => {
  const c = await h.categoria('Bebidas');
  await h.plato(c.id, 'Café');
  const te = await h.plato(c.id, 'Té');
  await agente.post(`/api/admin/platos/${te.id}/subir`).send({});
  assert.deepEqual(await platosDe(c.id), ['Té', 'Café']);
});

// ---------- Archivar ----------

test('Archivar un plato', async () => {
  const c = await h.categoria('Raciones');
  const p = await h.plato(c.id, 'Croquetas', { precio: '6,50', alergenos: ['gluten', 'leche', 'huevos'], sinAlergenos: false });
  await h.plato(c.id, 'Tortilla');
  const r = await agente.post(`/api/admin/platos/${p.id}/archivar`).send({});
  assert.equal(r.status, 204);
  assert.deepEqual(await platosDe(c.id), ['Tortilla']);
  assert.equal(await platoEnCarta('Croquetas'), undefined);
  const fila = e.db.prepare('SELECT nombre, precio_centimos, archivado_en FROM platos WHERE id = ?').get(p.id);
  assert.equal(fila.nombre, 'Croquetas');
  assert.equal(fila.precio_centimos, 650);
  assert.ok(fila.archivado_en);
  const alergenos = e.db.prepare('SELECT alergeno FROM plato_alergenos WHERE plato_id = ? ORDER BY alergeno').all(p.id);
  assert.deepEqual(alergenos.map((a) => a.alergeno), ['gluten', 'huevos', 'leche']);
});

test('Archivar un plato: un plato archivado no se puede editar', async () => {
  const c = await h.categoria('Raciones');
  const p = await h.plato(c.id, 'Croquetas');
  await agente.post(`/api/admin/platos/${p.id}/archivar`).send({});
  assert.equal((await agente.patch(`/api/admin/platos/${p.id}`).send({ nombre: 'X' })).status, 404);
});

// ---------- Declaración de alérgenos ----------

test('Plato sin declaración de alérgenos', async () => {
  const c = await h.categoria('Raciones');
  const r = await agente.post('/api/admin/platos').send({ categoriaId: c.id, nombre: 'Croquetas', precio: '6' });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'alergenos', mensaje: 'Debe declarar los alérgenos del plato o marcar «Sin alérgenos».' });
  const vacio = await agente.post('/api/admin/platos').send({ categoriaId: c.id, nombre: 'Croquetas', precio: '6', alergenos: [], sinAlergenos: false });
  assert.equal(vacio.status, 422);
  assert.deepEqual(await platosDe(c.id), []);
});

test('Declaración contradictoria', async () => {
  const c = await h.categoria('Bebidas');
  const r = await agente
    .post('/api/admin/platos')
    .send({ categoriaId: c.id, nombre: 'Batido', precio: '3', sinAlergenos: true, alergenos: ['leche'] });
  assert.equal(r.status, 422);
  assert.equal(r.body.campo, 'alergenos');
  assert.match(r.body.mensaje, /La declaración es contradictoria/);
  assert.deepEqual(await platosDe(c.id), []);
});

test('Declaración contradictoria: también al editar, y el plato no cambia', async () => {
  const c = await h.categoria('Bebidas');
  const p = await h.plato(c.id, 'Batido', { alergenos: ['leche'], sinAlergenos: false });
  const r = await agente.patch(`/api/admin/platos/${p.id}`).send({ sinAlergenos: true });
  assert.equal(r.status, 422);
  const actual = (await agente.get(`/api/admin/platos?categoriaId=${c.id}`)).body[0];
  assert.deepEqual(actual.alergenos, ['leche']);
  assert.equal(actual.sinAlergenos, false);
});

test('Plato declarado sin alérgenos', async () => {
  const c = await h.categoria('Bebidas');
  const r = await agente.post('/api/admin/platos').send({ categoriaId: c.id, nombre: 'Agua mineral', precio: '1,20', sinAlergenos: true });
  assert.equal(r.status, 201);
  const p = await platoEnCarta('Agua mineral');
  assert.equal(p.sinAlergenos, true);
  assert.deepEqual(p.alergenos, []);
});

test('Alérgenos: un código fuera de la lista se rechaza', async () => {
  const c = await h.categoria('Bebidas');
  const r = await agente.post('/api/admin/platos').send({ categoriaId: c.id, nombre: 'X', precio: '1', alergenos: ['trazas'] });
  assert.equal(r.status, 422);
  assert.equal(r.body.campo, 'alergenos');
});

// ---------- Agotado ----------

test('Marcar un plato como agotado', async () => {
  const c = await h.categoria('Raciones');
  await h.plato(c.id, 'Croquetas');
  const tortilla = await h.plato(c.id, 'Tortilla');
  await h.plato(c.id, 'Bravas');
  const r = await agente.patch(`/api/admin/platos/${tortilla.id}`).send({ agotado: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.agotado, true);
  assert.deepEqual(await platosDe(c.id), ['Croquetas', 'Tortilla', 'Bravas']);
  const enCarta = (await carta()).categorias[0].platos;
  assert.deepEqual(enCarta.map((p) => p.nombre), ['Croquetas', 'Tortilla', 'Bravas']);
  assert.equal(enCarta[1].agotado, true);
  assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM platos').get().n, 3, 'no se duplica');
  assert.equal(e.db.prepare('SELECT archivado_en FROM platos WHERE id = ?').get(tortilla.id).archivado_en, null);
});

test('Volver a marcar un plato disponible', async () => {
  const c = await h.categoria('Raciones');
  const tortilla = await h.plato(c.id, 'Tortilla');
  await agente.patch(`/api/admin/platos/${tortilla.id}`).send({ agotado: true });
  const r = await agente.patch(`/api/admin/platos/${tortilla.id}`).send({ agotado: false });
  assert.equal(r.status, 200);
  assert.equal((await platoEnCarta('Tortilla')).agotado, false);
});

test('Agotado: solo admite verdadero o falso', async () => {
  const c = await h.categoria('Raciones');
  const p = await h.plato(c.id, 'Tortilla');
  assert.equal((await agente.patch(`/api/admin/platos/${p.id}`).send({ agotado: 'si' })).status, 422);
});
