#!/usr/bin/env tsx
/**
 * ChrisShop Database Seeder — Paradigm 3: Strict 3-Tier Hierarchy
 *
 * Tier 1: ProductLines (Master series container, root story, default price)
 * Tier 2: Products (Silhouettes/models, mandatory foreign key to product_lines)
 * Tier 3: ProductVariations (SKUs/colorways/materials, mandatory foreign key to products)
 *
 * Demonstrates cascading 3-tier price inheritance:
 * COALESCE(variation.price_override, product.base_price, product_lines.default_price)
 * and the ergonomic consequence of dummy parent containers for 1-of-1 prototypes.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), '.wrangler/state/v3/d1/local.sqlite');

export function seedDatabase(dbInstance?: DatabaseSync) {
  let db = dbInstance;
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
  }

  db.exec('PRAGMA foreign_keys = OFF;');

  // Create tables for Paradigm 3
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      parent_id TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_lines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      story TEXT,
      default_price REAL,
      hero_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      product_line_id TEXT NOT NULL,
      product_line_id_id TEXT,
      category_id TEXT,
      category_id_id TEXT,
      base_price REAL,
      price REAL,
      status TEXT NOT NULL DEFAULT 'active',
      featured_image TEXT,
      gallery TEXT,
      maker_field_notes TEXT,
      materials TEXT,
      weight TEXT,
      fit_profile TEXT,
      origin TEXT DEFAULT "Hand-crafted in Chris's workshop",
      shopify_product_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_line_id) REFERENCES product_lines(id)
    );

    CREATE TABLE IF NOT EXISTS product_variations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_id_id TEXT,
      sku TEXT UNIQUE NOT NULL,
      variation_name TEXT NOT NULL,
      price_override REAL,
      is_limited_edition INTEGER DEFAULT 0,
      stock_quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  console.log('🏷️ [Seed Paradigm 3] Seeding Categories...');
  const categories = [
    { id: 'cat-packs', name: 'Packs & Carry', slug: 'packs', description: 'Modular carry gear' },
    { id: 'cat-apparel', name: 'Apparel', slug: 'apparel', description: 'Technical outerwear' },
    { id: 'cat-accessories', name: 'Accessories', slug: 'accessories', description: 'Field utility' },
  ];

  const insertCat = db.prepare(`
    INSERT INTO categories (id, name, slug, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      slug=excluded.slug,
      description=excluded.description;
  `);

  for (const c of categories) {
    insertCat.run(c.id, c.name, c.slug, c.description);
  }

  console.log('🌲 [Seed Paradigm 3] Tier 1: Seeding Product Lines...');
  const lines = [
    // Scenario A Line
    {
      id: 'line-alpine-chest-rig',
      title: 'Alpine Chest Rig System',
      slug: 'alpine-chest-rig-system',
      story: 'Modular alpine chest workstation designed for cutthroat bank anglers. Low profile 4-point harness rides high above deep wading lines.',
      default_price: 165.0,
      hero_image: '/media/chest-rig/hero.jpeg',
    },
    // Scenario B Line
    {
      id: 'line-bushwhack-series',
      title: 'Bushwhack Series',
      slug: 'bushwhack-series',
      story: 'Patagonia-grade foul-weather shells and storm gear built to push through dense alder thickets.',
      default_price: 285.0,
      hero_image: '/media/bushwhack/hero.jpeg',
    },
    // Scenario C Line (Mandatory dummy parent required by Strict 3-Tier for solo-maker one-offs)
    {
      id: 'line-bench-archive',
      title: 'Bench Prototypes & One-Off Archive',
      slug: 'bench-prototypes-archive',
      story: 'Archive container required by strict 3-tier hierarchy for solo-maker standalone bench experiments.',
      default_price: null,
      hero_image: '/media/workbench/hero.jpeg',
    },
  ];

  const insertLine = db.prepare(`
    INSERT INTO product_lines (id, title, slug, story, default_price, hero_image)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      story=excluded.story,
      default_price=excluded.default_price,
      hero_image=excluded.hero_image;
  `);

  for (const l of lines) {
    insertLine.run(l.id, l.title, l.slug, l.story, l.default_price, l.hero_image);
    console.log(`  Tier 1 Line: ${l.title} (Default Price: ${l.default_price ? '$' + l.default_price : 'NULL'})`);
  }

  console.log('🎒 [Seed Paradigm 3] Tier 2: Seeding Products (Models / Silhouettes)...');
  const products = [
    // Scenario A Models
    {
      id: 'prod-rig-minimalist',
      title: 'Ultralight Minimalist Rig',
      slug: 'ultralight-minimalist-rig',
      product_line_id: 'line-alpine-chest-rig',
      category_id: 'cat-packs',
      base_price: null, // Inherits Tier 1 ($165)
      status: 'active',
      featured_image: '/media/chest-rig/minimalist.jpeg',
      gallery: JSON.stringify(['/media/chest-rig/min-1.jpeg', '/media/chest-rig/min-2.jpeg']),
      maker_field_notes: 'Ultralight minimalist chest station with fold-down knot tying table.',
      materials: '500D Mil-Spec Cordura, Duraflex Buckles',
      weight: '9.6 oz (272g)',
      fit_profile: 'Low profile 4-point harness',
    },
    {
      id: 'prod-rig-recon',
      title: 'Heavy-Haul Recon Rig',
      slug: 'heavy-haul-recon-rig',
      product_line_id: 'line-alpine-chest-rig',
      category_id: 'cat-packs',
      base_price: 235.0, // Overrides Tier 1 ($165 -> $235)
      status: 'active',
      featured_image: '/media/chest-rig/recon.jpeg',
      gallery: JSON.stringify(['/media/chest-rig/rcn-1.jpeg']),
      maker_field_notes: 'Expedition-scale chest station with dual side pods and hydration carrier integration.',
      materials: '1000D Cordura, Laser-cut Hypalon docking tabs',
      weight: '16.4 oz (465g)',
      fit_profile: 'Reinforced load-bearing harness',
    },

    // Scenario B Model
    {
      id: 'prod-bushwhack-anorak',
      title: 'Bushwhack Storm Anorak - Standard Run',
      slug: 'bushwhack-storm-anorak-standard',
      product_line_id: 'line-bushwhack-series',
      category_id: 'cat-apparel',
      base_price: null, // Inherits Tier 1 ($285)
      status: 'active',
      featured_image: '/media/bushwhack/standard.jpeg',
      gallery: JSON.stringify(['/media/bushwhack/std-1.jpeg']),
      maker_field_notes: '3-layer waterproof storm shell with 500D forearm abrasion protection.',
      materials: '3-Layer DWR Toray Ripstop (20k/20k), 500D Cordura forearms',
      weight: '21.4 oz (606g)',
      fit_profile: 'Relaxed athletic layering',
    },

    // Scenario C Model (Mandatory Tier 2 container for 1-of-1 prototype)
    {
      id: 'prod-leadville-tool-wrap',
      title: 'Leadville Prototype Tool Wrap',
      slug: 'leadville-prototype-tool-wrap',
      product_line_id: 'line-bench-archive', // Forced link to dummy parent line
      category_id: 'cat-accessories',
      base_price: 110.0,
      status: 'active',
      featured_image: '/media/workbench/leadville.jpeg',
      gallery: JSON.stringify(['/media/workbench/leadville-detail.jpeg']),
      maker_field_notes: 'Bench prototype sewn from scrap remnant waxed canvas. 1-of-1 signed archive.',
      materials: '12oz Martexin Waxed Canvas, Salvaged Mil-Spec Webbing',
      weight: '5.2 oz (147g)',
      fit_profile: 'Tri-fold compact wallet wrap',
    },
  ];

  const insertProd = db.prepare(`
    INSERT INTO products (
      id, title, slug, product_line_id, product_line_id_id, category_id, category_id_id,
      base_price, price, status, featured_image, gallery, maker_field_notes, materials, weight, fit_profile
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      product_line_id=excluded.product_line_id,
      product_line_id_id=excluded.product_line_id_id,
      category_id=excluded.category_id,
      category_id_id=excluded.category_id_id,
      base_price=excluded.base_price,
      price=excluded.price,
      status=excluded.status,
      featured_image=excluded.featured_image,
      gallery=excluded.gallery,
      maker_field_notes=excluded.maker_field_notes,
      materials=excluded.materials,
      weight=excluded.weight,
      fit_profile=excluded.fit_profile;
  `);

  for (const p of products) {
    insertProd.run(
      p.id,
      p.title,
      p.slug,
      p.product_line_id,
      p.product_line_id,
      p.category_id,
      p.category_id,
      p.base_price,
      p.base_price,
      p.status,
      p.featured_image,
      p.gallery,
      p.maker_field_notes,
      p.materials,
      p.weight,
      p.fit_profile
    );
    console.log(`  Tier 2 Product: ${p.title} -> Base Price: ${p.base_price ? '$' + p.base_price : 'NULL (Inherits Tier 1)'}`);
  }

  console.log('🏷️ [Seed Paradigm 3] Tier 3: Seeding Product Variations (SKUs / Colorways)...');
  const variations = [
    // Scenario A Variations
    {
      id: 'var-min-olv',
      product_id: 'prod-rig-minimalist',
      sku: 'RIG-MIN-OLV',
      variation_name: 'Olive Drab',
      price_override: null, // Inherits Tier 2 (which inherits Tier 1 $165)
    },
    {
      id: 'var-min-mcb',
      product_id: 'prod-rig-minimalist',
      sku: 'RIG-MIN-MCB',
      variation_name: 'Black Multicam',
      price_override: null, // Inherits $165
    },
    {
      id: 'var-rcn-cyt',
      product_id: 'prod-rig-recon',
      sku: 'RIG-RCN-CYT',
      variation_name: 'Coyote Tan',
      price_override: null, // Inherits Tier 2 override $235
    },
    {
      id: 'var-rcn-rng',
      product_id: 'prod-rig-recon',
      sku: 'RIG-RCN-RNG',
      variation_name: 'Ranger Olive',
      price_override: null, // Inherits Tier 2 override $235
    },

    // Scenario B Variations
    {
      id: 'var-anr-std',
      product_id: 'prod-bushwhack-anorak',
      sku: 'BWK-ANR-STD',
      variation_name: 'Field Olive (Standard Run)',
      price_override: null, // Inherits Tier 1 ($285)
    },
    {
      id: 'var-anr-dyn',
      product_id: 'prod-bushwhack-anorak',
      sku: 'BWK-ANR-DYN',
      variation_name: 'Specialty Dyneema Edition',
      price_override: 325.0, // Overrides Tier 2 & Tier 1 to $325!
    },

    // Scenario C Variation (Mandatory Tier 3 SKU required by Strict 3-Tier for 1-of-1 prototype)
    {
      id: 'var-leadville-01',
      product_id: 'prod-leadville-tool-wrap',
      sku: 'LDV-WR-01',
      variation_name: '1-of-1 Scrap Remnant',
      price_override: null, // Inherits Tier 2 ($110)
    },
  ];

  const insertVar = db.prepare(`
    INSERT INTO product_variations (id, product_id, product_id_id, sku, variation_name, price_override)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      product_id=excluded.product_id,
      product_id_id=excluded.product_id_id,
      sku=excluded.sku,
      variation_name=excluded.variation_name,
      price_override=excluded.price_override;
  `);

  for (const v of variations) {
    insertVar.run(v.id, v.product_id, v.product_id, v.sku, v.variation_name, v.price_override);
    console.log(`  Tier 3 Variation: ${v.variation_name} (${v.sku}) -> Price Override: ${v.price_override ? '$' + v.price_override : 'NULL (Cascading Inheritance)'}`);
  }

  console.log('✅ [Seed Paradigm 3] Completed.');
  return { linesCount: lines.length, productsCount: products.length, variationsCount: variations.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
