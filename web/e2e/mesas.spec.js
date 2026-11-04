import { test, expect } from '@playwright/test';
import { iniciarSesion, sinDesplazamientoHorizontal, botonesGrandes, contrasteAAA } from './utilidades.js';
import { matrizQR, MARGEN_QR } from '../../server/qr.js';

/** Matriz de módulos a partir del SVG servido (un `M x,y h1v1h-1z` por módulo oscuro). */
function matrizDeSvg(svg) {
  const lado = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)[1]) - MARGEN_QR * 2;
  const m = Array.from({ length: lado }, () => Array(lado).fill(false));
  for (const [, x, y] of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) m[Number(y) - MARGEN_QR][Number(x) - MARGEN_QR] = true;
  return m;
}

test('Gestión de mesas desde el móvil', async ({ page, baseURL }) => {
  page.on('dialog', (d) => d.accept());
  await iniciarSesion(page);
  await page.getByRole('button', { name: 'Mesas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mesas' })).toBeVisible();

  // Crear (con el error de nombre repetido junto al campo).
  await page.getByLabel(/Nueva mesa/).fill('Mesa e2e');
  await page.getByRole('button', { name: 'Añadir mesa' }).click();
  await expect(page.locator('[data-mesa="Mesa e2e"]')).toBeVisible();
  await page.getByLabel(/Nueva mesa/).fill('mesa E2E');
  await page.getByRole('button', { name: 'Añadir mesa' }).click();
  await expect(page.getByText('Ya existe una mesa con ese nombre.')).toBeVisible();
  await sinDesplazamientoHorizontal(page);
  await botonesGrandes(page);
  await contrasteAAA(page);

  // Ver el QR: decodifica a la dirección de mesa de esta mesa.
  await page.getByRole('button', { name: 'Ver QR de Mesa e2e' }).click();
  const qr = page.getByAltText('QR de Mesa e2e');
  await expect(qr).toBeVisible();
  const url = await page.locator('[data-mesa="Mesa e2e"] .mesa-qr__url').textContent();
  expect(url).toMatch(new RegExp(`^${baseURL}/mesa/[23456789a-z]{10}$`));
  const svg = await page.evaluate(async (src) => (await fetch(src)).text(), await qr.getAttribute('src'));
  expect(matrizDeSvg(svg)).toEqual(matrizQR(url));
  await sinDesplazamientoHorizontal(page);
  await botonesGrandes(page);

  // Renombrar: el QR no cambia.
  await page.getByRole('button', { name: 'Renombrar Mesa e2e' }).click();
  await page.getByLabel('Nuevo nombre de «Mesa e2e»').fill('Ventana e2e');
  await sinDesplazamientoHorizontal(page);
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.locator('[data-mesa="Ventana e2e"]')).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar QR de Ventana e2e' }).click();
  await page.getByRole('button', { name: 'Ver QR de Ventana e2e' }).click();
  await expect(page.locator('[data-mesa="Ventana e2e"] .mesa-qr__url')).toHaveText(url);

  // El QR abre la carta de esa mesa.
  const carta = await page.context().newPage();
  await carta.goto(url);
  await expect(carta.getByText('Ventana e2e')).toBeVisible();
  await carta.close();

  // Imprimir: en modo impresión solo salen las hojas.
  await page.evaluate(() => { window.print = () => { window.__impreso = (window.__impreso ?? 0) + 1; }; });
  await page.emulateMedia({ media: 'print' });
  await page.getByRole('button', { name: 'Imprimir QR de Ventana e2e' }).click();
  await expect.poll(() => page.evaluate(() => window.__impreso)).toBe(1);
  await page.emulateMedia({ media: 'screen' });

  // Eliminar (con confirmación).
  await page.getByRole('button', { name: 'Eliminar Ventana e2e' }).click();
  await expect(page.locator('[data-mesa="Ventana e2e"]')).toHaveCount(0);
  await sinDesplazamientoHorizontal(page);
});
