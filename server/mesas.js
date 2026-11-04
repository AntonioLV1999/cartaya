import { randomBytes } from 'node:crypto';
import { ErrorValidacion, NoEncontrado } from './errores.js';

export const MAX_NOMBRE_MESA = 30;
export const LONGITUD_CODIGO = 10;
// Sin 0/o ni 1/l/i para que el código pueda dictarse sin confusiones: 31 símbolos, ~49 bits con 10 caracteres.
const ALFABETO = '23456789abcdefghjkmnpqrstuvwxyz';

const normalizar = (texto) => texto.trim().toLocaleLowerCase('es-ES');

/** Código de mesa aleatorio y no adivinable (no deriva del nombre ni del orden de creación). */
export function generarCodigo() {
  // Rechazo de los bytes ≥ 248 (8 × 31) para que cada símbolo sea equiprobable.
  let codigo = '';
  while (codigo.length < LONGITUD_CODIGO) {
    for (const b of randomBytes(LONGITUD_CODIGO * 2)) {
      if (b < 248 && codigo.length < LONGITUD_CODIGO) codigo += ALFABETO[b % 31];
    }
  }
  return codigo;
}

/**
 * Servicio de mesas. Las mesas nunca se borran: archivar pone la fecha en `archivada_en`.
 * Un código de mesa nunca se reasigna ni cambia (renombrar conserva el QR impreso).
 */
export function crearMesas(db, { ahora = () => Date.now(), generar = generarCodigo } = {}) {
  const q = {
    mesa: db.prepare('SELECT * FROM mesas WHERE id = ?'),
    porCodigo: db.prepare('SELECT * FROM mesas WHERE codigo = ?'),
    activas: db.prepare('SELECT * FROM mesas WHERE archivada_en IS NULL ORDER BY id'),
    insertar: db.prepare('INSERT INTO mesas (nombre, codigo) VALUES (?, ?)'),
    renombrar: db.prepare('UPDATE mesas SET nombre = ? WHERE id = ?'),
    archivar: db.prepare('UPDATE mesas SET archivada_en = ? WHERE id = ?'),
  };

  const aMesa = (f) => ({ id: f.id, nombre: f.nombre, codigo: f.codigo });

  function validarNombre(nombre, excluirId = null) {
    if (typeof nombre !== 'string' || !nombre.trim()) {
      throw new ErrorValidacion('nombre', 'El nombre es obligatorio.');
    }
    const limpio = nombre.trim();
    if ([...limpio].length > MAX_NOMBRE_MESA) {
      throw new ErrorValidacion('nombre', `El nombre admite como máximo ${MAX_NOMBRE_MESA} caracteres.`);
    }
    const clave = normalizar(limpio);
    if (q.activas.all().some((m) => m.id !== excluirId && normalizar(m.nombre) === clave)) {
      throw new ErrorValidacion('nombre', 'Ya existe una mesa con ese nombre.');
    }
    return limpio;
  }

  function mesaActiva(id) {
    const m = q.mesa.get(id);
    if (!m || m.archivada_en) throw new NoEncontrado('La mesa no existe.');
    return m;
  }

  const listar = () => q.activas.all().map(aMesa);

  const crear = db.transaction(({ nombre } = {}) => {
    const limpio = validarNombre(nombre);
    // UNIQUE(codigo) incluye las archivadas: un código nunca se reutiliza.
    let codigo = generar();
    while (q.porCodigo.get(codigo)) codigo = generar();
    const { lastInsertRowid } = q.insertar.run(limpio, codigo);
    return aMesa(q.mesa.get(Number(lastInsertRowid)));
  });

  const renombrar = db.transaction((id, { nombre } = {}) => {
    mesaActiva(id);
    q.renombrar.run(validarNombre(nombre, id), id);
    return aMesa(q.mesa.get(id));
  });

  const archivar = db.transaction((id) => {
    mesaActiva(id);
    q.archivar.run(new Date(ahora()).toISOString(), id);
  });

  /** Mesa por su código, activa o archivada (null si no existe). */
  function buscarPorCodigo(codigo) {
    if (typeof codigo !== 'string') return null;
    const m = q.porCodigo.get(codigo);
    return m ? { ...aMesa(m), archivada: Boolean(m.archivada_en) } : null;
  }

  return { listar, crear, renombrar, archivar, buscarPorCodigo, mesaActiva: (id) => aMesa(mesaActiva(id)) };
}
