// Validación y reducción de la foto en el propio móvil antes de subirla.

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FOTO = 5 * 1024 * 1024;
export const LADO_MAXIMO = 800;
export const MENSAJE_FORMATO = 'Formato no admitido: solo se admiten fotos JPEG, PNG o WebP.';
export const MENSAJE_TAMANO = 'La foto es demasiado grande: el máximo es 5 MB.';

/** Devuelve el mensaje de error o null si la foto es válida. */
export function validarFoto(fichero) {
  if (!fichero || !TIPOS_FOTO.includes(fichero.type)) return MENSAJE_FORMATO;
  if (fichero.size > MAX_FOTO) return MENSAJE_TAMANO;
  return null;
}

/**
 * Reduce la foto a 800 px de lado mayor en WebP (calidad 0,8) con <canvas>.
 * Si el navegador no puede (sin createImageBitmap, sin canvas o sin WebP), devuelve el original.
 */
export async function reducirFoto(fichero) {
  try {
    if (typeof createImageBitmap !== 'function') return fichero;
    const imagen = await createImageBitmap(fichero);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return fichero;
    ctx.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close?.();
    const reducida = await new Promise((ok) => lienzo.toBlob(ok, 'image/webp', 0.8));
    // Navegadores sin codificador WebP devuelven PNG o nada: se sube el original ya validado.
    if (!reducida || reducida.type !== 'image/webp') return fichero;
    return reducida.size < fichero.size ? reducida : fichero;
  } catch {
    return fichero;
  }
}
