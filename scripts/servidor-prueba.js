// Servidor para los tests e2e y de rendimiento: carpeta de datos temporal, semilla y contraseña conocida.
// Uso: node scripts/servidor-prueba.js [--puerto 4321] [--rendimiento] [--retraso-fotos 3000]
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirBD } from '../server/db.js';
import { crearApp } from '../server/app.js';
import { hashPassword } from '../server/password.js';
import { sembrar } from './seed.js';

export const PASSWORD_PRUEBA = 'prueba-e2e-2026';

export function arrancarServidorPrueba({ puerto = 4321, rendimiento = false, retrasoFotos = 0 } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'cartaya-prueba-'));
  sembrar({ dataDir, rendimiento });
  const db = abrirBD(join(dataDir, 'cartaya.db'));
  const app = crearApp({ db, passwordHash: hashPassword(PASSWORD_PRUEBA), dataDir });
  const raiz = express();
  if (retrasoFotos > 0) {
    // Simula fotos que tardan en servirse (escenario «Las fotos no bloquean el texto»).
    raiz.use('/fotos', (req, res, next) => setTimeout(next, retrasoFotos));
  }
  raiz.use(app);
  return new Promise((resolver) => {
    const servidor = raiz.listen(puerto, () => {
      resolver({
        url: `http://localhost:${puerto}`,
        cerrar: () =>
          new Promise((ok) => {
            servidor.closeAllConnections?.();
            servidor.close(() => {
              db.close();
              rmSync(dataDir, { recursive: true, force: true });
              ok();
            });
          }),
      });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (nombre, defecto) => {
    const i = process.argv.indexOf(nombre);
    return i === -1 ? defecto : process.argv[i + 1];
  };
  const s = await arrancarServidorPrueba({
    puerto: Number(arg('--puerto', 4321)),
    rendimiento: process.argv.includes('--rendimiento'),
    retrasoFotos: Number(arg('--retraso-fotos', 0)),
  });
  console.log(`Servidor de prueba en ${s.url}`);
  const salir = async () => {
    await s.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', salir);
  process.on('SIGTERM', salir);
}
