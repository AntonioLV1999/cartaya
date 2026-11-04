import { test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { AppCarta } from '../AppCarta.jsx';
import { MENSAJE_SOLO_CONSULTA, MENSAJE_MESA_ARCHIVADA } from '../../../../server/textos.js';
import { diaDeServicio } from '../../../../server/dia.js';
import { anadir, cambiarCantidad, MENSAJE_MAX_CANTIDAD, MENSAJE_MAX_LINEAS } from './pedido-en-curso.js';

const CODIGO = 'k3f9q2txab';

const plato = (id, nombre, precioCentimos, extra = {}) => ({
  id, nombre, precioCentimos, descripcion: '', foto: null, alergenos: [], sinAlergenos: true, agotado: false, ...extra,
});
const cafe = plato(1, 'Café con leche', 150, { alergenos: ['leche'], sinAlergenos: false });
const tostada = plato(2, 'Tostada con tomate', 280, { alergenos: ['gluten'], sinAlergenos: false });
const tortilla = plato(3, 'Tortilla', 450, { agotado: true });
const lomo = plato(4, 'Bocadillo de lomo', 450, { alergenos: ['gluten'], sinAlergenos: false });
const croquetas = plato(5, 'Croquetas', 750);
const carta = {
  categorias: [
    { id: 1, nombre: 'Bebidas', platos: [cafe, tostada, tortilla] },
    { id: 2, nombre: 'Bocadillos', platos: [lomo, croquetas] },
  ],
};

/** Simula la API (fetch) y EventSource; registra las peticiones. */
let llamadas;
let fuentes;
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
class FuenteFalsa {
  constructor(url) {
    this.url = url;
    this.oyentes = {};
    this.cerrada = false;
    fuentes.push(this);
  }
  addEventListener(tipo, f) {
    this.oyentes[tipo] = f;
  }
  emitir(datos) {
    this.oyentes.estado?.({ data: JSON.stringify(datos) });
  }
  close() {
    this.cerrada = true;
  }
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
  fuentes = [];
  globalThis.EventSource = FuenteFalsa;
  simularApi();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pedidoConfirmado = (extra = {}) => ({
  token: 'tokenSecretoDePrueba12',
  numero: 15,
  dia: diaDeServicio(Date.now()),
  mesa: 'Mesa 7',
  estado: 'recibido',
  estadoTexto: 'Recibido',
  totalCentimos: 300,
  lineas: [{ platoId: 1, nombre: 'Café con leche', precioCentimos: 150, cantidad: 2, nota: '' }],
  ...extra,
});

/** Abre la carta de «Mesa 7» (o la ruta indicada) y espera a que esté lista. */
async function abrirMesa({ ruta = `/mesa/${CODIGO}`, mesa = { nombre: 'Mesa 7' }, datos = carta } = {}) {
  const r = render(<AppCarta ruta={ruta} cargar={() => Promise.resolve(datos)} cargarMesaPorCodigo={() => Promise.resolve(mesa)} />);
  if (mesa) await screen.findByText('Mesa 7');
  else await screen.findByRole('heading', { name: 'Bebidas' });
  return r;
}
const pulsar = (nombre) => fireEvent.click(screen.getByRole('button', { name: nombre }));
const lineaResumen = (nombre) => document.querySelector(`.resumen .linea[data-plato="${nombre}"]`);
const guardado = () => JSON.parse(localStorage.getItem(`cartaya:pedido:${CODIGO}`) ?? '[]');

// ---------- Carta de una mesa / solo consulta ----------

test('Carta de una mesa activa', async () => {
  await abrirMesa();
  expect(screen.getByText('Mesa 7').closest('.mesa-actual')).toBeTruthy();
  for (const p of [cafe, tostada, lomo, croquetas]) {
    expect(screen.getByRole('button', { name: `Añadir ${p.nombre}` }).textContent).toBe('Añadir');
  }
  expect(screen.queryByText(MENSAJE_SOLO_CONSULTA)).toBeNull();
});

test('Carta sin mesa solo para consultar', async () => {
  render(<AppCarta ruta="/carta" cargar={() => Promise.resolve(carta)} cargarModulo={() => { throw new Error('no debe cargarse'); }} />);
  await screen.findByRole('heading', { name: 'Bebidas' });
  expect(screen.queryAllByRole('button', { name: /^Añadir/ })).toHaveLength(0);
  expect(screen.getByText(MENSAJE_SOLO_CONSULTA)).toBeTruthy();
});

test('Código de mesa no válido', async () => {
  await abrirMesa({ ruta: '/mesa/noexiste22', mesa: null });
  await screen.findByText(MENSAJE_SOLO_CONSULTA);
  expect(screen.queryAllByRole('button', { name: /^Añadir/ })).toHaveLength(0);
});

test('QR de una mesa archivada', async () => {
  // La API responde 404 para una mesa archivada, igual que para una inexistente.
  simularApi({ [`GET /api/mesas/${CODIGO}`]: () => [404, { mensaje: MENSAJE_SOLO_CONSULTA }] });
  render(<AppCarta ruta={`/mesa/${CODIGO}`} cargar={() => Promise.resolve(carta)} />);
  await screen.findByText(MENSAJE_SOLO_CONSULTA);
  await screen.findByRole('heading', { name: 'Bebidas' });
  expect(screen.queryAllByRole('button', { name: /^Añadir/ })).toHaveLength(0);
});

test('Dirección de mesa con código desconocido', async () => {
  const { container } = await abrirMesa({ ruta: '/mesa/desconocido', mesa: null });
  const enMesa = [...container.querySelectorAll('.categoria')].map((c) => c.textContent);
  cleanup();
  const r = render(<AppCarta ruta="/carta" cargar={() => Promise.resolve(carta)} />);
  await screen.findByRole('heading', { name: 'Bebidas' });
  expect([...r.container.querySelectorAll('.categoria')].map((c) => c.textContent)).toEqual(enMesa);
});

// ---------- Pedido en curso ----------

test('Añadir un plato', async () => {
  await abrirMesa();
  expect(screen.queryByRole('region', { name: 'Su pedido' })).toBeNull();
  pulsar('Añadir Café con leche');
  const barra = screen.getByRole('region', { name: 'Su pedido' });
  expect(within(barra).getByText('1 plato · 1,50 €')).toBeTruthy();
  expect(within(barra).getByRole('button', { name: 'Ver mi pedido' })).toBeTruthy();
  expect(guardado()).toMatchObject([{ platoId: 1, nombre: 'Café con leche', cantidad: 1, nota: '' }]);
});

test('Añadir otra vez el mismo plato', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Café con leche');
  expect(guardado()).toHaveLength(1);
  expect(guardado()[0].cantidad).toBe(2);
  expect(screen.getByText('2 en su pedido')).toBeTruthy();
  expect(screen.getByText('2 platos · 3,00 €')).toBeTruthy();
});

test('Un plato agotado no se puede añadir', async () => {
  await abrirMesa();
  const li = document.querySelector('.plato[data-plato="Tortilla"]');
  expect(within(li).getByText('Agotado')).toBeTruthy();
  expect(within(li).queryByRole('button')).toBeNull();
  // Y la lógica tampoco admite añadirlo desde otra vía.
  expect(screen.queryByRole('button', { name: 'Añadir Tortilla' })).toBeNull();
});

test('Aumentar y disminuir la cantidad', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  pulsar('Añadir otro Café con leche');
  expect(within(lineaResumen('Café con leche')).getByText('×3')).toBeTruthy();
  pulsar('Quitar un Café con leche');
  pulsar('Quitar un Café con leche');
  expect(within(lineaResumen('Café con leche')).getByText('×1')).toBeTruthy();
  expect(guardado()[0].cantidad).toBe(1);
});

