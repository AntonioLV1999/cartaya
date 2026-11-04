import express from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { verificarPassword } from './password.js';

export const COOKIE = 'cartaya_sesion';
const DIA = 24 * 60 * 60 * 1000;
export const DURACION_SESION = 30 * DIA;
export const MAX_INTENTOS = 5;
export const VENTANA_INTENTOS = 15 * 60 * 1000;

// La huella del token incluye la huella de la contraseña: si se cambia la contraseña
// (CARTAYA_PASSWORD_HASH), ningún token anterior vuelve a encontrarse y todas las sesiones caen.
function huellaToken(token, passwordHash) {
  return createHash('sha256').update(`${passwordHash}:${token}`).digest('hex');
}

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

function horaLocal(ms) {
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

/**
 * Crea las piezas de la sesión de establecimiento.
 * @param {{db: import('better-sqlite3').Database, passwordHash: string, produccion: boolean, ahora: () => number}} opciones
 */
export function crearSesion({ db, passwordHash, produccion, ahora }) {
  const consultas = {
    insertar: db.prepare('INSERT INTO sesiones (token_hash, creada_en, ultimo_uso_en) VALUES (?, ?, ?)'),
    buscar: db.prepare('SELECT ultimo_uso_en FROM sesiones WHERE token_hash = ?'),
    tocar: db.prepare('UPDATE sesiones SET ultimo_uso_en = ? WHERE token_hash = ?'),
    borrar: db.prepare('DELETE FROM sesiones WHERE token_hash = ?'),
    borrarCaducadas: db.prepare('DELETE FROM sesiones WHERE ultimo_uso_en < ?'),
    fallos: db.prepare('SELECT momento FROM intentos_login WHERE ip = ? AND momento > ? ORDER BY momento DESC'),
    registrarFallo: db.prepare('INSERT INTO intentos_login (ip, momento) VALUES (?, ?)'),
    limpiarFallos: db.prepare('DELETE FROM intentos_login WHERE ip = ? OR momento <= ?'),
    limpiarAntiguos: db.prepare('DELETE FROM intentos_login WHERE momento <= ?'),
  };

  function opcionesCookie() {
    return { httpOnly: true, sameSite: 'strict', secure: produccion, path: '/', maxAge: DURACION_SESION };
  }

  /** Devuelve la huella del token si la petición trae una sesión válida (y la renueva). */
  function sesionValida(req) {
    if (!passwordHash) return null;
    const token = leerCookie(req, COOKIE);
    if (!token) return null;
    const huella = huellaToken(token, passwordHash);
    const fila = consultas.buscar.get(huella);
    if (!fila) return null;
    const t = ahora();
    if (t - fila.ultimo_uso_en > DURACION_SESION) {
      consultas.borrar.run(huella);
      return null;
    }
    consultas.tocar.run(t, huella);
    return huella;
  }

  /** Si la IP está bloqueada, devuelve el instante (ms) en que puede volver a intentarlo. */
  function bloqueadaHasta(ip) {
    const t = ahora();
    consultas.limpiarAntiguos.run(t - VENTANA_INTENTOS);
    const fallos = consultas.fallos.all(ip, t - VENTANA_INTENTOS);
    if (fallos.length < MAX_INTENTOS) return null;
    return fallos[0].momento + VENTANA_INTENTOS;
  }

  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({ abierta: Boolean(sesionValida(req)) });
  });

  router.post('/', express.json({ limit: '10kb' }), (req, res) => {
    const ip = req.ip;
    const hasta = bloqueadaHasta(ip);
    if (hasta) {
      return res.status(429).json({
        campo: 'password',
        mensaje: `Demasiados intentos fallidos. Vuelva a intentarlo pasados 15 minutos (a partir de las ${horaLocal(hasta)}).`,
        reintentarEn: new Date(hasta).toISOString(),
      });
    }
    const password = req.body?.password;
    if (!passwordHash || !verificarPassword(password, passwordHash)) {
      consultas.registrarFallo.run(ip, ahora());
      return res.status(401).json({ campo: 'password', mensaje: 'Contraseña incorrecta' });
    }
    const t = ahora();
    consultas.limpiarFallos.run(ip, t - VENTANA_INTENTOS);
    consultas.borrarCaducadas.run(t - DURACION_SESION);
    const token = randomBytes(32).toString('base64url');
    consultas.insertar.run(huellaToken(token, passwordHash), t, t);
    res.cookie(COOKIE, token, opcionesCookie());
    res.json({ abierta: true });
  });

  router.delete('/', (req, res) => {
    const token = leerCookie(req, COOKIE);
    if (token && passwordHash) consultas.borrar.run(huellaToken(token, passwordHash));
    const { maxAge, ...opciones } = opcionesCookie();
    res.clearCookie(COOKIE, opciones);
    res.json({ abierta: false });
  });

  /** Middleware para /api/admin: 401 si no hay sesión de establecimiento. */
  function exigirSesion(req, res, next) {
    if (!sesionValida(req)) {
      return res.status(401).json({ campo: null, mensaje: 'Inicie sesión para gestionar la carta.' });
    }
    next();
  }

  return { router, exigirSesion };
}
