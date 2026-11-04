import { useState } from 'react';
import { api } from './api.js';

const plural = (n) => (n === 1 ? 'su plato' : `sus ${n} platos`);

export function FormNombre({ id, etiqueta, inicial = '', textoBoton, onGuardar, onCancelar, maxLength }) {
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState(null);

  async function enviar(evento) {
    evento.preventDefault();
    const e = await onGuardar(nombre);
    if (e) setError(e.mensaje);
    else if (!inicial) setNombre('');
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor={id}>{etiqueta}</label>
        <input
          id={id}
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus={Boolean(inicial)}
          maxLength={maxLength}
        />
        {error && (
          <p id={`${id}-error`} className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="acciones">
        <button className="boton" type="submit">
          {textoBoton}
        </button>
        {onCancelar && (
          <button className="boton boton--secundario" type="button" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export function Categorias({ categorias, operar, confirmar = (t) => window.confirm(t) }) {
  const [editando, setEditando] = useState(null);
  const [errores, setErrores] = useState({});

  const ponerError = (id, e) => setErrores((x) => ({ ...x, [id]: e?.mensaje ?? null }));

  async function eliminar(c) {
    if (c.platosActivos > 0) {
      return ponerError(c.id, { mensaje: `No se puede eliminar: primero archive o mueva ${plural(c.platosActivos)}.` });
    }
    if (!confirmar(`¿Eliminar la categoría «${c.nombre}»? Dejará de verse en la carta. Podrá recuperarla desde «Archivados».`)) {
      return;
    }
    ponerError(c.id, await operar(() => api('POST', `/api/admin/categorias/${c.id}/archivar`), `Categoría «${c.nombre}» eliminada.`));
  }

  async function mover(c, direccion) {
    ponerError(c.id, await operar(() => api('POST', `/api/admin/categorias/${c.id}/${direccion}`)));
  }

  return (
    <section className="seccion" aria-labelledby="titulo-categorias">
      <h2 id="titulo-categorias">Categorías</h2>

      <FormNombre
        id="nueva-categoria"
        etiqueta="Nueva categoría"
        textoBoton="Añadir categoría"
        onGuardar={(nombre) => operar(() => api('POST', '/api/admin/categorias', { nombre }), `Categoría «${nombre.trim()}» añadida.`)}
      />

      {categorias.length === 0 && <p>Todavía no hay categorías.</p>}
      <ul className="lista">
        {categorias.map((c, i) => (
          <li key={c.id} className="fila" data-categoria={c.nombre}>
            {editando === c.id ? (
              <FormNombre
                id={`renombrar-${c.id}`}
                etiqueta={`Nuevo nombre de «${c.nombre}»`}
                inicial={c.nombre}
                textoBoton="Guardar nombre"
                onCancelar={() => setEditando(null)}
                onGuardar={async (nombre) => {
                  const e = await operar(() => api('PATCH', `/api/admin/categorias/${c.id}`, { nombre }), 'Nombre guardado.');
                  if (!e) setEditando(null);
                  return e;
                }}
              />
            ) : (
              <>
                <p className="fila__titulo">{c.nombre}</p>
                <p>{c.platosActivos === 1 ? '1 plato' : `${c.platosActivos} platos`}</p>
                <div className="acciones">
                  <button className="boton boton--secundario" type="button" onClick={() => mover(c, 'subir')} disabled={i === 0}
                    aria-label={`Subir ${c.nombre}`}>
                    ↑ Subir
                  </button>
                  <button className="boton boton--secundario" type="button" onClick={() => mover(c, 'bajar')}
                    disabled={i === categorias.length - 1} aria-label={`Bajar ${c.nombre}`}>
                    ↓ Bajar
                  </button>
                  <button className="boton boton--secundario" type="button" onClick={() => setEditando(c.id)}
                    aria-label={`Renombrar ${c.nombre}`}>
                    Renombrar
                  </button>
                  <button className="boton boton--peligro" type="button" onClick={() => eliminar(c)}
                    aria-label={`Eliminar ${c.nombre}`}>
                    Eliminar
                  </button>
                </div>
                {errores[c.id] && (
                  <p className="error" role="alert">
                    {errores[c.id]}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
