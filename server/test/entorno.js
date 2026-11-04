// Utilidades compartidas por los tests de la API (node:test + supertest).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { abrirBD } from '../db.js';
import { crearApp } from '../app.js';
import { hashPassword } from '../password.js';

export const PASSWORD = 'cafe-con-leche-2026';
const HASH = hashPassword(PASSWORD);

/**
 * Crea una app aislada con BD en memoria y carpeta de datos temporal.
 * `reloj.t` permite adelantar el tiempo en los tests de caducidad.
 */
export function crearEntorno({ produccion = false } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'cartaya-test-'));
  const db = abrirBD(':memory:');
  const reloj = { t: Date.parse('2026-11-04T10:00:00Z') };
  const app = crearApp({ db, passwordHash: HASH, dataDir, produccion, ahora: () => reloj.t });
  return {
    app,
    db,
    dataDir,
    reloj,
    hash: HASH,
    cerrar() {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Devuelve un agente de supertest con la sesión de establecimiento ya abierta. */
export async function agenteConSesion(app) {
  const agente = request.agent(app);
  const r = await agente.post('/api/sesion').send({ password: PASSWORD });
  if (r.status !== 200) throw new Error(`No se pudo iniciar sesión: ${r.status}`);
  return agente;
}

/** Crea categorías y platos rápidamente a través de la API. */
export function ayudante(agente) {
  return {
    async categoria(nombre) {
      const r = await agente.post('/api/admin/categorias').send({ nombre });
      if (r.status !== 201) throw new Error(`categoria ${nombre}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body;
    },
    async plato(categoriaId, nombre, extra = {}) {
      const r = await agente
        .post('/api/admin/platos')
        .send({ categoriaId, nombre, precio: '2,00', sinAlergenos: true, ...extra });
      if (r.status !== 201) throw new Error(`plato ${nombre}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body;
    },
  };
}
