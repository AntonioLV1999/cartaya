import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearEntorno, agenteConSesion, ayudante } from './test/entorno.js';
import { diaDeServicio } from './pedidos.js';
import { MENSAJE_MESA_ARCHIVADA, MENSAJE_SOLO_CONSULTA } from './textos.js';

let e;
let agente;
let h;
let mesa;
let cafe;
let tostada;
let bebidas;
beforeEach(async () => {
  e = crearEntorno();
  agente = await agenteConSesion(e.app);
  h = ayudante(agente);
  bebidas = await h.categoria('Bebidas');
  cafe = await h.plato(bebidas.id, 'Café con leche', { precio: '1,50', sinAlergenos: false, alergenos: ['leche'] });
  tostada = await h.plato(bebidas.id, 'Tostada con tomate', { precio: '2,80', sinAlergenos: false, alergenos: ['gluten'] });
  mesa = await crearMesa('Mesa 7');
});
afterEach(() => e.cerrar());

async function crearMesa(nombre) {
  const r = await agente.post('/api/admin/mesas').send({ nombre });
  assert.equal(r.status, 201);
  return r.body;
}

const linea = (plato, cantidad = 1, nota = '', precioCentimos = plato.precioCentimos) => ({
  platoId: plato.id, cantidad, nota, precioCentimos,
});
const confirmar = (lineas, codigo = mesa.codigo) =>
  request(e.app).post(`/api/mesas/${codigo}/pedidos`).send({ lineas });
const contarPedidos = () => e.db.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n;

// ---------- Límites ----------

test('Pedido fuera de límites rechazado', async () => {
  const otros = [];
  for (let i = 0; i < 31; i++) otros.push(await h.plato(bebidas.id, `Plato ${i}`));
  const casos = [
    [[linea(cafe, 21)], 'cantidad'],
    [[linea(cafe, 0)], 'cantidad'],
    [[linea(cafe, 1.5)], 'cantidad'],
    [otros.map((p) => linea(p)), 'lineas'],
    [[], 'lineas'],
    [[linea(cafe), linea(cafe)], 'lineas'],
  ];
  for (const [lineas, campo] of casos) {
    const r = await confirmar(lineas);
    assert.equal(r.status, 422, JSON.stringify(r.body));
    assert.equal(r.body.campo, campo);
  }
  const r = await confirmar(otros.slice(0, 30).map((p) => linea(p, 20)));
  assert.equal(r.status, 201, 'con 30 platos y 20 unidades sí se admite');
  assert.equal(contarPedidos(), 1);
});

test('Pedido con nota demasiado larga rechazado', async () => {
  const r = await confirmar([linea(cafe, 1, 'a'.repeat(141))]);
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { campo: 'nota', mensaje: 'La nota admite como máximo 140 caracteres.' });
  assert.equal(contarPedidos(), 0);
  const ok = await confirmar([linea(cafe, 1, `  ${'a'.repeat(140)}  `)]);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.lineas[0].nota, 'a'.repeat(140));
});

test('Pedido vacío rechazado por la API', async () => {
  const r = await request(e.app).post(`/api/mesas/${mesa.codigo}/pedidos`).send({});
  assert.equal(r.status, 422);
  assert.equal(r.body.mensaje, 'El pedido está vacío: añada algún plato.');
});

// ---------- Registro ----------

test('Pedido registrado en estado Recibido', async () => {
  const r = await confirmar([linea(cafe, 2, '  uno descafeinado ')]);
  assert.equal(r.status, 201);
  assert.equal(r.body.mesa, 'Mesa 7');
  assert.equal(r.body.estado, 'recibido');
  assert.equal(r.body.estadoTexto, 'Recibido');
  assert.equal(r.body.numero, 1);
  assert.equal(r.body.totalCentimos, 300);
  assert.deepEqual(r.body.lineas, [{ platoId: cafe.id, nombre: 'Café con leche', precioCentimos: 150, cantidad: 2, nota: 'uno descafeinado' }]);
  // Disponible para cocina: guardado en la BD con su mesa.
  const fila = e.db.prepare('SELECT p.*, m.nombre AS mesa FROM pedidos p JOIN mesas m ON m.id = p.mesa_id').get();
  assert.equal(fila.mesa, 'Mesa 7');
  assert.equal(fila.estado, 'recibido');
  assert.equal(fila.total_centimos, 300);
});

