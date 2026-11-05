import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ESQUEMA = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');

/** Abre (y crea si hace falta) la base de datos y aplica el esquema. ':memory:' para tests. */
export function abrirBD(ruta) {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(ESQUEMA);
  // Versión 3: CREATE TABLE IF NOT EXISTS no añade columnas a una tabla ya existente.
  // Se mira la columna y no user_version, que el esquema acaba de sobrescribir.
  const columnas = db.prepare('PRAGMA table_info(pedidos)').all();
  if (!columnas.some((c) => c.name === 'cancelado_en')) db.exec('ALTER TABLE pedidos ADD COLUMN cancelado_en INTEGER');
  return db;
}
