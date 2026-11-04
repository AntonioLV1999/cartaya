// Utilidades de precio compartidas entre el servidor y el frontend (web/).
// Los precios se guardan en céntimos enteros para evitar errores de coma flotante.

const formato = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** 350 → "3,50 €" */
export function formatearPrecio(centimos) {
  // Intl separa importe y símbolo con un espacio duro; lo normalizamos a espacio simple.
  return formato.format(centimos / 100).replace(/ /g, ' ');
}

/**
 * Convierte un precio en euros escrito por el dueño ("4,50", "4.5", "4") a céntimos.
 * Devuelve null si no es un precio válido (> 0 € y como mucho dos decimales).
 */
export function eurosACentimos(valor) {
  if (typeof valor === 'number') valor = String(valor);
  if (typeof valor !== 'string') return null;
  const texto = valor.trim().replace(/\s*€$/, '');
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(texto);
  if (!m) return null;
  const centimos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return centimos > 0 ? centimos : null;
}

/** 450 → "4,50" (para rellenar el campo del formulario) */
export function centimosATexto(centimos) {
  return (centimos / 100).toFixed(2).replace('.', ',');
}
