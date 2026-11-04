// Generador mínimo de PNG (sin dependencias) para las fotos de ejemplo de la semilla.
import { deflateSync } from 'node:zlib';

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** Pseudoaleatorio determinista para que la semilla sea reproducible. */
function aleatorio(semilla) {
  let s = semilla >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/**
 * Crea un PNG de ancho × alto con un degradado del tono indicado y textura en bloques,
 * con un peso parecido al de una foto reducida (decenas de KB).
 */
export function crearPng({ ancho = 800, alto = 600, tono = 30, semilla = 1 } = {}) {
  const azar = aleatorio(semilla);
  const bloqueTam = 6;
  const columnas = Math.ceil(ancho / bloqueTam);
  const filas = Math.ceil(alto / bloqueTam);
  const ruido = Array.from({ length: columnas * filas }, () => Math.floor(azar() * 48) - 24);
  const [r0, g0, b0] = hslARgb(tono, 0.55, 0.55);
  const crudo = Buffer.alloc((ancho * 3 + 1) * alto);
  let i = 0;
  for (let y = 0; y < alto; y++) {
    crudo[i++] = 0; // filtro: ninguno
    const luz = 1 - (y / alto) * 0.45;
    for (let x = 0; x < ancho; x++) {
      const n = ruido[Math.floor(y / bloqueTam) * columnas + Math.floor(x / bloqueTam)];
      crudo[i++] = clamp(r0 * luz + n);
      crudo[i++] = clamp(g0 * luz + n);
      crudo[i++] = clamp(b0 * luz + n);
    }
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(crudo, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function hslARgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