test('Pedido registrado: la cocina recibe el aviso', async () => {
  const avisos = [];
  e.app.locals.eventos.on('pedido-registrado', (p) => avisos.push(p));
  const r = await confirmar([linea(cafe)]);
  assert.deepEqual(avisos.map((p) => p.numero), [r.body.numero]);
});

test('El pedido conserva el precio confirmado', async () => {
  const r = await confirmar([linea(cafe, 2)]);
  await agente.patch(`/api/admin/platos/${cafe.id}`).send({ precio: '1,60', nombre: 'Café con leche grande' });
  await agente.post(`/api/admin/platos/${cafe.id}/archivar`).send({});
  await agente.patch(`/api/admin/mesas/${mesa.id}`).send({ nombre: 'Ventana 7' });
  await agente.post(`/api/admin/mesas/${mesa.id}/archivar`).send({});
  const despues = (await request(e.app).get(`/api/pedidos/${r.body.token}`)).body;
  assert.equal(despues.mesa, 'Mesa 7');
  assert.deepEqual(despues.lineas, r.body.lineas);
  assert.equal(despues.lineas[0].precioCentimos, 150);
  assert.equal(despues.totalCentimos, 300);
});

test('Números correlativos del día', async () => {
  for (let i = 1; i <= 14; i++) assert.equal((await confirmar([linea(cafe)])).body.numero, i);
  const otra = await crearMesa('Terraza 1');
  const r = await confirmar([linea(tostada)], otra.codigo);
  assert.equal(r.body.numero, 15, 'el número es del local, no de la mesa');
});

test('El número vuelve a empezar cada día', async () => {
  // 23:59 en Madrid (22:59 UTC en invierno): todavía es el día 4.
  e.reloj.t = Date.parse('2026-11-04T22:59:00Z');
  for (let i = 0; i < 80; i++) await confirmar([linea(cafe)]);
  assert.equal(diaDeServicio(e.reloj.t), '2026-11-04');
  // 00:01 en Madrid del día 5.
  e.reloj.t = Date.parse('2026-11-04T23:01:00Z');
  const r = await confirmar([linea(cafe)]);
  assert.equal(r.body.numero, 1);
  assert.equal(r.body.dia, '2026-11-05');
  // En verano (UTC+2) también se usa la medianoche de Madrid.
  assert.equal(diaDeServicio(Date.parse('2026-07-01T22:30:00Z')), '2026-07-02');
});

test('Pedir el postre después', async () => {
  const postres = await h.categoria('Postres');
  const flan = await h.plato(postres.id, 'Flan', { precio: '3,00' });
  const p15 = (await confirmar([linea(cafe, 2)])).body;
  const nuevo = (await confirmar([linea(flan, 2)])).body;
  assert.notEqual(nuevo.numero, p15.numero);
  assert.equal(nuevo.mesa, 'Mesa 7');
  assert.deepEqual(nuevo.lineas.map((l) => [l.nombre, l.cantidad]), [['Flan', 2]]);
  assert.deepEqual((await request(e.app).get(`/api/pedidos/${p15.token}`)).body, p15);
});

