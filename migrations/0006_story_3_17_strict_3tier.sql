-- Migration: 0006_story_3_17_strict_3tier.sql
-- Paradigm 3: Strict 3-Tier Hierarchy schema alignment for Cloudflare D1 / SQLite

PRAGMA foreign_keys = OFF;

-- 1. Product Lines Collection (Tier 1)
CREATE TABLE IF NOT EXISTS product_lines (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  story TEXT,
  default_price NUMERIC,
  hero_image_id INTEGER REFERENCES media(id) ON UPDATE NO ACTION ON DELETE SET NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS product_lines_slug_idx ON product_lines (slug);

-- 2. Products table columns for Paradigm 3
ALTER TABLE products ADD COLUMN product_line_id_id TEXT REFERENCES product_lines(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN price NUMERIC;

-- 3. Payload locked documents relationship alignment
ALTER TABLE payload_locked_documents_rels ADD COLUMN product_lines_id TEXT;
