import { test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react';
import { AppCocina } from './AppCocina.jsx';
import { PanelCocina } from './PanelCocina.jsx';
import { MENSAJE_ESTADO_CAMBIADO, MENSAJE_NO_CANCELABLE, MENSAJE_SIN_CONEXION } from '../../../server/textos.js';

const AHORA = Date.parse('2026-11-04T12:00:00Z');
const hace = (minutos) => new Date(AHORA - minutos * 60_000).toISOString();

const ETIQUETAS = { recibido: 'Recibido', en_preparacion: 'En preparación', servido: 'Servido', cancelado: 'Cancelado' };
const pedido = (numero, estado = 'recibido', extra = {}) => ({
  token: `token-${numero}`,
  numero,
  dia: '2026-11-04',
  mesa: 'Mesa 7',
  estado,
  estadoTexto: ETIQUETAS[estado],
  creadoEn: hace(5),
  canceladoEn: null,
  totalCentimos: 300,
  lineas: [{ platoId: 1, nombre: 'Café con leche', precioCentimos: 150, cantidad: 2, nota: '' }],
  ...extra,
});
const foto = (pedidos, extra = {}) => ({ dia: '2026-11-04', ahora: new Date(AHORA).toISOString(), pedidos, ...extra });

/** Simula la API (fetch); registra las peticiones. */
let llamadas;
function simularApi(rutas = {}) {
  llamadas = [];
  globalThis.fetch = vi.fn(async (url, opciones = {}) => {
    const metodo = opciones.method ?? 'GET';
    llamadas.push({ metodo, url, cuerpo: opciones.body && JSON.parse(opciones.body) });
    const manejador = rutas[`${metodo} ${url}`];
    const [status, datos] = manejador ? manejador(opciones) : [404, { mensaje: 'No se ha encontrado.' }];
    return new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
  });
}

let fuentes;
class FuenteFalsa {
  static CLOSED = 2;
  constructor(url) {
    this.url = url;
    this.oyentes = {};
    this.readyState = 1;
    this.cerrada = false;
    fuentes.push(this);
  }
  addEventListener(tipo, f) {
    this.oyentes[tipo] = f;
  }
  emitir(datos) {
    act(() => this.oyentes.pedidos({ data: JSON.stringify(datos) }));
  }
  latido() {
    act(() => this.oyentes.latido({ data: '{}' }));
  }
  /** Simula un fallo: 0 si el navegador sigue reconectando, 2 si se ha rendido. */
  fallar(readyState) {
    this.readyState = readyState;
    act(() => {
      this.onerror();
    });
  }
  close() {
    this.cerrada = true;
  }
}

let contextos;
class ContextoFalso {
  static estadoInicial = 'running';
  constructor() {
    this.state = ContextoFalso.estadoInicial;
    this.currentTime = 0;
    this.destination = {};
    this.tonos = 0;
    contextos.push(this);
  }
  createOscillator() {
    return { frequency: {}, connect() {}, start: () => this.tonos++, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
  resume() {
    this.state = 'running';
    this.onstatechange?.();
    return Promise.resolve();
  }
  close() {}
}

beforeEach(() => {
  fuentes = [];
  contextos = [];
  ContextoFalso.estadoInicial = 'running';
  globalThis.EventSource = FuenteFalsa;
  globalThis.AudioContext = ContextoFalso;
  simularApi({ 'GET /api/sesion': () => [200, { abierta: true }] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete globalThis.AudioContext;
});

const abrirPanel = (pedidos = []) => {
  const onSesionCaducada = vi.fn();
  render(<PanelCocina onSalir={() => {}} onSesionCaducada={onSesionCaducada} />);
  fuentes[0].emitir(foto(pedidos));
  return { onSesionCaducada };
};
const tarjeta = (numero) => screen.getByRole('article', { name: `Pedido ${numero}` });
const tarjetas = () => screen.queryAllByRole('article').map((t) => t.getAttribute('aria-label'));
const pulsar = (nombre, dentro = screen) => fireEvent.click(dentro.getByRole('button', { name: nombre }));
const verHistorico = () => pulsar('Histórico del día');

// ---------- Acceso y sesión ----------

test('Panel sin sesión', async () => {
  simularApi({ 'GET /api/sesion': () => [200, { abierta: false }] });
  render(<AppCocina />);
  await screen.findByLabelText('Contraseña de establecimiento');
  expect(screen.getByRole('heading', { name: 'La Estación · Cocina' })).toBeTruthy();
  expect(fuentes).toHaveLength(0);
  expect(screen.queryByRole('article')).toBeNull();
});

test('Panel con sesión abierta', async () => {
  render(<AppCocina />);
  await screen.findByRole('button', { name: 'Pedidos activos' });
  expect(screen.queryByLabelText('Contraseña de establecimiento')).toBeNull();
  expect(fuentes.map((f) => f.url)).toEqual(['/api/cocina/eventos']);
  fuentes[0].emitir(foto([pedido(15)]));
  expect(tarjetas()).toEqual(['Pedido 15']);
});

test('Contraseña correcta desde el panel de cocina', async () => {
  simularApi({
    'GET /api/sesion': () => [200, { abierta: false }],
    'POST /api/sesion': () => [200, { abierta: true }],
  });
  render(<AppCocina />);
  fireEvent.change(await screen.findByLabelText('Contraseña de establecimiento'), { target: { value: 'secreta' } });
  pulsar('Entrar');
  await screen.findByRole('button', { name: 'Pedidos activos' });
  expect(llamadas.at(-1)).toEqual({ metodo: 'POST', url: '/api/sesion', cuerpo: { password: 'secreta' } });
  expect(fuentes).toHaveLength(1);
});

test('Cerrar la sesión desde el panel de cocina', async () => {
  simularApi({
    'GET /api/sesion': () => [200, { abierta: true }],
    'DELETE /api/sesion': () => [200, { abierta: false }],
  });
  render(<AppCocina />);
  await screen.findByRole('button', { name: 'Pedidos activos' });
  fuentes[0].emitir(foto([pedido(15)]));
  pulsar('Cerrar sesión');
  expect(fuentes[0].cerrada).toBe(true);
  await screen.findByLabelText('Contraseña de establecimiento');
  expect(screen.queryByRole('article')).toBeNull();
  await waitFor(() => expect(llamadas.map((l) => l.metodo)).toContain('DELETE'));
});

test('Sesión cerrada con el panel abierto', async () => {
  render(<AppCocina />);
  await screen.findByRole('button', { name: 'Pedidos activos' });
  fuentes[0].emitir(foto([pedido(15)]));
  simularApi({ 'GET /api/sesion': () => [200, { abierta: false }] });
  fuentes[0].fallar(FuenteFalsa.CLOSED); // el servidor corta el flujo y responde 401 al reconectar
  await screen.findByLabelText('Contraseña de establecimiento');
  expect(screen.queryByRole('article')).toBeNull();
  expect(fuentes[0].cerrada).toBe(true);
  expect(fuentes).toHaveLength(1);
});

test('Una acción con la sesión caducada lleva a pedir la contraseña', async () => {
  simularApi({ 'POST /api/cocina/pedidos/token-15/estado': () => [401, { mensaje: 'Inicie sesión' }] });
  const { onSesionCaducada } = abrirPanel([pedido(15)]);
  pulsar('Empezar a preparar');
  await waitFor(() => expect(onSesionCaducada).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).toBeNull();
});

// ---------- Tiempo real y conexión ----------

test('Un pedido nuevo aparece solo', () => {
  abrirPanel([]);
  expect(screen.getByText('No hay pedidos activos.')).toBeTruthy();
  fuentes[0].emitir(foto([pedido(1, 'recibido', { mesa: 'Mesa 7' })]));
  expect(within(tarjeta(1)).getByText('Mesa 7')).toBeTruthy();
  expect(screen.queryByText('No hay pedidos activos.')).toBeNull();
});

test('Un cambio de estado aparece solo', () => {
  abrirPanel([pedido(15)]);
  expect(within(tarjeta(15)).getByText('Recibido')).toBeTruthy();
  fuentes[0].emitir(foto([pedido(15, 'en_preparacion')]));
  expect(within(tarjeta(15)).getByText('En preparación')).toBeTruthy();
  expect(within(tarjeta(15)).queryByRole('button', { name: 'Empezar a preparar' })).toBeNull();
});

test('El panel pasa al día nuevo', () => {
  abrirPanel([pedido(14), pedido(15, 'servido')]);
  expect(tarjetas()).toEqual(['Pedido 14']);
  fuentes[0].emitir(foto([], { dia: '2026-11-05' }));
  expect(tarjetas()).toEqual([]);
  verHistorico();
  expect(tarjetas()).toEqual([]);
});

test('Conexión perdida', () => {
  abrirPanel([pedido(15)]);
  expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
  fuentes[0].fallar(0);
  expect(screen.getByRole('alert').textContent).toBe('Sin conexión: los pedidos nuevos no aparecerán');
  expect(tarjetas()).toEqual(['Pedido 15']);
  expect(fuentes).toHaveLength(1);
  expect(llamadas).toEqual([]);
});

test('El panel se recupera tras perder la conexión', () => {
  abrirPanel([pedido(15)]);
  fuentes[0].fallar(0);
  fuentes[0].emitir(foto([pedido(15), pedido(16)]));
  expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
  expect(tarjetas()).toEqual(['Pedido 15', 'Pedido 16']);
});

/** Espera a que el panel programe el nuevo intento y comprueba que llega a los 3 s, no antes. */
async function reintentoProgramado() {
  // No vale vi.waitFor: adelantaría los temporizadores simulados mientras espera.
  // Dos temporizadores: el del nuevo intento y el que vigila el silencio.
  for (let i = 0; i < 50 && vi.getTimerCount() < 2; i++) await new Promise((ok) => setImmediate(ok));
  expect(vi.getTimerCount()).toBe(2);
  vi.advanceTimersByTime(2999);
  expect(fuentes).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(fuentes).toHaveLength(2);
}

test('Conexión rechazada con la sesión abierta: nuevo intento a los 3 s', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  abrirPanel([pedido(15)]);
  fuentes[0].fallar(FuenteFalsa.CLOSED);
  await reintentoProgramado();
  expect(llamadas.map((l) => l.url)).toEqual(['/api/sesion']);
  expect(screen.getByText(MENSAJE_SIN_CONEXION)).toBeTruthy();
  fuentes[1].emitir(foto([pedido(15), pedido(16)]));
  expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
  expect(tarjetas()).toEqual(['Pedido 15', 'Pedido 16']);
});

test('Sin servidor no se pide la contraseña: se sigue intentando', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const { onSesionCaducada } = abrirPanel([pedido(15)]);
  globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('sin red')));
  fuentes[0].fallar(FuenteFalsa.CLOSED);
  await reintentoProgramado();
  expect(onSesionCaducada).not.toHaveBeenCalled();
});

const pasar = (ms) => act(() => {
  vi.advanceTimersByTime(ms);
});

test('Corte silencioso: sin latidos durante 60 s avisa y reconecta', () => {
  vi.useFakeTimers({ now: AHORA });
  abrirPanel([pedido(15)]);
  pasar(59_999);
  expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
  expect(fuentes).toHaveLength(1);
  pasar(1);
  expect(screen.getByText(MENSAJE_SIN_CONEXION)).toBeTruthy();
  expect(tarjetas()).toEqual(['Pedido 15']);
  expect(fuentes[0].cerrada).toBe(true);
  expect(fuentes).toHaveLength(2);
  // La conexión nueva trae la foto al día y quita el aviso.
  fuentes[1].emitir(foto([pedido(15), pedido(16)]));
  expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
  expect(tarjetas()).toEqual(['Pedido 15', 'Pedido 16']);
});

test('Corte silencioso: los latidos mantienen la conexión sin aviso', () => {
  vi.useFakeTimers({ now: AHORA });
  abrirPanel([pedido(15)]);
  for (let i = 0; i < 10; i++) {
    pasar(25_000);
    fuentes[0].latido();
  }
  expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
  expect(fuentes).toHaveLength(1);
});

test('Corte silencioso: sigue intentándolo mientras no llegue nada', () => {
  vi.useFakeTimers({ now: AHORA });
  abrirPanel([pedido(15)]);
  pasar(180_000);
  expect(fuentes).toHaveLength(4);
  expect(fuentes.slice(0, 3).every((f) => f.cerrada)).toBe(true);
  expect(fuentes[3].cerrada).toBe(false);
  expect(screen.getByText(MENSAJE_SIN_CONEXION)).toBeTruthy();
});

test('Corte silencioso: al salir del panel no queda ninguna reconexión pendiente', () => {
  vi.useFakeTimers({ now: AHORA });
  abrirPanel([pedido(15)]);
  cleanup();
  pasar(120_000);
  expect(fuentes).toHaveLength(1);
});

// ---------- Pedidos activos ----------

test('Pedidos activos por antigüedad', () => {
  abrirPanel([pedido(13, 'en_preparacion'), pedido(14), pedido(15)]);
  expect(tarjetas()).toEqual(['Pedido 13', 'Pedido 14', 'Pedido 15']);
});

test('Contenido de un pedido en el panel', () => {
  abrirPanel([
    pedido(15, 'recibido', {
      lineas: [
        { platoId: 1, nombre: 'Café con leche', precioCentimos: 150, cantidad: 2, nota: 'uno descafeinado' },
        { platoId: 2, nombre: 'Tostada con tomate', precioCentimos: 280, cantidad: 1, nota: '' },
      ],
    }),
  ]);
  const t = within(tarjeta(15));
  expect(t.getByRole('heading', { name: 'Pedido 15' })).toBeTruthy();
  expect(t.getByText('Mesa 7')).toBeTruthy();
  expect(t.getByText('Recibido')).toBeTruthy();
  expect(t.getByText('5 min')).toBeTruthy();
  expect(t.getByText('2 × Café con leche')).toBeTruthy();
  expect(t.getByText('Nota: uno descafeinado')).toBeTruthy();
  expect(t.getByText('1 × Tostada con tomate')).toBeTruthy();
  expect(t.getAllByText(/^Nota:/)).toHaveLength(1);
});

test('Tiempo transcurrido del pedido', () => {
  vi.useFakeTimers({ now: AHORA });
  abrirPanel([pedido(15, 'recibido', { creadoEn: hace(12) })]);
  expect(within(tarjeta(15)).getByText('12 min')).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(3 * 60_000);
  });
  expect(within(tarjeta(15)).getByText('15 min')).toBeTruthy();
  expect(within(tarjeta(15)).queryByText('12 min')).toBeNull();
});

