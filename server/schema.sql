-- Esquema de CartaYa. Se aplica en cada arranque (idempotente).
-- PRAGMA user_version marca la versión del esquema para futuras migraciones.

CREATE TABLE IF NOT EXISTS categorias (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),
  posicion      INTEGER NOT NULL,
  archivada_en  TEXT
);

CREATE TABLE IF NOT EXISTS platos (
  id               INTEGER PRIMARY KEY,
  categoria_id     INTEGER NOT NULL REFERENCES categorias(id),
  nombre           TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),
  precio_centimos  INTEGER NOT NULL CHECK (precio_centimos > 0),
  descripcion      TEXT    NOT NULL DEFAULT '' CHECK (length(descripcion) <= 140),
  foto             TEXT,
  sin_alergenos    INTEGER NOT NULL DEFAULT 0 CHECK (sin_alergenos IN (0, 1)),
  agotado          INTEGER NOT NULL DEFAULT 0 CHECK (agotado IN (0, 1)),
  posicion         INTEGER NOT NULL,
  archivado_en     TEXT
);

CREATE INDEX IF NOT EXISTS platos_por_categoria ON platos (categoria_id, posicion);

CREATE TABLE IF NOT EXISTS plato_alergenos (
  plato_id  INTEGER NOT NULL REFERENCES platos(id),
  alergeno  TEXT    NOT NULL CHECK (alergeno IN (
    'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja', 'leche',
    'frutos_cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos', 'altramuces', 'moluscos'
  )),
  PRIMARY KEY (plato_id, alergeno)
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash     TEXT PRIMARY KEY,
  creada_en      INTEGER NOT NULL,
  ultimo_uso_en  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS intentos_login (
  ip       TEXT    NOT NULL,
  momento  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS intentos_por_ip ON intentos_login (ip, momento);

-- ---------- Versión 2: mesas y pedidos ----------

CREATE TABLE IF NOT EXISTS mesas (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL CHECK (length(trim(nombre)) > 0 AND length(nombre) <= 30),
  codigo        TEXT    NOT NULL UNIQUE,
  archivada_en  TEXT
);

-- Un pedido pertenece a una mesa, nunca a una persona: no hay columnas de IP, navegador ni sesión.
CREATE TABLE IF NOT EXISTS pedidos (
  id              INTEGER PRIMARY KEY,
  mesa_id         INTEGER NOT NULL REFERENCES mesas(id),
  mesa_nombre     TEXT    NOT NULL,                -- copia: renombrar la mesa no altera el pedido
  dia           TEXT    NOT NULL,                -- AAAA-MM-DD en hora de Madrid
  numero          INTEGER NOT NULL CHECK (numero > 0),
  token           TEXT    NOT NULL UNIQUE,
  estado          TEXT    NOT NULL DEFAULT 'recibido',
  total_centimos  INTEGER NOT NULL CHECK (total_centimos > 0),
  creado_en       INTEGER NOT NULL,
  cancelado_en    INTEGER,                         -- versión 3 (db.js la añade a las bases ya creadas)
  UNIQUE (dia, numero)
);

CREATE INDEX IF NOT EXISTS pedidos_por_mesa ON pedidos (mesa_id, creado_en);

-- Copia del nombre y el precio del plato en el momento de confirmar (precio histórico).
CREATE TABLE IF NOT EXISTS pedido_lineas (
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id),
  posicion         INTEGER NOT NULL,
  plato_id         INTEGER NOT NULL REFERENCES platos(id),
  nombre           TEXT    NOT NULL,
  precio_centimos  INTEGER NOT NULL CHECK (precio_centimos > 0),
  cantidad         INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  nota             TEXT    NOT NULL DEFAULT '' CHECK (length(nota) <= 140),
  PRIMARY KEY (pedido_id, posicion)
);

CREATE TRIGGER IF NOT EXISTS mesas_no_se_borran BEFORE DELETE ON mesas
BEGIN
  SELECT RAISE(ABORT, 'Las mesas no se borran: se archivan');
END;

-- Los platos y las categorías nunca se borran: se archivan (los pedidos históricos los referencian).
CREATE TRIGGER IF NOT EXISTS platos_no_se_borran BEFORE DELETE ON platos
BEGIN
  SELECT RAISE(ABORT, 'Los platos no se borran: se archivan');
END;

CREATE TRIGGER IF NOT EXISTS categorias_no_se_borran BEFORE DELETE ON categorias
BEGIN
  SELECT RAISE(ABORT, 'Las categorías no se borran: se archivan');
END;

PRAGMA user_version = 3;
