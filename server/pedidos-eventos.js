import { EventEmitter } from 'node:events';

/**
 * Emisor en memoria de los eventos de pedidos (un solo proceso):
 * - 'pedido-registrado' (pedido): lo escucha el panel de cocina por SSE.
 * - 'estado-cambiado' (pedido): lo escuchan la confirmación del visitante y el panel de cocina por SSE.
 */
export function crearEventosPedidos() {
  const eventos = new EventEmitter();
  eventos.setMaxListeners(0); // una conexión SSE por móvil con su confirmación abierta y por panel
  return eventos;
}
