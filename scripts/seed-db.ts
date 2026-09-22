#!/usr/bin/env tsx
/**
 * ChrisShop Database Seeder — Paradigm 1: Hybrid Product-First
 * Seeds native schema: product_lines (optional) + products (with category select and price inheritance)
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

  // Create tables for Paradigm 1
  db.exec(`
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
      sku TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      product_line_id TEXT,
      category TEXT NOT NULL DEFAULT 'packs',
      price REAL,
      options TEXT,
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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      roles TEXT DEFAULT '["editor"]',
      totp_enabled INTEGER DEFAULT 0,
      totp_secret TEXT,
      totp_verified_at TEXT,
      totp_backup_codes TEXT,
      reset_password_token TEXT,
      reset_password_expiration TEXT,
      salt TEXT,
      hash TEXT,
      login_attempts NUMERIC DEFAULT 0,
      lock_until TEXT
    );
  `);

  console.log('👤 [Seed RBAC] Seeding Default Admin and Editor Accounts...');
  const users = [
    {
      email: 'admin@chrishop.com',
      roles: JSON.stringify(['admin']),
      totp_enabled: 1,
    },
    {
      email: 'editor@chrishop.com',
      roles: JSON.stringify(['editor']),
      totp_enabled: 0,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (email, roles, totp_enabled)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      roles=excluded.roles,
      totp_enabled=excluded.totp_enabled;
  `);

  for (const u of users) {
    insertUser.run(u.email, u.roles, u.totp_enabled);
    console.log(`  User: ${u.email} (Roles: ${u.roles}, 2FA Enforced: ${u.totp_enabled === 1})`);
  }

  console.log('🌱 [Seed Paradigm 1] Seeding Product Lines...');
  const lines = [
    {
      id: 'line-alpine-chest-rig',
      title: 'Alpine Chest Rig System',
      slug: 'alpine-chest-rig-system',
      story: 'Modular alpine chest workstation designed for cutthroat bank anglers. Low profile 4-point harness rides high above deep wading lines.',
      default_price: 165.0,
      hero_image: '/media/chest-rig/hero.jpeg',
    },
    {
      id: 'line-bushwhack-series',
      title: 'Bushwhack Series',
      slug: 'bushwhack-series',
      story: 'Patagonia-grade foul-weather shells and storm gear built to push through dense alder thickets.',
      default_price: 285.0,
      hero_image: '/media/bushwhack/hero.jpeg',
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
    console.log(`  Line: ${l.title} (Default Price: $${l.default_price})`);
  }

  console.log('🎒 [Seed Paradigm 1] Seeding Products (Scenarios A, B, C)...');
  const products = [
    // Scenario A: Chest Rig System
    {
      id: 'prod-rig-minimalist',
      sku: 'RIG-MIN-01',
      title: 'Ultralight Minimalist Rig',
      slug: 'ultralight-minimalist-rig',
      product_line_id: 'line-alpine-chest-rig',
      category: 'packs',
      price: null, // Inherits line default ($165)
      options: JSON.stringify([
        { name: 'Colorway', value: 'Olive Drab', sku_suffix: 'OLV' },
        { name: 'Colorway', value: 'Black Multicam', sku_suffix: 'MCB' },
      ]),
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
      product_line_id: 'line-alpine-chest-rig',
      category: 'packs',
      price: 235.0, // Overrides line default ($165 -> $235)
      options: JSON.stringify([
        { name: 'Colorway', value: 'Coyote Tan', sku_suffix: 'CYT' },
        { name: 'Colorway', value: 'Ranger Olive', sku_suffix: 'RNG' },
      ]),
      status: 'active',
      featured_image: '/media/chest-rig/recon.jpeg',
      gallery: JSON.stringify(['/media/chest-rig/rcn-1.jpeg']),
      maker_field_notes: 'Expedition-scale chest station with dual side pods and hydration carrier integration.',
      materials: '1000D Cordura, Laser-cut Hypalon docking tabs',
      weight: '16.4 oz (465g)',
      fit_profile: 'Reinforced load-bearing harness',
    },

    // Scenario B: Bushwhack Anorak
    {
      id: 'prod-anorak-standard',
      sku: 'BWK-ANR-STD',
      title: 'Bushwhack Storm Anorak - Standard Run',
      slug: 'bushwhack-storm-anorak-standard',
      product_line_id: 'line-bushwhack-series',
      category: 'apparel',
      price: null, // Inherits line default ($285)
      options: JSON.stringify([
        { name: 'Colorway', value: 'Field Olive', sku_suffix: 'OLV' },
        { name: 'Colorway', value: 'Dark Charcoal', sku_suffix: 'CHR' },
      ]),
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
      product_line_id: 'line-bushwhack-series',
      category: 'apparel',
      price: 325.0, // Overrides line default ($285 -> $325)
      options: JSON.stringify([
        { name: 'Fabric', value: 'Raw White Dyneema Composite', sku_suffix: 'DYN' },
      ]),
      status: 'active',
      featured_image: '/media/bushwhack/dyneema.jpeg',
      gallery: JSON.stringify(['/media/bushwhack/dyn-1.jpeg']),
      maker_field_notes: 'Specialty fabric run utilizing ultra-high molecular weight Dyneema composite.',
      materials: 'Dyneema Composite Fabric + YKK AquaGuard',
      weight: '14.1 oz (400g)',
      fit_profile: 'Athletic storm shell',
    },

    // Scenario C: Solo-Maker 1-of-1 Workbench Prototype
    {
      id: 'prod-leadville-tool-wrap',
      sku: 'LDV-WR-01',
      title: 'Leadville Prototype Tool Wrap',
      slug: 'leadville-prototype-tool-wrap',
      product_line_id: null, // STANDALONE! Zero dummy container required!
      category: 'accessories',
      price: 110.0,
      options: JSON.stringify([
        { name: 'Edition', value: '1-of-1 Scrap Remnant', sku_suffix: '01' },
      ]),
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
      id, sku, title, slug, product_line_id, category, price, options,
      status, featured_image, gallery, maker_field_notes, materials, weight, fit_profile
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sku=excluded.sku,
      title=excluded.title,
      slug=excluded.slug,
      product_line_id=excluded.product_line_id,
      category=excluded.category,
      price=excluded.price,
      options=excluded.options,
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
      p.product_line_id,
      p.category,
      p.price,
      p.options,
      p.status,
      p.featured_image,
      p.gallery,
      p.maker_field_notes,
      p.materials,
      p.weight,
      p.fit_profile
    );
    console.log(`  Product: ${p.title} (${p.category}) -> Override: ${p.price ? '$' + p.price : 'None (Inherited)'}`);
  }

  console.log('✅ [Seed Paradigm 1] Completed.');
  return { linesCount: lines.length, productsCount: products.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
