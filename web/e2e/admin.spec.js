import { test, expect } from '@playwright/test';
import { iniciarSesion, sinDesplazamientoHorizontal, botonesGrandes, contrasteAAA } from './utilidades.js';
import { crearPng } from '../../scripts/png.js';

/** Comprobaciones de móvil que se repiten en cada pantalla. */
async function pantallaMovil(page) {
  await sinDesplazamientoHorizontal(page);
  await botonesGrandes(page);
}

test('Acceso sin sesión', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByLabel('Contraseña de establecimiento')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Platos' })).toHaveCount(0);
  await pantallaMovil(page);
  await contrasteAAA(page);
});

test('Contraseña incorrecta', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Contraseña de establecimiento').fill('no-es-esta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Contraseña incorrecta');
  await contrasteAAA(page);
});

test('Cerrar la sesión', async ({ page }) => {
  await iniciarSesion(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Contraseña de establecimiento')).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByLabel('Contraseña de establecimiento')).toBeVisible();
});

test('Gestión completa desde el móvil', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await iniciarSesion(page);
  await pantallaMovil(page);
  await contrasteAAA(page);

  // --- Categorías: crear, renombrar, ordenar ---
  await page.getByRole('button', { name: 'Categorías', exact: true }).click();
  await page.getByLabel('Nueva categoría').fill('Meriendas');
  await page.getByRole('button', { name: 'Añadir categoría' }).click();
  await expect(page.locator('[data-categoria="Meriendas"]')).toBeVisible();
  await page.getByLabel('Nueva categoría').fill('meriendas');
  await page.getByRole('button', { name: 'Añadir categoría' }).click();
  await expect(page.getByText('Ya existe una categoría con ese nombre.')).toBeVisible();
  await page.getByRole('button', { name: 'Renombrar Meriendas' }).click();
  await page.getByLabel('Nuevo nombre de «Meriendas»').fill('Meriendas de la tarde');
  await pantallaMovil(page);
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.locator('[data-categoria="Meriendas de la tarde"]')).toBeVisible();
  await page.getByRole('button', { name: 'Subir Meriendas de la tarde' }).click();
  const nombres = () => page.locator('.lista > li .fila__titulo').allTextContents();
  await expect.poll(async () => (await nombres()).at(-2)).toBe('Meriendas de la tarde');
  await pantallaMovil(page);
  await contrasteAAA(page);

  // --- Platos: crear con foto, editar, ordenar, agotado ---
  await page.getByRole('button', { name: 'Platos', exact: true }).click();
  const seccion = page.locator('section[data-categoria="Meriendas de la tarde"]');
  await seccion.getByRole('button', { name: 'Añadir plato en Meriendas de la tarde' }).click();
  await seccion.getByLabel('Nombre').fill('Chocolate con churros');
  await seccion.getByLabel('Precio en euros (IVA incluido)').fill('4,20');
  await seccion.getByLabel('Descripción corta (opcional)').fill('Chocolate a la taza y seis churros');
  await seccion.getByLabel('Gluten').check();
  await seccion.getByLabel('Leche').check();
  await seccion.getByLabel(/Foto \(opcional\)/).setInputFiles({
    name: 'churros.png',
    mimeType: 'image/png',
    buffer: crearPng({ ancho: 1600, alto: 1200, tono: 25, semilla: 9 }),
  });
  await expect(seccion.getByRole('img', { name: 'Vista previa de la foto' })).toBeVisible();
  await pantallaMovil(page);
  await contrasteAAA(page);
  await seccion.getByRole('button', { name: 'Guardar plato' }).click();
  await expect(seccion.locator('[data-plato="Chocolate con churros"]')).toBeVisible();

  await seccion.getByRole('button', { name: 'Añadir plato en Meriendas de la tarde' }).click();
  await seccion.getByLabel('Nombre').fill('Batido');
  await seccion.getByLabel('Precio en euros (IVA incluido)').fill('0');
  await seccion.getByRole('button', { name: 'Guardar plato' }).click();
  await expect(seccion.getByText(/El precio no es válido/)).toBeVisible();
  await seccion.getByLabel('Precio en euros (IVA incluido)').fill('3,00');
  await seccion.getByRole('button', { name: 'Guardar plato' }).click();
  await expect(seccion.getByText(/Debe declarar los alérgenos/)).toBeVisible();
  await seccion.getByLabel('Leche').check();
  await seccion.getByRole('button', { name: 'Guardar plato' }).click();
  await expect(seccion.locator('[data-plato="Batido"]')).toBeVisible();

  await seccion.getByRole('button', { name: 'Subir Batido' }).click();
  await expect.poll(() => seccion.locator('li[data-plato]').evaluateAll((l) => l.map((x) => x.dataset.plato))).toEqual([
    'Batido',
    'Chocolate con churros',
  ]);
  await seccion.getByRole('button', { name: 'Editar Batido' }).click();
  await seccion.getByLabel('Nombre').fill('Batido de vainilla');
  await seccion.getByRole('button', { name: 'Guardar plato' }).click();
  await expect(seccion.locator('[data-plato="Batido de vainilla"]')).toBeVisible();
  await seccion.getByRole('button', { name: 'Marcar Batido de vainilla como agotado' }).click();
  await expect(seccion.locator('[data-plato="Batido de vainilla"]').getByText('Agotado')).toBeVisible();
  await pantallaMovil(page);
  await contrasteAAA(page);

  // La carta refleja la foto (reducida) y el agotado.
  const carta = await page.context().newPage();
  await carta.goto('/carta');
  const chocolate = carta.locator('.plato[data-plato="Chocolate con churros"]');
  await chocolate.scrollIntoViewIfNeeded();
  const foto = chocolate.getByRole('img', { name: 'Foto de Chocolate con churros' });
  await expect(foto).toBeVisible();
  await expect.poll(() => foto.evaluate((img) => img.complete && img.naturalWidth)).toBe(800);
  await expect(carta.locator('.plato[data-plato="Batido de vainilla"]').getByText('Agotado')).toBeVisible();
  await carta.close();

  // --- Archivar y recuperar ---
  await seccion.getByRole('button', { name: 'Eliminar Batido de vainilla' }).click();
  await expect(seccion.locator('[data-plato="Batido de vainilla"]')).toHaveCount(0);
  await seccion.getByRole('button', { name: 'Eliminar Chocolate con churros' }).click();
  await expect(seccion.getByText('No hay platos en esta categoría.')).toBeVisible();

  await page.getByRole('button', { name: 'Categorías', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar Meriendas de la tarde' }).click();
  await expect(page.locator('[data-categoria="Meriendas de la tarde"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Archivados', exact: true }).click();
  await pantallaMovil(page);
  await contrasteAAA(page);
  // Con su categoría archivada, recuperar el plato pide elegir una categoría activa.
  const batido = page.locator('li[data-plato="Batido de vainilla"]');
  await expect(batido.getByText('(archivada)')).toBeVisible();
  await expect(batido.getByLabel('Recuperar en la categoría')).toBeVisible();
  await page.getByRole('button', { name: 'Recuperar Meriendas de la tarde' }).click();
  // Recuperada la categoría, el plato vuelve a la suya sin elegir nada.
  await expect(batido.getByLabel('Recuperar en la categoría')).toHaveCount(0);
  await batido.getByRole('button', { name: 'Recuperar Batido de vainilla' }).click();
  await expect(batido).toHaveCount(0);

  await page.getByRole('button', { name: 'Platos', exact: true }).click();
  await expect(seccion.locator('[data-plato="Batido de vainilla"]').getByText('Disponible')).toBeVisible();
  await pantallaMovil(page);
});
