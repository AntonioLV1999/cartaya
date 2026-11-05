import { expect, request as crearContexto } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const PASSWORD_PRUEBA = 'prueba-e2e-2026';

/** Contexto de API con la sesión de establecimiento abierta (para preparar datos). */
export async function apiConSesion(baseURL) {
  const api = await crearContexto.newContext({ baseURL });
  const r = await api.post('/api/sesion', { data: { password: PASSWORD_PRUEBA } });
  expect(r.status()).toBe(200);
  return api;
}

export async function iniciarSesion(page, ruta = '/admin') {
  await page.goto(ruta);
  await page.getByLabel('Contraseña de establecimiento').fill(PASSWORD_PRUEBA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

/** Comprueba que la página no se desplaza en horizontal. */
export async function sinDesplazamientoHorizontal(page) {
  const { ancho, contenido } = await page.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    contenido: document.documentElement.scrollWidth,
  }));
  expect(contenido, 'sin desplazamiento horizontal').toBeLessThanOrEqual(ancho);
}

/** Todos los botones y enlaces visibles miden al menos 48 × 48 px. */
export async function botonesGrandes(page, selector = 'button, a.boton, input[type="checkbox"], select, input[type="text"], input[type="password"]') {
  const pequenos = await page.$$eval(selector, (elementos) =>
    elementos
      .filter((e) => e.offsetParent !== null)
      .map((e) => {
        // Una casilla cuenta con su etiqueta entera, que es la zona que se puede pulsar.
        const zona = e.matches('input[type="checkbox"]') ? e.closest('label') ?? e : e;
        const r = zona.getBoundingClientRect();
        return { texto: (zona.textContent || zona.getAttribute('aria-label') || zona.id || zona.tagName).trim().slice(0, 40), ancho: r.width, alto: r.height };
      })
      .filter((r) => r.ancho < 47.5 || r.alto < 47.5),
  );
  expect(pequenos, 'elementos pulsables de al menos 48 × 48 px').toEqual([]);
}

/** Texto de al menos 18 px en todos los elementos visibles del selector. */
export async function textoLegible(page, selector) {
  const pequenos = await page.$$eval(selector, (els) =>
    els
      .filter((e) => e.offsetParent !== null && e.textContent.trim())
      .map((e) => ({ t: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) }))
      .filter((x) => x.px < 18),
  );
  expect(pequenos, 'texto de al menos 18 px').toEqual([]);
}

/** Todos los botones tienen nombre accesible. */
export async function botonesConNombre(page) {
  const sinNombre = await page.$$eval('button', (bs) =>
    bs.filter((b) => b.offsetParent !== null && !(b.getAttribute('aria-label') || b.textContent.trim())).length,
  );
  expect(sinNombre).toBe(0);
}

/** Sin fallos de contraste WCAG AAA (7:1). */
export async function contrasteAAA(page) {
  const resultado = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
  expect(resultado.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
}
