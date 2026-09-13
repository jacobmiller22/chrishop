-- BankBeaters Adventure Gear D1 Seed Script
PRAGMA foreign_keys = ON;
-- Schema Migration: 0001_initial.sql
-- Migration: 0001_initial.sql
-- ChrisShop Catalog Schema for SQLite / Cloudflare D1
-- Conforms to docs/HIGH_LEVEL_DESIGN.md Section 3.2

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id TEXT,
  description TEXT,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  maker_field_notes TEXT,
  artist_statement TEXT,
  materials TEXT,
  weight TEXT,
  fit_profile TEXT,
  origin TEXT,
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
  variation_type TEXT NOT NULL DEFAULT 'standard',
  edition_badge TEXT,
  variation_notes TEXT,
  variation_images TEXT,
  price_override REAL,
  is_limited_edition INTEGER NOT NULL DEFAULT 1,
  total_edition_count INTEGER,
  stock_quantity INTEGER NOT NULL DEFAULT 1,
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
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Schema Migration: 0002_payload_tables.sql
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

-- Schema Migration: 0003_payload_catalog_tables.sql
-- Migration: 0003_payload_catalog_tables.sql
-- Payload CMS v3 Catalog Schema for Cloudflare D1 / SQLite
-- Reconciles categories, products, and product_variations with Payload Drizzle ORM
-- Conforms to HLD Section 3.2, DEP_PAYLOAD_CMS.md, and Issue #241

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

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_order_idx ON payload_locked_documents_rels ("order");
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_parent_idx ON payload_locked_documents_rels (parent_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_path_idx ON payload_locked_documents_rels (path);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_categories_id_idx ON payload_locked_documents_rels (categories_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_products_id_idx ON payload_locked_documents_rels (products_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_product_variations_id_idx ON payload_locked_documents_rels (product_variations_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_media_id_idx ON payload_locked_documents_rels (media_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_users_id_idx ON payload_locked_documents_rels (users_id);

PRAGMA foreign_keys = ON;

INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-accessories', 'Field Accessories', 'field-accessories', NULL, 'Waxed canvas tool rolls, Kevlar-reinforced casting gloves, and floating brim guide caps.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-apparel', 'Apparel', 'apparel', NULL, 'Technical foul-weather outerwear, guide pants, and active midlayers hand-sewn for bank anglers.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-packs', 'Packs & Carry', 'packs-carry', NULL, 'Waterproof composite lumbar slings, modular chest rigs, and submersible gear duffels.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-gloves', 'Gloves & Handwear', 'gloves', 'cat-accessories', 'Braid-resistant Kevlar stripping gloves and sun protection.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-headwear', 'Caps & Headwear', 'headwear', 'cat-accessories', 'Floating brim 5-panel guide caps and waxed cotton sun covers.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-tool-rolls', 'Tool Rolls & Wallets', 'tool-rolls', 'cat-accessories', 'Martexin waxed canvas leader rolls and tool organizers.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-midlayers', 'Midlayers & Fleece', 'midlayers', 'cat-apparel', 'Breathable grid fleece pullovers and thermal insulation.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-outerwear', 'Outerwear', 'outerwear', 'cat-apparel', 'Weather-defense storm shells, wind anoraks, and wading jackets.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-pants', 'Pants & Shorts', 'pants', 'cat-apparel', 'Heavyweight ripstop guide pants with Cordura brush reinforcement.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-storm-shells', 'Waterproof Storm Shells', 'waterproof-storm-shells', 'cat-outerwear', '3-layer fully seam-taped waterproof breathable membranes with Cordura abrasion armor.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-chest-rigs', 'Chest Rigs & Harnesses', 'chest-rigs', 'cat-packs', 'Modular chest workstations with drop-down fly/tackle shelves.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-dry-bags', 'Submersible Bags', 'dry-bags', 'cat-packs', 'RF-welded TPU submersible bags that keep essentials dry in marsh mud.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-sling-packs', 'Lumbar & Sling Packs', 'sling-packs', 'cat-packs', 'One-handed access lumbar and sling packs engineered for uninhibited casting.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES ('cat-brush-pants', 'Technical Brush Pants', 'technical-brush-pants', 'cat-pants', '4-way stretch DWR pants with 1000D Cordura knee and ankle scuff guards.', NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;
-- Purge any legacy mock collectibles if present
DELETE FROM product_variations WHERE product_id NOT IN ('prod-bushwhack-anorak', 'prod-bramble-buster-pant', 'prod-cutbank-sling-pack', 'prod-minimalist-chest-rig', 'prod-waxed-tool-roll', 'prod-5panel-guide-cap');
DELETE FROM products WHERE id NOT IN ('prod-bushwhack-anorak', 'prod-bramble-buster-pant', 'prod-cutbank-sling-pack', 'prod-minimalist-chest-rig', 'prod-waxed-tool-roll', 'prod-5panel-guide-cap');
INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, category_id_id, shopify_product_id, featured_image, gallery) VALUES ('prod-5panel-guide-cap', 'The BankBeaters 5-Panel Guide Cap', 'the-bankbeaters-5-panel-guide-cap', 'Waxed cotton 5-panel guide cap engineered with an unsinkable floatable EVA foam brim, dark glare-reducing underbill, and breathable brass ventilation eyelets.', 'If your hat blows off in a river rapid, normal caps sink immediately. We built this with an EVA foam core brim that stays buoyant and recovers its shape after being stuffed into a pack for three days.', 'If your hat blows off in a river rapid, normal caps sink immediately. We built this with an EVA foam core brim that stays buoyant and recovers its shape after being stuffed into a pack for three days.', 'Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim, Antiqued Brass Mesh Eyelets', '2.9 oz (82g)', 'Low Crown 5-Panel with Nylon Webbing Quick-Release Adjuster', 'Sewn and shaped in workshop', 44, 'published', 'cat-headwear', 'cat-headwear', 'gid://shopify/Product/106', '/media/the-bankbeaters-5-panel-guide-cap/hero.jpeg', '["/media/the-bankbeaters-5-panel-guide-cap/field-action.jpeg","/media/the-bankbeaters-5-panel-guide-cap/workbench-detail.jpeg","/media/the-bankbeaters-5-panel-guide-cap/bark-brown-variation.jpeg"]') ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, category_id_id=excluded.category_id_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;
INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, category_id_id, shopify_product_id, featured_image, gallery) VALUES ('prod-bramble-buster-pant', 'Bramble-Buster Technical Guide Pant', 'bramble-buster-technical-guide-pant', 'Heavyweight stretch ripstop guide pants fortified with 1000D Cordura scuff guards on knees and ankles. Built for scrambles up 60-degree dirt cuts and briar-choked access trails.', 'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks, taking the direct abuse from blackberry canes and sharp limestone riprap without puncturing.', 'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks, taking the direct abuse from blackberry canes and sharp limestone riprap without puncturing.', 'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels, Mil-Spec Snap Closure', '17.8 oz (505g)', 'Technical Straight (Articulated knees, gusseted seat for steep cut-bank scrambles)', 'Hand-cut & sewn in small batches in Chris''s workshop', 215, 'published', 'cat-brush-pants', 'cat-brush-pants', 'gid://shopify/Product/102', '/media/bramble-buster-technical-guide-pant/hero.jpeg', '["/media/bramble-buster-technical-guide-pant/field-action.jpeg","/media/bramble-buster-technical-guide-pant/workbench-detail.jpeg","/media/bramble-buster-technical-guide-pant/camo-variation.jpeg"]') ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, category_id_id=excluded.category_id_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;
INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, category_id_id, shopify_product_id, featured_image, gallery) VALUES ('prod-bushwhack-anorak', 'The Bushwhack Storm Anorak', 'bushwhack-storm-anorak', 'Patagonia-grade 3-layer waterproof storm shell with 500D Cordura reinforced forearms and oversized kangaroo tackle pouch. Built to crawl through thorns, stay dry in torrential downpours, and cast all day.', 'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles. Features two-way pit-to-hem venting zips.', 'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles. Features two-way pit-to-hem venting zips.', '3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®', '21.4 oz (606g)', 'Relaxed Athletic (Engineered for layering and overhead casting mobility)', 'Hand-cut & sewn in small batches in Chris''s workshop', 340, 'published', 'cat-storm-shells', 'cat-storm-shells', 'gid://shopify/Product/101', '/media/bushwhack-storm-anorak/hero.jpeg', '["/media/bushwhack-storm-anorak/field-action.jpeg","/media/bushwhack-storm-anorak/workbench-detail.jpeg","/media/bushwhack-storm-anorak/camo-variation.jpeg"]') ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, category_id_id=excluded.category_id_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;
INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, category_id_id, shopify_product_id, featured_image, gallery) VALUES ('prod-cutbank-sling-pack', 'The Cutbank Lumbar & Sling Convertible Pack', 'the-cutbank-lumbar-sling-pack', 'Waterproof X-Pac composite sling that converts to a lumbar pack in seconds. Features an integrated magnetic net slot, Hypalon plier sheath with safety dock, and waterproof zipper compartments.', 'When you are wading chest-deep or scrambling over downed timber, you need your pack out of your stroke until the second you land a fish. The Cutbank swings smoothly from lumbar to chest with one hand, featuring an integrated magnetic net dock.', 'When you are wading chest-deep or scrambling over downed timber, you need your pack out of your stroke until the second you land a fish. The Cutbank swings smoothly from lumbar to chest with one hand, featuring an integrated magnetic net dock.', 'Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, YKK AquaGuard®, Hypalon Plier Dock', '14.2 oz (402g)', 'Ambidextrous Sling / Lumbar Switchable with Breathable 3D Spacer Mesh', 'Hand-crafted in Chris''s workshop', 195, 'published', 'cat-sling-packs', 'cat-sling-packs', 'gid://shopify/Product/103', '/media/the-cutbank-lumbar-sling-pack/hero.jpeg', '["/media/the-cutbank-lumbar-sling-pack/field-action.jpeg","/media/the-cutbank-lumbar-sling-pack/workbench-detail.jpeg","/media/the-cutbank-lumbar-sling-pack/coyote-variation.jpeg"]') ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, category_id_id=excluded.category_id_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;
INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, category_id_id, shopify_product_id, featured_image, gallery) VALUES ('prod-minimalist-chest-rig', 'Minimalist Bank Chest Rig', 'minimalist-bank-chest-rig', 'Ultralight modular chest station with fold-down tackle workbench shelf and interchangeable high-density EVA fly/lure patch. Straps cleanly over waders or breathable sun hoodies.', 'Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking your terminal fly boxes. Fold-down front panel creates an instant workbench for knot-tying in heavy river current.', 'Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking your terminal fly boxes. Fold-down front panel creates an instant workbench for knot-tying in heavy river current.', '500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch, Duraflex® Mojave Buckles', '9.6 oz (272g)', 'Low-Profile 4-Point Harness (Rides high above deep wading lines)', 'Hand-crafted in Chris''s workshop', 135, 'published', 'cat-chest-rigs', 'cat-chest-rigs', 'gid://shopify/Product/104', '/media/minimalist-bank-chest-rig/hero.jpeg', '["/media/minimalist-bank-chest-rig/field-action.jpeg","/media/minimalist-bank-chest-rig/workbench-detail.jpeg","/media/minimalist-bank-chest-rig/prototype-variation.jpeg"]') ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, category_id_id=excluded.category_id_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;
INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, category_id_id, shopify_product_id, featured_image, gallery) VALUES ('prod-waxed-tool-roll', 'Waxed Canvas & Cordura Tool Roll / Leader Wallet', 'waxed-canvas-cordura-tool-roll', 'Heavyweight waxed canvas organizer with 6 internal slots for tippet spools, leader wallets, pliers, hook hones, and knot tools. Fastens securely with twin solid brass button snaps.', 'Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina. Lined with blaze orange packcloth so terminal split-shot and micro-swivels never get lost in low dusk light.', 'Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina. Lined with blaze orange packcloth so terminal split-shot and micro-swivels never get lost in low dusk light.', '12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth, Solid Antiqued Brass Snaps', '6.5 oz (184g)', 'Tri-Fold Compact (Fits into any thigh pocket or pack exterior sleeve)', 'Hand-cut, waxed, and stitched with bonded nylon thread', 75, 'published', 'cat-tool-rolls', 'cat-tool-rolls', 'gid://shopify/Product/105', '/media/waxed-canvas-cordura-tool-roll/hero.jpeg', '["/media/waxed-canvas-cordura-tool-roll/field-action.jpeg","/media/waxed-canvas-cordura-tool-roll/workbench-detail.jpeg","/media/waxed-canvas-cordura-tool-roll/charcoal-variation.jpeg"]') ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, category_id_id=excluded.category_id_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-cap-bark', 'prod-5panel-guide-cap', 'prod-5panel-guide-cap', 'gid://shopify/ProductVariant/213', 'Waxed Bark Brown', 'GDC-CAP-BRK', 'standard', 'Hand-Shaped', NULL, '[{"image":"/media/the-bankbeaters-5-panel-guide-cap/bark-brown-variation.jpeg","caption":"Bench shot: Waxed Bark Brown cotton canvas 5-panel guide cap profile"},{"image":"/media/the-bankbeaters-5-panel-guide-cap/workbench-detail.jpeg","caption":"Bench shot: Floatable EVA foam brim shaping and antiqued brass mesh eyelet"}]', NULL, 1, 50, 25, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-cap-olive', 'prod-5panel-guide-cap', 'prod-5panel-guide-cap', 'gid://shopify/ProductVariant/212', 'Waxed River Olive', 'GDC-CAP-OLV', 'standard', 'Hand-Shaped', NULL, NULL, NULL, 1, 50, 25, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-pant-32', 'prod-bramble-buster-pant', 'prod-bramble-buster-pant', 'gid://shopify/ProductVariant/203', 'Size 32 / Regular (Standard)', 'BMB-PNT-32R', 'standard', 'Standard Run', NULL, NULL, NULL, 1, 30, 8, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-pant-34', 'prod-bramble-buster-pant', 'prod-bramble-buster-pant', 'gid://shopify/ProductVariant/204', 'Size 34 / Regular (Standard)', 'BMB-PNT-34R', 'standard', 'Standard Run', NULL, NULL, NULL, 1, 30, 10, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-pant-camo-knees', 'prod-bramble-buster-pant', 'prod-bramble-buster-pant', 'gid://shopify/ProductVariant/205', 'Micro-Batch Deadstock Camo Knee Edition', 'BMB-PNT-CAMO-LTD', 'micro_batch', 'Only 4 Crafted', 'Workbench micro-batch built with rare deadstock Mil-Spec camo Cordura knee reinforcements and high-tensile orange bar-tacks.', '[{"image":"/media/bramble-buster-technical-guide-pant/camo-variation.jpeg","caption":"Bench shot: Triple-stitched camo knee overlay with bonded nylon thread"},{"image":"/media/bramble-buster-technical-guide-pant/workbench-detail.jpeg","caption":"Bench shot: Heavyweight DWR ripstop scuff guard seam detail"}]', 245, 1, 4, 4, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-anorak-camo-micro', 'prod-bushwhack-anorak', 'prod-bushwhack-anorak', 'gid://shopify/ProductVariant/202', 'Deadstock Duck Camo Pocket Edition', 'BWK-ANRK-CAMO-LTD', 'micro_batch', 'Only 3 Crafted', 'Crafted at the sewing bench using salvaged 1990s deadstock Mil-Spec duck camo Cordura for the oversized kangaroo chest drop pouch. Only 3 jackets crafted in this micro-batch run. Signed and numbered interior label.', '[{"image":"/media/bushwhack-storm-anorak/camo-variation.jpeg","caption":"Bench shot: Deadstock 500D duck camo chest pouch under machine needle"},{"image":"/media/bushwhack-storm-anorak/workbench-detail.jpeg","caption":"Bench shot: AquaGuard zipper bar-tacking and hand-stamped edition tag"}]', 385, 1, 3, 3, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-anorak-olive', 'prod-bushwhack-anorak', 'prod-bushwhack-anorak', 'gid://shopify/ProductVariant/201', 'Field Olive — Standard Run', 'BWK-ANRK-OLV-STD', 'standard', 'Standard Production', 'Standard production run in bombproof 3-layer olive ripstop with black 500D Cordura scuff guards.', NULL, NULL, 1, 25, 12, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-cutbank-coyote', 'prod-cutbank-sling-pack', 'prod-cutbank-sling-pack', 'gid://shopify/ProductVariant/207', 'Coyote Tan & Blaze Orange Micro-Run', 'CTB-SLG-CYT-LTD', 'micro_batch', 'Only 5 Crafted', 'Micro-batch crafted with Coyote Tan X-Pac VX21 exterior shell and high-visibility blaze orange internal packcloth liner for quick tackle identification.', '[{"image":"/media/the-cutbank-lumbar-sling-pack/coyote-variation.jpeg","caption":"Bench shot: Coyote Tan sailcloth assembly with blaze orange interior bind"},{"image":"/media/the-cutbank-lumbar-sling-pack/workbench-detail.jpeg","caption":"Bench shot: Magnetic net dock and Hypalon plier sheath testing"}]', 225, 1, 5, 5, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-cutbank-slate', 'prod-cutbank-sling-pack', 'prod-cutbank-sling-pack', 'gid://shopify/ProductVariant/206', 'VX21 Slate Grey — Standard Edition', 'CTB-SLG-GRY-STD', 'standard', 'Standard Production', NULL, NULL, NULL, 1, 40, 15, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-chestrig-proto', 'prod-minimalist-chest-rig', 'prod-minimalist-chest-rig', 'gid://shopify/ProductVariant/209', 'Archive Workshop Prototype 01', 'MCR-RIG-PROTO-01', 'one_of_one', 'One-of-One Archive', 'Chris personal workshop prototype used during spring cutthroat testing on the North Umpqua River. Signed and dated 01/01 inside the fold-down fly station.', '[{"image":"/media/minimalist-bank-chest-rig/prototype-variation.jpeg","caption":"Bench shot: Hand-numbered 01/01 prototype label with custom hook shear dock"},{"image":"/media/minimalist-bank-chest-rig/workbench-detail.jpeg","caption":"Bench shot: High-density EVA fly foam bench testing with bar-tacked webbing"}]', 175, 1, 1, 1, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-chestrig-ranger', 'prod-minimalist-chest-rig', 'prod-minimalist-chest-rig', 'gid://shopify/ProductVariant/208', 'Ranger Olive — Standard Station', 'MCR-RIG-OLV-STD', 'standard', 'Standard Run', NULL, NULL, NULL, 1, 35, 12, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-toolroll-charcoal', 'prod-waxed-tool-roll', 'prod-waxed-tool-roll', 'gid://shopify/ProductVariant/211', 'Dark Charcoal Waxed Canvas', 'WTR-ROL-DRK-STD', 'standard', 'Workshop Standard', NULL, '[{"image":"/media/waxed-canvas-cordura-tool-roll/charcoal-variation.jpeg","caption":"Bench shot: Dark Charcoal Martexin waxed canvas opened with hi-vis blaze orange interior slots"},{"image":"/media/waxed-canvas-cordura-tool-roll/workbench-detail.jpeg","caption":"Bench shot: Solid antiqued brass snaps pressed into 12oz waxed canvas"}]', NULL, 1, 50, 18, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
INSERT INTO product_variations (id, product_id, product_id_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES ('var-toolroll-tan', 'prod-waxed-tool-roll', 'prod-waxed-tool-roll', 'gid://shopify/ProductVariant/210', 'Field Tan Waxed Canvas', 'WTR-ROL-TAN-STD', 'standard', 'Workshop Standard', NULL, NULL, NULL, 1, 50, 20, NULL, 'active') ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, product_id_id=excluded.product_id_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;
-- Administrative Users (Payload CMS v3)
INSERT INTO users (email, salt, hash, login_attempts, created_at, updated_at) VALUES ('admin@chrishop.jacobmiller22.com', 'c1a06a0901e959b85c138be789f2a243292415175960098dfc38481352467d1a', '57c0ab53de16b2b6af00492252473888fe666ac2324cc46f7f76b004db16bb81159847639e140ead90c85990667c8953b94e3a83394865c42631fb46971d0e5aa59e3afc77a30e0c183a899db85816054717390983e6eb59a5a8942a7a98d362040464cbd775185a29a8d695122114fdbfca0caf7e08b54b54317f767208efcf37024ba1a0f39e869720111be1845e1a14a3564542f8ca233820bd9ad27ce0c59c1aa0beba20978401714f52b54fbcb929a6894dda50c6103aa1c97131c8865e1b076ef944eefe499b12fa2ca5e1046d6e8075bf7fc7d97ddf934ca946bf2f9235ecb7fc545b0aee39061a05cf299f945d303e0ca6f2758d0522d4583b1eabb8910c8085fd4fc20920288febf9af6e630866060d9ae949a15c6cd95ca13a21a6d05e3dd7ec2d17cbf3c22827738c062330feaae70b1ee53eeb955f735b43bd2b2405ba367f86f767fb3468f819737d8c50e3e3ebe487e3e9d8cebe473b0cb55faad4013157c96c2b079988e969bcc292776f396cc250912fe24999d619831079f731c6279b6428d9f3a86483a71b625201aa71ce1f5d0baa61432f65fd331af94286d0e2782f998e2876f5071fda20d3de84ee65c4612e2348df3b2c553a827e77442104fb79224074f4ad7bb92782f82a7c8456bb0791089874f5cb0ca83b4b7f871b3e0db2a4b19e0b67b47917490cc568e4b543c0ca5b75ef820a9e34da7b', 0, '2026-09-13 17:16:49', '2026-09-13 17:16:49') ON CONFLICT(email) DO UPDATE SET salt=excluded.salt, hash=excluded.hash, updated_at=excluded.updated_at;
INSERT INTO users (email, salt, hash, login_attempts, created_at, updated_at) VALUES ('chris@chrishop.jacobmiller22.com', 'f3b18d2209e848a74d227cf678e1b132181304064859987ceb27370241356e0b', '19c7518f981dbce9e12f6023399af06cb3ef07481fb36f86e8e89864864e1a83be93dfb84cdfdab1ee320f183d4af0f2fd0a3e43eedcb1e9d1eb1c8fdab2817b24e5aa15626ca3805532de87766a39f2e262cdb17150426afad133d44815de058f97faa251b809c777a8d4cae0a6500053f2eda9812fdee057c99fdd68c255cefac8eac227b8f303f44ab1a3abdcdfe6c0521ea6cdcce8c47554ee1485cb21e551dd8abdafa195e55481ea6b6a85ad404bd76ab07d08ed84a7d83b6faaf4b8d525b72fc50ebe40c02bd4717603eeb46b9cca13f1748f38aa590cb43eda9dc3cdc9764fd0bf5f1cf27225f52e215b79558d83e1b4546d919475707ecb93c3df2c8a978a4d585c1427342e828520778602ded594c8f6d302e567c872586f988930117f0c8c5e11bc00fb363b4ab5ecafd84cc22db620fd249c552726d7fb1bcf93daac23074bab1684892ab6a6ab1fe7d31962103fff7ac216681acf13e26100a57e056633fb5257610a89d7c295b76b549c10e8a6e427e7abaa118bce28bf924151b047a3c24a360a18acea35a825d0df02a52109043a7936f9c45b2311bd745779897444645634f66a2eeee1e552a8646d75bbf2df93a00da114105baaac8073f053aa98dce289e393c2d76676cb58af4a98bf56ffd4b7565386e1703d1ca304306e90ae325d8b11838959d1186d21f299e0a2101dc1ce8d8da32612f40d94b5', 0, '2026-09-13 17:16:49', '2026-09-13 17:16:49') ON CONFLICT(email) DO UPDATE SET salt=excluded.salt, hash=excluded.hash, updated_at=excluded.updated_at;
