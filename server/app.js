import express from 'express';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearSesion } from './sesion.js';
import { crearCatalogo } from './catalogo.js';
import { obtenerCarta } from './carta.js';
import { crearAlmacenFotos, MENSAJE_TAMANO } from './fotos.js';
import { crearRutasAdmin } from './admin.js';
import { ErrorValidacion } from './errores.js';

const DIST = fileURLToPath(new URL('../web/dist', import.meta.url));

/**
 * Crea la aplicación Express. Exportable para los tests (supertest), sin escuchar en ningún puerto.
 * @param {object} opciones
 * @param {import('better-sqlite3').Database} opciones.db
 * @param {string} opciones.passwordHash   huella scrypt de la contraseña de establecimiento
 * @param {string} opciones.dataDir        carpeta de datos (contiene fotos/)
 * @param {boolean} [opciones.produccion]  activa la cookie Secure
 * @param {() => number} [opciones.ahora]  reloj inyectable para los tests
 * @param {string} [opciones.distDir]      estáticos del frontend compilado
 * @param {string|boolean|number} [opciones.trustProxy]
 */
export function crearApp({
  db,
  passwordHash,
  dataDir,
  produccion = false,
  ahora = () => Date.now(),
  distDir = DIST,
  trustProxy = false,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(compression());

  const catalogo = crearCatalogo(db, { ahora });
  const sesion = crearSesion({ db, passwordHash, produccion, ahora });
  const dirFotos = join(dataDir, 'fotos');
  const fotos = crearAlmacenFotos(dirFotos);

  // ---------- API ----------
  app.get('/api/carta', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.json(obtenerCarta(catalogo));
  });
  app.use('/api/sesion', sesion.router);
  app.use('/api/admin', sesion.exigirSesion, crearRutasAdmin({ catalogo, fotos }));
  app.use('/api', (req, res) => res.status(404).json({ campo: null, mensaje: 'No se ha encontrado.' }));

  // ---------- Fotos (nombre nuevo en cada sustitución: caché inmutable) ----------
  app.use('/fotos', express.static(dirFotos, { immutable: true, maxAge: '365d', index: false, fallthrough: false }));

  // ---------- Páginas ----------
  const pagina = (nombre) => (req, res) => {
    const fichero = join(distDir, nombre);
    if (!existsSync(fichero)) {
      return res.status(200).type('html').send(`<!doctype html><meta charset="utf-8"><title>CartaYa</title>
<p>Falta compilar el frontend: ejecute <code>npm run build</code>.</p>`);
    }
    res.set('Cache-Control', 'no-cache');
    res.sendFile(fichero);
  };
  app.get(['/', '/carta', '/mesa/:id'], pagina('carta.html'));
  app.get('/admin', pagina('admin.html'));
  app.use(express.static(distDir, { index: false, immutable: true, maxAge: '365d' }));

  // ---------- Errores ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErrorValidacion) {
      return res.status(err.status).json({ campo: err.campo, mensaje: err.mensaje });
    }
    if (err.type === 'entity.too.large' && req.path.endsWith('/foto')) {
      return res.status(422).json({ campo: 'foto', mensaje: MENSAJE_TAMANO });
    }
    if (err.status === 404 || err.statusCode === 404) return res.status(404).end();
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ campo: null, mensaje: 'La petición no es válida.' });
    }
    // Nunca se registra el cuerpo de la petición (podría contener la contraseña).
    console.error(`Error en ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ campo: null, mensaje: 'Ha ocurrido un error. Inténtelo de nuevo.' });
  });

  return app;
}
