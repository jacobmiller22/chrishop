-- Migration: 0008_story_3_15_pages_and_theme_settings.sql
-- Story 3.15: Modular Storefront Page Customization & Hero Template Engine
-- Adds pages collection tables, layout block subtables, and theme_settings global table

PRAGMA foreign_keys = OFF;

-- 1. Pages Collection
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  layout_json TEXT,
  meta_title TEXT,
  meta_description TEXT,
  meta_image_id INTEGER,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (meta_image_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_idx ON pages (slug);
CREATE INDEX IF NOT EXISTS pages_status_idx ON pages (status);
CREATE INDEX IF NOT EXISTS pages_meta_image_idx ON pages (meta_image_id);
CREATE INDEX IF NOT EXISTS pages_updated_at_idx ON pages (updated_at);
CREATE INDEX IF NOT EXISTS pages_created_at_idx ON pages (created_at);

-- 2. Hero Block Table
CREATE TABLE IF NOT EXISTS pages_blocks_hero (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  _path TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  layout_preset TEXT DEFAULT 'minimalist_overlay' NOT NULL,
  headline TEXT NOT NULL,
  subheadline TEXT,
  ethos_statement TEXT,
  backdrop_image TEXT,
  backdrop_media_id INTEGER,
  badge_text TEXT,
  provenance_callout TEXT,
  block_name TEXT,
  FOREIGN KEY (_parent_id) REFERENCES pages(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (backdrop_media_id) REFERENCES media(id) ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS pages_blocks_hero_order_idx ON pages_blocks_hero (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_hero_parent_id_idx ON pages_blocks_hero (_parent_id);
CREATE INDEX IF NOT EXISTS pages_blocks_hero_path_idx ON pages_blocks_hero (_path);
CREATE INDEX IF NOT EXISTS pages_blocks_hero_media_idx ON pages_blocks_hero (backdrop_media_id);

-- Hero CTA Buttons Array Subtable
CREATE TABLE IF NOT EXISTS pages_blocks_hero_cta_buttons (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  variant TEXT DEFAULT 'primary',
  FOREIGN KEY (_parent_id) REFERENCES pages_blocks_hero(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_hero_cta_buttons_order_idx ON pages_blocks_hero_cta_buttons (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_hero_cta_buttons_parent_id_idx ON pages_blocks_hero_cta_buttons (_parent_id);

-- 3. Drop Countdown Block Table
CREATE TABLE IF NOT EXISTS pages_blocks_drop_countdown (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  _path TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  target_date TEXT,
  cta_text TEXT,
  cta_href TEXT,
  teaser_notes TEXT,
  block_name TEXT,
  FOREIGN KEY (_parent_id) REFERENCES pages(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_drop_countdown_order_idx ON pages_blocks_drop_countdown (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_drop_countdown_parent_id_idx ON pages_blocks_drop_countdown (_parent_id);

-- 4. Featured Collection Block Table
CREATE TABLE IF NOT EXISTS pages_blocks_featured_collection (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  _path TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  category_filter TEXT DEFAULT 'all',
  "limit" NUMERIC DEFAULT 6,
  show_starting_price INTEGER DEFAULT 1,
  block_name TEXT,
  FOREIGN KEY (_parent_id) REFERENCES pages(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_featured_collection_order_idx ON pages_blocks_featured_collection (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_featured_collection_parent_id_idx ON pages_blocks_featured_collection (_parent_id);

-- 5. Craftsmanship Story Block Table
CREATE TABLE IF NOT EXISTS pages_blocks_craftsmanship_story (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  _path TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  eyebrow TEXT,
  headline TEXT NOT NULL,
  story_text TEXT,
  block_name TEXT,
  FOREIGN KEY (_parent_id) REFERENCES pages(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_craftsmanship_story_order_idx ON pages_blocks_craftsmanship_story (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_craftsmanship_story_parent_id_idx ON pages_blocks_craftsmanship_story (_parent_id);

-- Craftsmanship Pillars Subtable
CREATE TABLE IF NOT EXISTS pages_blocks_craftsmanship_story_pillars (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  icon TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES pages_blocks_craftsmanship_story(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_craftsmanship_story_pillars_order_idx ON pages_blocks_craftsmanship_story_pillars (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_craftsmanship_story_pillars_parent_id_idx ON pages_blocks_craftsmanship_story_pillars (_parent_id);

-- 6. Material Provenance Block Table
CREATE TABLE IF NOT EXISTS pages_blocks_material_provenance (
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL,
  _path TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  eyebrow TEXT,
  headline TEXT NOT NULL,
  block_name TEXT,
  FOREIGN KEY (_parent_id) REFERENCES pages(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_material_provenance_order_idx ON pages_blocks_material_provenance (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_material_provenance_parent_id_idx ON pages_blocks_material_provenance (_parent_id);

-- Material Provenance Specs Subtable
CREATE TABLE IF NOT EXISTS pages_blocks_material_provenance_materials (
  _order INTEGER NOT NULL,
  _parent_id TEXT NOT NULL,
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  spec TEXT NOT NULL,
  badge TEXT,
  description TEXT NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES pages_blocks_material_provenance(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pages_blocks_material_provenance_materials_order_idx ON pages_blocks_material_provenance_materials (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_material_provenance_materials_parent_id_idx ON pages_blocks_material_provenance_materials (_parent_id);

-- 7. Theme Settings Global Table
CREATE TABLE IF NOT EXISTS theme_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  font_preset TEXT DEFAULT 'shippori_jakarta' NOT NULL,
  surface_canvas TEXT DEFAULT '#0F1215' NOT NULL,
  accent_color TEXT DEFAULT '#E55B24' NOT NULL,
  hairline_border TEXT DEFAULT 'subtle' NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);

-- 8. Payload Locked Documents Relationship Alignment
ALTER TABLE payload_locked_documents_rels ADD COLUMN pages_id INTEGER;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_pages_id_idx ON payload_locked_documents_rels (pages_id);

-- 9. Seed Default Homepage Page Document
INSERT OR IGNORE INTO pages (id, title, slug, status, meta_title, meta_description)
VALUES (
  1,
  'Storefront Homepage',
  'homepage',
  'published',
  'BankBeaters Adventure Gear · Curiosity > Fear',
  'Patagonia-grade technical outerwear, convertible carry rigs, and field accessories hand-sewn by Chris in Leadville, CO.'
);

-- Seed Default Theme Settings
INSERT OR IGNORE INTO theme_settings (id, font_preset, surface_canvas, accent_color, hairline_border)
VALUES (1, 'shippori_jakarta', '#0F1215', '#E55B24', 'subtle');
