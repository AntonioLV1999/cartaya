import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { abrirBD } from './db.js';
import { ALERGENOS, CODIGOS_ALERGENOS } from './alergenos.js';

test('Esquema: se crea en una BD vacía con sus tablas y versión', () => {
  const db = abrirBD(':memory:');
  const tablas = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((t) => t.name);
  assert.deepEqual(tablas, [
    'categorias', 'intentos_login', 'mesas', 'pedido_lineas', 'pedidos', 'plato_alergenos', 'platos', 'sesiones',
  ]);
  assert.equal(db.pragma('user_version', { simple: true }), 3);
  const columnas = db.prepare('PRAGMA table_info(platos)').all().map((c) => c.name);
  assert.ok(columnas.includes('agotado'));
  db.close();
});

test('Esquema: aplicarlo dos veces sobre el mismo fichero no falla ni pierde datos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartaya-esquema-'));
  const ruta = join(dir, 'cartaya.db');
  const db1 = abrirBD(ruta);
  db1.prepare("INSERT INTO categorias (nombre, posicion) VALUES ('Bebidas', 1)").run();
  db1.close();
  const db2 = abrirBD(ruta);
  assert.equal(db2.pragma('journal_mode', { simple: true }), 'wal');
  assert.equal(db2.prepare('SELECT COUNT(*) AS n FROM categorias').get().n, 1);
  db2.close();
  rmSync(dir, { recursive: true, force: true });
});

test('Esquema: una BD de la versión 1 con datos pasa a la versión actual sin perderlos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartaya-esquema-v1-'));
  const ruta = join(dir, 'cartaya.db');
  // Esquema de la versión 1 tal como se desplegó (sin mesas ni pedidos).
  const v1 = new Database(ruta);
  v1.exec(`
    CREATE TABLE categorias (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, posicion INTEGER NOT NULL, archivada_en TEXT);
    CREATE TABLE platos (id INTEGER PRIMARY KEY, categoria_id INTEGER NOT NULL REFERENCES categorias(id),
      nombre TEXT NOT NULL, precio_centimos INTEGER NOT NULL, descripcion TEXT NOT NULL DEFAULT '', foto TEXT,
      sin_alergenos INTEGER NOT NULL DEFAULT 0, agotado INTEGER NOT NULL DEFAULT 0, posicion INTEGER NOT NULL, archivado_en TEXT);
    INSERT INTO categorias (id, nombre, posicion) VALUES (1, 'Bebidas', 1);
    INSERT INTO platos (categoria_id, nombre, precio_centimos, sin_alergenos, posicion) VALUES (1, 'Café con leche', 150, 1, 1);
    PRAGMA user_version = 1;`);
  v1.close();
  const db = abrirBD(ruta);
  assert.equal(db.pragma('user_version', { simple: true }), 3);
  assert.equal(db.prepare('SELECT nombre, precio_centimos FROM platos').get().nombre, 'Café con leche');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mesas').get().n, 0);
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('Esquema: una BD de la versión 2 con pedidos gana cancelado_en sin perderlos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartaya-esquema-v2-'));
  const ruta = join(dir, 'cartaya.db');
  // Tablas de pedidos de la versión 2 tal como se desplegaron (sin cancelado_en).
  const v2 = new Database(ruta);
  v2.exec(`
    CREATE TABLE mesas (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, codigo TEXT NOT NULL UNIQUE, archivada_en TEXT);
    CREATE TABLE pedidos (id INTEGER PRIMARY KEY, mesa_id INTEGER NOT NULL REFERENCES mesas(id), mesa_nombre TEXT NOT NULL,
      dia TEXT NOT NULL, numero INTEGER NOT NULL CHECK (numero > 0), token TEXT NOT NULL UNIQUE,
      estado TEXT NOT NULL DEFAULT 'recibido', total_centimos INTEGER NOT NULL CHECK (total_centimos > 0),
      creado_en INTEGER NOT NULL, UNIQUE (dia, numero));
    INSERT INTO mesas (id, nombre, codigo) VALUES (1, 'Mesa 7', 'k3f9q2txab');
    INSERT INTO pedidos (mesa_id, mesa_nombre, dia, numero, token, total_centimos, creado_en)
      VALUES (1, 'Mesa 7', '2026-11-03', 15, 'tokenDePrueba', 300, 1000);
    PRAGMA user_version = 2;`);
  v2.close();
  const db = abrirBD(ruta);
  assert.equal(db.pragma('user_version', { simple: true }), 3);
  const pedido = db.prepare('SELECT * FROM pedidos').get();
  assert.equal(pedido.numero, 15);
  assert.equal(pedido.estado, 'recibido');
  assert.equal(pedido.cancelado_en, null);
  db.close();
  // Abrirla otra vez no vuelve a añadir la columna.
  const otraVez = abrirBD(ruta);
  assert.equal(otraVez.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n, 1);
  otraVez.close();
  rmSync(dir, { recursive: true, force: true });
});

test('Esquema: un DELETE de mesas falla', () => {
  const db = abrirBD(':memory:');
  db.prepare("INSERT INTO mesas (nombre, codigo) VALUES ('Mesa 1', 'abc')").run();
  assert.throws(() => db.prepare('DELETE FROM mesas').run(), /no se borran/);
  db.close();
});

test('Esquema: un DELETE de platos o categorías falla', () => {
  const db = abrirBD(':memory:');
  db.prepare("INSERT INTO categorias (id, nombre, posicion) VALUES (1, 'Bebidas', 1)").run();
  db.prepare("INSERT INTO platos (categoria_id, nombre, precio_centimos, sin_alergenos, posicion) VALUES (1, 'Agua', 100, 1, 1)").run();
  assert.throws(() => db.prepare('DELETE FROM platos').run(), /no se borran/);
  assert.throws(() => db.prepare('DELETE FROM categorias').run(), /no se borran/);
  db.close();
});

test('Alérgenos: hay exactamente 14 y coinciden con el CHECK del esquema', () => {
  assert.equal(ALERGENOS.length, 14);
  assert.equal(new Set(CODIGOS_ALERGENOS).size, 14);
  const db = abrirBD(':memory:');
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'plato_alergenos'").get().sql;
  const enCheck = [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...enCheck].sort(), [...CODIGOS_ALERGENOS].sort());
  db.prepare("INSERT INTO categorias (id, nombre, posicion) VALUES (1, 'B', 1)").run();
  db.prepare("INSERT INTO platos (id, categoria_id, nombre, precio_centimos, posicion) VALUES (1, 1, 'P', 100, 1)").run();
  assert.throws(() => db.prepare("INSERT INTO plato_alergenos VALUES (1, 'trazas')").run(), /CHECK/);
  db.close();
});

test('Alérgenos: todos tienen nombre en español', () => {
  for (const a of ALERGENOS) assert.match(a.nombre, /^[A-ZÁÉÍÓÚ][a-záéíóúñ ]+/);
});
