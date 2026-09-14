#!/usr/bin/env tsx
/**
 * ChrisShop Database Seeder — Paradigm 4: Recursive Node Tree / DAG
 *
 * "A product is a node in a tree".
 * Self-referential parent_id links define arbitrary hierarchy depth.
 * Demonstrates recursive CTE price inheritance from root collections down to models and leaf items,
 * and elegant standalone nodes (zero dummy containers) for 1-of-1 prototypes.
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

  // Create tables for Paradigm 4
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
      sku TEXT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      parent_id TEXT,
      node_role TEXT NOT NULL DEFAULT 'model',
      category_id TEXT,
      category_id_id TEXT,
      base_price REAL NOT NULL DEFAULT 0,
      price REAL,
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS product_variations (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      sku TEXT UNIQUE,
      variation_name TEXT,
      price_override REAL,
      status TEXT DEFAULT 'active'
    );
  `);

  console.log('🏷️ [Seed Paradigm 4] Seeding Baseline Categories...');
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

  console.log('🌲 [Seed Paradigm 4] Seeding Recursive Catalog Nodes (Scenarios A, B, C)...');
  const nodes = [
    // ─── SCENARIO A: CHEST RIG SYSTEM ─────────────────────────────────────────
    // Root Collection Node (Depth 0)
    {
      id: 'node-alpine-chest-rig',
      sku: null,
      title: 'Alpine Chest Rig System',
      slug: 'alpine-chest-rig-system',
      parent_id: null,
      node_role: 'collection',
      base_price: 165.0,
      price: 165.0,
      category_id: 'cat-packs',
      maker_field_notes: 'Modular alpine chest workstation root narrative and design philosophy.',
      materials: '500D Cordura, Duraflex hardware',
      weight: null,
      fit_profile: 'Modular chest rig platform',
    },
    // Child Model Node (Depth 1, Inherits $165 from root node)
    {
      id: 'node-rig-minimalist',
      sku: 'RIG-MIN-01',
      title: 'Ultralight Minimalist Rig',
      slug: 'ultralight-minimalist-rig',
      parent_id: 'node-alpine-chest-rig',
      node_role: 'model',
      base_price: 0,
      price: null, // Inherits root $165 via recursive CTE
      category_id: 'cat-packs',
      maker_field_notes: 'Ultralight minimalist chest station with fold-down knot tying table.',
      materials: '500D Mil-Spec Cordura, Duraflex Buckles',
      weight: '9.6 oz (272g)',
      fit_profile: 'Low profile 4-point harness',
    },
    // Child Model Node (Depth 1, Overrides root to $235)
    {
      id: 'node-rig-recon',
      sku: 'RIG-RCN-01',
      title: 'Heavy-Haul Recon Rig',
      slug: 'heavy-haul-recon-rig',
      parent_id: 'node-alpine-chest-rig',
      node_role: 'model',
      base_price: 235.0,
      price: 235.0, // Explicit override
      category_id: 'cat-packs',
      maker_field_notes: 'Expedition-scale chest station with dual side pods and hydration carrier.',
      materials: '1000D Cordura, Laser-cut Hypalon docking tabs',
      weight: '16.4 oz (465g)',
      fit_profile: 'Reinforced load-bearing harness',
    },

    // ─── SCENARIO B: BUSHWHACK STORM ANORAK ───────────────────────────────────
    // Root Collection Node (Depth 0)
    {
      id: 'node-bushwhack-series',
      sku: null,
      title: 'Bushwhack Series',
      slug: 'bushwhack-series',
      parent_id: null,
      node_role: 'collection',
      base_price: 285.0,
      price: 285.0,
      category_id: 'cat-apparel',
      maker_field_notes: 'Patagonia-grade foul-weather shells built for dense brush.',
      materials: 'Toray 3-Layer Ripstop',
      weight: null,
      fit_profile: 'Layering outerwear',
    },
    // Child Model Node (Depth 1, Inherits $285)
    {
      id: 'node-bushwhack-standard',
      sku: 'BWK-ANR-STD',
      title: 'Bushwhack Storm Anorak - Standard Run',
      slug: 'bushwhack-storm-anorak-standard',
      parent_id: 'node-bushwhack-series',
      node_role: 'model',
      base_price: 0,
      price: null, // Inherits root $285
      category_id: 'cat-apparel',
      maker_field_notes: '3-layer waterproof storm shell with 500D forearm abrasion protection.',
      materials: '3-Layer DWR Toray Ripstop (20k/20k), 500D Cordura forearms',
      weight: '21.4 oz (606g)',
      fit_profile: 'Relaxed athletic layering',
    },
    // Leaf Item Node (Depth 2, Specialty Material Overrides to $325)
    {
      id: 'node-bushwhack-dyneema',
      sku: 'BWK-ANR-DYN',
      title: 'Bushwhack Storm Anorak - Dyneema Edition',
      slug: 'bushwhack-storm-anorak-dyneema',
      parent_id: 'node-bushwhack-standard', // Self-referential child of model
      node_role: 'item',
      base_price: 325.0,
      price: 325.0, // Override
      category_id: 'cat-apparel',
      maker_field_notes: 'Specialty fabric run utilizing ultra-high molecular weight Dyneema composite.',
      materials: 'Dyneema Composite Fabric + YKK AquaGuard',
      weight: '14.1 oz (400g)',
      fit_profile: 'Athletic storm shell',
    },

    // ─── SCENARIO C: SOLO-MAKER 1-OF-1 BENCH PROTOTYPE ───────────────────────
    // Standalone Root Node (Depth 0, Parent is NULL, Zero dummy container!)
    {
      id: 'node-leadville-tool-wrap',
      sku: 'LDV-WR-01',
      title: 'Leadville Prototype Tool Wrap',
      slug: 'leadville-prototype-tool-wrap',
      parent_id: null, // STANDALONE ROOT NODE!
      node_role: 'model',
      base_price: 110.0,
      price: 110.0,
      category_id: 'cat-accessories',
      maker_field_notes: 'Bench prototype sewn from scrap remnant waxed canvas. 1-of-1 signed archive.',
      materials: '12oz Martexin Waxed Canvas, Salvaged Mil-Spec Webbing',
      weight: '5.2 oz (147g)',
      fit_profile: 'Tri-fold compact wallet wrap',
    },
  ];

  const insertNode = db.prepare(`
    INSERT INTO products (
      id, sku, title, slug, parent_id, node_role, category_id, category_id_id,
      base_price, price, status, maker_field_notes, artist_statement, materials, weight, fit_profile
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sku=excluded.sku,
      title=excluded.title,
      slug=excluded.slug,
      parent_id=excluded.parent_id,
      node_role=excluded.node_role,
      category_id=excluded.category_id,
      category_id_id=excluded.category_id_id,
      base_price=excluded.base_price,
      price=excluded.price,
      maker_field_notes=excluded.maker_field_notes,
      artist_statement=excluded.artist_statement,
      materials=excluded.materials,
      weight=excluded.weight,
      fit_profile=excluded.fit_profile;
  `);

  for (const n of nodes) {
    insertNode.run(
      n.id,
      n.sku,
      n.title,
      n.slug,
      n.parent_id,
      n.node_role,
      n.category_id,
      n.category_id,
      n.base_price,
      n.price,
      n.maker_field_notes,
      n.maker_field_notes,
      n.materials,
      n.weight,
      n.fit_profile
    );
    console.log(`  Node [${n.node_role}]: ${n.title} (Parent: ${n.parent_id ?? 'NULL (Root)'}) -> Price: ${n.price ? '$' + n.price : 'Inherits Ancestor'}`);
  }

  console.log('✅ [Seed Paradigm 4] Completed.');
  return { nodesCount: nodes.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
