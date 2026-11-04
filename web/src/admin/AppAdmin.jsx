import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { Login } from './Login.jsx';
import { Panel } from './Panel.jsx';

export function AppAdmin() {
  // null: comprobando; false: sin sesión; true: sesión abierta
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    api('GET', '/api/sesion').then(
      (r) => setSesion(r.abierta),
      () => setSesion(false),
    );
  }, []);

  const salir = useCallback(async () => {
    try {
      await api('DELETE', '/api/sesion');
    } finally {
      setSesion(false);
    }
  }, []);

  if (sesion === null) return <main className="contenedor"><p className="estado">Cargando…</p></main>;
  if (!sesion) return <Login onEntrar={() => setSesion(true)} />;
  return <Panel onSalir={salir} onSesionCaducada={() => setSesion(false)} />;
}
