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

-- Los platos y las categorías nunca se borran: se archivan (los pedidos históricos los referencian).
CREATE TRIGGER IF NOT EXISTS platos_no_se_borran BEFORE DELETE ON platos
BEGIN
  SELECT RAISE(ABORT, 'Los platos no se borran: se archivan');
END;

CREATE TRIGGER IF NOT EXISTS categorias_no_se_borran BEFORE DELETE ON categorias
BEGIN
  SELECT RAISE(ABORT, 'Las categorías no se borran: se archivan');
END;

PRAGMA user_version = 1;
