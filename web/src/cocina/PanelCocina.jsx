import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../admin/api.js';
import { MENSAJE_SIN_CONEXION } from '../../../server/textos.js';
import { crearAviso, pedidosNuevos } from './aviso.js';
import { TarjetaPedido } from './TarjetaPedido.jsx';

const REINTENTO_CONEXION = 3000;
// El servidor envía un latido cada 25 s: dos perdidos y algo de margen.
const SILENCIO_MAXIMO = 60_000;
const REFRESCO_TIEMPO = 30_000;
const DURACION_RESALTADO = 30_000;

const VISTAS = [
  ['activos', 'Pedidos activos'],
  ['historico', 'Histórico del día'],
];
const ESTADOS_ACTIVOS = ['recibido', 'en_preparacion'];

export function PanelCocina({ onSalir, onSesionCaducada }) {
  const [pedidos, setPedidos] = useState(null); // null: todavía sin ninguna foto
  const [vista, setVista] = useState('activos');
  const [sinConexion, setSinConexion] = useState(false);
  const [error, setError] = useState(null);
  const [resaltados, setResaltados] = useState(() => new Set());
  const [sonidoBloqueado, setSonidoBloqueado] = useState(false);
  // El tiempo transcurrido se mide con el reloj del servidor, no con el de la tablet.
  const [reloj, setReloj] = useState(() => Date.now());
  const [desfase, setDesfase] = useState(0);
  const aviso = useRef(null);

  useEffect(() => {
    aviso.current = crearAviso(setSonidoBloqueado);
    return () => aviso.current.cerrar();
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => setReloj(Date.now()), REFRESCO_TIEMPO);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    let fuente;
    let reintento;
    let silencio;
    let abierto = true;
    let conocidos = null; // tokens de la foto anterior; la primera foto no avisa
    const temporizadores = new Set();

    function avisar(nuevos) {
      const tokens = nuevos.map((p) => p.token);
      aviso.current.sonar();
      setResaltados((previos) => new Set([...previos, ...tokens]));
      const temporizador = setTimeout(() => {
        temporizadores.delete(temporizador);
        setResaltados((previos) => new Set([...previos].filter((t) => !tokens.includes(t))));
      }, DURACION_RESALTADO);
      temporizadores.add(temporizador);
    }

    // Si la red se cae sin cerrar la conexión, EventSource no se entera: solo se nota por el silencio.
    function vigilarSilencio() {
      clearTimeout(silencio);
      silencio = setTimeout(() => {
        setSinConexion(true);
        conectar();
      }, SILENCIO_MAXIMO);
    }

    function alRecibirFoto(evento) {
      vigilarSilencio();
      const foto = JSON.parse(evento.data);
      const nuevos = conocidos ? pedidosNuevos(conocidos, foto.pedidos) : [];
      conocidos = new Set(foto.pedidos.map((p) => p.token));
      setSinConexion(false);
      setPedidos(foto.pedidos);
      setDesfase(Date.parse(foto.ahora) - Date.now());
      setReloj(Date.now());
      if (nuevos.length) avisar(nuevos);
    }

    async function alFallar() {
      setSinConexion(true);
      // Ante un corte de red, EventSource reconecta solo; ante un 401 se rinde.
      if (fuente.readyState !== EventSource.CLOSED) return;
      try {
        const { abierta } = await api('GET', '/api/sesion');
        if (!abierta) {
          if (abierto) onSesionCaducada();
          return;
        }
      } catch {
        // Sin servidor no se sabe nada de la sesión: se sigue intentando.
      }
      if (abierto) reintento = setTimeout(conectar, REINTENTO_CONEXION);
    }

    function conectar() {
      clearTimeout(reintento);
      fuente?.close();
      fuente = new EventSource('/api/cocina/eventos');
      fuente.addEventListener('pedidos', alRecibirFoto);
      fuente.addEventListener('latido', vigilarSilencio);
      fuente.onerror = alFallar;
      vigilarSilencio();
    }

    conectar();
    return () => {
      abierto = false;
      clearTimeout(reintento);
      clearTimeout(silencio);
      temporizadores.forEach(clearTimeout);
      fuente.close();
    };
  }, [onSesionCaducada]);

  const cambiarEstado = useCallback(
    async (pedido, estado) => {
      setError(null);
      try {
        await api('POST', `/api/cocina/pedidos/${encodeURIComponent(pedido.token)}/estado`, { estado });
      } catch (e) {
        if (e.status === 401) onSesionCaducada();
        else setError(`Pedido ${pedido.numero}: ${e.mensaje}`);
      }
    },
    [onSesionCaducada],
  );

  const enVista = (pedidos ?? []).filter((p) => ESTADOS_ACTIVOS.includes(p.estado) === (vista === 'activos'));

  return (
    <div className="panel-cocina">
      <header className="admin-barra">
        <h1>La Estación · Cocina</h1>
        <div className="acciones">
          {sonidoBloqueado && (
            <button className="boton" type="button" onClick={() => aviso.current.activar()}>
              Activar sonido
            </button>
          )}
          <button className="boton boton--secundario" type="button" onClick={onSalir}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {sinConexion && (
        <p className="aviso-conexion" role="alert">
          {MENSAJE_SIN_CONEXION}
        </p>
      )}

      <nav className="pestanas" aria-label="Vistas del panel de cocina">
        {VISTAS.map(([id, texto]) => (
          <button key={id} type="button" className="boton" aria-pressed={vista === id} onClick={() => setVista(id)}>
            {texto}
          </button>
        ))}
      </nav>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <main>
        {pedidos === null && <p className="estado">Cargando…</p>}
        {pedidos !== null && enVista.length === 0 && (
          <p className="estado">{vista === 'activos' ? 'No hay pedidos activos.' : 'Todavía no hay pedidos terminados hoy.'}</p>
        )}
        {enVista.length > 0 && (
          <ul className="pedidos-cocina">
            {enVista.map((p) => (
              <li key={p.token}>
                <TarjetaPedido
                  pedido={p}
                  ahora={reloj + desfase}
                  resaltado={p.estado === 'recibido' && resaltados.has(p.token)}
                  onCambiarEstado={cambiarEstado}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
