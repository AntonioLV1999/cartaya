import { test, expect } from '@playwright/test';
import { apiConSesion, sinDesplazamientoHorizontal, botonesGrandes, contrasteAAA } from './utilidades.js';

const PULSABLES = 'button, a.boton, textarea';

async function crearMesa(baseURL, nombre) {
  const api = await apiConSesion(baseURL);
  const mesa = await (await api.post('/api/admin/mesas', { data: { nombre } })).json();
  await api.dispose();
  return { ...mesa, ruta: `/mesa/${mesa.codigo}` };
}

/** Pide 2 «Café con leche» (con nota) y 1 «Lomo con queso» y deja el resumen abierto. */
async function prepararPedido(page, mesa) {
  await page.goto(mesa.ruta);
  await expect(page.getByText(mesa.nombre)).toBeVisible();
  await page.getByRole('button', { name: 'Añadir Café con leche' }).click();
  await page.getByRole('button', { name: 'Añadir Café con leche' }).click();
  await page.getByRole('button', { name: 'Añadir Lomo con queso' }).click();
  await expect(page.getByRole('region', { name: 'Su pedido' })).toContainText('3 platos · 7,50 €');
  await page.getByRole('button', { name: 'Ver mi pedido' }).click();
  await page.locator('.linea[data-plato="Café con leche"]').getByLabel('Nota para cocina (opcional)').fill('uno descafeinado');
}

/** Texto ≥ 18 px en todos los textos visibles de la vista del pedido. */
async function textoLegible(page, selector) {
  const pequenos = await page.$$eval(selector, (els) =>
    els
      .filter((e) => e.offsetParent !== null && e.textContent.trim())
      .map((e) => ({ t: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) }))
      .filter((x) => x.px < 18),
  );
  expect(pequenos, 'texto de al menos 18 px').toEqual([]);
}

/** Todos los botones tienen nombre accesible. */
async function botonesConNombre(page) {
  const sinNombre = await page.$$eval('button', (bs) =>
    bs.filter((b) => b.offsetParent !== null && !(b.getAttribute('aria-label') || b.textContent.trim())).length,
  );
  expect(sinNombre).toBe(0);
}

async function comprobarVista(page, selectorTexto) {
  await textoLegible(page, selectorTexto);
  await botonesGrandes(page, PULSABLES);
  await botonesConNombre(page);
  await sinDesplazamientoHorizontal(page);
  await contrasteAAA(page);
  // Texto ampliado al 200 %.
  const estilo = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await sinDesplazamientoHorizontal(page);
  await estilo.evaluate((e) => e.remove());
}

test('Pedido desde la mesa: añadir, nota, resumen, confirmar y ver el número', async ({ page, baseURL }) => {
  const mesa = await crearMesa(baseURL, 'Mesa flujo e2e');
  await prepararPedido(page, mesa);
  const resumen = page.locator('.resumen');
  await expect(resumen.getByRole('heading', { name: 'Su pedido · Mesa flujo e2e' })).toBeVisible();
  await expect(resumen.locator('.total')).toHaveText('Total 7,50 €');
  await resumen.getByRole('button', { name: 'Confirmar pedido' }).click();

  await expect(page.locator('.confirmacion__numero')).toHaveText(/^Pedido \d+$/);
  await expect(page.locator('.confirmacion__estado')).toHaveText('Estado: Recibido');
  await expect(page.locator('.confirmacion')).toContainText('2 × Café con leche');
  await expect(page.locator('.confirmacion')).toContainText('Nota: uno descafeinado');
  expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${mesa.ruta}/pedidos/[A-Za-z0-9_-]{22}$`));

  // Tras recargar, la confirmación sigue ahí; y desde la carta de la mesa, en «Mis pedidos de hoy».
  const numero = await page.locator('.confirmacion__numero').textContent();
  await page.reload();
  await expect(page.locator('.confirmacion__numero')).toHaveText(numero);
  await page.getByRole('link', { name: 'Volver a la carta' }).click();
  await expect(page.getByRole('region', { name: 'Mis pedidos de hoy' }).getByRole('link', { name: numero })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Su pedido' })).toHaveCount(0);
});

test('El estado se actualiza sin recargar', async ({ page, baseURL, request }) => {
  const mesa = await crearMesa(baseURL, 'Mesa estado e2e');
  await prepararPedido(page, mesa);
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.locator('.confirmacion__estado')).toHaveText('Estado: Recibido');
  const token = new URL(page.url()).pathname.split('/').at(-1);
  let recargas = 0;
  page.on('load', () => recargas++);
  const r = await request.post(`/prueba/pedidos/${token}/estado`, { data: { estado: 'listo' } });
  expect(r.ok()).toBe(true);
  await expect(page.locator('.confirmacion__estado')).toHaveText('Estado: Listo');
  expect(recargas).toBe(0);
});

test('Plato archivado mientras se decide: aviso en el móvil de extremo a extremo', async ({ page, baseURL }) => {
  const mesa = await crearMesa(baseURL, 'Mesa retirada e2e');
  const api = await apiConSesion(baseURL);
  const categorias = await (await api.get('/api/admin/categorias')).json();
  const plato = await (
    await api.post('/api/admin/platos', { data: { categoriaId: categorias[0].id, nombre: 'Plato efímero e2e', precio: '3', sinAlergenos: true } })
  ).json();
  await page.goto(mesa.ruta);
  await page.getByRole('button', { name: 'Añadir Plato efímero e2e' }).click();
  await page.getByRole('button', { name: 'Añadir Café con leche' }).click();
  await page.getByRole('button', { name: 'Ver mi pedido' }).click();
  await api.post(`/api/admin/platos/${plato.id}/archivar`, { data: {} });
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('alert')).toContainText('Plato efímero e2e ya no está disponible y se ha retirado de su pedido');
  await expect(page.locator('.resumen .total')).toHaveText('Total 1,50 €');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.locator('.confirmacion__numero')).toBeVisible();
  await api.dispose();
});

test('Pedido usable en el móvil', async ({ page, baseURL }) => {
  const mesa = await crearMesa(baseURL, 'Mesa accesible e2e');
  await page.goto(mesa.ruta);
  await page.getByRole('button', { name: 'Añadir Café con leche' }).click();
  // Carta con el pedido en curso (botones «Añadir» y barra del pedido).
  await comprobarVista(page, '.mesa-actual, .plato__pedir *, .barra-pedido *');
  // Resumen.
  await page.getByRole('button', { name: 'Ver mi pedido' }).click();
  await page.getByLabel('Nota para cocina (opcional)').fill('sin azúcar');
  await comprobarVista(page, '.resumen h2, .linea *, .resumen .total, .resumen p');
  // Confirmación.
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.locator('.confirmacion__numero')).toBeVisible();
  await comprobarVista(page, '.confirmacion h2, .confirmacion p, .confirmacion .linea *');
});
