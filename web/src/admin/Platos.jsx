import { useState } from 'react';
import { formatearPrecio } from '../../../server/precio.js';
import { api } from './api.js';
import { FormPlato } from './FormPlato.jsx';

export function Platos({ datos, operar, confirmar = (t) => window.confirm(t) }) {
  const { categorias, platos } = datos;
  // null: nada abierto; { nuevo: categoriaId } o { id: platoId }
  const [abierto, setAbierto] = useState(null);
  const [errores, setErrores] = useState({});

  const ponerError = (id, e) => setErrores((x) => ({ ...x, [id]: e?.mensaje ?? null }));

  if (categorias.length === 0) {
    return (
      <section className="seccion">
        <h2>Platos</h2>
        <p>Primero cree una categoría en la pestaña «Categorías».</p>
      </section>
    );
  }

  async function archivar(p) {
    if (!confirmar(`¿Eliminar el plato «${p.nombre}»? Dejará de verse en la carta. Podrá recuperarlo desde «Archivados».`)) return;
    ponerError(p.id, await operar(() => api('POST', `/api/admin/platos/${p.id}/archivar`), `Plato «${p.nombre}» eliminado.`));
  }

  async function alternarAgotado(p) {
    const agotado = !p.agotado;
    ponerError(
      p.id,
      await operar(
        () => api('PATCH', `/api/admin/platos/${p.id}`, { agotado }),
        agotado ? `«${p.nombre}» marcado como agotado.` : `«${p.nombre}» vuelve a estar disponible.`,
      ),
    );
  }

  async function mover(p, direccion) {
    ponerError(p.id, await operar(() => api('POST', `/api/admin/platos/${p.id}/${direccion}`)));
  }

  const formulario = (plato, categoriaInicial) => (
    <FormPlato plato={plato} categorias={categorias} categoriaInicial={categoriaInicial} operar={operar}
      onTerminar={() => setAbierto(null)} />
  );

  return (
    <section className="seccion" aria-labelledby="titulo-platos">
      <h2 id="titulo-platos">Platos</h2>
      {categorias.map((c) => {
        const deCategoria = platos.filter((p) => p.categoriaId === c.id);
        return (
          <section key={c.id} className="seccion" aria-labelledby={`platos-cat-${c.id}`} data-categoria={c.nombre}>
            <h3 id={`platos-cat-${c.id}`}>{c.nombre}</h3>
            {deCategoria.length === 0 && <p>No hay platos en esta categoría.</p>}
            <ul className="lista">
              {deCategoria.map((p, i) =>
                abierto?.id === p.id ? (
                  <li key={p.id}>{formulario(p)}</li>
                ) : (
                  <li key={p.id} className="fila" data-plato={p.nombre}>
                    <p className="fila__titulo">
                      {p.nombre} · {formatearPrecio(p.precioCentimos)}
                    </p>
                    <p>
                      Estado:{' '}
                      {p.agotado ? <span className="etiqueta etiqueta--agotado">Agotado</span> : <strong>Disponible</strong>}
                      {!p.foto && ' · sin foto'}
                    </p>
                    <div className="acciones">
                      <button className="boton boton--secundario" type="button" onClick={() => mover(p, 'subir')}
                        disabled={i === 0} aria-label={`Subir ${p.nombre}`}>
                        ↑ Subir
                      </button>
                      <button className="boton boton--secundario" type="button" onClick={() => mover(p, 'bajar')}
                        disabled={i === deCategoria.length - 1} aria-label={`Bajar ${p.nombre}`}>
                        ↓ Bajar
                      </button>
                      <button className="boton boton--secundario" type="button" onClick={() => setAbierto({ id: p.id })}
                        aria-label={`Editar ${p.nombre}`}>
                        Editar
                      </button>
                      <button className="boton boton--secundario" type="button" onClick={() => alternarAgotado(p)}
                        aria-label={p.agotado ? `Marcar ${p.nombre} como disponible` : `Marcar ${p.nombre} como agotado`}>
                        {p.agotado ? 'Marcar disponible' : 'Marcar agotado'}
                      </button>
                      <button className="boton boton--peligro" type="button" onClick={() => archivar(p)}
                        aria-label={`Eliminar ${p.nombre}`}>
                        Eliminar
                      </button>
                    </div>
                    {errores[p.id] && (
                      <p className="error" role="alert">
                        {errores[p.id]}
                      </p>
                    )}
                  </li>
                ),
              )}
            </ul>
            {abierto?.nuevo === c.id ? (
              formulario(null, c.id)
            ) : (
              <div className="acciones">
                <button className="boton" type="button" onClick={() => setAbierto({ nuevo: c.id })}>
                  Añadir plato en {c.nombre}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
