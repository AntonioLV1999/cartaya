import { useCallback, useEffect, useState } from 'react';
import { api } from '../admin/api.js';
import { Login } from '../admin/Login.jsx';
import { PanelCocina } from './PanelCocina.jsx';

export function AppCocina() {
  // null: comprobando; false: sin sesión; true: sesión abierta
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    api('GET', '/api/sesion').then(
      (r) => setSesion(r.abierta),
      () => setSesion(false),
    );
  }, []);

  const sesionCaducada = useCallback(() => setSesion(false), []);

  // Primero se desmonta el panel: su EventSource se cierra sin esperar a la respuesta.
  const salir = useCallback(() => {
    setSesion(false);
    api('DELETE', '/api/sesion').catch(() => {});
  }, []);

  if (sesion === null) return <main className="contenedor"><p className="estado">Cargando…</p></main>;
  if (!sesion) return <Login titulo="La Estación · Cocina" onEntrar={() => setSesion(true)} />;
  return <PanelCocina onSalir={salir} onSesionCaducada={sesionCaducada} />;
}
