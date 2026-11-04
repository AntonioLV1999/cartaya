// Tras `vite build`: genera una copia .br (brotli calidad 11) y .gz (gzip nivel 9) de cada JS y CSS
// de web/dist/assets. Express sirve la que acepte el navegador (server/estaticos.js).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const ASSETS = 'web/dist/assets';

let n = 0;
for (const nombre of readdirSync(ASSETS)) {
  if (!/\.(js|css)$/.test(nombre)) continue;
  const ruta = join(ASSETS, nombre);
  const datos = readFileSync(ruta);
  writeFileSync(`${ruta}.br`, brotliCompressSync(datos, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: datos.length },
  }));
  writeFileSync(`${ruta}.gz`, gzipSync(datos, { level: 9 }));
  n++;
}
console.log(`Precomprimidos ${n} ficheros JS/CSS (.br y .gz).`);
