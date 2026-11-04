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
  return db;
}
