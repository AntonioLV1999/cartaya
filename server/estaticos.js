import { existsSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

const TIPOS = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const VARIANTES = [
  ['br', '.br'],
  ['gzip', '.gz'],
];

/**
 * Sirve la versión precomprimida (.br o .gz, generada en el build) de los JS y CSS de /assets
 * según `Accept-Encoding`. Si no hay variante aceptable, pasa al siguiente middleware
 * (express.static + compression).
 */
export function estaticosPrecomprimidos(distDir) {
  const raiz = normalize(join(distDir, 'assets'));
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const tipo = TIPOS[req.path.slice(req.path.lastIndexOf('.'))];
    if (!tipo) return next();
    const fichero = normalize(join(raiz, decodeURIComponent(req.path)));
    if (!fichero.startsWith(raiz + sep)) return next();
    res.vary('Accept-Encoding');
    for (const [codificacion, extension] of VARIANTES) {
      if (req.acceptsEncodings(codificacion, 'identity') !== codificacion) continue;
      if (!existsSync(fichero + extension)) continue;
      res.set({
        'Content-Type': tipo,
        'Content-Encoding': codificacion,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return res.sendFile(fichero + extension);
    }
    next();
  };
}
