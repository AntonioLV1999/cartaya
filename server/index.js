import { join, resolve } from 'node:path';
import { abrirBD } from './db.js';
import { crearApp } from './app.js';
import { huellaValida } from './password.js';

const dataDir = resolve(process.env.CARTAYA_DATA_DIR ?? 'data');
const puerto = Number(process.env.PORT ?? 3000);
const passwordHash = process.env.CARTAYA_PASSWORD_HASH ?? '';
const produccion = process.env.NODE_ENV === 'production';

if (!huellaValida(passwordHash)) {
  console.warn(
    'Aviso: CARTAYA_PASSWORD_HASH no está configurada o no es válida; no se podrá entrar en la administración.\n' +
      'Genérela con "npm run hash-password" (véase el README).',
  );
}

const trustProxy = process.env.CARTAYA_TRUST_PROXY;
const db = abrirBD(join(dataDir, 'cartaya.db'));
const app = crearApp({
  db,
  passwordHash,
  dataDir,
  produccion,
  trustProxy: trustProxy === undefined ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
});

app.listen(puerto, () => {
  console.log(`CartaYa escuchando en http://localhost:${puerto} (datos en ${dataDir})`);
});
