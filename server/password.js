import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Formato de la huella: scrypt$N$r$p$<sal base64>$<hash base64>
const N = 16384;
const R = 8;
const P = 1;
const LONGITUD = 32;

export function hashPassword(password) {
  const sal = randomBytes(16);
  const hash = scryptSync(password, sal, LONGITUD, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

export function verificarPassword(password, huella) {
  if (typeof password !== 'string' || typeof huella !== 'string') return false;
  const partes = huella.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = scryptSync(password, Buffer.from(salB64, 'base64'), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export function huellaValida(huella) {
  return typeof huella === 'string' && /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/.test(huella);
}
