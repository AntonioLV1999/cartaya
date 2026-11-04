// Catálogo de ejemplo de La Estación (cafetería de barrio). Precios en euros con IVA incluido.
// Cada plato declara sus alérgenos o «sin alérgenos» (obligatorio).

const SIN = { sinAlergenos: true };
const con = (...alergenos) => ({ alergenos });

export const CATALOGO_EJEMPLO = [
  {
    categoria: 'Desayunos',
    platos: [
      { nombre: 'Tostada con tomate', precio: '2,80', descripcion: 'Pan de pueblo con tomate rallado y AOVE', ...con('gluten'), foto: true },
      { nombre: 'Tostada con mantequilla y mermelada', precio: '2,50', ...con('gluten', 'leche') },
      { nombre: 'Churros (6 unidades)', precio: '3,00', descripcion: 'Recién hechos', ...con('gluten'), foto: true },
      { nombre: 'Croissant a la plancha', precio: '2,20', ...con('gluten', 'leche', 'huevos') },
      { nombre: 'Pincho de tortilla', precio: '2,50', descripcion: 'Tortilla de patata con cebolla', ...con('huevos'), foto: true },
    ],
  },
  {
    categoria: 'Bocadillos',
    platos: [
      { nombre: 'Bocadillo de calamares', precio: '5,50', ...con('gluten', 'moluscos', 'huevos'), foto: true },
      { nombre: 'Lomo con queso', precio: '4,50', ...con('gluten', 'leche') },
      { nombre: 'Bocadillo de tortilla', precio: '4,00', ...con('gluten', 'huevos') },
      { nombre: 'Serranito', precio: '5,00', descripcion: 'Lomo, jamón serrano y pimiento frito', ...con('gluten') },
      { nombre: 'Vegetal', precio: '4,20', descripcion: 'Lechuga, tomate, huevo duro y mayonesa', ...con('gluten', 'huevos', 'mostaza') },
    ],
  },
  {
    categoria: 'Raciones',
    platos: [
      { nombre: 'Croquetas caseras', precio: '7,50', descripcion: 'De jamón, 8 unidades', ...con('gluten', 'leche', 'huevos'), foto: true },
      { nombre: 'Patatas bravas', precio: '5,00', ...con('huevos', 'mostaza') },
      { nombre: 'Boquerones en vinagre', precio: '6,50', ...con('pescado', 'sulfitos') },
      { nombre: 'Ensaladilla rusa', precio: '5,50', ...con('huevos', 'pescado') },
      { nombre: 'Gambas al ajillo', precio: '9,50', ...con('crustaceos') },
    ],
  },
  {
    categoria: 'Bebidas',
    platos: [
      { nombre: 'Café solo', precio: '1,30', ...SIN },
      { nombre: 'Café con leche', precio: '1,50', ...con('leche') },
      { nombre: 'Infusión', precio: '1,40', descripcion: 'Manzanilla, poleo o té', ...SIN },
      { nombre: 'Zumo de naranja', precio: '2,80', descripcion: 'Natural, recién exprimido', ...SIN, foto: true },
      { nombre: 'Agua mineral', precio: '1,20', ...SIN },
      { nombre: 'Caña', precio: '1,80', ...con('gluten') },
      { nombre: 'Vino de la casa', precio: '2,20', ...con('sulfitos') },
    ],
  },
  {
    categoria: 'Postres',
    platos: [
      { nombre: 'Flan casero', precio: '3,50', ...con('huevos', 'leche') },
      { nombre: 'Tarta de queso', precio: '4,00', ...con('gluten', 'leche', 'huevos'), foto: true },
      { nombre: 'Arroz con leche', precio: '3,50', ...con('leche') },
    ],
  },
];

const NOMBRES_RENDIMIENTO = [
  'Desayunos', 'Tostadas', 'Bollería', 'Bocadillos', 'Sándwiches',
  'Raciones', 'Tapas', 'Ensaladas', 'Platos combinados', 'Bebidas calientes',
];

/** Variante de rendimiento: 150 platos activos, todos con foto, repartidos en 10 categorías. */
export function catalogoRendimiento() {
  const alergenosRotatorios = [['gluten'], ['leche'], ['huevos', 'gluten'], ['pescado'], null, ['frutos_cascara', 'leche']];
  return NOMBRES_RENDIMIENTO.map((categoria, c) => ({
    categoria,
    platos: Array.from({ length: 15 }, (_, i) => {
      const n = c * 15 + i;
      const alergenos = alergenosRotatorios[n % alergenosRotatorios.length];
      return {
        nombre: `${categoria} ${i + 1}`,
        precio: `${2 + (n % 9)},${String((n * 37) % 100).padStart(2, '0')}`,
        descripcion: 'Plato de ejemplo para medir la carga de la carta con un catálogo grande',
        ...(alergenos ? { alergenos } : SIN),
        foto: true,
      };
    }),
  }));
}
