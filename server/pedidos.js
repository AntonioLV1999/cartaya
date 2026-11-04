import { randomBytes } from 'node:crypto';
import { ErrorValidacion, ErrorCartaCambiada, NoEncontrado } from './errores.js';
import {
  ESTADO_INICIAL,
  MAX_CANTIDAD,
  MAX_LINEAS,
  MAX_NOTA,
  MENSAJE_CARTA_CAMBIADA,
  MENSAJE_MESA_ARCHIVADA,
  MENSAJE_SOLO_CONSULTA,
  textoEstado,
} from './textos.js';

import { diaDeServicio } from './dia.js';

export { diaDeServicio };

/** Comprueba la forma y los límites del pedido. Devuelve las líneas normalizadas. */
function validarLineas(lineas) {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new ErrorValidacion('lineas', 'El pedido está vacío: añada algún plato.');
  }
  if (lineas.length > MAX_LINEAS) {
    throw new ErrorValidacion('lineas', `Un pedido admite como máximo ${MAX_LINEAS} platos distintos.`);
  }
  const vistos = new Set();
  return lineas.map((l) => {
    const platoId = l?.platoId;
    if (!Number.isInteger(platoId) || platoId <= 0) throw new ErrorValidacion('lineas', 'El pedido no es válido.');
    if (vistos.has(platoId)) throw new ErrorValidacion('lineas', 'El pedido no es válido: hay un plato repetido.');
    vistos.add(platoId);
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > MAX_CANTIDAD) {
      throw new ErrorValidacion('cantidad', `La cantidad de cada plato debe estar entre 1 y ${MAX_CANTIDAD} unidades.`);
    }
    if (l.nota != null && typeof l.nota !== 'string') throw new ErrorValidacion('nota', 'La nota no es válida.');
    const nota = (l.nota ?? '').trim();
    if ([...nota].length > MAX_NOTA) {
      throw new ErrorValidacion('nota', `La nota admite como máximo ${MAX_NOTA} caracteres.`);
    }
    if (!Number.isInteger(l.precioCentimos)) throw new ErrorValidacion('lineas', 'El pedido no es válido.');
    return { platoId, cantidad: l.cantidad, nota, precioVisto: l.precioCentimos };
  });
}

/**
 * Servicio de pedidos. Un pedido pertenece a una mesa y nunca guarda datos de quien lo envía.
 * La validación contra el catálogo vigente y la escritura van en una sola transacción.
 */
export function crearPedidos(db, { eventos, ahora = () => Date.now() }) {
  const q = {
    mesa: db.prepare('SELECT id, nombre, archivada_en FROM mesas WHERE codigo = ?'),
    plato: db.prepare(`
      SELECT p.id, p.nombre, p.precio_centimos, p.agotado, p.archivado_en, c.archivada_en AS categoria_archivada_en
      FROM platos p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?`),
    siguienteNumero: db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM pedidos WHERE dia = ?'),
    insertarPedido: db.prepare(`
      INSERT INTO pedidos (mesa_id, mesa_nombre, dia, numero, token, estado, total_centimos, creado_en)
      VALUES (@mesaId, @mesaNombre, @dia, @numero, @token, @estado, @total, @creadoEn)`),
    insertarLinea: db.prepare(`
      INSERT INTO pedido_lineas (pedido_id, posicion, plato_id, nombre, precio_centimos, cantidad, nota)
      VALUES (?, ?, ?, ?, ?, ?, ?)`),
    pedido: db.prepare('SELECT * FROM pedidos WHERE token = ?'),
    lineas: db.prepare('SELECT * FROM pedido_lineas WHERE pedido_id = ? ORDER BY posicion'),
    cambiarEstado: db.prepare('UPDATE pedidos SET estado = ? WHERE token = ?'),
  };

  function aPedido(fila) {
    return {
      token: fila.token,
      numero: fila.numero,
      dia: fila.dia,
      mesa: fila.mesa_nombre,
      estado: fila.estado,
      estadoTexto: textoEstado(fila.estado),
      creadoEn: new Date(fila.creado_en).toISOString(),
      totalCentimos: fila.total_centimos,
      lineas: q.lineas.all(fila.id).map((l) => ({
        platoId: l.plato_id,
        nombre: l.nombre,
        precioCentimos: l.precio_centimos,
        cantidad: l.cantidad,
        nota: l.nota,
      })),
    };
  }

  const registrar = db.transaction((codigo, lineas) => {
    const mesa = q.mesa.get(codigo);
    if (!mesa) throw new NoEncontrado(MENSAJE_SOLO_CONSULTA);
    if (mesa.archivada_en) throw new ErrorValidacion(null, MENSAJE_MESA_ARCHIVADA, 410);

    // Platos no disponibles (no activos, agotados o de una categoría archivada) y precios cambiados.
    const retirados = [];
    const precios = [];
    const vigentes = lineas.map((l) => {
      const p = q.plato.get(l.platoId);
      if (!p || p.archivado_en || p.categoria_archivada_en || p.agotado) {
        retirados.push({ platoId: l.platoId, nombre: p?.nombre ?? null });
      } else if (p.precio_centimos !== l.precioVisto) {
        precios.push({ platoId: l.platoId, nombre: p.nombre, precioCentimos: p.precio_centimos });
      }
      return { ...l, nombre: p?.nombre, precioCentimos: p?.precio_centimos };
    });
    if (retirados.length || precios.length) throw new ErrorCartaCambiada(MENSAJE_CARTA_CAMBIADA, { retirados, precios });

    const t = ahora();
    const dia = diaDeServicio(t);
    const token = randomBytes(16).toString('base64url');
    const { lastInsertRowid } = q.insertarPedido.run({
      mesaId: mesa.id,
      mesaNombre: mesa.nombre,
      dia,
      numero: q.siguienteNumero.get(dia).n,
      token,
      estado: ESTADO_INICIAL,
      total: vigentes.reduce((s, l) => s + l.precioCentimos * l.cantidad, 0),
      creadoEn: t,
    });
    vigentes.forEach((l, i) =>
      q.insertarLinea.run(Number(lastInsertRowid), i + 1, l.platoId, l.nombre, l.precioCentimos, l.cantidad, l.nota),
    );
    return token;
  });

  /** Confirma el pedido de una mesa. Lanza 404/410/422/409 sin registrar nada si no procede. */
  function confirmar(codigo, cuerpo = {}) {
    const lineas = validarLineas(cuerpo?.lineas);
    // IMMEDIATE: toma el bloqueo de escritura al empezar, así el número del día no se repite.
    const token = registrar.immediate(String(codigo), lineas);
    const pedido = obtener(token);
    eventos.emit('pedido-registrado', pedido);
    return pedido;
  }

  function obtener(token) {
    const fila = typeof token === 'string' ? q.pedido.get(token) : null;
    if (!fila) throw new NoEncontrado('No se ha encontrado el pedido.');
    return aPedido(fila);
  }

  /** Uso interno (y del futuro panel de cocina): cambia el estado y avisa a quien lo esté viendo. */
  function cambiarEstado(token, estado) {
    if (typeof estado !== 'string' || !/^[a-z-]+$/.test(estado)) throw new ErrorValidacion('estado', 'El estado no es válido.');
    obtener(token);
    q.cambiarEstado.run(estado, token);
    const pedido = obtener(token);
    eventos.emit('estado-cambiado', pedido);
    return pedido;
  }

  return { confirmar, obtener, cambiarEstado };
}
