import { useState } from 'react';

const horaDeMadrid = (iso) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });

const minutosDesde = (iso, ahora) => Math.max(0, Math.floor((ahora - Date.parse(iso)) / 60_000));

/**
 * Un pedido del panel. Los activos muestran el tiempo transcurrido y sus acciones;
 * los del histórico, solo la hora de confirmación y la de cancelación.
 * @param {number} props.ahora  instante actual según el reloj del servidor
 * @param {(pedido: object, estado: string) => Promise<void>} [props.onCambiarEstado]
 */
export function TarjetaPedido({ pedido, ahora, resaltado = false, onCambiarEstado }) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const { numero, estado } = pedido;
  const activo = estado === 'recibido' || estado === 'en_preparacion';

  async function cambiar(nuevo) {
    setOcupado(true);
    await onCambiarEstado(pedido, nuevo);
    setOcupado(false);
    setConfirmando(false);
  }

  return (
    <article className={`tarjeta-pedido${resaltado ? ' tarjeta-pedido--nuevo' : ''}`} aria-label={`Pedido ${numero}`}>
      <div className="tarjeta-pedido__cabecera">
        <h2>Pedido {numero}</h2>
        {resaltado && <span className="etiqueta etiqueta--nuevo">Nuevo</span>}
        <span className="etiqueta">{pedido.estadoTexto}</span>
      </div>
      <p className="tarjeta-pedido__mesa">{pedido.mesa}</p>

      {activo ? (
        <p className="tarjeta-pedido__tiempo">{minutosDesde(pedido.creadoEn, ahora)} min</p>
      ) : (
        <p>Confirmado a las {horaDeMadrid(pedido.creadoEn)}</p>
      )}
      {pedido.canceladoEn && <p>Cancelado a las {horaDeMadrid(pedido.canceladoEn)}</p>}

      <ul className="tarjeta-pedido__lineas">
        {pedido.lineas.map((l) => (
          <li key={l.platoId}>
            <p className="tarjeta-pedido__plato">{l.cantidad} × {l.nombre}</p>
            {l.nota && <p>Nota: {l.nota}</p>}
          </li>
        ))}
      </ul>

      {estado === 'recibido' && confirmando && (
        <div className="tarjeta-pedido__confirmar">
          <p>¿Cancelar el pedido {numero}?</p>
          <div className="acciones">
            <button className="boton boton--peligro" type="button" disabled={ocupado} onClick={() => cambiar('cancelado')}>
              Sí, cancelar
            </button>
            <button className="boton boton--secundario" type="button" onClick={() => setConfirmando(false)}>
              No
            </button>
          </div>
        </div>
      )}
      {estado === 'recibido' && !confirmando && (
        <div className="acciones">
          <button className="boton" type="button" disabled={ocupado} onClick={() => cambiar('en_preparacion')}>
            Empezar a preparar
          </button>
          <button className="boton boton--peligro" type="button" disabled={ocupado} onClick={() => setConfirmando(true)}>
            Cancelar pedido
          </button>
        </div>
      )}
      {estado === 'en_preparacion' && (
        <div className="acciones">
          <button className="boton" type="button" disabled={ocupado} onClick={() => cambiar('servido')}>
            Marcar como servido
          </button>
        </div>
      )}
    </article>
  );
}
