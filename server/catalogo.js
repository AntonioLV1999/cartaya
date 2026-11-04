import { CODIGOS_ALERGENOS } from './alergenos.js';
import { eurosACentimos } from './precio.js';
import { ErrorValidacion, NoEncontrado } from './errores.js';

export const MAX_DESCRIPCION = 140;

const normalizar = (texto) => texto.trim().toLocaleLowerCase('es-ES');
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

/**
 * Servicio del catálogo: categorías y platos con orden, agotado, archivado y recuperación.
 * Nunca borra filas: archivar pone la fecha en `archivada_en` / `archivado_en`.
 */
export function crearCatalogo(db, { ahora = () => Date.now() } = {}) {
  const fecha = () => new Date(ahora()).toISOString();

  // ---------- Categorías ----------

  const q = {
    categoria: db.prepare('SELECT * FROM categorias WHERE id = ?'),
    categoriasActivas: db.prepare(`
      SELECT c.id, c.nombre, c.posicion,
        (SELECT COUNT(*) FROM platos p WHERE p.categoria_id = c.id AND p.archivado_en IS NULL) AS platos_activos
      FROM categorias c WHERE c.archivada_en IS NULL ORDER BY c.posicion, c.id`),
    nombresActivos: db.prepare('SELECT id, nombre FROM categorias WHERE archivada_en IS NULL'),
    siguientePosCategoria: db.prepare('SELECT COALESCE(MAX(posicion), 0) + 1 AS p FROM categorias WHERE archivada_en IS NULL'),
    insertarCategoria: db.prepare('INSERT INTO categorias (nombre, posicion) VALUES (?, ?)'),
    renombrarCategoria: db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?'),
    posCategoria: db.prepare('UPDATE categorias SET posicion = ? WHERE id = ?'),
    archivarCategoria: db.prepare('UPDATE categorias SET archivada_en = ? WHERE id = ?'),
    recuperarCategoria: db.prepare('UPDATE categorias SET archivada_en = NULL, posicion = ? WHERE id = ?'),
    categoriasArchivadas: db.prepare('SELECT id, nombre, archivada_en FROM categorias WHERE archivada_en IS NOT NULL ORDER BY archivada_en DESC, id'),

    plato: db.prepare('SELECT * FROM platos WHERE id = ?'),
    alergenosDe: db.prepare('SELECT alergeno FROM plato_alergenos WHERE plato_id = ?'),
    platosActivos: db.prepare(`
      SELECT p.* FROM platos p JOIN categorias c ON c.id = p.categoria_id
      WHERE p.archivado_en IS NULL AND c.archivada_en IS NULL
      ORDER BY c.posicion, c.id, p.posicion, p.id`),
    platosActivosDe: db.prepare('SELECT * FROM platos WHERE categoria_id = ? AND archivado_en IS NULL ORDER BY posicion, id'),
    siguientePosPlato: db.prepare('SELECT COALESCE(MAX(posicion), 0) + 1 AS p FROM platos WHERE categoria_id = ? AND archivado_en IS NULL'),
    insertarPlato: db.prepare(`
      INSERT INTO platos (categoria_id, nombre, precio_centimos, descripcion, sin_alergenos, agotado, posicion)
      VALUES (@categoriaId, @nombre, @precioCentimos, @descripcion, @sinAlergenos, @agotado, @posicion)`),
    actualizarPlato: db.prepare(`
      UPDATE platos SET categoria_id = @categoriaId, nombre = @nombre, precio_centimos = @precioCentimos,
        descripcion = @descripcion, sin_alergenos = @sinAlergenos, agotado = @agotado, posicion = @posicion
      WHERE id = @id`),
    borrarAlergenos: db.prepare('DELETE FROM plato_alergenos WHERE plato_id = ?'),
    insertarAlergeno: db.prepare('INSERT INTO plato_alergenos (plato_id, alergeno) VALUES (?, ?)'),
    posPlato: db.prepare('UPDATE platos SET posicion = ? WHERE id = ?'),
    archivarPlato: db.prepare('UPDATE platos SET archivado_en = ? WHERE id = ?'),
    recuperarPlato: db.prepare('UPDATE platos SET archivado_en = NULL, agotado = 0, categoria_id = ?, posicion = ? WHERE id = ?'),
    fotoPlato: db.prepare('UPDATE platos SET foto = ? WHERE id = ?'),
    platosArchivados: db.prepare(`
      SELECT p.id, p.nombre, p.categoria_id, p.archivado_en, c.nombre AS categoria_nombre,
        c.archivada_en IS NOT NULL AS categoria_archivada
      FROM platos p JOIN categorias c ON c.id = p.categoria_id
      WHERE p.archivado_en IS NOT NULL ORDER BY p.archivado_en DESC, p.id`),
  };

  function categoriaActiva(id) {
    const c = q.categoria.get(id);
    if (!c || c.archivada_en) throw new NoEncontrado('La categoría no existe.');
    return c;
  }

  function validarNombreCategoria(nombre, excluirId = null) {
    if (typeof nombre !== 'string' || !nombre.trim()) {
      throw new ErrorValidacion('nombre', 'El nombre es obligatorio.');
    }
    const clave = normalizar(nombre);
    const repetida = q.nombresActivos.all().some((c) => c.id !== excluirId && normalizar(c.nombre) === clave);
    if (repetida) throw new ErrorValidacion('nombre', 'Ya existe una categoría con ese nombre.');
    return nombre.trim();
  }

  function aCategoria(fila) {
    return { id: fila.id, nombre: fila.nombre, platosActivos: fila.platos_activos ?? 0 };
  }

  const listarCategorias = () => q.categoriasActivas.all().map(aCategoria);

  const crearCategoria = db.transaction(({ nombre } = {}) => {
    const limpio = validarNombreCategoria(nombre);
    const { lastInsertRowid } = q.insertarCategoria.run(limpio, q.siguientePosCategoria.get().p);
    return aCategoria(q.categoriasActivas.all().find((c) => c.id === Number(lastInsertRowid)));
  });

  const renombrarCategoria = db.transaction((id, { nombre } = {}) => {
    categoriaActiva(id);
    q.renombrarCategoria.run(validarNombreCategoria(nombre, id), id);
    return aCategoria(q.categoriasActivas.all().find((c) => c.id === id));
  });

  /** Intercambia la posición con la vecina (delta -1 sube, +1 baja). En los extremos no hace nada. */
  function mover(lista, id, delta, actualizar) {
    const i = lista.findIndex((x) => x.id === id);
    if (i === -1) throw new NoEncontrado();
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    // Se renumera todo el ámbito para que las posiciones queden siempre consecutivas.
    [lista[i], lista[j]] = [lista[j], lista[i]];
    lista.forEach((x, k) => actualizar.run(k + 1, x.id));
  }

  const moverCategoria = db.transaction((id, delta) => {
    categoriaActiva(id);
    mover(q.categoriasActivas.all(), id, delta, q.posCategoria);
    return listarCategorias();
  });

  const archivarCategoria = db.transaction((id) => {
    categoriaActiva(id);
    const n = q.platosActivosDe.all(id).length;
    if (n > 0) {
      throw new ErrorValidacion(
        null,
        `No se puede eliminar: primero archive o mueva ${plural(n, 'su plato', `sus ${n} platos`)}.`,
      );
    }
    q.archivarCategoria.run(fecha(), id);
  });

  const recuperarCategoria = db.transaction((id) => {
    const c = q.categoria.get(id);
    if (!c) throw new NoEncontrado('La categoría no existe.');
    if (!c.archivada_en) throw new ErrorValidacion(null, 'La categoría no está archivada.');
    validarNombreCategoria(c.nombre, id);
    q.recuperarCategoria.run(q.siguientePosCategoria.get().p, id);
    return aCategoria(q.categoriasActivas.all().find((x) => x.id === id));
  });

  // ---------- Platos ----------

  function aPlato(fila) {
    return {
      id: fila.id,
      categoriaId: fila.categoria_id,
      nombre: fila.nombre,
      precioCentimos: fila.precio_centimos,
      descripcion: fila.descripcion,
      foto: fila.foto ? `/fotos/${fila.foto}` : null,
      alergenos: ordenarAlergenos(q.alergenosDe.all(fila.id).map((a) => a.alergeno)),
      sinAlergenos: fila.sin_alergenos === 1,
      agotado: fila.agotado === 1,
    };
  }

  function ordenarAlergenos(codigos) {
    return CODIGOS_ALERGENOS.filter((c) => codigos.includes(c));
  }

  function platoExistente(id) {
    const p = q.plato.get(id);
    if (!p) throw new NoEncontrado('El plato no existe.');
    return p;
  }

  function platoActivo(id) {
    const p = platoExistente(id);
    if (p.archivado_en) throw new NoEncontrado('El plato no existe.');
    return p;
  }

  /** Valida todos los campos de un plato ya combinado (existente + cambios). */
  function validarPlato(datos) {
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    if (!nombre) throw new ErrorValidacion('nombre', 'El nombre es obligatorio.');

    const precioCentimos = datos.precioCentimos ?? eurosACentimos(datos.precio);
    if (!Number.isInteger(precioCentimos) || precioCentimos <= 0) {
      throw new ErrorValidacion('precio', 'El precio no es válido: debe ser mayor que 0 € y tener como mucho dos decimales.');
    }

    const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';
    if ([...descripcion].length > MAX_DESCRIPCION) {
      throw new ErrorValidacion('descripcion', `La descripción admite como máximo ${MAX_DESCRIPCION} caracteres.`);
    }

    if (datos.categoriaId == null) throw new ErrorValidacion('categoriaId', 'Elija una categoría.');
    const categoria = q.categoria.get(Number(datos.categoriaId));
    if (!categoria || categoria.archivada_en) throw new ErrorValidacion('categoriaId', 'Elija una categoría.');

    const alergenos = Array.isArray(datos.alergenos) ? [...new Set(datos.alergenos)] : [];
    if (alergenos.some((a) => !CODIGOS_ALERGENOS.includes(a))) {
      throw new ErrorValidacion('alergenos', 'Hay un alérgeno que no está en la lista de los 14 obligatorios.');
    }
    const sinAlergenos = datos.sinAlergenos === true;
    if (sinAlergenos && alergenos.length > 0) {
      throw new ErrorValidacion('alergenos', 'La declaración es contradictoria: ha marcado «Sin alérgenos» y también algún alérgeno.');
    }
    if (!sinAlergenos && alergenos.length === 0) {
      throw new ErrorValidacion('alergenos', 'Debe declarar los alérgenos del plato o marcar «Sin alérgenos».');
    }

    return {
      nombre,
      precioCentimos,
      descripcion,
      categoriaId: categoria.id,
      alergenos,
      sinAlergenos: sinAlergenos ? 1 : 0,
      agotado: datos.agotado === true ? 1 : 0,
    };
  }

  function guardarAlergenos(platoId, alergenos) {
    q.borrarAlergenos.run(platoId);
    for (const a of alergenos) q.insertarAlergeno.run(platoId, a);
  }

  function listarPlatos({ categoriaId } = {}) {
    const filas = categoriaId != null ? q.platosActivosDe.all(Number(categoriaId)) : q.platosActivos.all();
    return filas.map(aPlato);
  }

  const crearPlato = db.transaction((datos = {}) => {
    const v = validarPlato({ ...datos, agotado: false });
    const posicion = q.siguientePosPlato.get(v.categoriaId).p;
    const { lastInsertRowid } = q.insertarPlato.run({ ...v, posicion });
    const id = Number(lastInsertRowid);
    guardarAlergenos(id, v.alergenos);
    return aPlato(q.plato.get(id));
  });

  const CAMPOS_EDITABLES = ['nombre', 'precio', 'descripcion', 'categoriaId', 'alergenos', 'sinAlergenos', 'agotado'];

  const editarPlato = db.transaction((id, cambios = {}) => {
    const actual = aPlato(platoActivo(id));
    const fila = q.plato.get(id);
    const combinado = { ...actual, precioCentimos: undefined, precio: undefined };
    for (const campo of CAMPOS_EDITABLES) if (campo in cambios) combinado[campo] = cambios[campo];
    if (!('precio' in cambios)) combinado.precioCentimos = actual.precioCentimos;
    if ('agotado' in cambios && typeof cambios.agotado !== 'boolean') {
      throw new ErrorValidacion('agotado', 'Indique si el plato está agotado o disponible.');
    }
    const v = validarPlato(combinado);
    // Al cambiar de categoría, el plato pasa al final de la nueva.
    const posicion = v.categoriaId === fila.categoria_id ? fila.posicion : q.siguientePosPlato.get(v.categoriaId).p;
    q.actualizarPlato.run({ ...v, posicion, id });
    guardarAlergenos(id, v.alergenos);
    return aPlato(q.plato.get(id));
  });

  const moverPlato = db.transaction((id, delta) => {
    const p = platoActivo(id);
    mover(q.platosActivosDe.all(p.categoria_id), id, delta, q.posPlato);
    return listarPlatos({ categoriaId: p.categoria_id });
  });

  const archivarPlato = db.transaction((id) => {
    platoActivo(id);
    q.archivarPlato.run(fecha(), id);
  });

  const recuperarPlato = db.transaction((id, { categoriaId } = {}) => {
    const p = platoExistente(id);
    if (!p.archivado_en) throw new ErrorValidacion(null, 'El plato no está archivado.');
    let destino;
    if (categoriaId != null) {
      const c = q.categoria.get(Number(categoriaId));
      if (!c || c.archivada_en) throw new ErrorValidacion('categoriaId', 'Elija una categoría activa para recuperar el plato.');
      destino = c.id;
    } else {
      const c = q.categoria.get(p.categoria_id);
      if (c.archivada_en) {
        throw new ErrorValidacion('categoriaId', `Su categoría «${c.nombre}» está archivada: elija una categoría activa para recuperar el plato.`);
      }
      destino = c.id;
    }
    q.recuperarPlato.run(destino, q.siguientePosPlato.get(destino).p, id);
    return aPlato(q.plato.get(id));
  });

  function listarArchivados() {
    return {
      categorias: q.categoriasArchivadas.all().map((c) => ({ id: c.id, nombre: c.nombre })),
      platos: q.platosArchivados.all().map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoriaId: p.categoria_id,
        categoriaNombre: p.categoria_nombre,
        categoriaArchivada: p.categoria_archivada === 1,
      })),
    };
  }

  /** Cambia la foto del plato y devuelve el nombre de fichero anterior (para borrarlo). */
  const cambiarFoto = db.transaction((id, fichero) => {
    const p = platoActivo(id);
    q.fotoPlato.run(fichero, id);
    return { anterior: p.foto, plato: aPlato(q.plato.get(id)) };
  });

  return {
    listarCategorias,
    crearCategoria,
    renombrarCategoria,
    subirCategoria: (id) => moverCategoria(id, -1),
    bajarCategoria: (id) => moverCategoria(id, +1),
    archivarCategoria,
    recuperarCategoria,
    listarPlatos,
    crearPlato,
    editarPlato,
    subirPlato: (id) => moverPlato(id, -1),
    bajarPlato: (id) => moverPlato(id, +1),
    archivarPlato,
    recuperarPlato,
    listarArchivados,
    cambiarFoto,
  };
}
