-- Migration: 0006_story_3_17_flat_tags.sql
-- Paradigm 2: Flat Typed Tags schema alignment for Cloudflare D1 / SQLite

PRAGMA foreign_keys = OFF;

-- 1. Products table SKU column
ALTER TABLE products ADD COLUMN sku TEXT;

-- 2. Products tags subtable (Payload array)
CREATE TABLE IF NOT EXISTS products_tags (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS products_tags_order_idx ON products_tags (_order);
CREATE INDEX IF NOT EXISTS products_tags_parent_id_idx ON products_tags (_parent_id);
