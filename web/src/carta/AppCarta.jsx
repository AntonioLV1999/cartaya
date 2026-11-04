import { useEffect, useState } from 'react';
import { VistaCarta } from './componentes.jsx';
import { MENSAJE_SOLO_CONSULTA } from '../../../server/textos.js';

export async function cargarCarta() {
  // Mismo modo que el <link rel="preload" crossorigin="anonymous"> para reutilizar la respuesta.
  const r = await fetch('/api/carta', { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Nombre de la mesa activa con ese código, o null si no existe o está archivada. */
export async function cargarMesa(codigo) {
  const r = await fetch(`/api/mesas/${encodeURIComponent(codigo)}`, { credentials: 'same-origin' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** El código del pedido solo se descarga en las rutas de mesa: /carta no crece. */
const cargarModuloPedido = () => import('./pedido/PaginaMesa.jsx');

/** `/` y `/carta` → consulta; `/mesa/<código>` → carta de la mesa; `/mesa/<código>/pedidos/<token>` → confirmación. */
export function analizarRuta(ruta) {
  const m = /^\/mesa\/([^/]+)(?:\/pedidos\/([^/]+))?\/?$/.exec(ruta);
  if (!m) return { tipo: 'carta' };
  const codigo = decodeURIComponent(m[1]);
  return m[2] ? { tipo: 'pedido', codigo, token: decodeURIComponent(m[2]) } : { tipo: 'mesa', codigo };
}

export function AviseSoloConsulta() {
  return <p className="aviso-pedir">{MENSAJE_SOLO_CONSULTA}</p>;
}

export function AppCarta({
  cargar = cargarCarta,
  cargarMesaPorCodigo = cargarMesa,
  cargarModulo = cargarModuloPedido,
  ruta = typeof location === 'undefined' ? '/carta' : location.pathname,
}) {
  const [destino] = useState(() => analizarRuta(ruta));
  const [carta, setCarta] = useState(null);
  const [error, setError] = useState(false);
  // undefined = comprobando; null = no se puede pedir; {nombre} = mesa activa.
  const [mesa, setMesa] = useState(destino.tipo === 'carta' ? null : undefined);
  const [modulo, setModulo] = useState(null);

  useEffect(() => {
    if (destino.tipo === 'pedido') return;
    cargar().then(setCarta, () => setError(true));
  }, [cargar, destino]);

  useEffect(() => {
    if (destino.tipo === 'carta') return;
    cargarModulo().then(setModulo, () => setMesa(null));
    if (destino.tipo === 'mesa') cargarMesaPorCodigo(destino.codigo).then(setMesa, () => setMesa(null));
  }, [cargarMesaPorCodigo, cargarModulo, destino]);

  useEffect(() => {
    // Marca medida por el test de rendimiento: el texto completo de la carta ya está pintado.
    if (carta) performance.mark?.('carta-texto-visible');
  }, [carta]);

  if (destino.tipo === 'pedido') {
    if (!modulo) return <VistaCarta carta={null} antes={<p className="estado">Cargando su pedido…</p>} />;
    return <modulo.PaginaMesa codigo={destino.codigo} tokenInicial={destino.token} />;
  }
  if (modulo && mesa && carta) {
    return <modulo.PaginaMesa codigo={destino.codigo} mesa={mesa} carta={carta} />;
  }
  // Consulta: sin mesa, con un código no válido o mientras se comprueba la mesa.
  return <VistaCarta carta={carta} error={error} antes={mesa === null ? <AviseSoloConsulta /> : null} />;
}
