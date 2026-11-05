// Aviso de pedido nuevo: la detección entre fotos y un tono breve generado con Web Audio.

const DURACION_TONO = 0.3; // segundos
const FRECUENCIA_TONO = 880; // Hz

/** Pedidos recién llegados: en «Recibido» y con un token que la foto anterior no tenía. */
export const pedidosNuevos = (conocidos, pedidos) =>
  pedidos.filter((p) => p.estado === 'recibido' && !conocidos.has(p.token));

/**
 * Crea el aviso sonoro. Los navegadores dejan el sonido suspendido hasta una pulsación,
 * así que se intenta reanudar en cada una. `alCambiar(bloqueado)` informa de si sigue suspendido.
 */
export function crearAviso(alCambiar) {
  const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Contexto) return { sonar() {}, activar() {}, cerrar() {} };

  const contexto = new Contexto();
  const informar = () => alCambiar(contexto.state !== 'running');
  const activar = () => {
    if (contexto.state !== 'running') contexto.resume().then(informar, informar);
  };
  contexto.onstatechange = informar;
  document.addEventListener('click', activar);
  informar();

  return {
    activar,
    sonar() {
      // Suspendido, el tono quedaría en cola y sonaría a destiempo al reanudar.
      if (contexto.state !== 'running') return;
      const inicio = contexto.currentTime;
      const oscilador = contexto.createOscillator();
      const volumen = contexto.createGain();
      oscilador.frequency.value = FRECUENCIA_TONO;
      volumen.gain.setValueAtTime(0.4, inicio);
      volumen.gain.exponentialRampToValueAtTime(0.001, inicio + DURACION_TONO);
      oscilador.connect(volumen);
      volumen.connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + DURACION_TONO);
    },
    cerrar() {
      document.removeEventListener('click', activar);
      contexto.onstatechange = null;
      contexto.close();
    },
  };
}