test('Quitar un plato bajando su cantidad', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Tostada con tomate');
  pulsar('Ver mi pedido');
  pulsar('Quitar un Café con leche');
  expect(lineaResumen('Café con leche')).toBeNull();
  expect(lineaResumen('Tostada con tomate')).toBeTruthy();
  expect(guardado().map((l) => l.nombre)).toEqual(['Tostada con tomate']);
});

test('Cantidad máxima por plato', async () => {
  await abrirMesa();
  for (let i = 0; i < 20; i++) pulsar('Añadir Café con leche');
  pulsar('Añadir Café con leche');
  expect(guardado()[0].cantidad).toBe(20);
  expect(screen.getByRole('alert').textContent).toBe(MENSAJE_MAX_CANTIDAD);
  expect(MENSAJE_MAX_CANTIDAD).toBe('El máximo es 20 unidades por plato.');
  pulsar('Ver mi pedido');
  pulsar('Añadir otro Café con leche');
  expect(within(lineaResumen('Café con leche')).getByText('×20')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toBe(MENSAJE_MAX_CANTIDAD);
});

test('Máximo de platos distintos', () => {
  let lineas = [];
  for (let i = 1; i <= 30; i++) lineas = anadir(lineas, plato(100 + i, `Plato ${i}`, 100)).lineas;
  const r = anadir(lineas, plato(999, 'Uno más', 100));
  expect(r.lineas).toHaveLength(30);
  expect(r.aviso).toBe(MENSAJE_MAX_LINEAS);
  expect(MENSAJE_MAX_LINEAS).toBe('El máximo es 30 platos distintos por pedido.');
  // Sumar unidades a uno ya pedido sí se puede.
  expect(anadir(lineas, plato(101, 'Plato 1', 100)).lineas[0].cantidad).toBe(2);
  expect(cambiarCantidad(lineas, 101, -1).lineas).toHaveLength(29);
});

test('Añadir una nota a un plato', async () => {
  await abrirMesa();
  pulsar('Añadir Bocadillo de lomo');
  pulsar('Ver mi pedido');
  const nota = within(lineaResumen('Bocadillo de lomo')).getByLabelText('Nota para cocina (opcional)');
  fireEvent.change(nota, { target: { value: 'sin cebolla' } });
  expect(nota.value).toBe('sin cebolla');
  expect(guardado()[0].nota).toBe('sin cebolla');
  expect(within(lineaResumen('Bocadillo de lomo')).getByText('11 de 140 caracteres')).toBeTruthy();
});

test('Nota demasiado larga', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  const nota = within(lineaResumen('Café con leche')).getByLabelText('Nota para cocina (opcional)');
  expect(nota.getAttribute('maxlength')).toBe('140');
  // Aunque se pegue un texto más largo, se corta a 140 y se indica el máximo.
  fireEvent.change(nota, { target: { value: 'a'.repeat(141) } });
  expect(guardado()[0].nota).toHaveLength(140);
  expect(within(lineaResumen('Café con leche')).getByRole('alert').textContent).toBe('La nota admite como máximo 140 caracteres.');
  expect(within(lineaResumen('Café con leche')).getByText('140 de 140 caracteres')).toBeTruthy();
});

