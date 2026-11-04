import { useCallback, useEffect, useRef, useState } from 'react';
import { Alergenos, Cabecera, VistaCarta } from '../componentes.jsx';
import { formatearPrecio } from '../../../../server/precio.js';
import { MAX_NOTA, MENSAJE_MESA_ARCHIVADA } from '../../../../server/textos.js';
import {
  aEnvio,
  anadir,
  aplicarCambiosDeCarta,
  cambiarCantidad,
  guardarPedido,
  leerMisPedidos,
  leerPedido,
  ponerNota,
  recordarPedido,
  total,
  unidades,
} from './pedido-en-curso.js';

const rutaMesa = (codigo) => `/mesa/${encodeURIComponent(codigo)}`;
const rutaPedido = (codigo, token) => `${rutaMesa(codigo)}/pedidos/${encodeURIComponent(token)}`;
const platos = (n) => (n === 1 ? '1 plato' : `${n} platos`);

/** Envía el pedido. Devuelve un resultado tipado en vez de lanzar. */
export async function enviarPedido(codigo, lineas) {
  let r;
  try {
    r = await fetch(`/api/mesas/${encodeURIComponent(codigo)}/pedidos`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas: aEnvio(lineas) }),
    });
  } catch {
    return { tipo: 'error', mensaje: 'No se ha podido enviar el pedido. Compruebe la conexión e inténtelo de nuevo.' };
  }
  const datos = await r.json().catch(() => ({}));
  if (r.status === 201) return { tipo: 'ok', pedido: datos };
  if (r.status === 409) return { tipo: 'carta-cambiada', ...datos };
  if (r.status === 410 || r.status === 404) return { tipo: 'mesa', mensaje: r.status === 410 ? datos.mensaje : MENSAJE_MESA_ARCHIVADA };
  return { tipo: 'error', mensaje: datos.mensaje ?? 'No se ha podido enviar el pedido. Inténtelo de nuevo.' };
}

