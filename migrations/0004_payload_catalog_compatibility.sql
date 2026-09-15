-- Migration: 0004_payload_catalog_compatibility.sql
-- Payload CMS v3 & Storefront Relational Catalog Schema (Dual Compatibility)
-- Conforms to Issue #241 & HLD Section 3

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS payload_locked_documents_rels;
DROP TABLE IF EXISTS product_variations_variation_images;
DROP TABLE IF EXISTS product_variations;
DROP TABLE IF EXISTS products_gallery;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT,
  description TEXT,
  image TEXT,
  image_id INTEGER,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON UPDATE NO ACTION ON DELETE SET NULL,
  FOREIGN KEY (image_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories (slug);
CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories (parent_id);
CREATE INDEX IF NOT EXISTS categories_image_idx ON categories (image_id);
CREATE INDEX IF NOT EXISTS categories_updated_at_idx ON categories (updated_at);
CREATE INDEX IF NOT EXISTS categories_created_at_idx ON categories (created_at);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  shopify_product_id TEXT,
  base_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  category_id TEXT,
  category_id_id TEXT,
  featured_image TEXT,
  featured_image_id INTEGER,
  gallery TEXT,
  maker_field_notes TEXT,
  artist_statement TEXT,
  materials TEXT,
  weight TEXT,
  fit_profile TEXT,
  origin TEXT DEFAULT "Hand-cut & sewn in small batches in Chris's workshop",
  description TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (category_id_id) REFERENCES categories(id) ON UPDATE NO ACTION ON DELETE SET NULL,
  FOREIGN KEY (featured_image_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_idx ON products (slug);
CREATE INDEX IF NOT EXISTS products_shopify_product_id_idx ON products (shopify_product_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id_id);
CREATE INDEX IF NOT EXISTS products_featured_image_idx ON products (featured_image_id);
CREATE INDEX IF NOT EXISTS products_updated_at_idx ON products (updated_at);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON products (created_at);

CREATE TABLE IF NOT EXISTS products_gallery (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  image_id INTEGER NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES products(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS products_gallery_order_idx ON products_gallery (_order);
CREATE INDEX IF NOT EXISTS products_gallery_parent_id_idx ON products_gallery (_parent_id);
CREATE INDEX IF NOT EXISTS products_gallery_image_idx ON products_gallery (image_id);

CREATE TABLE IF NOT EXISTS product_variations (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT,
  product_id_id TEXT,
  shopify_variant_id TEXT,
  variation_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  variation_type TEXT DEFAULT 'standard',
  edition_badge TEXT,
  variation_notes TEXT,
  variation_images TEXT,
  price_override NUMERIC,
  is_limited_edition INTEGER DEFAULT 1,
  total_edition_count NUMERIC,
  stock_quantity INTEGER DEFAULT 10,
  release_date TEXT,
  status TEXT DEFAULT 'coming_soon' NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (product_id_id) REFERENCES products(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variations_sku_idx ON product_variations (sku);
CREATE INDEX IF NOT EXISTS product_variations_product_id_idx ON product_variations (product_id_id);
CREATE INDEX IF NOT EXISTS product_variations_shopify_variant_id_idx ON product_variations (shopify_variant_id);
CREATE INDEX IF NOT EXISTS product_variations_updated_at_idx ON product_variations (updated_at);
CREATE INDEX IF NOT EXISTS product_variations_created_at_idx ON product_variations (created_at);

CREATE TABLE IF NOT EXISTS product_variations_variation_images (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  image_id INTEGER NOT NULL,
  caption TEXT,
  FOREIGN KEY (_parent_id) REFERENCES product_variations(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS product_variations_variation_images_order_idx ON product_variations_variation_images (_order);
CREATE INDEX IF NOT EXISTS product_variations_variation_images_parent_id_idx ON product_variations_variation_images (_parent_id);
CREATE INDEX IF NOT EXISTS product_variations_variation_images_image_idx ON product_variations_variation_images (image_id);

CREATE TABLE IF NOT EXISTS payload_locked_documents_rels (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  categories_id TEXT,
  products_id TEXT,
  product_variations_id TEXT,
  media_id INTEGER,
  users_id INTEGER,
  FOREIGN KEY (_parent_id) REFERENCES payload_locked_documents(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (categories_id) REFERENCES categories(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (products_id) REFERENCES products(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (product_variations_id) REFERENCES product_variations(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (users_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_order_idx ON payload_locked_documents_rels (_order);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_parent_idx ON payload_locked_documents_rels (_parent_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_path_idx ON payload_locked_documents_rels (path);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_categories_id_idx ON payload_locked_documents_rels (categories_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_products_id_idx ON payload_locked_documents_rels (products_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_product_variations_id_idx ON payload_locked_documents_rels (product_variations_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_media_id_idx ON payload_locked_documents_rels (media_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_users_id_idx ON payload_locked_documents_rels (users_id);

PRAGMA foreign_keys = ON;
