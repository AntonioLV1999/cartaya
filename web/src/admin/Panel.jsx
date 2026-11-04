import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { Categorias } from './Categorias.jsx';
import { Platos } from './Platos.jsx';
import { Archivados } from './Archivados.jsx';

const PESTANAS = [
  ['platos', 'Platos'],
  ['categorias', 'Categorías'],
  ['archivados', 'Archivados'],
];

export function Panel({ onSalir, onSesionCaducada, pestanaInicial = 'platos' }) {
  const [pestana, setPestana] = useState(pestanaInicial);
  const [datos, setDatos] = useState(null);
  const [aviso, setAviso] = useState('');
  const [errorCarga, setErrorCarga] = useState(null);

  const recargar = useCallback(async () => {
    try {
      const [categorias, platos, archivados] = await Promise.all([
        api('GET', '/api/admin/categorias'),
        api('GET', '/api/admin/platos'),
        api('GET', '/api/admin/archivados'),
      ]);
      setDatos({ categorias, platos, archivados });
      setErrorCarga(null);
    } catch (e) {
      if (e.status === 401) onSesionCaducada();
      else setErrorCarga(e.mensaje);
    }
  }, [onSesionCaducada]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  /** Ejecuta una operación, recarga y muestra el resultado. Devuelve el error (o null) para el formulario. */
  const operar = useCallback(
    async (operacion, mensajeOk) => {
      try {
        await operacion();
        setAviso(mensajeOk ?? '');
        await recargar();
        return null;
      } catch (e) {
        if (e.status === 401) {
          onSesionCaducada();
          return null;
        }
        setAviso('');
        return e;
      }
    },
    [recargar, onSesionCaducada],
  );

  return (
    <div className="contenedor">
      <header className="admin-barra">
        <h1>La Estación · Administración</h1>
        <div className="acciones">
          <a className="boton boton--secundario" href="/carta" target="_blank" rel="noopener">
            Ver la carta
          </a>
          <button className="boton boton--secundario" type="button" onClick={onSalir}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="pestanas" aria-label="Secciones de la administración">
        {PESTANAS.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className="boton"
            aria-pressed={pestana === id}
            onClick={() => {
              setPestana(id);
              setAviso('');
            }}
          >
            {texto}
          </button>
        ))}
      </nav>

      <p className="visualmente-oculto" role="status">
        {aviso}
      </p>
      {aviso && <p className="mensaje-ok">{aviso}</p>}
      {errorCarga && (
        <p className="error" role="alert">
          {errorCarga}
        </p>
      )}

      <main>
        {!datos && !errorCarga && <p className="estado">Cargando…</p>}
        {datos && pestana === 'platos' && <Platos datos={datos} operar={operar} />}
        {datos && pestana === 'categorias' && <Categorias categorias={datos.categorias} operar={operar} />}
        {datos && pestana === 'archivados' && (
          <Archivados archivados={datos.archivados} categorias={datos.categorias} operar={operar} />
        )}
      </main>
    </div>
  );
}
