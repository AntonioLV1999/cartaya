import { useState } from 'react';
import { api } from './api.js';

function PlatoArchivado({ plato, categorias, operar }) {
  const [destino, setDestino] = useState('');
  const [error, setError] = useState(null);
  const necesitaCategoria = plato.categoriaArchivada;
  const idSelector = `recuperar-plato-${plato.id}-categoria`;

  async function recuperar() {
    const cuerpo = necesitaCategoria && destino ? { categoriaId: Number(destino) } : {};
    const e = await operar(() => api('POST', `/api/admin/platos/${plato.id}/recuperar`, cuerpo), `Plato «${plato.nombre}» recuperado.`);
    setError(e?.mensaje ?? null);
  }

  return (
    <li className="fila" data-plato={plato.nombre}>
      <p className="fila__titulo">{plato.nombre}</p>
      <p>
        Categoría: {plato.categoriaNombre}
        {necesitaCategoria && ' (archivada)'}
      </p>
      {necesitaCategoria && (
        <div className="campo">
          <label htmlFor={idSelector}>Recuperar en la categoría</label>
          <select id={idSelector} value={destino} onChange={(e) => setDestino(e.target.value)}
            aria-describedby={error ? `${idSelector}-error` : undefined}>
            <option value="">Elija una categoría…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="acciones">
        <button className="boton" type="button" onClick={recuperar} aria-label={`Recuperar ${plato.nombre}`}>
          Recuperar
        </button>
      </div>
      {error && (
        <p id={`${idSelector}-error`} className="error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function CategoriaArchivada({ categoria, operar }) {
  const [error, setError] = useState(null);
  async function recuperar() {
    const e = await operar(
      () => api('POST', `/api/admin/categorias/${categoria.id}/recuperar`),
      `Categoría «${categoria.nombre}» recuperada. Sus platos se recuperan uno a uno.`,
    );
    setError(e?.mensaje ?? null);
  }
  return (
    <li className="fila" data-categoria={categoria.nombre}>
      <p className="fila__titulo">{categoria.nombre}</p>
      <div className="acciones">
        <button className="boton" type="button" onClick={recuperar} aria-label={`Recuperar ${categoria.nombre}`}>
          Recuperar
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function Archivados({ archivados, categorias, operar }) {
  return (
    <section className="seccion" aria-labelledby="titulo-archivados">
      <h2 id="titulo-archivados">Archivados</h2>
      <p>Lo que elimina no se pierde: aparece aquí y puede recuperarlo.</p>

      <h3>Platos archivados</h3>
      {archivados.platos.length === 0 ? (
        <p>No hay platos archivados.</p>
      ) : (
        <ul className="lista">
          {archivados.platos.map((p) => (
            <PlatoArchivado key={p.id} plato={p} categorias={categorias} operar={operar} />
          ))}
        </ul>
      )}

      <h3>Categorías archivadas</h3>
      {archivados.categorias.length === 0 ? (
        <p>No hay categorías archivadas.</p>
      ) : (
        <ul className="lista">
          {archivados.categorias.map((c) => (
            <CategoriaArchivada key={c.id} categoria={c} operar={operar} />
          ))}
        </ul>
      )}
    </section>
  );
}