test('Dos móviles en la misma mesa', async () => {
  const [a, b] = await Promise.all([confirmar([linea(cafe)]), confirmar([linea(tostada, 3)])]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.notEqual(a.body.numero, b.body.numero);
  assert.notEqual(a.body.token, b.body.token);
  assert.deepEqual(a.body.lineas.map((l) => l.nombre), ['Café con leche']);
  assert.deepEqual(b.body.lineas.map((l) => [l.nombre, l.cantidad]), [['Tostada con tomate', 3]]);
});

// ---------- La carta cambia mientras se decide ----------

test('Plato archivado mientras se decide', async () => {
  const raciones = await h.categoria('Raciones');
  const croquetas = await h.plato(raciones.id, 'Croquetas', { precio: '7,50' });
  await agente.post(`/api/admin/platos/${croquetas.id}/archivar`).send({});
  const r = await confirmar([linea(croquetas), linea(cafe, 2)]);
  assert.equal(r.status, 409);
  assert.equal(r.body.motivo, 'carta-cambiada');
  assert.deepEqual(r.body.retirados, [{ platoId: croquetas.id, nombre: 'Croquetas' }]);
  assert.deepEqual(r.body.precios, []);
  assert.equal(contarPedidos(), 0);
});

test('Plato agotado mientras se decide', async () => {
  const tortilla = await h.plato(bebidas.id, 'Tortilla', { precio: '4,00' });
  await agente.patch(`/api/admin/platos/${tortilla.id}`).send({ agotado: true });
  const r = await confirmar([linea(tortilla), linea(cafe)]);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.retirados, [{ platoId: tortilla.id, nombre: 'Tortilla' }]);
  assert.equal(contarPedidos(), 0);
});

// (Una categoría solo se archiva sin platos activos, así que «categoría archivada» implica «plato archivado».)
test('Un plato que no existe se retira', async () => {
  const r = await confirmar([linea(cafe), { platoId: 9999, cantidad: 1, nota: '', precioCentimos: 100 }]);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.retirados, [{ platoId: 9999, nombre: null }]);
});

test('Todos los platos retirados', async () => {
  const raciones = await h.categoria('Raciones');
  const croquetas = await h.plato(raciones.id, 'Croquetas');
  await agente.post(`/api/admin/platos/${croquetas.id}/archivar`).send({});
  const r = await confirmar([linea(croquetas)]);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.retirados.map((x) => x.nombre), ['Croquetas']);
  assert.equal(contarPedidos(), 0);
});

test('Precio cambiado mientras se decide', async () => {
  await agente.patch(`/api/admin/platos/${cafe.id}`).send({ precio: '1,60' });
  const r = await confirmar([linea(cafe, 2, '', 150)]);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.precios, [{ platoId: cafe.id, nombre: 'Café con leche', precioCentimos: 160 }]);
  assert.deepEqual(r.body.retirados, []);
  assert.equal(contarPedidos(), 0);
  const ok = await confirmar([linea(cafe, 2, '', 160)]);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.totalCentimos, 320);
});

test('Confirmar en una mesa archivada', async () => {
  const terraza = await crearMesa('Terraza 3');
  await agente.post(`/api/admin/mesas/${terraza.id}/archivar`).send({});
  const r = await confirmar([linea(cafe)], terraza.codigo);
  assert.equal(r.status, 410);
  assert.equal(r.body.mensaje, MENSAJE_MESA_ARCHIVADA);
  const r2 = await confirmar([linea(cafe)], 'noexiste22');
  assert.equal(r2.status, 404);
  assert.equal(r2.body.mensaje, MENSAJE_SOLO_CONSULTA);
  assert.equal(contarPedidos(), 0);
});

test('Pedidos: solo se aceptan en JSON', async () => {
  const r = await request(e.app).post(`/api/mesas/${mesa.codigo}/pedidos`).type('form').send('lineas=1');
  assert.equal(r.status, 415);
});

// ---------- Consulta y privacidad ----------

test('Un pedido no se consulta por su número', async () => {
  const p = (await confirmar([linea(cafe)])).body;
  assert.match(p.token, /^[A-Za-z0-9_-]{22}$/);
  for (const ruta of [`/api/pedidos/${p.numero}`, `/api/pedidos/1`, `/api/mesas/${mesa.codigo}/pedidos`, `/api/pedidos/${mesa.codigo}`]) {
    const r = await request(e.app).get(ruta);
    assert.equal(r.status, 404, ruta);
    assert.ok(!r.text.includes('Café con leche'), ruta);
  }
  assert.equal((await request(e.app).get(`/api/pedidos/${p.token}`)).status, 200);
});

