-- server/db/schema.sql
-- Esquema de la base de datos. Refleja el modelo de 3 niveles que ya
-- existía en localStorage (dashboards → boxes → items), más los eventos
-- propios del calendario. Los campos `data` y `metadata` de items se
-- guardan como JSON en TEXT, igual que en localStorage, para que la
-- migración sea directa sin normalizar prematuramente tipos de contenido
-- que todavía pueden cambiar de forma.

CREATE TABLE IF NOT EXISTS dashboards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT 'links',
  layout_config TEXT, -- JSON, solo para type='flex-grid'; NULL en todos los demás (incluido el dashboard por defecto)
  background_url TEXT, -- imagen de fondo propia de este dashboard; NULL = usar el fondo global (Perfil)
  active      INTEGER DEFAULT 0,
  pinned      INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boxes (
  id              TEXT PRIMARY KEY,
  dashboard_id    TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  layout          TEXT DEFAULT 'grid',
  col_span        INTEGER DEFAULT 1,
  title_align     TEXT DEFAULT 'left',
  title_color     TEXT DEFAULT '#f3f4f6',
  title_font      TEXT DEFAULT 'Inter',
  show_title      INTEGER DEFAULT 1,
  link_color      TEXT DEFAULT '#ffffff',
  link_font_size  INTEGER DEFAULT 14,
  bg_color        TEXT DEFAULT '#000000',
  bg_opacity      REAL DEFAULT 0.7,
  grid_cols       INTEGER DEFAULT 2,
  orb_size        INTEGER DEFAULT 80,
  list_row_height TEXT DEFAULT 'normal',
  stats_limit     INTEGER DEFAULT 5,
  rss_feed_url    TEXT,
  rss_count       INTEGER DEFAULT 8,
  calendar_view   TEXT DEFAULT 'month',
  note_id         TEXT REFERENCES notes(id) ON DELETE SET NULL, -- solo para layout='note'
  bullet_style    TEXT DEFAULT 'disc', -- disc | circle | square | arrow (solo notas)
  parent_box_id   TEXT REFERENCES boxes(id) ON DELETE SET NULL, -- si pertenece a una caja contenedora
  container_config TEXT, -- JSON, solo para layout='container' (columnas/proporción internas)
  order_index     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_boxes_dashboard ON boxes(dashboard_id);

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  box_id      TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  type        TEXT DEFAULT 'link',
  order_index INTEGER DEFAULT 0,
  data        TEXT NOT NULL DEFAULT '{}',     -- JSON: { title, url, ... } según el type
  metadata    TEXT NOT NULL DEFAULT '{}'      -- JSON: { clickCount, lastAccessed, createdAt, tags }
);

CREATE INDEX IF NOT EXISTS idx_items_box ON items(box_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,   -- 'YYYY-MM-DD'
  time       TEXT,            -- 'HH:MM' o NULL si es todo el día
  all_day    INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);

-- Tabla de configuración simple clave-valor: sustituye a las keys sueltas
-- de localStorage (weatherApiKey, googleClientId, rssApiKey, preferencias)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ========== AUTENTICACIÓN ==========
-- Pensado para un único usuario doméstico. No hay endpoint público de
-- registro: el usuario se crea con server/scripts/create-user.js,
-- ejecutado directamente en la máquina donde corre el servidor.

CREATE TABLE IF NOT EXISTS users (
  username      TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,  -- hex de scrypt
  password_salt TEXT NOT NULL,  -- hex, aleatorio por usuario
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT  -- NULL = sesión indefinida (elegido por el usuario)
);

-- ========== VERSIÓN DE DATOS ==========
-- Contador que se incrementa en cada escritura (crear/editar/borrar
-- cualquier dashboard, caja, item o evento). El cliente lo compara con
-- su propia copia para saber si hace falta traer datos nuevos, sin tener
-- que descargar el volcado completo solo para comprobarlo.

CREATE TABLE IF NOT EXISTS data_version (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO data_version (id, version) VALUES (1, 0);

-- ========== NOTAS ==========
-- Sistema de notas tipo Keep pero sin el límite de "una nota = un tipo":
-- el contenido es Markdown, así que una misma nota puede mezclar texto,
-- listas, tablas e imágenes libremente. `type` deja preparado el terreno
-- para futuras plantillas de colección (libros, recetas...) sin tener
-- que migrar nada cuando lleguen — de momento todas son 'quick'.
-- `properties` guarda campos estructurados de esas futuras plantillas
-- (vacío por ahora, JSON).

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL DEFAULT 'quick',
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',  -- Markdown
  properties TEXT NOT NULL DEFAULT '{}', -- JSON, para futuras plantillas
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

