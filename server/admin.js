import express from 'express';
import { MAX_FOTO, TIPOS_FOTO, MENSAJE_FORMATO } from './fotos.js';
import { ErrorValidacion } from './errores.js';
import { svgQR, urlMesa } from './qr.js';

const id = (req) => Number(req.params.id);

/** Rutas de /api/admin. Se montan detrás del middleware que exige sesión. */
export function crearRutasAdmin({ catalogo, fotos, mesas, urlPublica }) {
  const r = express.Router();

  // Las rutas de administración solo aceptan JSON (las fotos, image/*): refuerza SameSite contra CSRF.
  r.use((req, res, next) => {
    if (!['POST', 'PATCH', 'PUT'].includes(req.method) || req.path.endsWith('/foto')) return next();
    if (!req.is('application/json')) {
      return res.status(415).json({ campo: null, mensaje: 'Las peticiones deben enviarse en formato JSON.' });
    }
    next();
  });
  r.use(express.json({ limit: '50kb' }));

  // ---------- Categorías ----------
  r.get('/categorias', (req, res) => res.json(catalogo.listarCategorias()));
  r.post('/categorias', (req, res) => res.status(201).json(catalogo.crearCategoria(req.body)));
  r.patch('/categorias/:id', (req, res) => res.json(catalogo.renombrarCategoria(id(req), req.body)));
  r.post('/categorias/:id/subir', (req, res) => res.json(catalogo.subirCategoria(id(req))));
  r.post('/categorias/:id/bajar', (req, res) => res.json(catalogo.bajarCategoria(id(req))));
  r.post('/categorias/:id/archivar', (req, res) => {
    catalogo.archivarCategoria(id(req));
    res.status(204).end();
  });
  r.post('/categorias/:id/recuperar', (req, res) => res.json(catalogo.recuperarCategoria(id(req))));

  // ---------- Platos ----------
  r.get('/platos', (req, res) => res.json(catalogo.listarPlatos({ categoriaId: req.query.categoriaId })));
  r.post('/platos', (req, res) => res.status(201).json(catalogo.crearPlato(req.body)));
  r.patch('/platos/:id', (req, res) => res.json(catalogo.editarPlato(id(req), req.body)));
  r.post('/platos/:id/subir', (req, res) => res.json(catalogo.subirPlato(id(req))));
  r.post('/platos/:id/bajar', (req, res) => res.json(catalogo.bajarPlato(id(req))));
  r.post('/platos/:id/archivar', (req, res) => {
    catalogo.archivarPlato(id(req));
    res.status(204).end();
  });
  r.post('/platos/:id/recuperar', (req, res) => res.json(catalogo.recuperarPlato(id(req), req.body)));

  r.put(
    '/platos/:id/foto',
    express.raw({ type: TIPOS_FOTO, limit: MAX_FOTO }),
    (req, res) => {
      if (!req.is(TIPOS_FOTO)) throw new ErrorValidacion('foto', MENSAJE_FORMATO);
      const fichero = fotos.guardar(req.get('content-type'), req.body);
      try {
        const { anterior, plato } = catalogo.cambiarFoto(id(req), fichero);
        fotos.borrar(anterior);
        res.json(plato);
      } catch (e) {
        fotos.borrar(fichero);
        throw e;
      }
    },
  );
  r.delete('/platos/:id/foto', (req, res) => {
    const { anterior, plato } = catalogo.cambiarFoto(id(req), null);
    fotos.borrar(anterior);
    res.json(plato);
  });

  // ---------- Archivados ----------
  r.get('/archivados', (req, res) => res.json(catalogo.listarArchivados()));

  // ---------- Mesas ----------
  // Sin CARTAYA_URL_PUBLICA se usa el origen de la petición (válido en desarrollo).
  const base = (req) => urlPublica || `${req.protocol}://${req.get('host')}`;
  const conUrl = (req, m) => ({ ...m, url: urlMesa(base(req), m.codigo) });
  r.get('/mesas', (req, res) => res.json(mesas.listar().map((m) => conUrl(req, m))));
  r.post('/mesas', (req, res) => res.status(201).json(conUrl(req, mesas.crear(req.body))));
  r.patch('/mesas/:id', (req, res) => res.json(conUrl(req, mesas.renombrar(id(req), req.body))));
  r.post('/mesas/:id/archivar', (req, res) => {
    mesas.archivar(id(req));
    res.status(204).end();
  });
  r.get('/mesas/:id/qr.svg', (req, res) => {
    const m = mesas.mesaActiva(id(req));
    res.set('Cache-Control', 'private, no-cache').type('image/svg+xml').send(svgQR(urlMesa(base(req), m.codigo)));
  });

  return r;
}