test('Tiempo transcurrido: usa el reloj del servidor, no el de la tablet', () => {
  vi.useFakeTimers({ now: AHORA + 60 * 60_000 }); // la tablet va una hora adelantada
  abrirPanel([pedido(15, 'recibido', { creadoEn: hace(12) })]);
  expect(within(tarjeta(15)).getByText('12 min')).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(30_000);
  });
  expect(within(tarjeta(15)).getByText('12 min')).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(30_000);
  });
  expect(within(tarjeta(15)).getByText('13 min')).toBeTruthy();
});

// ---------- Acciones ----------

const conCambio = (status = 200, datos = {}) => ({ 'POST /api/cocina/pedidos/token-15/estado': () => [status, datos] });

test('Empezar a preparar un pedido', async () => {
  simularApi(conCambio());
  abrirPanel([pedido(15)]);
  pulsar('Empezar a preparar');
  await waitFor(() => expect(llamadas).toHaveLength(1));
  expect(llamadas[0]).toEqual({
    metodo: 'POST',
    url: '/api/cocina/pedidos/token-15/estado',
    cuerpo: { estado: 'en_preparacion' },
  });
  fuentes[0].emitir(foto([pedido(15, 'en_preparacion')]));
  expect(within(tarjeta(15)).getByText('En preparación')).toBeTruthy();
  expect(tarjetas()).toEqual(['Pedido 15']);
});

