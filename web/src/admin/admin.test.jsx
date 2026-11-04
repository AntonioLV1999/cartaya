import { test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { Categorias } from './Categorias.jsx';
import { Platos } from './Platos.jsx';
import { FormPlato } from './FormPlato.jsx';
import { Archivados } from './Archivados.jsx';
import { Login } from './Login.jsx';
import { ALERGENOS } from '../../../server/alergenos.js';
import { reducirFoto, MENSAJE_FORMATO, MENSAJE_TAMANO } from './fotos.js';

/** Sustituye fetch por un enrutador de pruebas y registra las llamadas. */
function simularApi(rutas) {
  const llamadas = [];
  globalThis.fetch = vi.fn(async (url, opciones = {}) => {
    const metodo = opciones.method ?? 'GET';
    llamadas.push({ metodo, url, cuerpo: opciones.body, tipo: opciones.headers?.['Content-Type'] });
    const manejador = rutas[`${metodo} ${url}`];
    const [status, datos] = manejador ? manejador(opciones) : [404, { mensaje: 'No se ha encontrado.' }];
    return new Response(status === 204 ? null : JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
  });
  return llamadas;
}

/** `operar` igual que el del panel, sin recargar. */
const operar = async (op) => {
  try {
    await op();
    return null;
  } catch (e) {
    return e;
  }
};

beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

const categorias = [
  { id: 1, nombre: 'Bebidas', platosActivos: 2 },
  { id: 2, nombre: 'Especiales de verano', platosActivos: 0 },
];

// ---------- 3.6 Inicio de sesión ----------

test('Inicio de sesión: muestra "Contraseña incorrecta" junto al campo', async () => {
  simularApi({ 'POST /api/sesion': () => [401, { campo: 'password', mensaje: 'Contraseña incorrecta' }] });
  const onEntrar = vi.fn();
  render(<Login onEntrar={onEntrar} />);
  fireEvent.change(screen.getByLabelText('Contraseña de establecimiento'), { target: { value: 'mala' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Contraseña incorrecta');
  expect(screen.getByLabelText('Contraseña de establecimiento').getAttribute('aria-describedby')).toBe('password-error');
  expect(onEntrar).not.toHaveBeenCalled();
});

test('Inicio de sesión: muestra el aviso de bloqueo', async () => {
  const mensaje = 'Demasiados intentos fallidos. Vuelva a intentarlo pasados 15 minutos (a partir de las 10:45).';
  simularApi({ 'POST /api/sesion': () => [429, { campo: 'password', mensaje }] });
  render(<Login onEntrar={() => {}} />);
  fireEvent.change(screen.getByLabelText('Contraseña de establecimiento'), { target: { value: 'buena' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect((await screen.findByRole('alert')).textContent).toBe(mensaje);
});

// ---------- 7.1 Categorías ----------

test('Categorías: el error de nombre repetido aparece en español junto al campo', async () => {
  simularApi({ 'POST /api/admin/categorias': () => [422, { campo: 'nombre', mensaje: 'Ya existe una categoría con ese nombre.' }] });
  render(<Categorias categorias={categorias} operar={operar} />);
  const campo = screen.getByLabelText('Nueva categoría');
  fireEvent.change(campo, { target: { value: 'bebidas' } });
  fireEvent.click(screen.getByRole('button', { name: 'Añadir categoría' }));
  const error = await screen.findByText('Ya existe una categoría con ese nombre.');
  expect(campo.getAttribute('aria-describedby')).toBe(error.id);
  expect(campo.getAttribute('aria-invalid')).toBe('true');
});

test('Categorías: el error de nombre vacío aparece junto al campo', async () => {
  simularApi({ 'POST /api/admin/categorias': () => [422, { campo: 'nombre', mensaje: 'El nombre es obligatorio.' }] });
  render(<Categorias categorias={[]} operar={operar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Añadir categoría' }));
  expect((await screen.findByRole('alert')).textContent).toBe('El nombre es obligatorio.');
});

test('Categorías: eliminar una con platos activos muestra el aviso y no pide confirmación', async () => {
  const llamadas = simularApi({});
  const confirmar = vi.fn(() => true);
  render(<Categorias categorias={categorias} operar={operar} confirmar={confirmar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Bebidas' }));
  expect((await screen.findByRole('alert')).textContent).toBe('No se puede eliminar: primero archive o mueva sus 2 platos.');
  expect(confirmar).not.toHaveBeenCalled();
  expect(llamadas).toEqual([]);
});

test('Categorías: eliminar una vacía pide confirmación y la archiva', async () => {
  const llamadas = simularApi({ 'POST /api/admin/categorias/2/archivar': () => [204] });
  const confirmar = vi.fn(() => true);
  render(<Categorias categorias={categorias} operar={operar} confirmar={confirmar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Especiales de verano' }));
  await waitFor(() => expect(llamadas.map((l) => `${l.metodo} ${l.url}`)).toEqual(['POST /api/admin/categorias/2/archivar']));
  expect(confirmar.mock.calls[0][0]).toMatch(/¿Eliminar la categoría «Especiales de verano»\?/);
});

test('Categorías: renombrar, subir y bajar llaman a la API', async () => {
  const llamadas = simularApi({
    'PATCH /api/admin/categorias/1': () => [200, {}],
    'POST /api/admin/categorias/2/subir': () => [200, []],
    'POST /api/admin/categorias/1/bajar': () => [200, []],
  });
  render(<Categorias categorias={categorias} operar={operar} />);
  expect(screen.getByRole('button', { name: 'Subir Bebidas' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Subir Especiales de verano' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bajar Bebidas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Renombrar Bebidas' }));
  fireEvent.change(screen.getByLabelText('Nuevo nombre de «Bebidas»'), { target: { value: 'Refrescos' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  await waitFor(() => expect(llamadas).toHaveLength(3));
  expect(JSON.parse(llamadas[2].cuerpo)).toEqual({ nombre: 'Refrescos' });
});

// ---------- 7.2 Platos y formulario ----------

const platos = [
  { id: 10, categoriaId: 1, nombre: 'Croquetas', precioCentimos: 750, descripcion: '', foto: null, alergenos: ['gluten'], sinAlergenos: false, agotado: false },
  { id: 11, categoriaId: 1, nombre: 'Tortilla', precioCentimos: 450, descripcion: '', foto: null, alergenos: ['huevos'], sinAlergenos: false, agotado: true },
];

test('Lista de alérgenos disponible', () => {
  render(<FormPlato plato={null} categorias={categorias} operar={operar} onTerminar={() => {}} />);
  const grupo = screen.getByRole('group', { name: /Alérgenos/ });
  const casillas = within(grupo).getAllByRole('checkbox').filter((c) => c.name === 'alergeno');
  expect(casillas).toHaveLength(14);
  for (const a of ALERGENOS) expect(within(grupo).getByLabelText(a.nombre)).toBeTruthy();
  expect(within(grupo).getByLabelText('Sin alérgenos')).toBeTruthy();
});

test('Formulario de plato: contador de la descripción y errores junto a cada campo', async () => {
  simularApi({ 'POST /api/admin/platos': () => [422, { campo: 'precio', mensaje: 'El precio no es válido: debe ser mayor que 0 € y tener como mucho dos decimales.' }] });
  render(<FormPlato plato={null} categorias={categorias} operar={operar} onTerminar={() => {}} />);
  fireEvent.change(screen.getByLabelText('Descripción corta (opcional)'), { target: { value: 'a'.repeat(141) } });
  expect(screen.getByText('141 de 140 caracteres')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
  const error = await screen.findByText(/El precio no es válido/);
  expect(screen.getByLabelText('Precio en euros (IVA incluido)').getAttribute('aria-describedby')).toBe(error.id);
});

test('Formulario de plato: envía los datos declarados', async () => {
  const llamadas = simularApi({ 'POST /api/admin/platos': () => [201, { id: 5 }] });
  const onTerminar = vi.fn();
  render(<FormPlato plato={null} categorias={categorias} operar={operar} onTerminar={onTerminar} />);
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lomo con queso' } });
  fireEvent.change(screen.getByLabelText('Precio en euros (IVA incluido)'), { target: { value: '4,50' } });
  fireEvent.click(screen.getByLabelText('Gluten'));
  fireEvent.click(screen.getByLabelText('Leche'));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
  await waitFor(() => expect(onTerminar).toHaveBeenCalled());
  expect(JSON.parse(llamadas[0].cuerpo)).toEqual({
    nombre: 'Lomo con queso', precio: '4,50', descripcion: '', categoriaId: 1, alergenos: ['gluten', 'leche'], sinAlergenos: false,
  });
});

test('Cancelar el archivado', async () => {
  const llamadas = simularApi({});
  const confirmar = vi.fn(() => false);
  render(<Platos datos={{ categorias, platos }} operar={operar} confirmar={confirmar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Croquetas' }));
  expect(confirmar).toHaveBeenCalledOnce();
  expect(confirmar.mock.calls[0][0]).toMatch(/¿Eliminar el plato «Croquetas»\?/);
  await new Promise((r) => setTimeout(r, 0));
  expect(llamadas).toEqual([]);
  expect(screen.getByText(/Croquetas ·/)).toBeTruthy();
});

test('Platos: confirmar el archivado llama a la API', async () => {
  const llamadas = simularApi({ 'POST /api/admin/platos/10/archivar': () => [204] });
  render(<Platos datos={{ categorias, platos }} operar={operar} confirmar={() => true} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Croquetas' }));
  await waitFor(() => expect(llamadas.map((l) => l.url)).toEqual(['/api/admin/platos/10/archivar']));
});

// ---------- 7.5 Agotado ----------

test('Platos: el botón de agotado cambia el estado y la etiqueta', async () => {
  const llamadas = simularApi({
    'PATCH /api/admin/platos/10': () => [200, {}],
    'PATCH /api/admin/platos/11': () => [200, {}],
  });
  const { rerender } = render(<Platos datos={{ categorias, platos }} operar={operar} />);
  const croquetas = screen.getByText(/Croquetas ·/).closest('li');
  expect(within(croquetas).getByText('Disponible')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Marcar Croquetas como agotado' }));
  fireEvent.click(screen.getByRole('button', { name: 'Marcar Tortilla como disponible' }));
  await waitFor(() => expect(llamadas).toHaveLength(2));
  expect(JSON.parse(llamadas[0].cuerpo)).toEqual({ agotado: true });
  expect(JSON.parse(llamadas[1].cuerpo)).toEqual({ agotado: false });
  // Con los datos recargados, el estado se ve en texto.
  rerender(<Platos datos={{ categorias, platos: [{ ...platos[0], agotado: true }, { ...platos[1], agotado: false }] }} operar={operar} />);
  const tras = screen.getByText(/Croquetas ·/).closest('li');
  expect(within(tras).getByText('Agotado')).toBeTruthy();
  expect(within(tras).getByRole('button', { name: 'Marcar Croquetas como disponible' }).textContent).toBe('Marcar disponible');
  expect(within(screen.getByText(/Tortilla ·/).closest('li')).getByText('Disponible')).toBeTruthy();
});

// ---------- 7.3 Foto ----------

function ficheroFalso(nombre, tipo, tamano) {
  const f = new File([new Uint8Array(Math.min(tamano, 16))], nombre, { type: tipo });
  Object.defineProperty(f, 'size', { value: tamano });
  return f;
}

test('Foto: una imagen grande se sube reducida', async () => {
  const llamadas = simularApi({
    'POST /api/admin/platos': () => [201, { id: 7 }],
    'PUT /api/admin/platos/7/foto': () => [200, {}],
  });
  // Simula un navegador con canvas y WebP: 4000 × 3000 → 800 × 600.
  const dibujos = [];
  globalThis.createImageBitmap = vi.fn(async () => ({ width: 4000, height: 3000, close() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return { drawImage: (img, x, y, w, h) => dibujos.push([this.width, this.height, w, h]) };
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((ok, tipo) =>
    ok(new Blob([new Uint8Array(90_000)], { type: tipo })),
  );
  const onTerminar = vi.fn();
  render(<FormPlato plato={null} categorias={categorias} operar={operar} onTerminar={onTerminar} />);
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tostada' } });
  fireEvent.change(screen.getByLabelText('Precio en euros (IVA incluido)'), { target: { value: '2,80' } });
  fireEvent.click(screen.getByLabelText('Sin alérgenos'));
  const original = ficheroFalso('foto.jpg', 'image/jpeg', 3 * 1024 * 1024);
  fireEvent.change(screen.getByLabelText(/Foto \(opcional\)/), { target: { files: [original] } });
  await waitFor(() => expect(dibujos).toHaveLength(1));
  expect(dibujos[0]).toEqual([800, 600, 800, 600]);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
  await waitFor(() => expect(onTerminar).toHaveBeenCalled());
  const subida = llamadas.find((l) => l.metodo === 'PUT');
  expect(subida.tipo).toBe('image/webp');
  expect(subida.cuerpo.size).toBe(90_000);
  delete globalThis.createImageBitmap;
});

test('Foto: sin capacidad de reducir, se sube el original', async () => {
  delete globalThis.createImageBitmap;
  const original = ficheroFalso('foto.png', 'image/png', 1000);
  expect(await reducirFoto(original)).toBe(original);
});

test('Foto: un PDF se rechaza con su mensaje', async () => {
  const llamadas = simularApi({});
  render(<FormPlato plato={null} categorias={categorias} operar={operar} onTerminar={() => {}} />);
  fireEvent.change(screen.getByLabelText(/Foto \(opcional\)/), { target: { files: [ficheroFalso('carta.pdf', 'application/pdf', 20_000)] } });
  expect((await screen.findByRole('alert')).textContent).toBe(MENSAJE_FORMATO);
  expect(MENSAJE_FORMATO).toMatch(/solo se admiten fotos JPEG, PNG o WebP/);
  expect(llamadas).toEqual([]);
});

test('Foto: una foto de 8 MB se rechaza con su mensaje', async () => {
  render(<FormPlato plato={null} categorias={categorias} operar={operar} onTerminar={() => {}} />);
  fireEvent.change(screen.getByLabelText(/Foto \(opcional\)/), { target: { files: [ficheroFalso('foto.jpg', 'image/jpeg', 8 * 1024 * 1024)] } });
  expect((await screen.findByRole('alert')).textContent).toBe(MENSAJE_TAMANO);
  expect(MENSAJE_TAMANO).toMatch(/el máximo es 5 MB/);
});

test('Foto: quitar la foto de un plato la borra al guardar', async () => {
  const llamadas = simularApi({
    'PATCH /api/admin/platos/10': () => [200, { id: 10 }],
    'DELETE /api/admin/platos/10/foto': () => [200, {}],
  });
  const conFoto = { ...platos[0], foto: '/fotos/x.webp' };
  render(<FormPlato plato={conFoto} categorias={categorias} operar={operar} onTerminar={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar la foto' }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plato' }));
  await waitFor(() => expect(llamadas.map((l) => `${l.metodo} ${l.url}`)).toEqual(['PATCH /api/admin/platos/10', 'DELETE /api/admin/platos/10/foto']));
});

// ---------- 7.6 Archivados ----------

const archivados = {
  categorias: [{ id: 2, nombre: 'bebidas' }],
  platos: [
    { id: 20, nombre: 'Croquetas', categoriaId: 1, categoriaNombre: 'Raciones', categoriaArchivada: false },
    { id: 21, nombre: 'Horchata', categoriaId: 3, categoriaNombre: 'Especiales de verano', categoriaArchivada: true },
  ],
};
const activas = [{ id: 1, nombre: 'Raciones', platosActivos: 0 }, { id: 4, nombre: 'Bebidas', platosActivos: 1 }];

test('Archivados: recuperar un plato de una categoría activa', async () => {
  const llamadas = simularApi({ 'POST /api/admin/platos/20/recuperar': () => [200, {}] });
  render(<Archivados archivados={archivados} categorias={activas} operar={operar} />);
  const fila = screen.getByText('Croquetas').closest('li');
  expect(within(fila).queryByRole('combobox')).toBeNull();
  fireEvent.click(within(fila).getByRole('button', { name: 'Recuperar Croquetas' }));
  await waitFor(() => expect(llamadas).toHaveLength(1));
  expect(JSON.parse(llamadas[0].cuerpo)).toEqual({});
});

test('Archivados: un plato de una categoría archivada pide elegir una activa', async () => {
  const llamadas = simularApi({
    'POST /api/admin/platos/21/recuperar': (o) =>
      JSON.parse(o.body).categoriaId
        ? [200, {}]
        : [422, { campo: 'categoriaId', mensaje: 'Su categoría «Especiales de verano» está archivada: elija una categoría activa para recuperar el plato.' }],
  });
  render(<Archivados archivados={archivados} categorias={activas} operar={operar} />);
  const fila = screen.getByText('Horchata').closest('li');
  fireEvent.click(within(fila).getByRole('button', { name: 'Recuperar Horchata' }));
  expect((await within(fila).findByRole('alert')).textContent).toMatch(/elija una categoría activa/);
  fireEvent.change(within(fila).getByLabelText('Recuperar en la categoría'), { target: { value: '4' } });
  fireEvent.click(within(fila).getByRole('button', { name: 'Recuperar Horchata' }));
  await waitFor(() => expect(llamadas).toHaveLength(2));
  expect(JSON.parse(llamadas[1].cuerpo)).toEqual({ categoriaId: 4 });
});

test('Archivados: el error de nombre repetido aparece junto a la categoría', async () => {
  simularApi({ 'POST /api/admin/categorias/2/recuperar': () => [422, { campo: 'nombre', mensaje: 'Ya existe una categoría con ese nombre.' }] });
  render(<Archivados archivados={archivados} categorias={activas} operar={operar} />);
  const fila = screen.getByText('bebidas').closest('li');
  fireEvent.click(within(fila).getByRole('button', { name: 'Recuperar bebidas' }));
  expect((await within(fila).findByRole('alert')).textContent).toBe('Ya existe una categoría con ese nombre.');
});
