import { test, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { Cabecera, Plato, Categoria, AVISO_ALERGIAS } from './componentes.jsx';
import { AppCarta } from './AppCarta.jsx';

afterEach(cleanup);

const plato = (extra = {}) => ({
  id: 1,
  nombre: 'Tostada con tomate',
  precioCentimos: 280,
  descripcion: '',
  foto: null,
  alergenos: [],
  sinAlergenos: true,
  agotado: false,
  ...extra,
});

const renderPlato = (p) => render(<ul><Plato plato={p} /></ul>);

test('Nombre del establecimiento en la cabecera', () => {
  render(<Cabecera />);
  expect(screen.getByRole('banner').textContent).toContain('La Estación');
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('La Estación');
});

test('Aviso de alergias visible', async () => {
  const datos = { categorias: [{ id: 1, nombre: 'Desayunos', platos: [plato()] }] };
  const { container } = render(<AppCarta cargar={() => Promise.resolve(datos)} />);
  await screen.findByRole('heading', { name: 'Desayunos' });
  const aviso = screen.getByText('Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal');
  expect(aviso.textContent).toBe(AVISO_ALERGIAS);
  // Antes de la primera categoría en el orden del documento.
  const primera = container.querySelector('.categoria');
  expect(aviso.compareDocumentPosition(primera) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('Plato con todos sus datos', () => {
  renderPlato(
    plato({
      descripcion: 'Pan de pueblo con tomate rallado y AOVE',
      foto: '/fotos/tostada.webp',
      alergenos: ['gluten'],
      sinAlergenos: false,
    }),
  );
  expect(screen.getByText('Tostada con tomate')).toBeTruthy();
  expect(screen.getByText('2,80 €')).toBeTruthy();
  expect(screen.getByText('Pan de pueblo con tomate rallado y AOVE')).toBeTruthy();
  const img = screen.getByRole('img', { name: 'Foto de Tostada con tomate' });
  expect(img.getAttribute('src')).toBe('/fotos/tostada.webp');
  expect(img.getAttribute('loading')).toBe('lazy');
  expect(img.getAttribute('width')).toBe('800');
  expect(img.getAttribute('height')).toBe('600');
});

test('Plato sin foto', () => {
  const { container } = renderPlato(plato({ nombre: 'Café con leche', precioCentimos: 150, alergenos: ['leche'], sinAlergenos: false }));
  expect(screen.getByText('Café con leche')).toBeTruthy();
  expect(screen.getByText('1,50 €')).toBeTruthy();
  expect(screen.getByText('Leche')).toBeTruthy();
  expect(container.querySelector('img')).toBeNull();
});

test('Plato sin foto: si la foto falla al cargar se oculta en vez de mostrarse rota', () => {
  const { container } = renderPlato(plato({ foto: '/fotos/no-existe.webp' }));
  fireEvent.error(container.querySelector('img'));
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('Tostada con tomate')).toBeTruthy();
});

test('Plato con alérgenos', () => {
  renderPlato(plato({ nombre: 'Bocadillo de calamares', alergenos: ['gluten', 'huevos', 'moluscos'], sinAlergenos: false }));
  const lista = screen.getByRole('list', { name: 'Alérgenos' });
  const etiquetas = within(lista).getAllByRole('listitem').map((li) => li.textContent);
  expect(etiquetas).toEqual(['Gluten', 'Huevos', 'Moluscos']);
  // Visibles sin pulsar nada: no están dentro de ningún desplegable ni botón.
  expect(lista.closest('details, button, [hidden]')).toBeNull();
});

test('Plato sin alérgenos', () => {
  renderPlato(plato({ nombre: 'Zumo de naranja', sinAlergenos: true }));
  expect(screen.getByText('Sin alérgenos')).toBeTruthy();
});

test('Plato agotado en la carta', () => {
  const categoria = {
    id: 3,
    nombre: 'Raciones',
    platos: [
      plato({ id: 1, nombre: 'Croquetas' }),
      plato({ id: 2, nombre: 'Tortilla', precioCentimos: 450, agotado: true, alergenos: ['huevos'], sinAlergenos: false }),
    ],
  };
  const { container } = render(<Categoria categoria={categoria} />);
  const platos = [...container.querySelectorAll('.plato')];
  expect(platos.map((p) => p.dataset.plato)).toEqual(['Croquetas', 'Tortilla']);
  const tortilla = within(platos[1]);
  expect(tortilla.getByText('Agotado')).toBeTruthy();
  expect(tortilla.getByText('4,50 €')).toBeTruthy();
  expect(tortilla.getByText('Huevos')).toBeTruthy();
  expect(within(platos[0]).queryByText('Agotado')).toBeNull();
});

test('Carta: muestra un mensaje si no se puede cargar', async () => {
  render(<AppCarta cargar={() => Promise.reject(new Error('red'))} />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No se ha podido cargar la carta/));
});
