import { useState } from 'react';
import { nombreAlergeno } from '../../../server/alergenos.js';
import { formatearPrecio } from '../../../server/precio.js';

export const NOMBRE_ESTABLECIMIENTO = 'La Estación';
export const AVISO_ALERGIAS = 'Si tiene alguna alergia o intolerancia alimentaria, consulte a nuestro personal';

export const idCategoria = (id) => `categoria-${id}`;

export function Cabecera() {
  return (
    <header className="cabecera">
      <h1>{NOMBRE_ESTABLECIMIENTO}</h1>
      <p className="aviso-alergias">{AVISO_ALERGIAS}</p>
    </header>
  );
}

export function Indice({ categorias }) {
  return (
    <nav className="indice" aria-label="Categorías de la carta">
      <ul className="contenedor">
        {categorias.map((c) => (
          <li key={c.id}>
            <a className="boton boton--secundario" href={`#${idCategoria(c.id)}`}>
              {c.nombre}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Categoria({ categoria, accionPlato }) {
  const idTitulo = `${idCategoria(categoria.id)}-titulo`;
  return (
    <section className="categoria" id={idCategoria(categoria.id)} aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{categoria.nombre}</h2>
      <ul className="platos">
        {categoria.platos.map((p) => (
          <Plato key={p.id} plato={p} accion={accionPlato?.(p)} />
        ))}
      </ul>
    </section>
  );
}

/** Lista de alérgenos de un plato, siempre visible (o «Sin alérgenos»). */
export function Alergenos({ plato }) {
  return (
    <ul className="etiquetas" aria-label="Alérgenos">
      {plato.sinAlergenos ? (
        <li className="etiqueta">Sin alérgenos</li>
      ) : (
        plato.alergenos.map((a) => (
          <li key={a} className="etiqueta">
            {nombreAlergeno(a)}
          </li>
        ))
      )}
    </ul>
  );
}

/**
 * Página de la carta: cabecera, índice y categorías. `antes` va tras la cabecera (mesa, avisos),
 * `accionPlato` añade a cada plato su control de pedido y `despues` va tras la carta (barra del pedido).
 */
export function VistaCarta({ carta, error = false, antes = null, accionPlato, despues = null }) {
  return (
    <>
      <div className="contenedor">
        <Cabecera />
        {antes}
      </div>
      {carta && carta.categorias.length > 0 && <Indice categorias={carta.categorias} />}
      <main className="contenedor">
        {error && <p className="estado" role="alert">No se ha podido cargar la carta. Recargue la página.</p>}
        {!error && !carta && <p className="estado">Cargando la carta…</p>}
        {carta && carta.categorias.length === 0 && <p className="estado">La carta está vacía por ahora.</p>}
        {carta?.categorias.map((c) => <Categoria key={c.id} categoria={c} accionPlato={accionPlato} />)}
      </main>
      <footer className="contenedor pie">
        <p>Precios con IVA incluido.</p>
      </footer>
      {despues}
    </>
  );
}

function Foto({ src, nombre }) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) return null;
  return (
    <img
      className="plato__foto"
      src={src}
      alt={`Foto de ${nombre}`}
      width="800"
      height="600"
      loading="lazy"
      decoding="async"
      onError={() => setFallo(true)}
    />
  );
}

export function Plato({ plato, accion = null }) {
  return (
    <li className="plato" data-plato={plato.nombre}>
      <div className="plato__cabecera">
        <h3 className="plato__nombre">{plato.nombre}</h3>
        <span className="plato__precio">{formatearPrecio(plato.precioCentimos)}</span>
      </div>
      {plato.agotado && (
        <p>
          <span className="etiqueta etiqueta--agotado">Agotado</span>
        </p>
      )}
      {plato.descripcion && <p className="plato__descripcion">{plato.descripcion}</p>}
      <Foto src={plato.foto} nombre={plato.nombre} />
      <Alergenos plato={plato} />
      {accion}
    </li>
  );
}
