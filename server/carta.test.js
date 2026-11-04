import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, agenteConSesion, ayudante } from './test/entorno.js';
import { CODIGOS_ALERGENOS } from './alergenos.js';

let e;
let agente;
let h;
beforeEach(async () => {
  e = crearEntorno();
  agente = await agenteConSesion(e.app);
  h = ayudante(agente);
});
afterEach(() => e.cerrar());

const carta = async () => {
  const r = await request(e.app).get('/api/carta');
  assert.equal(r.status, 200);
  return r.body;
};
const todosLosPlatos = (c) => c.categorias.flatMap((x) => x.platos);

test('Consulta de la carta sin identificación', async () => {
  const c = await h.categoria('Bebidas');
  await h.plato(c.id, 'Café');
  const r = await request(e.app).get('/api/carta');
  assert.equal(r.status, 200);
  assert.equal(r.headers['set-cookie'], undefined, 'no crea sesión ni pide datos');
  assert.match(r.headers['cache-control'], /no-cache/);
  assert.ok(r.headers.etag, 'lleva ETag');
  const otra = await request(e.app).get('/api/carta').set('If-None-Match', r.headers.etag);
  assert.equal(otra.status, 304, 'recargar sin cambios es barato');
  assert.deepEqual(r.body.categorias.map((x) => x.nombre), ['Bebidas']);
});

test('Consulta de la carta sin identificación: el ETag cambia cuando cambia el catálogo', async () => {
  const c = await h.categoria('Bebidas');
  const p = await h.plato(c.id, 'Café', { precio: '1,20' });
  const antes = (await request(e.app).get('/api/carta')).headers.etag;
  await agente.patch(`/api/admin/platos/${p.id}`).send({ precio: '1,30' });
  const despues = await request(e.app).get('/api/carta').set('If-None-Match', antes);
  assert.equal(despues.status, 200);
  assert.notEqual(despues.headers.etag, antes);
});

test('Categorías en el orden del dueño', async () => {
  for (const n of ['Desayunos', 'Bocadillos', 'Bebidas']) await h.plato((await h.categoria(n)).id, `Algo de ${n}`);
  assert.deepEqual((await carta()).categorias.map((c) => c.nombre), ['Desayunos', 'Bocadillos', 'Bebidas']);
});

test('Platos en el orden manual de su categoría', async () => {
  const b = await h.categoria('Bocadillos');
  const tortilla = await h.plato(b.id, 'Tortilla');
  await h.plato(b.id, 'Calamares');
  await h.plato(b.id, 'Lomo');
  await agente.post(`/api/admin/platos/${tortilla.id}/bajar`).send({});
  await agente.post(`/api/admin/platos/${tortilla.id}/bajar`).send({});
  assert.deepEqual((await carta()).categorias[0].platos.map((p) => p.nombre), ['Calamares', 'Lomo', 'Tortilla']);
});

test('Categoría sin platos activos oculta', async () => {
  const bebidas = await h.categoria('Bebidas');
  await h.plato(bebidas.id, 'Café');
  const postres = await h.categoria('Postres');
  const flan = await h.plato(postres.id, 'Flan');
  await agente.post(`/api/admin/platos/${flan.id}/archivar`).send({});
  await h.categoria('Vacía');
  assert.deepEqual((await carta()).categorias.map((c) => c.nombre), ['Bebidas']);
});

test('Se muestran todos los platos activos', async () => {
  const c = await h.categoria('Raciones');
  for (let i = 1; i <= 12; i++) await h.plato(c.id, `Ración ${i}`);
  const raciones = (await carta()).categorias.find((x) => x.nombre === 'Raciones');
  assert.equal(raciones.platos.length, 12);
});

test('Un plato archivado no aparece', async () => {
  const c = await h.categoria('Raciones');
  const croquetas = await h.plato(c.id, 'Croquetas');
  await h.plato(c.id, 'Tortilla');
  await agente.post(`/api/admin/platos/${croquetas.id}/archivar`).send({});
  const texto = JSON.stringify(await carta());
  assert.ok(!texto.includes('Croquetas'));
});

test('Un plato archivado no aparece: tampoco los de una categoría archivada', async () => {
  const c = await h.categoria('Verano');
  const p = await h.plato(c.id, 'Horchata');
  await agente.post(`/api/admin/platos/${p.id}/archivar`).send({});
  await agente.post(`/api/admin/categorias/${c.id}/archivar`).send({});
  assert.deepEqual((await carta()).categorias, []);
});

test('Categoría con todos sus platos agotados', async () => {
  const c = await h.categoria('Postres');
  for (const n of ['Flan', 'Natillas']) {
    const p = await h.plato(c.id, n);
    await agente.patch(`/api/admin/platos/${p.id}`).send({ agotado: true });
  }
  const postres = (await carta()).categorias.find((x) => x.nombre === 'Postres');
  assert.ok(postres, 'la categoría se muestra');
  assert.deepEqual(postres.platos.map((p) => [p.nombre, p.agotado]), [['Flan', true], ['Natillas', true]]);
});

test('Carta: cada plato trae al menos un alérgeno o sinAlergenos', async () => {
  const c = await h.categoria('Bocadillos');
  await h.plato(c.id, 'Calamares', { alergenos: ['gluten', 'moluscos', 'huevos'], sinAlergenos: false });
  await h.plato(c.id, 'Zumo de naranja', { sinAlergenos: true });
  const platos = todosLosPlatos(await carta());
  assert.equal(platos.length, 2);
  for (const p of platos) {
    assert.ok(p.alergenos.length > 0 || p.sinAlergenos === true, p.nombre);
    assert.ok(!(p.alergenos.length > 0 && p.sinAlergenos), `${p.nombre}: declaración coherente`);
    for (const a of p.alergenos) assert.ok(CODIGOS_ALERGENOS.includes(a));
  }
  // Alérgenos en el orden legal de la lista, no en el que se marcaron.
  assert.deepEqual(platos[0].alergenos, ['gluten', 'huevos', 'moluscos']);
});

test('Carta: campos de cada plato', async () => {
  const c = await h.categoria('Desayunos');
  await h.plato(c.id, 'Tostada con tomate', { precio: '2,80', descripcion: 'Pan de pueblo con tomate rallado y AOVE' });
  const [p] = todosLosPlatos(await carta());
  assert.deepEqual(Object.keys(p).sort(), ['agotado', 'alergenos', 'descripcion', 'foto', 'id', 'nombre', 'precioCentimos', 'sinAlergenos']);
  assert.equal(p.precioCentimos, 280);
});
