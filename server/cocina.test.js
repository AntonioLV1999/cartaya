import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, PASSWORD, ayudante, agenteConSesion } from './test/entorno.js';
import { MENSAJE_ESTADO_CAMBIADO, MENSAJE_NO_CANCELABLE } from './textos.js';

const DIA = 24 * 60 * 60 * 1000;
const LATIDO = 20;

let e;
let agente;
let cookie;
let mesa;
let cafe;
let flujos;
beforeEach(async () => {
  e = crearEntorno({ latidoSSE: LATIDO });
  const inicio = await request(e.app).post('/api/sesion').send({ password: PASSWORD });
  cookie = inicio.headers['set-cookie'][0].split(';')[0];
  agente = await agenteConSesion(e.app);
  const h = ayudante(agente);
  cafe = await h.plato((await h.categoria('Bebidas')).id, 'Café con leche', { precio: '1,50' });
  mesa = (await agente.post('/api/admin/mesas').send({ nombre: 'Mesa 7' })).body;
  flujos = [];
});
afterEach(async () => {
  for (const f of flujos) await f.cerrar();
  e.cerrar();
});

const confirmar = async (cantidad = 1) =>
  (await request(e.app)
    .post(`/api/mesas/${mesa.codigo}/pedidos`)
    .send({ lineas: [{ platoId: cafe.id, cantidad, nota: '', precioCentimos: cafe.precioCentimos }] })).body;
const cambiar = (token, estado) => agente.post(`/api/cocina/pedidos/${token}/estado`).send({ estado });
const estadoDe = (p) => e.app.locals.pedidos.obtener(p.token).estado;
const oyentes = () =>
  e.app.locals.eventos.listenerCount('pedido-registrado') + e.app.locals.eventos.listenerCount('estado-cambiado');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Espera a que se cumpla una condición que depende del latido. */
async function hasta(condicion) {
  for (let i = 0; i < 100 && !condicion(); i++) await esperar(LATIDO / 2);
  assert.ok(condicion(), 'la condición no llega a cumplirse');
}

/** Abre el flujo del panel contra un servidor real y devuelve un lector de fotos. */
async function abrirPanel(cabeceras = { Cookie: cookie }) {
  const servidor = e.app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  const controlador = new AbortController();
  const r = await fetch(`http://localhost:${servidor.address().port}/api/cocina/eventos`, {
    headers: cabeceras,
    signal: controlador.signal,
  });
  const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let bufer = '';
  const leer = async () => {
    const { value, done } = await lector.read();
    if (!done) bufer += value;
    return done;
  };
  const flujo = {
    respuesta: r,
    async foto() {
      for (;;) {
        const m = /event: pedidos\ndata: (.+)\n\n/.exec(bufer);
        if (m) {
          bufer = bufer.slice(m.index + m[0].length);
          return JSON.parse(m[1]);
        }
        if (await leer()) throw new Error('flujo cerrado');
      }
    },
    async latido() {
      while (!bufer.includes('event: latido\ndata: {}\n\n')) {
        if (await leer()) throw new Error('flujo cerrado');
      }
      bufer = '';
    },
    async fin() {
      while (!(await leer()));
    },
    async cerrar() {
      controlador.abort();
      servidor.closeAllConnections();
      await new Promise((ok) => servidor.close(ok));
      await esperar(LATIDO);
    },
  };
  flujos.push(flujo);
  return flujo;
}

// ---------- Acceso ----------

test('Operaciones del panel sin sesión rechazadas', async () => {
  const p = await confirmar();
  const cambio = await request(e.app).post(`/api/cocina/pedidos/${p.token}/estado`).send({ estado: 'en_preparacion' });
  assert.equal(cambio.status, 401);
  assert.equal(estadoDe(p), 'recibido');
  const eventos = await request(e.app).get('/api/cocina/eventos');
  assert.equal(eventos.status, 401);
  assert.ok(!eventos.text.includes('Café con leche'));
  assert.ok(!eventos.text.includes(p.token));
  assert.equal(oyentes(), 0);
});

// ---------- Cambio de estado ----------

test('Cambio de estado: responde con el pedido actualizado', async () => {
  const p = await confirmar();
  const r = await cambiar(p.token, 'en_preparacion');
  assert.equal(r.status, 200);
  assert.equal(r.body.numero, p.numero);
  assert.equal(r.body.estadoTexto, 'En preparación');
});

test('Cambio de estado: solo se acepta en JSON', async () => {
  const p = await confirmar();
  const r = await agente.post(`/api/cocina/pedidos/${p.token}/estado`).type('form').send('estado=cancelado');
  assert.equal(r.status, 415);
  assert.equal(estadoDe(p), 'recibido');
});

test('Cambio de estado: un token desconocido da 404', async () => {
  assert.equal((await cambiar('desconocido', 'en_preparacion')).status, 404);
});

test('Cambio de estado: una transición no válida da 409 con su mensaje', async () => {
  const p = await confirmar();
  const salto = await cambiar(p.token, 'servido');
  assert.equal(salto.status, 409);
  assert.equal(salto.body.mensaje, MENSAJE_ESTADO_CAMBIADO);
  await cambiar(p.token, 'en_preparacion');
  const cancelacion = await cambiar(p.token, 'cancelado');
  assert.equal(cancelacion.status, 409);
  assert.equal(cancelacion.body.mensaje, MENSAJE_NO_CANCELABLE);
  assert.equal((await agente.post(`/api/cocina/pedidos/${p.token}/estado`).send({})).status, 409);
  assert.equal(estadoDe(p), 'en_preparacion');
});

