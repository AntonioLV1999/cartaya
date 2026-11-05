import { createServer, connect } from 'node:net';
import { test, expect } from '@playwright/test';
import {
  apiConSesion,
  iniciarSesion,
  sinDesplazamientoHorizontal,
  botonesGrandes,
  botonesConNombre,
  textoLegible,
  contrasteAAA,
} from './utilidades.js';

// Tablet apoyada en la barra; la configuración general es la de un móvil.
test.use({ viewport: { width: 768, height: 1024 } });

const TEXTOS_PANEL = '.panel-cocina h1, .panel-cocina p, .panel-cocina li, .panel-cocina .etiqueta, .panel-cocina button';

async function comprobarVista(page) {
  await textoLegible(page, TEXTOS_PANEL);
  await botonesGrandes(page);
  await botonesConNombre(page);
  await sinDesplazamientoHorizontal(page);
  await contrasteAAA(page);
}

/** Prepara una mesa nueva y devuelve con qué confirmar pedidos y cambiarles el estado por la API. */
async function prepararMesa(baseURL, nombre) {
  const api = await apiConSesion(baseURL);
  const mesa = await (await api.post('/api/admin/mesas', { data: { nombre } })).json();
  const carta = await (await api.get('/api/carta')).json();
  const cafe = carta.categorias.flatMap((c) => c.platos).find((p) => p.nombre === 'Café con leche');
  return {
    mesa,
    async confirmar(nota = '') {
      const lineas = [{ platoId: cafe.id, cantidad: 2, nota, precioCentimos: cafe.precioCentimos }];
      return (await api.post(`/api/mesas/${mesa.codigo}/pedidos`, { data: { lineas } })).json();
    },
    async cambiar(pedido, ...estados) {
      for (const estado of estados) {
        const r = await api.post(`/api/cocina/pedidos/${pedido.token}/estado`, { data: { estado } });
        expect(r.status()).toBe(200);
      }
    },
    cerrar: () => api.dispose(),
  };
}

const tarjeta = (page, numero) => page.getByRole('article', { name: `Pedido ${numero}`, exact: true });