async function obtenerPedido(token) {
  const r = await fetch(`/api/pedidos/${encodeURIComponent(token)}`, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------- Confirmación ----------

export function Confirmacion({ codigo, token, pedidoInicial = null }) {
  const [pedido, setPedido] = useState(pedidoInicial);
  const [error, setError] = useState(false);
  const [estado, setEstado] = useState(pedidoInicial?.estadoTexto ?? null);

  useEffect(() => {
    if (pedidoInicial) return;
    obtenerPedido(token).then(
      (p) => {
        setPedido(p);
        setEstado(p.estadoTexto);
      },
      () => setError(true),
    );
  }, [token, pedidoInicial]);

  useEffect(() => {
    // El estado llega por SSE; EventSource reconecta solo y el servidor reenvía el estado actual.
    if (typeof EventSource === 'undefined') return;
    const fuente = new EventSource(`/api/pedidos/${encodeURIComponent(token)}/eventos`);
    fuente.addEventListener('estado', (e) => setEstado(JSON.parse(e.data).estadoTexto));
    return () => fuente.close();
  }, [token]);

  return (
    <>
      <div className="contenedor">
        <Cabecera />
      </div>
      <main className="contenedor confirmacion">
        {error && (
          <p className="estado" role="alert">
            No se ha encontrado este pedido. Si lo ha enviado, avise a nuestro personal.
          </p>
        )}
        {!error && !pedido && <p className="estado">Cargando su pedido…</p>}
        {pedido && (
          <>
            <h2>Pedido enviado a cocina</h2>
            <p className="confirmacion__numero">Pedido {pedido.numero}</p>
            <p className="confirmacion__mesa">{pedido.mesa}</p>
            <p className="confirmacion__estado" role="status">
              Estado: <strong>{estado}</strong>
            </p>
            <ul className="lineas">
              {pedido.lineas.map((l) => (
                <li key={l.platoId} className="linea" data-plato={l.nombre}>
                  <div className="linea__cabecera">
                    <h3 className="linea__nombre">
                      {l.cantidad} × {l.nombre}
                    </h3>
                    <span className="linea__importe">{formatearPrecio(l.cantidad * l.precioCentimos)}</span>
                  </div>
                  {l.nota && <p className="linea__nota">Nota: {l.nota}</p>}
                </li>
              ))}
            </ul>
            <p className="total">
              Total <strong>{formatearPrecio(pedido.totalCentimos)}</strong>
            </p>
            <p>Se paga en caja. Si necesita cambiar algo, avise a nuestro personal.</p>
          </>
        )}
        <p>
          <a className="boton" href={rutaMesa(codigo)}>
            Volver a la carta
          </a>
        </p>
      </main>
    </>
  );
}

// ---------- Resumen ----------

function LineaResumen({ linea, alCambiarCantidad, alCambiarNota, avisoNota }) {
  const id = `nota-${linea.platoId}`;
  return (
    <li className="linea" data-plato={linea.nombre}>
      <div className="linea__cabecera">
        <h3 className="linea__nombre">{linea.nombre}</h3>
        <span className="linea__importe">{formatearPrecio(linea.cantidad * linea.precioCentimos)}</span>
      </div>
      <p className="linea__precio">{formatearPrecio(linea.precioCentimos)} la unidad</p>
      <Alergenos plato={linea} />
      <div className="cantidad" role="group" aria-label={`Cantidad de ${linea.nombre}`}>
        <button className="boton boton--secundario" type="button" onClick={() => alCambiarCantidad(-1)}
          aria-label={`Quitar un ${linea.nombre}`}>
          −
        </button>
        <span className="cantidad__valor" aria-live="polite">
          ×{linea.cantidad}
        </span>
        <button className="boton boton--secundario" type="button" onClick={() => alCambiarCantidad(+1)}
          aria-label={`Añadir otro ${linea.nombre}`}>
          +
        </button>
      </div>
      <div className="campo">
        <label htmlFor={id}>Nota para cocina (opcional)</label>
        <textarea id={id} rows={2} maxLength={MAX_NOTA} value={linea.nota} placeholder="Por ejemplo: sin cebolla"
          onChange={(e) => alCambiarNota(e.target.value)} aria-describedby={`${id}-ayuda`} />
        <p className="ayuda" id={`${id}-ayuda`}>
          {[...linea.nota].length} de {MAX_NOTA} caracteres
        </p>
        {avisoNota && (
          <p className="error" role="alert">
            {avisoNota}
          </p>
        )}
      </div>
    </li>
  );
}

function Resumen({ mesa, lineas, setLineas, avisos, enviando, alConfirmar, alVolver }) {
  const [avisosNota, setAvisosNota] = useState({});
  const [avisoCantidad, setAvisoCantidad] = useState('');
  const vacio = lineas.length === 0;

  return (
    <main className="contenedor resumen">
      <h2>Su pedido · {mesa.nombre}</h2>
      {avisos.length > 0 && (
        <div className="aviso-cambios" role="alert">
          {avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}
      {vacio && <p className="estado">Su pedido está vacío. Vuelva a la carta para añadir platos.</p>}
      <ul className="lineas">
        {lineas.map((l) => (
          <LineaResumen
            key={l.platoId}
            linea={l}
            avisoNota={avisosNota[l.platoId]}
            alCambiarCantidad={(delta) => {
              const r = cambiarCantidad(lineas, l.platoId, delta);
              setLineas(r.lineas);
              setAvisoCantidad(r.aviso ?? '');
            }}
            alCambiarNota={(nota) => {
              const r = ponerNota(lineas, l.platoId, nota);
              setLineas(r.lineas);
              setAvisosNota((x) => ({ ...x, [l.platoId]: r.aviso }));
            }}
          />
        ))}
      </ul>
      {avisoCantidad && (
        <p className="error" role="alert">
          {avisoCantidad}
        </p>
      )}
      {!vacio && (
        <p className="total">
          Total <strong>{formatearPrecio(total(lineas))}</strong>
        </p>
      )}
      <p>Precios con IVA incluido. Se paga en caja.</p>
      <div className="acciones">
        {!vacio && (
          <button className="boton" type="button" onClick={alConfirmar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Confirmar pedido'}
          </button>
        )}
        <button className="boton boton--secundario" type="button" onClick={alVolver}>
          {vacio ? 'Volver a la carta' : 'Seguir pidiendo'}
        </button>
      </div>
    </main>
  );
}

// ---------- Carta de la mesa ----------

function MisPedidos({ codigo }) {
  const [lista] = useState(() => leerMisPedidos(codigo));
  if (lista.length === 0) return null;
  return (
    <section className="mis-pedidos" aria-labelledby="titulo-mis-pedidos">
      <h2 id="titulo-mis-pedidos">Mis pedidos de hoy</h2>
      <ul className="acciones">
        {lista.map((p) => (
          <li key={p.token}>
            <a className="boton boton--secundario" href={rutaPedido(codigo, p.token)}>
              Pedido {p.numero}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Página de una mesa: carta con «Añadir», resumen y confirmación.
 * Con `tokenInicial` (dirección de una confirmación) muestra directamente esa confirmación.
 */
export function PaginaMesa({ codigo, mesa, carta, tokenInicial = null }) {
  const [vista, setVista] = useState(() => (tokenInicial ? { tipo: 'confirmacion', token: tokenInicial } : { tipo: 'carta' }));
  const [lineas, setLineasEstado] = useState(() => leerPedido(codigo));
  const [aviso, setAviso] = useState('');
  const [avisosResumen, setAvisosResumen] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [mesaArchivada, setMesaArchivada] = useState(null);
  const arriba = useRef(null);

  const setLineas = useCallback(
    (nuevas) => {
      setLineasEstado(nuevas);
      guardarPedido(codigo, nuevas);
    },
    [codigo],
  );

  // «Atrás» en el móvil: del resumen vuelve a la carta.
  useEffect(() => {
    const alVolver = () => setVista(history.state?.vista === 'resumen' ? { tipo: 'resumen' } : { tipo: 'carta' });
    addEventListener('popstate', alVolver);
    return () => removeEventListener('popstate', alVolver);
  }, []);

  useEffect(() => {
    scrollTo?.(0, 0);
  }, [vista.tipo]);

  const abrirResumen = () => {
    setAvisosResumen([]);
    history.pushState({ vista: 'resumen' }, '');
    setVista({ tipo: 'resumen' });
  };
  const volverACarta = () => {
    if (history.state?.vista === 'resumen') history.back();
    else setVista({ tipo: 'carta' });
  };

  async function confirmar() {
    if (lineas.length === 0 || enviando) return;
    setEnviando(true);
    const r = await enviarPedido(codigo, lineas);
    setEnviando(false);
    if (r.tipo === 'ok') {
      recordarPedido(codigo, r.pedido);
      setLineas([]);
      // La confirmación sustituye al resumen en el historial: «atrás» vuelve a la carta.
      history.replaceState({ vista: 'confirmacion' }, '', rutaPedido(codigo, r.pedido.token));
      setVista({ tipo: 'confirmacion', token: r.pedido.token, pedido: r.pedido });
    } else if (r.tipo === 'carta-cambiada') {
      const c = aplicarCambiosDeCarta(lineas, r);
      setLineas(c.lineas);
      setAvisosResumen(c.lineas.length === 0 ? [...c.avisos, 'Su pedido se ha quedado vacío.'] : c.avisos);
      arriba.current?.focus?.();
    } else if (r.tipo === 'mesa') {
      setMesaArchivada(r.mensaje || MENSAJE_MESA_ARCHIVADA);
    } else {
      setAvisosResumen([r.mensaje]);
    }
  }

  if (vista.tipo === 'confirmacion') {
    return <Confirmacion codigo={codigo} token={vista.token} pedidoInicial={vista.pedido ?? null} />;
  }

  if (mesaArchivada) {
    return (
      <VistaCarta
        carta={carta}
        antes={
          <p className="aviso-cambios" role="alert">
            {mesaArchivada}
          </p>
        }
      />
    );
  }

  if (vista.tipo === 'resumen') {
    return (
      <>
        <div className="contenedor" ref={arriba} tabIndex={-1}>
          <Cabecera />
        </div>
        <Resumen
          mesa={mesa}
          lineas={lineas}
          setLineas={setLineas}
          avisos={avisosResumen}
          enviando={enviando}
          alConfirmar={confirmar}
          alVolver={volverACarta}
        />
      </>
    );
  }

  const enPedido = new Map(lineas.map((l) => [l.platoId, l.cantidad]));
  return (
    <VistaCarta
      carta={carta}
      antes={
        <>
          <p className="mesa-actual">
            Está pidiendo para <strong>{mesa.nombre}</strong>
          </p>
          <MisPedidos codigo={codigo} />
        </>
      }
      accionPlato={(p) =>
        p.agotado ? null : (
          <div className="plato__pedir">
            <button className="boton" type="button" aria-label={`Añadir ${p.nombre}`}
              onClick={() => {
                const r = anadir(lineas, p);
                setLineas(r.lineas);
                setAviso(r.aviso ?? '');
              }}>
              Añadir
            </button>
            {enPedido.has(p.id) && <span className="plato__en-pedido">{enPedido.get(p.id)} en su pedido</span>}
          </div>
        )
      }
      despues={
        <>
          {aviso && (
            <p className="barra-aviso" role="alert">
              {aviso}
            </p>
          )}
          {lineas.length > 0 && (
            <>
              <div className="hueco-barra" aria-hidden="true" />
              <div className="barra-pedido" role="region" aria-label="Su pedido">
                <p className="barra-pedido__total">
                  {platos(unidades(lineas))} · {formatearPrecio(total(lineas))}
                </p>
                <button className="boton" type="button" onClick={abrirResumen}>
                  Ver mi pedido
                </button>
              </div>
            </>
          )}
        </>
      }
    />
  );
}
