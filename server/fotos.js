import { randomUUID } from 'node:crypto';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorValidacion } from './errores.js';

export const MAX_FOTO = 5 * 1024 * 1024;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const MENSAJE_FORMATO = 'Formato no admitido: solo se admiten fotos JPEG, PNG o WebP.';
export const MENSAJE_TAMANO = 'La foto es demasiado grande: el máximo es 5 MB.';

const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Comprueba el tipo real del fichero por sus primeros bytes ("magic bytes"). */
export function tipoPorContenido(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export function crearAlmacenFotos(dirFotos) {
  mkdirSync(dirFotos, { recursive: true });

  /** Valida y guarda la foto; devuelve el nombre de fichero (nuevo en cada sustitución). */
  function guardar(tipoCabecera, cuerpo) {
    const tipo = (tipoCabecera ?? '').split(';')[0].trim().toLowerCase();
    if (!TIPOS_FOTO.includes(tipo) || !Buffer.isBuffer(cuerpo) || cuerpo.length === 0) {
      throw new ErrorValidacion('foto', MENSAJE_FORMATO);
    }
    if (cuerpo.length > MAX_FOTO) throw new ErrorValidacion('foto', MENSAJE_TAMANO);
    if (tipoPorContenido(cuerpo) !== tipo) throw new ErrorValidacion('foto', MENSAJE_FORMATO);
    const fichero = `${randomUUID()}.${EXTENSION[tipo]}`;
    writeFileSync(join(dirFotos, fichero), cuerpo);
    return fichero;
  }

  function borrar(fichero) {
    if (fichero) rmSync(join(dirFotos, fichero), { force: true });
  }

  return { guardar, borrar };
}
