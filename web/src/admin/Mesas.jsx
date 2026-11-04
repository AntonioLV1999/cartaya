import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { FormNombre } from './Categorias.jsx';
import { TEXTO_HOJA_QR } from '../../../server/textos.js';

const MAX_NOMBRE_MESA = 30;
export const urlQR = (mesa) => `/api/admin/mesas/${mesa.id}/qr.svg`;

/**
 * Hojas de impresión: una por mesa, con su QR, su nombre y el texto fijo.
 * Se pinta fuera de la aplicación (portal en <body>) para que al imprimir solo salgan las hojas.
 * Espera a que carguen los QR, abre el diálogo de impresión y avisa al terminar.
 */
export function HojasQR({ mesas, imprimir = () => window.print(), onTerminar }) {
  const ref = useRef(null);
  // Las funciones van en una referencia: el diálogo de impresión se abre una sola vez por lista de mesas.
  const acciones = useRef({ imprimir, onTerminar });
  acciones.current = { imprimir, onTerminar };

  useEffect(() => {
    let vivo = true;
    document.body.classList.add('imprimir-qr');
    const imagenes = [...ref.current.querySelectorAll('img')];
    Promise.all(imagenes.map((img) => img.decode?.().catch(() => {}))).then(() => {
      if (!vivo) return;
      acciones.current.imprimir();
      acciones.current.onTerminar();
    });
    return () => {
      vivo = false;
      document.body.classList.remove('imprimir-qr');
    };
  }, [mesas]);

  return createPortal(
    <div className="hojas-qr" ref={ref} aria-label="Hojas de QR para imprimir">
      {mesas.map((m) => (
        <section key={m.id} className="hoja-qr" data-mesa={m.nombre}>
          <h2 className="hoja-qr__nombre">{m.nombre}</h2>
          <img className="hoja-qr__qr" src={urlQR(m)} alt={`QR de ${m.nombre}`} width="300" height="300" />
          <p className="hoja-qr__texto">{TEXTO_HOJA_QR}</p>
        </section>
      ))}
    </div>,
    document.body,
  );
}

export function Mesas({ mesas, operar, confirmar = (t) => window.confirm(t), imprimir }) {
  const [editando, setEditando] = useState(null);
  const [viendoQR, setViendoQR] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(null);
  const [errores, setErrores] = useState({});

  const ponerError = (id, e) => setErrores((x) => ({ ...x, [id]: e?.mensaje ?? null }));

  async function eliminar(m) {
    if (!confirmar(`¿Eliminar la mesa «${m.nombre}»? Su QR dejará de servir para pedir (la carta se seguirá viendo).`)) return;
    ponerError(m.id, await operar(() => api('POST', `/api/admin/mesas/${m.id}/archivar`), `Mesa «${m.nombre}» eliminada.`));
  }

  return (
    <section className="seccion" aria-labelledby="titulo-mesas">
      <h2 id="titulo-mesas">Mesas</h2>

      <FormNombre
        id="nueva-mesa"
        etiqueta="Nueva mesa (p. ej. «Mesa 7» o «Terraza 2»)"
        textoBoton="Añadir mesa"
        maxLength={MAX_NOMBRE_MESA}
        onGuardar={(nombre) => operar(() => api('POST', '/api/admin/mesas', { nombre }), `Mesa «${nombre.trim()}» añadida.`)}
      />

      {mesas.length === 0 && <p>Todavía no hay mesas.</p>}
      {mesas.length > 0 && (
        <p>
          <button className="boton" type="button" onClick={() => setImprimiendo(mesas)}>
            Imprimir todos los QR
          </button>
        </p>
      )}

      <ul className="lista">
        {mesas.map((m) => (
          <li key={m.id} className="fila" data-mesa={m.nombre}>
            {editando === m.id ? (
              <FormNombre
                id={`renombrar-mesa-${m.id}`}
                etiqueta={`Nuevo nombre de «${m.nombre}»`}
                inicial={m.nombre}
                textoBoton="Guardar nombre"
                maxLength={MAX_NOMBRE_MESA}
                onCancelar={() => setEditando(null)}
                onGuardar={async (nombre) => {
                  const e = await operar(() => api('PATCH', `/api/admin/mesas/${m.id}`, { nombre }), 'Nombre guardado. El QR no cambia.');
                  if (!e) setEditando(null);
                  return e;
                }}
              />
            ) : (
              <>
                <p className="fila__titulo">{m.nombre}</p>
                <div className="acciones">
                  <button className="boton boton--secundario" type="button" aria-expanded={viendoQR === m.id}
                    onClick={() => setViendoQR(viendoQR === m.id ? null : m.id)}
                    aria-label={`${viendoQR === m.id ? 'Ocultar' : 'Ver'} QR de ${m.nombre}`}>
                    {viendoQR === m.id ? 'Ocultar QR' : 'Ver QR'}
                  </button>
                  <button className="boton boton--secundario" type="button" onClick={() => setImprimiendo([m])}
                    aria-label={`Imprimir QR de ${m.nombre}`}>
                    Imprimir QR
                  </button>
                  <button className="boton boton--secundario" type="button" onClick={() => setEditando(m.id)}
                    aria-label={`Renombrar ${m.nombre}`}>
                    Renombrar
                  </button>
                  <button className="boton boton--peligro" type="button" onClick={() => eliminar(m)}
                    aria-label={`Eliminar ${m.nombre}`}>
                    Eliminar
                  </button>
                </div>
                {viendoQR === m.id && (
                  <figure className="mesa-qr">
                    <img src={urlQR(m)} alt={`QR de ${m.nombre}`} width="240" height="240" />
                    <figcaption>
                      {m.nombre} · <span className="mesa-qr__url">{m.url}</span>
                    </figcaption>
                  </figure>
                )}
                {errores[m.id] && (
                  <p className="error" role="alert">
                    {errores[m.id]}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {imprimiendo && <HojasQR mesas={imprimiendo} imprimir={imprimir} onTerminar={() => setImprimiendo(null)} />}
    </section>
  );
}
