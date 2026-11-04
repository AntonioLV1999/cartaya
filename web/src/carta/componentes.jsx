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

export function Categoria({ categoria }) {
  const idTitulo = `${idCategoria(categoria.id)}-titulo`;
  return (
    <section className="categoria" id={idCategoria(categoria.id)} aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{categoria.nombre}</h2>
      <ul className="platos">
        {categoria.platos.map((p) => (
          <Plato key={p.id} plato={p} />
        ))}
      </ul>
    </section>
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

export function Plato({ plato }) {
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
    </li>
  );
}
