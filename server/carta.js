/**
 * Carta pública: categorías activas con al menos un plato activo (agotado o no),
 * en el orden del dueño, con sus platos activos en orden manual.
 */
export function obtenerCarta(catalogo) {
  const platos = catalogo.listarPlatos();
  const porCategoria = new Map();
  for (const p of platos) {
    if (!porCategoria.has(p.categoriaId)) porCategoria.set(p.categoriaId, []);
    porCategoria.get(p.categoriaId).push({
      id: p.id,
      nombre: p.nombre,
      precioCentimos: p.precioCentimos,
      descripcion: p.descripcion,
      foto: p.foto,
      alergenos: p.alergenos,
      sinAlergenos: p.sinAlergenos,
      agotado: p.agotado,
    });
  }
  return {
    categorias: catalogo
      .listarCategorias()
      .filter((c) => porCategoria.has(c.id))
      .map((c) => ({ id: c.id, nombre: c.nombre, platos: porCategoria.get(c.id) })),
  };
}
