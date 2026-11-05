import express from 'express';
import { diaDeServicio } from './dia.js';
import { abrirSSE, LATIDO_SSE } from './rutas-pedidos.js';

/**
 * Rutas del panel de cocina. Se montan detrás del middleware que exige sesión:
 *  POST /api/cocina/pedidos/:token/estado   lleva un pedido al estado indicado
 *  GET  /api/cocina/eventos                 foto de los pedidos del día por Server-Sent Events
 */
export function crearRutasCocina({ pedidos, eventos, sesionValida, ahora, latido = LATIDO_SSE }) {
  const r = express.Router();

  // Solo JSON, como /api/admin: refuerza SameSite contra CSRF.
  r.post(
    '/pedidos/:token/estado',
    (req, res, next) => {
      if (!req.is('application/json')) {
        return res.status(415).json({ campo: null, mensaje: 'Las peticiones deben enviarse en formato JSON.' });
      }
      next();
    },
    express.json({ limit: '1kb' }),
    (req, res) => res.json(pedidos.cambiarEstado(req.params.token, req.body?.estado)),
  );

  r.get('/eventos', (req, res) => {
    abrirSSE(res);

    // Cada evento lleva el día entero: reconectar y sincronizar son lo mismo.
    let dia;
    const enviarFoto = () => {
      const t = ahora();
      dia = diaDeServicio(t);
      const foto = { dia, ahora: new Date(t).toISOString(), pedidos: pedidos.delDia(dia) };
      res.write(`event: pedidos\ndata: ${JSON.stringify(foto)}\n\n`);
    };
    enviarFoto();
    eventos.on('pedido-registrado', enviarFoto);
    eventos.on('estado-cambiado', enviarFoto);

    // El latido también comprueba la sesión (y así la renueva) y el paso al día siguiente.
    // Es un evento y no un comentario para que el panel lo vea y note si deja de llegar.
    const intervalo = setInterval(() => {
      if (!sesionValida(req)) {
        liberar();
        res.end();
      } else if (diaDeServicio(ahora()) !== dia) {
        enviarFoto();
      } else {
        res.write('event: latido\ndata: {}\n\n');
      }
    }, latido);

    function liberar() {
      clearInterval(intervalo);
      eventos.off('pedido-registrado', enviarFoto);
      eventos.off('estado-cambiado', enviarFoto);
    }
    req.on('close', liberar);
  });

  return r;
}