// ---------- Fotos del día ----------

test('Eventos del panel: foto al conectar, con un pedido nuevo y con un cambio de estado', async () => {
  const primero = await confirmar();
  e.reloj.t += 1000;
  const segundo = await confirmar();
  const panel = await abrirPanel();
  assert.match(panel.respuesta.headers.get('content-type'), /text\/event-stream/);
  assert.equal(panel.respuesta.headers.get('content-encoding'), null, 'sin compresión');

  const inicial = await panel.foto();
  assert.equal(inicial.dia, '2026-11-04');
  assert.equal(inicial.ahora, new Date(e.reloj.t).toISOString());
  assert.deepEqual(inicial.pedidos.map((p) => p.numero), [primero.numero, segundo.numero]);
  assert.equal(inicial.pedidos[0].canceladoEn, null);
  assert.equal(oyentes(), 2);

  const tercero = await confirmar();
  assert.deepEqual((await panel.foto()).pedidos.map((p) => p.numero), [1, 2, tercero.numero]);

  await cambiar(primero.token, 'cancelado');
  const cancelado = (await panel.foto()).pedidos[0];
  assert.equal(cancelado.estado, 'cancelado');
  assert.equal(cancelado.canceladoEn, new Date(e.reloj.t).toISOString());

  await panel.cerrar();
  assert.equal(oyentes(), 0, 'los oyentes se liberan al cerrar');
});

test('Pedidos de otro día fuera del panel', async () => {
  e.reloj.t = Date.parse('2026-11-03T12:00:00Z');
  await confirmar();
  e.reloj.t = Date.parse('2026-11-04T12:00:00Z');
  const hoy = await confirmar();
  const panel = await abrirPanel();
  assert.deepEqual((await panel.foto()).pedidos.map((p) => p.token), [hoy.token]);
});

test('Mesa renombrada después del pedido', async () => {
  await confirmar();
  await agente.patch(`/api/admin/mesas/${mesa.id}`).send({ nombre: 'Terraza 1' });
  const panel = await abrirPanel();
  assert.equal((await panel.foto()).pedidos[0].mesa, 'Mesa 7');
});

// ---------- Latido: sesión y cambio de día ----------

test('Eventos del panel: el latido es un evento que el panel puede ver', async () => {
  const panel = await abrirPanel();
  await panel.foto();
  await panel.latido();
  await panel.latido();
});

test('Eventos del panel: el flujo se cierra al borrar la sesión', async () => {
  await confirmar();
  const panel = await abrirPanel();
  await panel.foto();
  await request(e.app).delete('/api/sesion').set('Cookie', cookie);
  await panel.fin();
  assert.equal(oyentes(), 0);
  const otra = await abrirPanel();
  assert.equal(otra.respuesta.status, 401, 'al reconectar, el navegador recibe el rechazo');
});

test('Eventos del panel: envía la foto del día nuevo al cruzar la medianoche de Madrid', async () => {
  e.reloj.t = Date.parse('2026-11-04T22:59:00Z'); // 23:59 en Madrid
  await confirmar();
  const panel = await abrirPanel();
  assert.equal((await panel.foto()).pedidos.length, 1);
  e.reloj.t = Date.parse('2026-11-04T23:00:30Z'); // 00:00:30 en Madrid del día 5
  assert.deepEqual(await panel.foto(), { dia: '2026-11-05', ahora: new Date(e.reloj.t).toISOString(), pedidos: [] });
});

test('El panel abierto mantiene la sesión', async () => {
  const ultimoUso = () => e.db.prepare('SELECT MAX(ultimo_uso_en) AS t FROM sesiones').get().t;
  const panel = await abrirPanel();
  await panel.foto();
  // Dos saltos de 20 días: el latido renueva la sesión aunque nadie toque la tablet.
  for (let i = 0; i < 2; i++) {
    e.reloj.t += 20 * DIA;
    await hasta(() => ultimoUso() === e.reloj.t);
  }
  assert.equal(oyentes(), 2, 'el flujo sigue abierto');

  // La cookie del navegador también dura 30 días: cada uso la renueva, o caducaría con el panel abierto.
  const pedido = await confirmar();
  const uso = await request(e.app)
    .post(`/api/cocina/pedidos/${pedido.token}/estado`)
    .set('Cookie', cookie)
    .send({ estado: 'en_preparacion' });
  assert.equal(uso.status, 200);
  const renovada = uso.headers['set-cookie'].find((c) => c.startsWith('cartaya_sesion='));
  assert.ok(renovada.startsWith(`${cookie};`), 'mantiene el mismo token');
  assert.match(renovada, /Max-Age=2592000/);
  assert.match(renovada, /HttpOnly/i);
  assert.match(renovada, /SameSite=Strict/i);

  const reconexion = await abrirPanel();
  assert.ok(reconexion.respuesta.headers.getSetCookie().some((c) => c.startsWith(`${cookie};`)));
  const comprobacion = await request(e.app).get('/api/sesion').set('Cookie', cookie);
  assert.deepEqual(comprobacion.body, { abierta: true });
  assert.ok(comprobacion.headers['set-cookie'].some((c) => c.startsWith(`${cookie};`)));
});