test('El pedido en curso sobrevive a recargar', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  fireEvent.change(within(lineaResumen('Café con leche')).getByLabelText('Nota para cocina (opcional)'), {
    target: { value: 'uno descafeinado' },
  });
  cleanup(); // «recargar»: se desmonta todo y se vuelve a abrir la misma mesa
  await abrirMesa();
  expect(screen.getByText('2 platos · 3,00 €')).toBeTruthy();
  pulsar('Ver mi pedido');
  expect(within(lineaResumen('Café con leche')).getByText('×2')).toBeTruthy();
  expect(within(lineaResumen('Café con leche')).getByLabelText('Nota para cocina (opcional)').value).toBe('uno descafeinado');
  // Es de esa mesa: otra mesa empieza vacía.
  cleanup();
  render(<AppCarta ruta="/mesa/otramesa22" cargar={() => Promise.resolve(carta)} cargarMesaPorCodigo={() => Promise.resolve({ nombre: 'Mesa 8' })} />);
  await screen.findByText('Mesa 8');
  expect(screen.queryByRole('region', { name: 'Su pedido' })).toBeNull();
});

test('Nada se envía antes de confirmar', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Tostada con tomate');
  pulsar('Ver mi pedido');
  pulsar('Añadir otro Café con leche');
  pulsar('Quitar un Tostada con tomate');
  fireEvent.change(within(lineaResumen('Café con leche')).getByLabelText('Nota para cocina (opcional)'), { target: { value: 'templado' } });
  pulsar('Seguir pidiendo');
  await new Promise((r) => setTimeout(r, 0));
  expect(llamadas).toEqual([]);
});

// ---------- Resumen ----------

test('Resumen con el total', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Café con leche');
  pulsar('Añadir Tostada con tomate');
  pulsar('Ver mi pedido');
  expect(screen.getByRole('heading', { name: 'Su pedido · Mesa 7' })).toBeTruthy();
  fireEvent.change(within(lineaResumen('Tostada con tomate')).getByLabelText('Nota para cocina (opcional)'), { target: { value: 'sin aceite' } });
  const c = within(lineaResumen('Café con leche'));
  expect(c.getByText('×2')).toBeTruthy();
  expect(c.getByText('3,00 €')).toBeTruthy();
  expect(c.getByText('Leche')).toBeTruthy();
  const t = within(lineaResumen('Tostada con tomate'));
  expect(t.getByText('×1')).toBeTruthy();
  expect(t.getByText('2,80 €')).toBeTruthy();
  expect(t.getByText('Gluten')).toBeTruthy();
  expect(t.getByLabelText('Nota para cocina (opcional)').value).toBe('sin aceite');
  expect(document.querySelector('.resumen .total').textContent).toBe('Total 5,80 €');
});

