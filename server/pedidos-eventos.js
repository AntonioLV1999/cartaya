import { EventEmitter } from 'node:events';

/**
 * Emisor en memoria de los eventos de pedidos (un solo proceso):
 * - 'pedido-registrado' (pedido): lo escuchará el panel de cocina.
 * - 'estado-cambiado' (pedido): lo escucha la confirmación del visitante por SSE.
 */
export function crearEventosPedidos() {
  const eventos = new EventEmitter();
  eventos.setMaxListeners(0); // una conexión SSE por móvil con su confirmación abierta
  return eventos;
}