test('El pedido no guarda datos del visitante', async () => {
  const navegador = 'Mozilla/5.0 (Android 14; Mobile) NavegadorDePrueba/1.0';
  await request(e.app)
    .post(`/api/mesas/${mesa.codigo}/pedidos`)
    .set('User-Agent', navegador)
    .set('X-Forwarded-For', '203.0.113.7')
    .set('Cookie', 'rastreo=abc123')
    .send({ lineas: [linea(cafe, 1, 'sin azúcar')] });
  const columnas = (t) => e.db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  assert.deepEqual(columnas('pedidos'), ['id', 'mesa_id', 'mesa_nombre', 'dia', 'numero', 'token', 'estado', 'total_centimos', 'creado_en']);
  assert.deepEqual(columnas('pedido_lineas'), ['pedido_id', 'posicion', 'plato_id', 'nombre', 'precio_centimos', 'cantidad', 'nota']);
  const volcado = JSON.stringify([
    e.db.prepare('SELECT * FROM pedidos').all(),
    e.db.prepare('SELECT * FROM pedido_lineas').all(),
  ]);
  for (const rastro of ['127.0.0.1', '::1', '203.0.113.7', 'NavegadorDePrueba', 'abc123']) {
    assert.ok(!volcado.includes(rastro), rastro);
  }
});

// ---------- Tiempo real ----------

/** Abre el flujo SSE contra un servidor real y devuelve un lector de eventos. */
async function abrirEventos(token) {
  const servidor = e.app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  const controlador = new AbortController();
  const r = await fetch(`http://localhost:${servidor.address().port}/api/pedidos/${token}/eventos`, { signal: controlador.signal });
  const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let bufer = '';
  return {
    respuesta: r,
    async siguiente() {
      while (!bufer.includes('\n\n') || !/event: estado/.test(bufer)) {
        const { value, done } = await lector.read();
        if (done) throw new Error('flujo cerrado');
        bufer += value;
      }
      const m = /event: estado\ndata: (.+)\n\n/.exec(bufer);
      bufer = bufer.slice(m.index + m[0].length);
      return JSON.parse(m[1]);
    },
    async cerrar() {
      controlador.abort();
      servidor.closeAllConnections();
      await new Promise((ok) => servidor.close(ok));
    },
  };
}

test('Estado del pedido por SSE: estado inicial, cambios y liberación al cerrar', async () => {
  const p = (await confirmar([linea(cafe)])).body;
  const otro = (await confirmar([linea(tostada)])).body;
  const sse = await abrirEventos(p.token);
  assert.match(sse.respuesta.headers.get('content-type'), /text\/event-stream/);
  assert.equal(sse.respuesta.headers.get('content-encoding'), null, 'sin compresión');
  assert.deepEqual(await sse.siguiente(), { estado: 'recibido', estadoTexto: 'Recibido' });
  assert.equal(e.app.locals.eventos.listenerCount('estado-cambiado'), 1);
  e.app.locals.pedidos.cambiarEstado(otro.token, 'listo'); // de otro pedido: no llega
  e.app.locals.pedidos.cambiarEstado(p.token, 'listo');
  assert.deepEqual(await sse.siguiente(), { estado: 'listo', estadoTexto: 'Listo' });
  await sse.cerrar();
  await new Promise((ok) => setTimeout(ok, 50));
  assert.equal(e.app.locals.eventos.listenerCount('estado-cambiado'), 0);
});

test('Estado del pedido por SSE: un token desconocido da 404', async () => {
  const r = await request(e.app).get('/api/pedidos/desconocido/eventos');
  assert.equal(r.status, 404);
});
