-- Migration: 0002_payload_tables.sql
-- Payload CMS v3 Core & Auth Schema for SQLite / Cloudflare D1
-- Conforms to docs/HIGH_LEVEL_DESIGN.md Section 3.1, DEP_PAYLOAD_CMS.md, and Story 2.46

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  email TEXT NOT NULL,
  reset_password_token TEXT,
  reset_password_expiration TEXT,
  salt TEXT,
  hash TEXT,
  login_attempts NUMERIC DEFAULT 0,
  lock_until TEXT
);

CREATE INDEX IF NOT EXISTS users_updated_at_idx ON users (updated_at);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS users_sessions (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS users_sessions_order_idx ON users_sessions (_order);
CREATE INDEX IF NOT EXISTS users_sessions_parent_id_idx ON users_sessions (_parent_id);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  alt TEXT NOT NULL,
  caption TEXT,
  prefix TEXT DEFAULT 'uploads',
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  url TEXT,
  thumbnail_u_r_l TEXT,
  filename TEXT,
  mime_type TEXT,
  filesize NUMERIC,
  width NUMERIC,
  height NUMERIC,
  focal_x NUMERIC,
  focal_y NUMERIC
);

CREATE INDEX IF NOT EXISTS media_updated_at_idx ON media (updated_at);
CREATE INDEX IF NOT EXISTS media_created_at_idx ON media (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS media_filename_idx ON media (filename);

CREATE TABLE IF NOT EXISTS payload_kv (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payload_kv_key_idx ON payload_kv (key);

CREATE TABLE IF NOT EXISTS payload_locked_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  global_slug TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS payload_locked_documents_global_slug_idx ON payload_locked_documents (global_slug);
CREATE INDEX IF NOT EXISTS payload_locked_documents_updated_at_idx ON payload_locked_documents (updated_at);
CREATE INDEX IF NOT EXISTS payload_locked_documents_created_at_idx ON payload_locked_documents (created_at);

CREATE TABLE IF NOT EXISTS payload_locked_documents_rels (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "order" INTEGER,
  parent_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  categories_id TEXT,
  products_id TEXT,
  product_variations_id TEXT,
  media_id INTEGER,
  users_id INTEGER,
  FOREIGN KEY (parent_id) REFERENCES payload_locked_documents(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (categories_id) REFERENCES categories(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (products_id) REFERENCES products(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (product_variations_id) REFERENCES product_variations(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (users_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payload_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  key TEXT,
  value TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS payload_preferences_key_idx ON payload_preferences (key);
CREATE INDEX IF NOT EXISTS payload_preferences_updated_at_idx ON payload_preferences (updated_at);
CREATE INDEX IF NOT EXISTS payload_preferences_created_at_idx ON payload_preferences (created_at);

CREATE TABLE IF NOT EXISTS payload_preferences_rels (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "order" INTEGER,
  parent_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  users_id INTEGER,
  FOREIGN KEY (parent_id) REFERENCES payload_preferences(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (users_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payload_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT,
  batch NUMERIC,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS payload_migrations_updated_at_idx ON payload_migrations (updated_at);
CREATE INDEX IF NOT EXISTS payload_migrations_created_at_idx ON payload_migrations (created_at);
