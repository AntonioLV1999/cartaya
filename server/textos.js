// Textos fijos que exigen las specs, compartidos entre el servidor y el frontend (web/).

export const MENSAJE_SOLO_CONSULTA = 'Para pedir, escanee el código QR de su mesa o avise a nuestro personal';
export const MENSAJE_MESA_ARCHIVADA = 'Esta mesa ya no admite pedidos. Avise a nuestro personal';
export const TEXTO_HOJA_QR = 'Escanee para ver la carta y pedir';
export const MENSAJE_CARTA_CAMBIADA = 'La carta ha cambiado mientras decidía. Revise su pedido y vuelva a confirmarlo.';

// Estados del pedido. Las transiciones válidas están en pedidos.js.
export const ESTADO_INICIAL = 'recibido';
const ETIQUETAS_ESTADO = {
  recibido: 'Recibido',
  en_preparacion: 'En preparación',
  servido: 'Servido',
  cancelado: 'Cancelado',
};
export const textoEstado = (estado) => ETIQUETAS_ESTADO[estado];
export const MENSAJE_NO_CANCELABLE = 'Este pedido ya no se puede cancelar';
export const MENSAJE_ESTADO_CAMBIADO = 'Este pedido ya ha cambiado de estado';
export const MENSAJE_SIN_CONEXION = 'Sin conexión: los pedidos nuevos no aparecerán';

// Límites del pedido (pedido-mesa).
export const MAX_CANTIDAD = 20;
export const MAX_LINEAS = 30;
export const MAX_NOTA = 140;
