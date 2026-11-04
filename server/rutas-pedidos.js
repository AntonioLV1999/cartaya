import express from 'express';

export const LATIDO_SSE = 25_000;

/**
 * Rutas públicas de pedidos (sin sesión ni datos personales):
 *  POST /api/mesas/:codigo/pedidos      confirmar un pedido
 *  GET  /api/pedidos/:token             confirmación de un pedido
 *  GET  /api/pedidos/:token/eventos     estado del pedido por Server-Sent Events
 */
export function crearRutasPedidos({ pedidos, eventos, latido = LATIDO_SSE }) {
  const r = express.Router();

  // Solo JSON: un formulario de otra web no puede enviarlo sin preflight CORS (que no se habilita).
  r.post(
    '/mesas/:codigo/pedidos',
    (req, res, next) => {
      if (!req.is('application/json')) {
        return res.status(415).json({ campo: null, mensaje: 'Las peticiones deben enviarse en formato JSON.' });
      }
      next();
    },
    express.json({ limit: '20kb' }),
    (req, res) => res.status(201).json(pedidos.confirmar(req.params.codigo, req.body)),
  );

  r.get('/pedidos/:token', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(pedidos.obtener(req.params.token));
  });

  r.get('/pedidos/:token/eventos', (req, res) => {
    const { token } = req.params;
    const inicial = pedidos.obtener(token); // 404 si no existe
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const enviar = (p) => res.write(`event: estado\ndata: ${JSON.stringify({ estado: p.estado, estadoTexto: p.estadoTexto })}\n\n`);
    // El estado actual nada más conectar: tras una reconexión, el móvil se corrige solo.
    res.write(`retry: 3000\n\n`);
    enviar(inicial);

    const alCambiar = (p) => {
      if (p.token === token) enviar(p);
    };
    eventos.on('estado-cambiado', alCambiar);
    const intervalo = setInterval(() => res.write(': latido\n\n'), latido);
    req.on('close', () => {
      clearInterval(intervalo);
      eventos.off('estado-cambiado', alCambiar);
    });
  });

  return r;
}
