#!/usr/bin/env tsx
/**
 * ChrisShop Database Seeder — Paradigm 2: Flat Typed Tags ("Everything is a Tag")
 *
 * Eliminates relational line/tier groupings. Categorization, line affiliation,
 * material specifications, and batch tags are modeled as structured typed tags.
 * Flat pricing directly on products with zero relational joins.
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

  // Create tables for Paradigm 2
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

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      base_price REAL NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      category_id TEXT,
      category_id_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      featured_image TEXT,
      gallery TEXT,
      maker_field_notes TEXT,
      artist_statement TEXT,
      materials TEXT,
      weight TEXT,
      fit_profile TEXT,
      origin TEXT DEFAULT "Hand-crafted in Chris's workshop",
      shopify_product_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variations (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      product_id_id TEXT,
      sku TEXT UNIQUE,
      variation_name TEXT,
      price_override REAL,
      is_limited_edition INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    );
  `);

  console.log('🏷️ [Seed Paradigm 2] Seeding Baseline Categories (for taxonomy compat)...');
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

  console.log('🎒 [Seed Paradigm 2] Seeding Products with Flat Typed Tags (Scenarios A, B, C)...');
  const products = [
    // Scenario A: Chest Rig System (Dynamic grouping via "line:alpine-chest-rig")
    {
      id: 'prod-rig-minimalist',
      sku: 'RIG-MIN-01',
      title: 'Ultralight Minimalist Rig',
      slug: 'ultralight-minimalist-rig',
      base_price: 165.0,
      tags: JSON.stringify([
        { tag: 'line:alpine-chest-rig' },
        { tag: 'cat:packs' },
        { tag: 'mat:cordura-500d' },
        { tag: 'type:standard' },
      ]),
      category_id: 'cat-packs',
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
      sku: 'RIG-RCN-01',
      title: 'Heavy-Haul Recon Rig',
      slug: 'heavy-haul-recon-rig',
      base_price: 235.0,
      tags: JSON.stringify([
        { tag: 'line:alpine-chest-rig' },
        { tag: 'cat:packs' },
        { tag: 'mat:cordura-1000d' },
        { tag: 'type:heavy-duty' },
      ]),
      category_id: 'cat-packs',
      status: 'active',
      featured_image: '/media/chest-rig/recon.jpeg',
      gallery: JSON.stringify(['/media/chest-rig/rcn-1.jpeg']),
      maker_field_notes: 'Expedition-scale chest station with dual side pods and hydration carrier integration.',
      materials: '1000D Cordura, Laser-cut Hypalon docking tabs',
      weight: '16.4 oz (465g)',
      fit_profile: 'Reinforced load-bearing harness',
    },

    // Scenario B: Bushwhack Anorak (Dynamic grouping via "line:bushwhack-series")
    {
      id: 'prod-anorak-standard',
      sku: 'BWK-ANR-STD',
      title: 'Bushwhack Storm Anorak - Standard Run',
      slug: 'bushwhack-storm-anorak-standard',
      base_price: 285.0,
      tags: JSON.stringify([
        { tag: 'line:bushwhack-series' },
        { tag: 'cat:apparel' },
        { tag: 'mat:ripstop-3l' },
        { tag: 'type:standard' },
      ]),
      category_id: 'cat-apparel',
      status: 'active',
      featured_image: '/media/bushwhack/standard.jpeg',
      gallery: JSON.stringify(['/media/bushwhack/std-1.jpeg']),
      maker_field_notes: '3-layer waterproof storm shell with 500D forearm abrasion protection.',
      materials: '3-Layer DWR Toray Ripstop (20k/20k), 500D Cordura forearms',
      weight: '21.4 oz (606g)',
      fit_profile: 'Relaxed athletic layering',
    },
    {
      id: 'prod-anorak-dyneema',
      sku: 'BWK-ANR-DYN',
      title: 'Bushwhack Storm Anorak - Dyneema Edition',
      slug: 'bushwhack-storm-anorak-dyneema',
      base_price: 325.0,
      tags: JSON.stringify([
        { tag: 'line:bushwhack-series' },
        { tag: 'cat:apparel' },
        { tag: 'mat:dyneema' },
        { tag: 'type:specialty' },
      ]),
      category_id: 'cat-apparel',
      status: 'active',
      featured_image: '/media/bushwhack/dyneema.jpeg',
      gallery: JSON.stringify(['/media/bushwhack/dyn-1.jpeg']),
      maker_field_notes: 'Specialty fabric run utilizing ultra-high molecular weight Dyneema composite.',
      materials: 'Dyneema Composite Fabric + YKK AquaGuard',
      weight: '14.1 oz (400g)',
      fit_profile: 'Athletic storm shell',
    },

    // Scenario C: Solo-Maker 1-of-1 Workbench Prototype (Standalone, Zero line tags)
    {
      id: 'prod-leadville-tool-wrap',
      sku: 'LDV-WR-01',
      title: 'Leadville Prototype Tool Wrap',
      slug: 'leadville-prototype-tool-wrap',
      base_price: 110.0,
      tags: JSON.stringify([
        { tag: 'cat:accessories' },
        { tag: 'mat:waxed-canvas' },
        { tag: 'type:prototype' },
        { tag: 'edition:1-of-1' },
      ]),
      category_id: 'cat-accessories',
      status: 'active',
      featured_image: '/media/workbench/leadville.jpeg',
      gallery: JSON.stringify(['/media/workbench/leadville-detail.jpeg']),
      maker_field_notes: 'Bench prototype sewn from scrap remnant waxed canvas and salvaged mil-spec webbing during North Umpqua river trials. 1-of-1 signed archive.',
      materials: '12oz Martexin Waxed Canvas, Salvaged Mil-Spec Webbing',
      weight: '5.2 oz (147g)',
      fit_profile: 'Tri-fold compact wallet wrap',
    },
  ];

  const insertProd = db.prepare(`
    INSERT INTO products (
      id, sku, title, slug, base_price, tags, category_id, category_id_id,
      status, featured_image, gallery, maker_field_notes, materials, weight, fit_profile
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sku=excluded.sku,
      title=excluded.title,
      slug=excluded.slug,
      base_price=excluded.base_price,
      tags=excluded.tags,
      category_id=excluded.category_id,
      category_id_id=excluded.category_id_id,
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
      p.sku,
      p.title,
      p.slug,
      p.base_price,
      p.tags,
      p.category_id,
      p.category_id,
      p.status,
      p.featured_image,
      p.gallery,
      p.maker_field_notes,
      p.materials,
      p.weight,
      p.fit_profile
    );
    console.log(`  Product: ${p.title} (SKU: ${p.sku}) -> Base Price: $${p.base_price} | Tags: ${p.tags}`);
  }

  console.log('✅ [Seed Paradigm 2] Completed.');
  return { productsCount: products.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