test('Marcar un pedido como servido', async () => {
  simularApi(conCambio());
  abrirPanel([pedido(15, 'en_preparacion')]);
  pulsar('Marcar como servido');
  await waitFor(() => expect(llamadas).toHaveLength(1));
  expect(llamadas[0].cuerpo).toEqual({ estado: 'servido' });
  fuentes[0].emitir(foto([pedido(15, 'servido')]));
  verHistorico();
  expect(within(tarjeta(15)).getByText('Servido')).toBeTruthy();
});

test('Un botón no se puede pulsar dos veces mientras se envía', async () => {
  simularApi(conCambio());
  abrirPanel([pedido(15)]);
  const boton = screen.getByRole('button', { name: 'Empezar a preparar' });
  fireEvent.click(boton);
  expect(boton.disabled).toBe(true);
  fireEvent.click(boton);
  await waitFor(() => expect(boton.disabled).toBe(false));
  expect(llamadas).toHaveLength(1);
});

test('Un 409 muestra su mensaje sin romper el panel', async () => {
  simularApi(conCambio(409, { campo: 'estado', mensaje: MENSAJE_ESTADO_CAMBIADO }));
  abrirPanel([pedido(15), pedido(16)]);
  pulsar('Empezar a preparar', within(tarjeta(15)));
  expect((await screen.findByRole('alert')).textContent).toBe(`Pedido 15: ${MENSAJE_ESTADO_CAMBIADO}`);
  expect(tarjetas()).toEqual(['Pedido 15', 'Pedido 16']);
  // El estado real llega por el flujo, y el aviso se va con la siguiente acción.
  fuentes[0].emitir(foto([pedido(15, 'en_preparacion'), pedido(16)]));
  expect(within(tarjeta(15)).getByText('En preparación')).toBeTruthy();
  simularApi({ 'POST /api/cocina/pedidos/token-16/estado': () => [200, {}] });
  pulsar('Empezar a preparar', within(tarjeta(16)));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

test('Cancelar un pedido recibido', async () => {
  simularApi(conCambio());
  abrirPanel([pedido(15)]);
  pulsar('Cancelar pedido');
  expect(screen.getByText('¿Cancelar el pedido 15?')).toBeTruthy();
  expect(llamadas).toHaveLength(0);
  pulsar('Sí, cancelar');
  await waitFor(() => expect(llamadas).toHaveLength(1));
  expect(llamadas[0].cuerpo).toEqual({ estado: 'cancelado' });
  fuentes[0].emitir(foto([pedido(15, 'cancelado', { canceladoEn: hace(0) })]));
  expect(tarjetas()).toEqual([]);
});

test('Desistir de cancelar un pedido', () => {
  abrirPanel([pedido(15)]);
  pulsar('Cancelar pedido');
  pulsar('No');
  expect(screen.queryByText('¿Cancelar el pedido 15?')).toBeNull();
  expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeTruthy();
  expect(within(tarjeta(15)).getByText('Recibido')).toBeTruthy();
  expect(llamadas).toHaveLength(0);
});

test('Sin opción de cancelar en preparación', () => {
  abrirPanel([pedido(15, 'en_preparacion')]);
  expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).toBeNull();
});

test('La confirmación desaparece si otra tablet empieza a preparar el pedido', () => {
  abrirPanel([pedido(15)]);
  pulsar('Cancelar pedido');
  fuentes[0].emitir(foto([pedido(15, 'en_preparacion')]));
  expect(screen.queryByRole('button', { name: 'Sí, cancelar' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Marcar como servido' })).toBeTruthy();
});

test('Cancelación rechazada: la tarjeta vuelve a su estado y se avisa', async () => {
  simularApi(conCambio(409, { campo: 'estado', mensaje: MENSAJE_NO_CANCELABLE }));
  abrirPanel([pedido(15)]);
  pulsar('Cancelar pedido');
  pulsar('Sí, cancelar');
  expect((await screen.findByRole('alert')).textContent).toContain(MENSAJE_NO_CANCELABLE);
  await waitFor(() => expect(screen.queryByText('¿Cancelar el pedido 15?')).toBeNull());
});

// ---------- Aviso de pedido nuevo ----------

const resaltado = (numero) => tarjeta(numero).classList.contains('tarjeta-pedido--nuevo');

test('Aviso al llegar un pedido nuevo', () => {
  abrirPanel([pedido(14)]);
  fuentes[0].emitir(foto([pedido(14), pedido(15)]));
  expect(contextos[0].tonos).toBe(1);
  expect(resaltado(15)).toBe(true);
  expect(within(tarjeta(15)).getByText('Nuevo')).toBeTruthy();
  expect(resaltado(14)).toBe(false);
  // Un cambio en otro pedido no vuelve a sonar.
  fuentes[0].emitir(foto([pedido(14, 'en_preparacion'), pedido(15)]));
  expect(contextos[0].tonos).toBe(1);
});

test('Sin aviso por los pedidos ya existentes', () => {
  abrirPanel([pedido(13), pedido(14), pedido(15)]);
  expect(contextos[0].tonos).toBe(0);
  expect([13, 14, 15].some(resaltado)).toBe(false);
});

test('Sonido bloqueado por el navegador', async () => {
  ContextoFalso.estadoInicial = 'suspended';
  abrirPanel([]);
  fuentes[0].emitir(foto([pedido(15)]));
  expect(resaltado(15)).toBe(true);
  expect(contextos[0].tonos).toBe(0);
  pulsar('Activar sonido');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Activar sonido' })).toBeNull());
  expect(contextos[0].state).toBe('running');
  fuentes[0].emitir(foto([pedido(15), pedido(16)]));
  expect(contextos[0].tonos).toBe(1);
});

test('Sonido bloqueado: cualquier pulsación en el panel lo activa', async () => {
  ContextoFalso.estadoInicial = 'suspended';
  abrirPanel([]);
  fireEvent.click(screen.getByRole('button', { name: 'Histórico del día' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Activar sonido' })).toBeNull());
});

test('Sin Web Audio el panel funciona y resalta', () => {
  delete globalThis.AudioContext;
  abrirPanel([]);
  fuentes[0].emitir(foto([pedido(15)]));
  expect(resaltado(15)).toBe(true);
  expect(screen.queryByRole('button', { name: 'Activar sonido' })).toBeNull();
});

test('El resaltado se quita a los 30 s', () => {
  vi.useFakeTimers({ now: AHORA });
  abrirPanel([]);
  fuentes[0].emitir(foto([pedido(15)]));
  act(() => {
    vi.advanceTimersByTime(29_000);
  });
  expect(resaltado(15)).toBe(true);
  act(() => {
    vi.advanceTimersByTime(1_000);
  });
  expect(resaltado(15)).toBe(false);
});

test('El resaltado se quita al cambiar de estado el pedido', () => {
  abrirPanel([]);
  fuentes[0].emitir(foto([pedido(15)]));
  fuentes[0].emitir(foto([pedido(15, 'en_preparacion')]));
  expect(resaltado(15)).toBe(false);
});

test('Tras una reconexión avisa de lo que ha llegado mientras tanto', () => {
  abrirPanel([pedido(14)]);
  fuentes[0].fallar(0);
  fuentes[0].emitir(foto([pedido(14), pedido(15), pedido(16, 'cancelado')]));
  expect(contextos[0].tonos).toBe(1);
  expect(resaltado(15)).toBe(true);
});

// ---------- Histórico del día ----------

test('Pedido servido pasa al histórico', () => {
  abrirPanel([pedido(15, 'en_preparacion')]);
  fuentes[0].emitir(foto([pedido(15, 'servido')]));
  expect(tarjetas()).toEqual([]);
  verHistorico();
  expect(within(tarjeta(15)).getByText('Servido')).toBeTruthy();
});

test('Pedido cancelado en el histórico', () => {
  abrirPanel([pedido(15, 'cancelado', { canceladoEn: '2026-11-04T12:42:00Z' })]);
  expect(tarjetas()).toEqual([]);
  verHistorico();
  const t = within(tarjeta(15));
  expect(t.getByText('Cancelado')).toBeTruthy();
  expect(t.getByText('Cancelado a las 13:42')).toBeTruthy();
});

test('Contenido del histórico del día', () => {
  abrirPanel([
    pedido(12, 'servido', {
      mesa: 'Mesa 3',
      creadoEn: '2026-11-04T11:05:00Z',
      lineas: [{ platoId: 3, nombre: 'Bocadillo de lomo', precioCentimos: 450, cantidad: 1, nota: 'sin cebolla' }],
    }),
    pedido(14, 'servido'),
    pedido(16),
  ]);
  verHistorico();
  expect(tarjetas()).toEqual(['Pedido 12', 'Pedido 14']);
  const t = within(tarjeta(12));
  expect(t.getByText('Mesa 3')).toBeTruthy();
  expect(t.getByText('Confirmado a las 12:05')).toBeTruthy();
  expect(t.getByText('1 × Bocadillo de lomo')).toBeTruthy();
  expect(t.getByText('Nota: sin cebolla')).toBeTruthy();
  expect(t.queryByText(/ min$/)).toBeNull();
  expect(within(screen.getByRole('main')).queryAllByRole('button')).toEqual([]);
});

test('El histórico solo contiene el día actual', () => {
  abrirPanel([pedido(9, 'servido', { dia: '2026-11-03', token: 'ayer' })]);
  fuentes[0].emitir(foto([pedido(2, 'servido', { dia: '2026-11-04' })]));
  verHistorico();
  expect(tarjetas()).toEqual(['Pedido 2']);
});

test('Histórico del día vacío', () => {
  abrirPanel([pedido(15)]);
  verHistorico();
  expect(screen.getByText('Todavía no hay pedidos terminados hoy.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Histórico del día' }).getAttribute('aria-pressed')).toBe('true');
});