test('Volver a la carta sin enviar', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  pulsar('Seguir pidiendo');
  await screen.findByRole('button', { name: 'Añadir Café con leche' });
  expect(llamadas).toEqual([]);
  expect(screen.getByText('1 plato · 1,50 €')).toBeTruthy();
  expect(guardado()).toHaveLength(1);
});

test('Pedido vacío no se confirma', async () => {
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  pulsar('Quitar un Café con leche');
  expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).toBeNull();
  expect(screen.getByText(/Su pedido está vacío/)).toBeTruthy();
  expect(llamadas).toEqual([]);
});

test('Confirmar sin identificarse', async () => {
  simularApi({ [`POST /api/mesas/${CODIGO}/pedidos`]: () => [201, pedidoConfirmado()] });
  await abrirMesa();
  pulsar('Añadir Café con leche');
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  // El resumen no tiene ningún campo de datos personales: solo las notas de los platos.
  const campos = [...document.querySelectorAll('.resumen input, .resumen textarea, .resumen select')];
  expect(campos.map((c) => c.labels[0].textContent)).toEqual(['Nota para cocina (opcional)']);
  expect(document.querySelector('.resumen').textContent.toLowerCase()).not.toMatch(/nombre|correo|email|teléfono|registr/);
  pulsar('Confirmar pedido');
  await screen.findByText('Pedido 15');
  expect(llamadas).toHaveLength(1);
  expect(llamadas[0].cuerpo).toEqual({ lineas: [{ platoId: 1, cantidad: 2, nota: '', precioCentimos: 150 }] });
});

// ---------- La carta cambia mientras se decide ----------

async function prepararYConfirmar(respuesta, anadirPlatos) {
  simularApi({ [`POST /api/mesas/${CODIGO}/pedidos`]: respuesta });
  await abrirMesa();
  for (const p of anadirPlatos) pulsar(`Añadir ${p}`);
  pulsar('Ver mi pedido');
  pulsar('Confirmar pedido');
}

test('Plato archivado mientras se decide: aviso y resumen corregido en el móvil', async () => {
  await prepararYConfirmar(
    () => [409, { motivo: 'carta-cambiada', retirados: [{ platoId: 5, nombre: 'Croquetas' }], precios: [] }],
    ['Croquetas', 'Café con leche', 'Café con leche'],
  );
  const aviso = await screen.findByText('Croquetas ya no está disponible y se ha retirado de su pedido');
  expect(aviso.closest('[role="alert"]')).toBeTruthy();
  expect(lineaResumen('Croquetas')).toBeNull();
  expect(within(lineaResumen('Café con leche')).getByText('×2')).toBeTruthy();
  expect(document.querySelector('.resumen .total').textContent).toBe('Total 3,00 €');
  expect(guardado().map((l) => l.nombre)).toEqual(['Café con leche']);
});

test('Plato agotado mientras se decide: aviso en el móvil', async () => {
  // Un plato que se agota tras añadirlo (en la carta cargada aún estaba disponible).
  const conTortilla = { categorias: [{ id: 1, nombre: 'Bebidas', platos: [cafe, { ...tortilla, agotado: false }] }] };
  simularApi({ [`POST /api/mesas/${CODIGO}/pedidos`]: () => [409, { retirados: [{ platoId: 3, nombre: 'Tortilla' }], precios: [] }] });
  await abrirMesa({ datos: conTortilla });
  pulsar('Añadir Tortilla');
  pulsar('Añadir Café con leche');
  pulsar('Ver mi pedido');
  pulsar('Confirmar pedido');
  await screen.findByText('Tortilla ya no está disponible y se ha retirado de su pedido');
  expect(lineaResumen('Tortilla')).toBeNull();
  expect(lineaResumen('Café con leche')).toBeTruthy();
});

test('Confirmar tras la retirada', async () => {
  let intento = 0;
  await prepararYConfirmar(
    () => (++intento === 1 ? [409, { retirados: [{ platoId: 5, nombre: 'Croquetas' }], precios: [] }] : [201, pedidoConfirmado()]),
    ['Croquetas', 'Café con leche'],
  );
  await screen.findByText(/Croquetas ya no está disponible/);
  pulsar('Confirmar pedido');
  await screen.findByText('Pedido 15');
  expect(llamadas.map((l) => l.cuerpo.lineas.map((x) => x.platoId))).toEqual([[5, 1], [1]]);
});

