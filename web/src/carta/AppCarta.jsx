import { useEffect, useState } from 'react';
import { Cabecera, Indice, Categoria } from './componentes.jsx';

export async function cargarCarta() {
  // Mismo modo que el <link rel="preload" crossorigin="anonymous"> para reutilizar la respuesta.
  const r = await fetch('/api/carta', { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function AppCarta({ cargar = cargarCarta }) {
  const [carta, setCarta] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    cargar().then(setCarta, () => setError(true));
  }, [cargar]);

  useEffect(() => {
    // Marca medida por el test de rendimiento: el texto completo de la carta ya está pintado.
    if (carta) performance.mark?.('carta-texto-visible');
  }, [carta]);

  return (
    <>
      <div className="contenedor">
        <Cabecera />
      </div>
      {carta && carta.categorias.length > 0 && <Indice categorias={carta.categorias} />}
      <main className="contenedor">
        {error && <p className="estado" role="alert">No se ha podido cargar la carta. Recargue la página.</p>}
        {!error && !carta && <p className="estado">Cargando la carta…</p>}
        {carta && carta.categorias.length === 0 && <p className="estado">La carta está vacía por ahora.</p>}
        {carta?.categorias.map((c) => <Categoria key={c.id} categoria={c} />)}
      </main>
      <footer className="contenedor pie">
        <p>Precios con IVA incluido.</p>
      </footer>
    </>
  );
}
