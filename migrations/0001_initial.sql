-- Migration: 0001_initial.sql
-- ChrisShop Catalog Schema for SQLite / Cloudflare D1
-- Conforms to docs/HIGH_LEVEL_DESIGN.md Section 3.2

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  artist_statement TEXT,
  base_price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  category_id TEXT,
  shopify_product_id TEXT UNIQUE,
  featured_image TEXT,
  gallery TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_variations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  shopify_variant_id TEXT UNIQUE,
  variation_name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price_override REAL,
  is_limited_edition INTEGER NOT NULL DEFAULT 1,
  total_edition_count INTEGER,
  release_date TEXT,
  status TEXT NOT NULL DEFAULT 'coming_soon',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_sku ON product_variations(sku);
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_shopify_id ON product_variations(shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