test('Panel usable en una tablet', async ({ page, baseURL }) => {
  const m = await prepararMesa(baseURL, 'Mesa tablet e2e');
  const recibido = await m.confirmar('una nota bastante larga para comprobar que cabe en la tarjeta sin desbordarla de ningún modo');
  const preparando = await m.confirmar();
  const servido = await m.confirmar();
  const cancelado = await m.confirmar();
  await m.cambiar(preparando, 'en_preparacion');
  await m.cambiar(servido, 'en_preparacion', 'servido');
  await m.cambiar(cancelado, 'cancelado');

  await iniciarSesion(page, '/cocina');
  await expect(page.getByRole('heading', { name: 'La Estación · Cocina' })).toBeVisible();

  // Pedidos activos, cada estado con texto.
  await expect(tarjeta(page, recibido.numero).getByText('Recibido', { exact: true })).toBeVisible();
  await expect(tarjeta(page, preparando.numero).getByText('En preparación', { exact: true })).toBeVisible();
  await comprobarVista(page);

  // Un pedido nuevo resaltado y la confirmación de cancelar.
  const nuevo = await m.confirmar();
  await expect(tarjeta(page, nuevo.numero).getByText('Nuevo', { exact: true })).toBeVisible();
  await comprobarVista(page);
  await tarjeta(page, nuevo.numero).getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(tarjeta(page, nuevo.numero).getByText(`¿Cancelar el pedido ${nuevo.numero}?`)).toBeVisible();
  await comprobarVista(page);
  await tarjeta(page, nuevo.numero).getByRole('button', { name: 'No', exact: true }).click();

  // Cualquier pulsación desbloquea el sonido.
  await expect(page.getByRole('button', { name: 'Activar sonido' })).toHaveCount(0);

  // Histórico del día, sin acciones.
  await page.getByRole('button', { name: 'Histórico del día' }).click();
  await expect(tarjeta(page, servido.numero).getByText('Servido', { exact: true })).toBeVisible();
  await expect(tarjeta(page, cancelado.numero).getByText('Cancelado', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await comprobarVista(page);

  // En horizontal, dos columnas.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'Pedidos activos' }).click();
  const columnas = await page.locator('.pedidos-cocina').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  expect(columnas).toBe(2);
  await sinDesplazamientoHorizontal(page);
  await m.cerrar();
});

test('Recorrido completo: del móvil del visitante a la tablet de cocina', async ({ page, browser, baseURL }) => {
  const m = await prepararMesa(baseURL, 'Mesa recorrido e2e');
  await iniciarSesion(page, '/cocina');
  let recargas = 0;
  page.on('load', () => recargas++);

  const contexto = await browser.newContext({ baseURL, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const movil = await contexto.newPage();
  await movil.goto(`/mesa/${m.mesa.codigo}`);
  await movil.getByRole('button', { name: 'Añadir Café con leche' }).click();
  await movil.getByRole('button', { name: 'Ver mi pedido' }).click();
  await movil.getByLabel('Nota para cocina (opcional)').fill('muy caliente');
  await movil.getByRole('button', { name: 'Confirmar pedido' }).click();
  const estadoMovil = movil.locator('.confirmacion__estado');
  await expect(estadoMovil).toHaveText('Estado: Recibido');
  const numero = (await movil.locator('.confirmacion__numero').textContent()).replace('Pedido ', '');

  // Aparece solo en la tablet.
  const pedido = tarjeta(page, numero);
  await expect(pedido.getByText('Mesa recorrido e2e')).toBeVisible();
  await expect(pedido.getByText('1 × Café con leche')).toBeVisible();
  await expect(pedido.getByText('Nota: muy caliente')).toBeVisible();
  await expect(pedido.getByText('Nuevo', { exact: true })).toBeVisible();

  await pedido.getByRole('button', { name: 'Empezar a preparar' }).click();
  await expect(pedido.getByText('En preparación', { exact: true })).toBeVisible();
  await expect(estadoMovil).toHaveText('Estado: En preparación');

  await pedido.getByRole('button', { name: 'Marcar como servido' }).click();
  await expect(pedido).toHaveCount(0);
  await expect(estadoMovil).toHaveText('Estado: Servido');

  await page.getByRole('button', { name: 'Histórico del día' }).click();
  await expect(pedido.getByText('Servido', { exact: true })).toBeVisible();
  await expect(pedido.getByText(/^Confirmado a las \d\d:\d\d$/)).toBeVisible();

  expect(recargas).toBe(0);
  await contexto.close();
  await m.cerrar();
});

/** Proxy TCP hacia el servidor: setOffline no corta un flujo SSE ya abierto, esto sí. */
async function abrirRed(baseURL) {
  const destino = { host: 'localhost', port: Number(new URL(baseURL).port) };
  const sockets = new Set();
  const respuestas = new Map(); // salida → cliente
  let cortada = false;
  let congelada = false;
  const servidor = createServer((cliente) => {
    if (cortada) return cliente.destroy();
    if (congelada) {
      // Ni rechaza ni responde: como un router colgado.
      sockets.add(cliente);
      cliente.on('error', () => {});
      return;
    }
    const salida = connect(destino);
    respuestas.set(salida, cliente);
    for (const socket of [cliente, salida]) {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => {
        cliente.destroy();
        salida.destroy();
        sockets.delete(socket);
      });
    }
    cliente.pipe(salida).pipe(cliente);
  });
  await new Promise((ok) => servidor.listen(0, ok));
  return {
    url: `http://localhost:${servidor.address().port}`,
    cortar() {
      cortada = true;
      sockets.forEach((s) => s.destroy());
    },
    /** Deja de pasar datos sin cerrar nada: el navegador no recibe ningún error. */
    congelar() {
      congelada = true;
      for (const [salida, cliente] of respuestas) {
        salida.unpipe(cliente);
        salida.pause();
      }
    },
    restablecer() {
      cortada = false;
      if (congelada) sockets.forEach((s) => s.destroy());
      congelada = false;
    },
    cerrar() {
      sockets.forEach((s) => s.destroy());
      return new Promise((ok) => servidor.close(ok));
    },
  };
}

test('Corte de red en la tablet: avisa y se recupera sin recargar', async ({ page, baseURL }) => {
  const m = await prepararMesa(baseURL, 'Mesa sin red e2e');
  const red = await abrirRed(baseURL);
  await iniciarSesion(page, `${red.url}/cocina`);
  await expect(page.locator('.estado, .pedidos-cocina').first()).toBeVisible();
  let recargas = 0;
  page.on('load', () => recargas++);

  red.cortar();
  const aviso = page.getByText('Sin conexión: los pedidos nuevos no aparecerán');
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await contrasteAAA(page);
  const pedido = await m.confirmar();

  red.restablecer();
  await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toHaveCount(0);
  expect(recargas).toBe(0);
  await red.cerrar();
  await m.cerrar();
});

test('Corte silencioso en la tablet: avisa sin ningún error de red y se recupera', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const m = await prepararMesa(baseURL, 'Mesa silencio e2e');
  const red = await abrirRed(baseURL);
  await iniciarSesion(page, `${red.url}/cocina`);
  await expect(page.locator('.estado, .pedidos-cocina').first()).toBeVisible();

  red.congelar();
  const aviso = page.getByText('Sin conexión: los pedidos nuevos no aparecerán');
  await expect(aviso).toBeVisible({ timeout: 70_000 });
  const pedido = await m.confirmar();

  red.restablecer();
  await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toHaveCount(0);
  await red.cerrar();
  await m.cerrar();
});

test('Sesión borrada con el panel abierto: vuelve a pedir la contraseña', async ({ page, baseURL }) => {
  const m = await prepararMesa(baseURL, 'Mesa sesión e2e');
  const pedido = await m.confirmar();
  await iniciarSesion(page, '/cocina');
  await expect(tarjeta(page, pedido.numero)).toBeVisible();

  // Comparte la cookie con la página: cierra la sesión sin que el panel lo sepa.
  await page.request.delete('/api/sesion');
  // Latido de 25 s y reconexión a los 3 s.
  await expect(page.getByLabel('Contraseña de establecimiento')).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole('article')).toHaveCount(0);
  await m.cerrar();
});
