import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, PASSWORD } from './test/entorno.js';
import { abrirBD } from './db.js';
import { crearApp } from './app.js';
import { hashPassword } from './password.js';

const DIA = 24 * 60 * 60 * 1000;
let e;
beforeEach(() => (e = crearEntorno()));
afterEach(() => e.cerrar());

const cookieDe = (r) => r.headers['set-cookie']?.find((c) => c.startsWith('cartaya_sesion='));

test('Contraseña correcta', async () => {
  const agente = request.agent(e.app);
  const r = await agente.post('/api/sesion').send({ password: PASSWORD });
  assert.equal(r.status, 200);
  const cookie = cookieDe(r);
  assert.ok(cookie, 'envía la cookie de sesión');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Secure/i, 'sin Secure fuera de producción');
  assert.deepEqual((await agente.get('/api/sesion')).body, { abierta: true });
  assert.equal((await agente.get('/api/admin/categorias')).status, 200);
});

test('Contraseña correcta: en producción la cookie es Secure', async () => {
  const p = crearEntorno({ produccion: true });
  const r = await request(p.app).post('/api/sesion').send({ password: PASSWORD });
  assert.match(cookieDe(r), /Secure/);
  p.cerrar();
});

test('Contraseña incorrecta', async () => {
  const agente = request.agent(e.app);
  const r = await agente.post('/api/sesion').send({ password: 'otra-cosa' });
  assert.equal(r.status, 401);
  assert.equal(r.body.mensaje, 'Contraseña incorrecta');
  assert.equal(cookieDe(r), undefined);
  assert.deepEqual((await agente.get('/api/sesion')).body, { abierta: false });
  assert.equal((await agente.get('/api/admin/categorias')).status, 401);
});

test('La sesión se mantiene', async () => {
  const agente = request.agent(e.app);
  await agente.post('/api/sesion').send({ password: PASSWORD });
  e.reloj.t += 3 * DIA;
  assert.deepEqual((await agente.get('/api/sesion')).body, { abierta: true });
  // Cada uso renueva: 29 días después del último uso sigue abierta (33 desde que se abrió).
  e.reloj.t += 29 * DIA;
  assert.equal((await agente.get('/api/admin/categorias')).status, 200);
});

test('Caducidad por inactividad', async () => {
  const agente = request.agent(e.app);
  await agente.post('/api/sesion').send({ password: PASSWORD });
  e.reloj.t += 30 * DIA + 1000;
  assert.deepEqual((await agente.get('/api/sesion')).body, { abierta: false });
  assert.equal((await agente.get('/api/admin/categorias')).status, 401);
});

test('Cerrar la sesión', async () => {
  const agente = request.agent(e.app);
  const inicio = await agente.post('/api/sesion').send({ password: PASSWORD });
  const token = cookieDe(inicio).split(';')[0];
  const r = await agente.delete('/api/sesion');
  assert.equal(r.status, 200);
  assert.deepEqual((await agente.get('/api/sesion')).body, { abierta: false });
  // Aunque alguien conserve la cookie antigua, la sesión ya no existe en el servidor.
  assert.equal((await request(e.app).get('/api/admin/categorias').set('Cookie', token)).status, 401);
});

test('Cambiar la contraseña cierra todas las sesiones', async () => {
  const dataDir = e.dataDir;
  const db = abrirBD(':memory:');
  const appA = crearApp({ db, passwordHash: e.hash, dataDir });
  const inicio = await request(appA).post('/api/sesion').send({ password: PASSWORD });
  const token = cookieDe(inicio).split(';')[0];
  const appB = crearApp({ db, passwordHash: hashPassword('nueva-clave-2027'), dataDir });
  assert.equal((await request(appB).get('/api/admin/categorias').set('Cookie', token)).status, 401);
  db.close();
});

test('Bloqueo tras 5 intentos fallidos', async () => {
  const agente = request.agent(e.app);
  for (let i = 0; i < 5; i++) {
    e.reloj.t += 60 * 1000;
    assert.equal((await agente.post('/api/sesion').send({ password: `mal-${i}` })).status, 401);
  }
  e.reloj.t += 60 * 1000;
  const bloqueado = await agente.post('/api/sesion').send({ password: PASSWORD });
  assert.equal(bloqueado.status, 429);
  assert.match(bloqueado.body.mensaje, /pasados 15 minutos/);
  assert.equal(cookieDe(bloqueado), undefined);
  // Pasados 15 minutos desde el último fallo, vuelve a admitir intentos.
  e.reloj.t += 15 * 60 * 1000;
  assert.equal((await agente.post('/api/sesion').send({ password: PASSWORD })).status, 200);
});

test('Bloqueo: los fallos de hace más de 15 minutos no cuentan y un acierto reinicia la cuenta', async () => {
  const agente = request.agent(e.app);
  for (let i = 0; i < 4; i++) await agente.post('/api/sesion').send({ password: 'mal' });
  assert.equal((await agente.post('/api/sesion').send({ password: PASSWORD })).status, 200);
  for (let i = 0; i < 4; i++) await agente.post('/api/sesion').send({ password: 'mal' });
  e.reloj.t += 16 * 60 * 1000;
  await agente.post('/api/sesion').send({ password: 'mal' });
  assert.equal((await agente.post('/api/sesion').send({ password: PASSWORD })).status, 200);
});

test('Sin contraseña en claro', async () => {
  const registros = [];
  const originales = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(originales)) console[k] = (...a) => registros.push(a.join(' '));
  try {
    for (let i = 0; i < 3; i++) {
      await request(e.app).post('/api/sesion').send({ password: PASSWORD });
      await request(e.app).post('/api/sesion').send({ password: `${PASSWORD}-mal` });
    }
    await request(e.app).post('/api/sesion').set('Content-Type', 'application/json').send(`{"password": "${PASSWORD}"`);
  } finally {
    Object.assign(console, originales);
  }
  // Base de datos: ninguna celda de ninguna tabla contiene la contraseña.
  const tablas = e.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  for (const { name } of tablas) {
    for (const fila of e.db.prepare(`SELECT * FROM ${name}`).all()) {
      assert.ok(!JSON.stringify(fila).includes(PASSWORD), `aparece en la tabla ${name}`);
    }
  }
  // Configuración: solo la huella.
  assert.ok(!e.hash.includes(PASSWORD));
  assert.match(e.hash, /^scrypt\$/);
  // Registros del servidor.
  assert.ok(!registros.join('\n').includes(PASSWORD));
});
