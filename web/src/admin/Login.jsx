import { useState } from 'react';
import { api } from './api.js';

export function Login({ onEntrar, titulo = 'La Estación · Administración' }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api('POST', '/api/sesion', { password });
      onEntrar();
    } catch (e) {
      setError(e.mensaje);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="contenedor">
      <div className="admin-barra">
        <h1>{titulo}</h1>
      </div>
      <form className="formulario seccion" onSubmit={entrar} noValidate>
        <h2>Iniciar sesión</h2>
        <div className="campo">
          <label htmlFor="password">Contraseña de establecimiento</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'password-error' : undefined}
            autoFocus
          />
          {error && (
            <p id="password-error" className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="acciones">
          <button className="boton" type="submit" disabled={enviando}>
            Entrar
          </button>
        </div>
      </form>
    </main>
  );
}
