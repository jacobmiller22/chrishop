-- Migration: 0006_story_3_17_hybrid_product_first.sql
-- Paradigm 1: Hybrid Product-First schema alignment for Cloudflare D1 / SQLite

PRAGMA foreign_keys = OFF;

-- 1. Product Lines Collection
CREATE TABLE IF NOT EXISTS product_lines (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  story TEXT,
  default_price NUMERIC,
  hero_image TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS product_lines_slug_idx ON product_lines (slug);

-- 2. Products table columns for Paradigm 1
ALTER TABLE products ADD COLUMN product_line_id_id TEXT REFERENCES product_lines(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN price NUMERIC;
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'packs';

-- 3. Products gallery caption support
ALTER TABLE products_gallery ADD COLUMN caption TEXT;

-- 4. Products options subtable (Payload array)
CREATE TABLE IF NOT EXISTS products_options (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  sku_suffix TEXT,
  FOREIGN KEY (_parent_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS products_options_order_idx ON products_options (_order);
CREATE INDEX IF NOT EXISTS products_options_parent_id_idx ON products_options (_parent_id);

-- 5. Payload locked documents relationship alignment
ALTER TABLE payload_locked_documents_rels ADD COLUMN product_lines_id TEXT;
