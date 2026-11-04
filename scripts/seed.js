// Carga un catálogo de ejemplo en una base de datos vacía.
// Uso: npm run seed                     → catálogo de ejemplo de La Estación
//      npm run seed -- --rendimiento     → 150 platos con foto (para medir la carga)
// La carpeta de datos es CARTAYA_DATA_DIR (por defecto ./data).
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { abrirBD } from '../server/db.js';
import { crearCatalogo } from '../server/catalogo.js';
import { crearAlmacenFotos } from '../server/fotos.js';
import { CATALOGO_EJEMPLO, catalogoRendimiento } from './catalogo-ejemplo.js';
import { crearPng } from './png.js';

export function sembrar({ dataDir, rendimiento = false }) {
  const db = abrirBD(join(dataDir, 'cartaya.db'));
  try {
    const n = db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n;
    if (n > 0) throw new Error('La base de datos ya tiene categorías: la semilla solo se carga en una base de datos vacía.');
    const catalogo = crearCatalogo(db);
    const fotos = crearAlmacenFotos(join(dataDir, 'fotos'));
    const datos = rendimiento ? catalogoRendimiento() : CATALOGO_EJEMPLO;
    let platos = 0;
    let conFoto = 0;
    db.transaction(() => {
      for (const [c, { categoria, platos: lista }] of datos.entries()) {
        const cat = catalogo.crearCategoria({ nombre: categoria });
        for (const [i, { foto, ...plato }] of lista.entries()) {
          const creado = catalogo.crearPlato({ ...plato, categoriaId: cat.id });
          platos++;
          if (foto) {
            const png = crearPng({ tono: (c * 47 + i * 13) % 360, semilla: c * 100 + i + 1 });
            catalogo.cambiarFoto(creado.id, fotos.guardar('image/png', png));
            conFoto++;
          }
        }
      }
    })();
    return { categorias: datos.length, platos, conFoto };
  } finally {
    db.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dataDir = resolve(process.env.CARTAYA_DATA_DIR ?? 'data');
  const rendimiento = process.argv.includes('--rendimiento');
  try {
    const r = sembrar({ dataDir, rendimiento });
    console.log(`Semilla cargada en ${dataDir}: ${r.categorias} categorías, ${r.platos} platos (${r.conFoto} con foto).`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