test('Todos los platos retirados: el móvil indica que el pedido está vacío', async () => {
  await prepararYConfirmar(() => [409, { retirados: [{ platoId: 5, nombre: 'Croquetas' }], precios: [] }], ['Croquetas']);
  await screen.findByText(/Croquetas ya no está disponible y se ha retirado/);
  expect(screen.getByText('Su pedido se ha quedado vacío.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).toBeNull();
});

test('Precio cambiado mientras se decide: aviso y total nuevo en el móvil', async () => {
  await prepararYConfirmar(
    () => [409, { retirados: [], precios: [{ platoId: 1, nombre: 'Café con leche', precioCentimos: 160 }] }],
    ['Café con leche', 'Café con leche'],
  );
  await screen.findByText('Café con leche ha cambiado de precio');
  expect(within(lineaResumen('Café con leche')).getByText('1,60 € la unidad')).toBeTruthy();
  expect(document.querySelector('.resumen .total').textContent).toBe('Total 3,20 €');
  expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeTruthy();
});

test('Confirmar en una mesa archivada: mensaje en el móvil', async () => {
  await prepararYConfirmar(() => [410, { mensaje: MENSAJE_MESA_ARCHIVADA }], ['Café con leche']);
  expect((await screen.findByRole('alert')).textContent).toBe('Esta mesa ya no admite pedidos. Avise a nuestro personal');
  expect(screen.queryAllByRole('button', { name: /^Añadir/ })).toHaveLength(0);
});

// ---------- Confirmación ----------

test('Confirmación con número y estado', async () => {
  await prepararYConfirmar(() => [201, pedidoConfirmado()], ['Café con leche', 'Café con leche']);
  const numero = await screen.findByText('Pedido 15');
  expect(numero.className).toBe('confirmacion__numero');
  expect(screen.getByText('Mesa 7')).toBeTruthy();
  expect(screen.getByText('2 × Café con leche')).toBeTruthy();
  expect(document.querySelector('.confirmacion .total').textContent).toBe('Total 3,00 €');
  expect(screen.getByRole('status').textContent).toBe('Estado: Recibido');
  expect(location.pathname).toBe(`/mesa/${CODIGO}/pedidos/tokenSecretoDePrueba12`);
  expect(guardado()).toEqual([]);
});

test('El estado se actualiza sin recargar (en el móvil)', async () => {
  await prepararYConfirmar(() => [201, pedidoConfirmado()], ['Café con leche']);
  await screen.findByText('Pedido 15');
  expect(fuentes.map((f) => f.url)).toEqual(['/api/pedidos/tokenSecretoDePrueba12/eventos']);
  fuentes[0].emitir({ estado: 'listo', estadoTexto: 'Listo' });
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Estado: Listo'));
  cleanup();
  expect(fuentes[0].cerrada).toBe(true);
});

test('Volver a ver un pedido confirmado', async () => {
  await prepararYConfirmar(() => [201, pedidoConfirmado()], ['Café con leche', 'Café con leche']);
  await screen.findByText('Pedido 15');
  cleanup();
  // Vuelve a abrir la carta de la mesa en el mismo móvil.
  await abrirMesa();
  const enlace = within(screen.getByRole('region', { name: 'Mis pedidos de hoy' })).getByRole('link', { name: 'Pedido 15' });
  expect(enlace.getAttribute('href')).toBe(`/mesa/${CODIGO}/pedidos/tokenSecretoDePrueba12`);
  cleanup();
  // Al abrir el enlace, se ve la confirmación con su estado actual.
  simularApi({ 'GET /api/pedidos/tokenSecretoDePrueba12': () => [200, pedidoConfirmado({ estado: 'listo', estadoTexto: 'Listo' })] });
  render(<AppCarta ruta={`/mesa/${CODIGO}/pedidos/tokenSecretoDePrueba12`} cargar={() => Promise.reject(new Error('no hace falta'))} />);
  await screen.findByText('Pedido 15');
  expect(screen.getByRole('status').textContent).toBe('Estado: Listo');
});

test('Mis pedidos de hoy: los de días anteriores no se muestran', async () => {
  localStorage.setItem(`cartaya:mis-pedidos:${CODIGO}`, JSON.stringify([{ token: 'viejo', numero: 3, dia: '2020-01-01' }]));
  await abrirMesa();
  expect(screen.queryByRole('region', { name: 'Mis pedidos de hoy' })).toBeNull();
});
