import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, agenteConSesion } from './test/entorno.js';
import { abrirBD } from './db.js';
import { crearApp } from './app.js';
import { matrizQR, MARGEN_QR, urlMesa } from './qr.js';
import { generarCodigo, LONGITUD_CODIGO } from './mesas.js';
import { MENSAJE_SOLO_CONSULTA } from './textos.js';

let e;
let agente;
beforeEach(async () => {
  e = crearEntorno();
  agente = await agenteConSesion(e.app);
});
afterEach(() => e.cerrar());

const crear = async (nombre) => {
  const r = await agente.post('/api/admin/mesas').send({ nombre });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};
const nombres = async () => (await agente.get('/api/admin/mesas')).body.map((m) => m.nombre);

/** Reconstruye la matriz de módulos a partir del SVG generado (un `M x,y h1v1h-1z` por módulo oscuro). */
function matrizDeSvg(svg) {
  const lado = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)[1]) - MARGEN_QR * 2;
  const m = Array.from({ length: lado }, () => Array(lado).fill(false));
  for (const [, x, y] of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) m[Number(y) - MARGEN_QR][Number(x) - MARGEN_QR] = true;
  return m;
}

test('Crear una mesa', async () => {
  const m = await crear('  Mesa 7  ');
  assert.equal(m.nombre, 'Mesa 7');
  assert.equal(m.codigo.length, LONGITUD_CODIGO);
  assert.match(m.url, new RegExp(`/mesa/${m.codigo}$`));
  assert.deepEqual(await nombres(), ['Mesa 7']);
});

test('Nombre de mesa vacío', async () => {
  for (const nombre of ['', '   ', undefined]) {
    const r = await agente.post('/api/admin/mesas').send({ nombre });
    assert.equal(r.status, 422);
    assert.deepEqual(r.body, { campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
  }
  assert.deepEqual(await nombres(), []);
});

test('Nombre de mesa demasiado largo', async () => {
  const r = await agente.post('/api/admin/mesas').send({ nombre: 'x'.repeat(31) });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'nombre', mensaje: 'El nombre admite como máximo 30 caracteres.' });
  await crear('x'.repeat(30));
  assert.equal((await nombres()).length, 1);
});

test('Nombre de mesa repetido', async () => {
  await crear('Terraza 2');
  const r = await agente.post('/api/admin/mesas').send({ nombre: 'terraza 2' });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'nombre', mensaje: 'Ya existe una mesa con ese nombre.' });
  const otra = await crear('Terraza 3');
  const r2 = await agente.patch(`/api/admin/mesas/${otra.id}`).send({ nombre: 'TERRAZA 2' });
  assert.equal(r2.status, 422);
});

test('Códigos de mesa distintos y no adivinables', async () => {
  const m1 = await crear('Mesa 1');
  const m2 = await crear('Mesa 2');
  assert.notEqual(m1.codigo, m2.codigo);
  for (const m of [m1, m2]) {
    assert.match(m.codigo, /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);
    assert.ok(!m.codigo.includes(String(m.id)) || !/^\d+$/.test(m.codigo));
    assert.ok(!m.codigo.includes('mesa'));
  }
  // Muchos códigos: ninguno se repite y todos los símbolos aparecen (no hay sesgo evidente).
  const codigos = Array.from({ length: 2000 }, generarCodigo);
  assert.equal(new Set(codigos).size, codigos.length);
  assert.equal(new Set(codigos.join('')).size, 31);
});

test('Renombrar una mesa conserva su QR', async () => {
  const m = await crear('Mesa 7');
  const qrAntes = (await agente.get(`/api/admin/mesas/${m.id}/qr.svg`)).text;
  const r = await agente.patch(`/api/admin/mesas/${m.id}`).send({ nombre: 'Ventana 7' });
  assert.equal(r.status, 200);
  assert.equal(r.body.nombre, 'Ventana 7');
  assert.equal(r.body.codigo, m.codigo);
  assert.equal((await agente.get(`/api/admin/mesas/${m.id}/qr.svg`)).text, qrAntes);
  const publica = await request(e.app).get(`/api/mesas/${m.codigo}`);
  assert.deepEqual(publica.body, { nombre: 'Ventana 7' });
});

