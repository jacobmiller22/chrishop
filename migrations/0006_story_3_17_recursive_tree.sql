-- Migration: 0006_story_3_17_recursive_tree.sql
-- Paradigm 4: Recursive Node Tree schema alignment for Cloudflare D1 / SQLite

PRAGMA foreign_keys = OFF;

-- 1. Products self-referential parent, node role, and SKU columns
ALTER TABLE products ADD COLUMN parent_id TEXT REFERENCES products(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN parent_id_id TEXT REFERENCES products(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN node_role TEXT DEFAULT 'model';
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN price NUMERIC;

-- 2. Indexes for recursive tree traversals
CREATE INDEX IF NOT EXISTS products_parent_idx ON products (parent_id);
CREATE INDEX IF NOT EXISTS products_parent_id_idx ON products (parent_id_id);
CREATE INDEX IF NOT EXISTS products_node_role_idx ON products (node_role);

-- 3. Purge obsolete ProductVariations (Candidate 4 Pure Recursive Tree)
DROP TABLE IF EXISTS product_variations_variation_images;
DROP TABLE IF EXISTS product_variations;
