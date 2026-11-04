import { test, expect } from '@playwright/test';
import { apiConSesion, sinDesplazamientoHorizontal, contrasteAAA } from './utilidades.js';

const esperarCarta = (page) => expect(page.locator('.plato').first()).toBeVisible();

test('Consulta de la carta sin identificación', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  await expect(page.getByRole('heading', { name: 'Desayunos' })).toBeVisible();
  await expect(page.getByLabel('Contraseña de establecimiento')).toHaveCount(0);
});

/** Crea una mesa activa por la API y devuelve su dirección de mesa. */
async function crearMesa(baseURL, nombre) {
  const api = await apiConSesion(baseURL);
  const r = await api.post('/api/admin/mesas', { data: { nombre } });
  expect(r.status()).toBe(201);
  const mesa = await r.json();
  await api.dispose();
  return { ...mesa, ruta: `/mesa/${mesa.codigo}` };
}

/** Texto de las categorías y platos de la carta, sin los controles del pedido. */
const textoDeLaCarta = (page) =>
  page.$$eval('main .categoria', (cs) =>
    cs.map((c) => {
      const copia = c.cloneNode(true);
      copia.querySelectorAll('.plato__pedir').forEach((x) => x.remove());
      return copia.innerText;
    }),
  );

test('Entrada desde el QR de una mesa', async ({ page, baseURL }) => {
  const mesa = await crearMesa(baseURL, 'Mesa QR e2e');
  await page.goto('/carta');
  await esperarCarta(page);
  const carta = await textoDeLaCarta(page);
  await page.goto(mesa.ruta);
  await expect(page.getByText('Mesa QR e2e')).toBeVisible();
  expect(await textoDeLaCarta(page)).toEqual(carta);
  await page.goto('/');
  await esperarCarta(page);
  expect(await textoDeLaCarta(page)).toEqual(carta);
});

test('Dirección de mesa con código desconocido', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  const carta = await page.locator('body').innerText();
  await page.goto('/mesa/7');
  await esperarCarta(page);
  expect(await page.locator('body').innerText()).toBe(carta);
});

test('Sin registro del cliente final', async ({ page, baseURL }) => {
  const mesa = await crearMesa(baseURL, 'Mesa registro e2e');
  for (const ruta of ['/carta', '/mesa/7', mesa.ruta]) {
    await page.goto(ruta);
    await esperarCarta(page);
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
    const texto = (await page.locator('body').innerText()).toLowerCase();
    for (const palabra of ['regístrese', 'registrarse', 'crear cuenta', 'iniciar sesión', 'correo', 'teléfono', 'contraseña']) {
      expect(texto).not.toContain(palabra);
    }
  }
});

test('Nombre del establecimiento en la cabecera', async ({ page }) => {
  await page.goto('/carta');
  await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText('La Estación');
});

test('Aviso de alergias visible', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  const aviso = page.getByText('Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal');
  await expect(aviso).toBeVisible();
  const yAviso = (await aviso.boundingBox()).y;
  const yCategoria = (await page.locator('.categoria').first().boundingBox()).y;
  expect(yAviso).toBeLessThan(yCategoria);
});

test('Ningún plato sin información de alérgenos', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  const platos = page.locator('.plato');
  const n = await platos.count();
  expect(n).toBeGreaterThan(10);
  for (let i = 0; i < n; i++) {
    const etiquetas = platos.nth(i).getByRole('list', { name: 'Alérgenos' }).getByRole('listitem');
    expect(await etiquetas.count(), await platos.nth(i).getAttribute('data-plato')).toBeGreaterThan(0);
    await platos.nth(i).scrollIntoViewIfNeeded();
    await expect(etiquetas.first()).toBeVisible();
  }
});

test('Navegación entre categorías', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  const indice = page.getByRole('navigation', { name: 'Categorías de la carta' });
  const boton = indice.getByRole('link', { name: 'Postres' });
  const caja = await boton.boundingBox();
  expect(caja.width).toBeGreaterThanOrEqual(48);
  expect(caja.height).toBeGreaterThanOrEqual(48);
  await boton.click();
  const titulo = page.getByRole('heading', { name: 'Postres', level: 2 });
  await expect(titulo).toBeInViewport();
  // El título no queda tapado por el índice fijo.
  const yIndice = (await indice.boundingBox()).y + (await indice.boundingBox()).height;
  expect((await titulo.boundingBox()).y).toBeGreaterThanOrEqual(yIndice - 1);
  for (const enlace of await indice.getByRole('link').all()) {
    const c = await enlace.boundingBox();
    expect(c.height).toBeGreaterThanOrEqual(48);
    expect(c.width).toBeGreaterThanOrEqual(48);
  }
});

test('Tamaño de texto y contraste', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  const tamanos = await page.$$eval(
    '.plato__nombre, .plato__precio, .plato__descripcion, .etiquetas .etiqueta, .etiqueta--agotado',
    (els) => els.map((e) => ({ texto: e.textContent, px: parseFloat(getComputedStyle(e).fontSize) })),
  );
  expect(tamanos.length).toBeGreaterThan(50);
  expect(tamanos.filter((t) => t.px < 18)).toEqual([]);
  const base = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(base).toBeGreaterThanOrEqual(18);
  await contrasteAAA(page);
});

test('Texto ampliado', async ({ page }) => {
  await page.goto('/carta');
  await esperarCarta(page);
  // Ampliación del texto al 200 % (como la opción de tamaño de letra del móvil).
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const base = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(base).toBeGreaterThanOrEqual(36);
  await sinDesplazamientoHorizontal(page);
  const fuera = await page.$$eval('.plato, .plato *, .cabecera *, .categoria > h2', (els) =>
    els
      .map((e) => ({ t: e.textContent.slice(0, 30), r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.left < -0.5 || r.right > document.documentElement.clientWidth + 0.5))
      .map(({ t }) => t),
  );
  expect(fuera).toEqual([]);
});

test('Los cambios del catálogo se reflejan al recargar', async ({ page, baseURL }) => {
  const api = await apiConSesion(baseURL);
  const categorias = await (await api.get('/api/admin/categorias')).json();
  const creado = await (
    await api.post('/api/admin/platos', {
      data: { categoriaId: categorias[0].id, nombre: 'Plato de prueba al recargar', precio: '3', sinAlergenos: true },
    })
  ).json();
  await page.goto('/carta');
  await expect(page.getByText('Plato de prueba al recargar')).toBeVisible();
  expect((await api.post(`/api/admin/platos/${creado.id}/archivar`, { data: {} })).status()).toBe(204);
  await page.reload();
  await esperarCarta(page);
  await expect(page.getByText('Plato de prueba al recargar')).toHaveCount(0);
  await api.dispose();
});

test('Plato agotado en la carta', async ({ page, baseURL }) => {
  const api = await apiConSesion(baseURL);
  const platos = await (await api.get('/api/admin/platos')).json();
  const segundo = platos.filter((p) => p.categoriaId === platos[0].categoriaId)[1];
  await api.patch(`/api/admin/platos/${segundo.id}`, { data: { agotado: true } });
  await page.goto('/carta');
  const plato = page.locator(`.plato[data-plato="${segundo.nombre}"]`);
  await expect(plato.getByText('Agotado')).toBeVisible();
  await expect(plato.locator('.plato__precio')).toBeVisible();
  await contrasteAAA(page);
  await api.patch(`/api/admin/platos/${segundo.id}`, { data: { agotado: false } });
  await api.dispose();
});