test('Archivar una mesa', async () => {
  const m = await crear('Terraza 3');
  await crear('Mesa 1');
  const r = await agente.post(`/api/admin/mesas/${m.id}/archivar`).send({});
  assert.equal(r.status, 204);
  assert.deepEqual(await nombres(), ['Mesa 1']);
  const fila = e.db.prepare('SELECT nombre, codigo, archivada_en FROM mesas WHERE id = ?').get(m.id);
  assert.equal(fila.nombre, 'Terraza 3');
  assert.equal(fila.codigo, m.codigo);
  assert.ok(fila.archivada_en);
  assert.equal((await agente.post(`/api/admin/mesas/${m.id}/archivar`).send({})).status, 404);
  assert.equal((await agente.get(`/api/admin/mesas/${m.id}/qr.svg`)).status, 404);
});

test('Crear una mesa con el nombre de una archivada', async () => {
  const vieja = await crear('Terraza 3');
  await agente.post(`/api/admin/mesas/${vieja.id}/archivar`).send({});
  const nueva = await crear('Terraza 3');
  assert.notEqual(nueva.id, vieja.id);
  assert.notEqual(nueva.codigo, vieja.codigo);
  assert.deepEqual(await nombres(), ['Terraza 3']);
});

test('Un código de mesa nunca se reutiliza, aunque el generador repita', async () => {
  const db = abrirBD(':memory:');
  const { crearMesas } = await import('./mesas.js');
  const cola = ['aaaaaaaaaa', 'aaaaaaaaaa', 'bbbbbbbbbb'];
  const mesas = crearMesas(db, { generar: () => cola.shift() });
  const a = mesas.crear({ nombre: 'A' });
  mesas.archivar(a.id);
  const b = mesas.crear({ nombre: 'B' });
  assert.equal(a.codigo, 'aaaaaaaaaa');
  assert.equal(b.codigo, 'bbbbbbbbbb');
  db.close();
});

test('Gestión de mesas sin sesión rechazada', async () => {
  const m = await crear('Mesa 7');
  const anonimo = request(e.app);
  const intentos = [
    anonimo.get('/api/admin/mesas'),
    anonimo.post('/api/admin/mesas').send({ nombre: 'Mesa 8' }),
    anonimo.patch(`/api/admin/mesas/${m.id}`).send({ nombre: 'Otra' }),
    anonimo.post(`/api/admin/mesas/${m.id}/archivar`).send({}),
    anonimo.get(`/api/admin/mesas/${m.id}/qr.svg`),
  ];
  for (const r of await Promise.all(intentos)) {
    assert.equal(r.status, 401);
    assert.ok(!r.text.includes(m.codigo));
  }
  assert.deepEqual(await nombres(), ['Mesa 7']);
});

test('QR de una mesa: el SVG codifica la dirección de mesa en la dirección pública', async () => {
  // Con CARTAYA_URL_PUBLICA configurada.
  const db = abrirBD(':memory:');
  const app = crearApp({ db, passwordHash: e.hash, dataDir: e.dataDir, urlPublica: 'https://laestacion.example/' });
  const a = await agenteConSesion(app);
  const m = (await a.post('/api/admin/mesas').send({ nombre: 'Mesa 7' })).body;
  assert.equal(m.url, `https://laestacion.example/mesa/${m.codigo}`);
  const r = await a.get(`/api/admin/mesas/${m.id}/qr.svg`);
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /image\/svg\+xml/);
  assert.deepEqual(matrizDeSvg(r.body.toString()), matrizQR(m.url));
  db.close();
});

test('QR de una mesa: sin dirección pública usa el origen de la petición', async () => {
  const m = await crear('Mesa 7');
  const r = await agente.get(`/api/admin/mesas/${m.id}/qr.svg`).set('Host', 'localhost:3000');
  assert.deepEqual(matrizDeSvg(r.body.toString()), matrizQR(urlMesa('http://localhost:3000', m.codigo)));
});

test('Mesa pública por su código: activa, archivada e inexistente', async () => {
  const activa = await crear('Mesa 7');
  const archivada = await crear('Terraza 3');
  await agente.post(`/api/admin/mesas/${archivada.id}/archivar`).send({});
  const pub = request(e.app);
  const r1 = await pub.get(`/api/mesas/${activa.codigo}`);
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.body, { nombre: 'Mesa 7' }); // solo el nombre: ni id ni otros datos
  for (const codigo of [archivada.codigo, 'noexiste22', '7']) {
    const r = await pub.get(`/api/mesas/${codigo}`);
    assert.equal(r.status, 404);
    assert.equal(r.body.mensaje, MENSAJE_SOLO_CONSULTA);
  }
});
