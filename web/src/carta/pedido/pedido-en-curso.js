// Pedido en curso: vive solo en el navegador del visitante, por mesa, hasta que lo confirma.
import { MAX_CANTIDAD, MAX_LINEAS, MAX_NOTA } from '../../../../server/textos.js';
import { diaDeServicio } from '../../../../server/dia.js';

export const MENSAJE_MAX_CANTIDAD = `El máximo es ${MAX_CANTIDAD} unidades por plato.`;
export const MENSAJE_MAX_LINEAS = `El máximo es ${MAX_LINEAS} platos distintos por pedido.`;
export const MENSAJE_MAX_NOTA = `La nota admite como máximo ${MAX_NOTA} caracteres.`;

const clavePedido = (codigo) => `cartaya:pedido:${codigo}`;
const claveMisPedidos = (codigo) => `cartaya:mis-pedidos:${codigo}`;

// Si el navegador no deja usar localStorage (navegación privada antigua), el pedido vive solo en memoria.
function almacen() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function leerJSON(clave, defecto) {
  try {
    const v = almacen()?.getItem(clave);
    return v ? JSON.parse(v) : defecto;
  } catch {
    return defecto;
  }
}
function escribirJSON(clave, valor) {
  try {
    almacen()?.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: solo en memoria */
  }
}

export const leerPedido = (codigo) => {
  const lineas = leerJSON(clavePedido(codigo), []);
  return Array.isArray(lineas) ? lineas : [];
};
export const guardarPedido = (codigo, lineas) => escribirJSON(clavePedido(codigo), lineas);

/** Añade una unidad del plato. Devuelve `{lineas}` o `{lineas, aviso}` si se ha alcanzado un límite. */
export function anadir(lineas, plato) {
  const i = lineas.findIndex((l) => l.platoId === plato.id);
  if (i >= 0) return cambiarCantidad(lineas, plato.id, +1);
  if (lineas.length >= MAX_LINEAS) return { lineas, aviso: MENSAJE_MAX_LINEAS };
  const nueva = {
    platoId: plato.id,
    nombre: plato.nombre,
    precioCentimos: plato.precioCentimos,
    alergenos: plato.alergenos,
    sinAlergenos: plato.sinAlergenos,
    cantidad: 1,
    nota: '',
  };
  return { lineas: [...lineas, nueva] };
}

/** Suma o resta unidades. Por debajo de 1 quita el plato; por encima de 20 no sube. */
export function cambiarCantidad(lineas, platoId, delta) {
  const l = lineas.find((x) => x.platoId === platoId);
  if (!l) return { lineas };
  const cantidad = l.cantidad + delta;
  if (cantidad > MAX_CANTIDAD) return { lineas, aviso: MENSAJE_MAX_CANTIDAD };
  if (cantidad < 1) return { lineas: lineas.filter((x) => x.platoId !== platoId) };
  return { lineas: lineas.map((x) => (x.platoId === platoId ? { ...x, cantidad } : x)) };
}

/** Pone la nota de un plato, cortada a 140 caracteres (avisa si se ha cortado). */
export function ponerNota(lineas, platoId, nota) {
  const caracteres = [...nota];
  const aviso = caracteres.length > MAX_NOTA ? MENSAJE_MAX_NOTA : undefined;
  const texto = caracteres.slice(0, MAX_NOTA).join('');
  return { lineas: lineas.map((x) => (x.platoId === platoId ? { ...x, nota: texto } : x)), aviso };
}

export const unidades = (lineas) => lineas.reduce((s, l) => s + l.cantidad, 0);
export const total = (lineas) => lineas.reduce((s, l) => s + l.cantidad * l.precioCentimos, 0);

/** Lo que se envía al confirmar: el precio que el visitante ha visto, para detectar cambios. */
export const aEnvio = (lineas) =>
  lineas.map((l) => ({ platoId: l.platoId, cantidad: l.cantidad, nota: l.nota.trim(), precioCentimos: l.precioCentimos }));

/** Aplica la respuesta 409 del servidor: retira los platos no disponibles y actualiza precios. */
export function aplicarCambiosDeCarta(lineas, { retirados = [], precios = [] }) {
  const quitar = new Set(retirados.map((r) => r.platoId));
  const nuevos = new Map(precios.map((p) => [p.platoId, p.precioCentimos]));
  const avisos = [
    ...retirados.map((r) => {
      const nombre = r.nombre ?? lineas.find((l) => l.platoId === r.platoId)?.nombre ?? 'Un plato';
      return `${nombre} ya no está disponible y se ha retirado de su pedido`;
    }),
    ...precios.map((p) => `${p.nombre} ha cambiado de precio`),
  ];
  return {
    lineas: lineas
      .filter((l) => !quitar.has(l.platoId))
      .map((l) => (nuevos.has(l.platoId) ? { ...l, precioCentimos: nuevos.get(l.platoId) } : l)),
    avisos,
  };
}

// ---------- Mis pedidos de hoy en esta mesa ----------

export function leerMisPedidos(codigo, ahora = Date.now()) {
  const hoy = diaDeServicio(ahora);
  const lista = leerJSON(claveMisPedidos(codigo), []);
  return Array.isArray(lista) ? lista.filter((p) => p.dia === hoy) : [];
}

export function recordarPedido(codigo, { token, numero, dia }, ahora = Date.now()) {
  const lista = leerMisPedidos(codigo, ahora).filter((p) => p.token !== token);
  escribirJSON(claveMisPedidos(codigo), [...lista, { token, numero, dia }]);
}
