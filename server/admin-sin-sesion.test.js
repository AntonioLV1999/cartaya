import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, agenteConSesion, ayudante } from './test/entorno.js';

const e = crearEntorno();
let cat;
let plato;
let archivado;

before(async () => {
  const h = ayudante(await agenteConSesion(e.app));
  cat = await h.categoria('Bebidas');
  plato = await h.plato(cat.id, 'Café');
  archivado = await h.plato(cat.id, 'Horchata');
  const agente = await agenteConSesion(e.app);
  await agente.post(`/api/admin/platos/${archivado.id}/archivar`).send({});
});
after(() => e.cerrar());

const instantanea = () =>
  JSON.stringify({
    c: e.db.prepare('SELECT * FROM categorias ORDER BY id').all(),
    p: e.db.prepare('SELECT * FROM platos ORDER BY id').all(),
    a: e.db.prepare('SELECT * FROM plato_alergenos ORDER BY plato_id, alergeno').all(),
  });

test('Modificación sin sesión rechazada', async () => {
  const rutas = [
    ['get', '/api/admin/categorias'],
    ['post', '/api/admin/categorias', { nombre: 'Postres' }],
    ['patch', `/api/admin/categorias/${cat.id}`, { nombre: 'Refrescos' }],
    ['post', `/api/admin/categorias/${cat.id}/subir`, {}],
    ['post', `/api/admin/categorias/${cat.id}/bajar`, {}],
    ['post', `/api/admin/categorias/${cat.id}/archivar`, {}],
    ['post', `/api/admin/categorias/${cat.id}/recuperar`, {}],
    ['get', '/api/admin/platos'],
    ['post', '/api/admin/platos', { categoriaId: cat.id, nombre: 'Té', precio: '1', sinAlergenos: true }],
    ['patch', `/api/admin/platos/${plato.id}`, { precio: '9,99' }],
    ['patch', `/api/admin/platos/${plato.id}`, { agotado: true }],
    ['post', `/api/admin/platos/${plato.id}/subir`, {}],
    ['post', `/api/admin/platos/${plato.id}/bajar`, {}],
    ['post', `/api/admin/platos/${plato.id}/archivar`, {}],
    ['post', `/api/admin/platos/${archivado.id}/recuperar`, {}],
    ['put', `/api/admin/platos/${plato.id}/foto`],
    ['delete', `/api/admin/platos/${plato.id}/foto`],
    ['get', '/api/admin/archivados'],
  ];
  const antes = instantanea();
  for (const [metodo, ruta, cuerpo] of rutas) {
    let peticion = request(e.app)[metodo](ruta);
    if (metodo === 'put') peticion = peticion.set('Content-Type', 'image/png').send(Buffer.from('89504e470d0a1a0a', 'hex'));
    else if (cuerpo) peticion = peticion.send(cuerpo);
    const r = await peticion;
    assert.equal(r.status, 401, `${metodo.toUpperCase()} ${ruta}`);
  }
  assert.equal(instantanea(), antes, 'el catálogo no cambia');
});

test('Modificación sin sesión rechazada: una cookie inventada tampoco sirve', async () => {
  const r = await request(e.app).post('/api/admin/categorias').set('Cookie', 'cartaya_sesion=inventada').send({ nombre: 'X' });
  assert.equal(r.status, 401);
});

test('Administración: solo acepta JSON en las modificaciones', async () => {
  const agente = await agenteConSesion(e.app);
  const r = await agente.post('/api/admin/categorias').type('form').send('nombre=Postres');
  assert.equal(r.status, 415);
});
