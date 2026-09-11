#!/usr/bin/env tsx
/**
 * ChrisShop Local SQLite / Cloudflare D1 Database Seeder
 *
 * Seeds local development database with sample catalog categories, products,
 * and variations per docs/HIGH_LEVEL_DESIGN.md Section 3.2.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), '.wrangler/state/v3/d1/local.sqlite');

export interface SeedResult {
  categoriesCount: number;
  productsCount: number;
  variationsCount: number;
}

export function seedDatabase(dbInstance?: DatabaseSync): SeedResult {
  let db = dbInstance;
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
  }

  db.exec('PRAGMA foreign_keys = ON;');

  // Apply schema migration
  const migrationPath = path.resolve(process.cwd(), 'migrations/0001_initial.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(migrationSql);
  }

  console.log('🌱 [Seed] Seeding Categories...');
  const categories = [
    {
      id: 'cat-sculptures',
      name: 'Sculptures',
      slug: 'sculptures',
      description: 'Handcrafted limited edition art sculptures, figurines, and tangible artifacts.',
      image: null,
    },
    {
      id: 'cat-prints',
      name: 'Prints',
      slug: 'prints',
      description: 'Museum-grade archival pigment prints and fine art reproductions on cotton rag.',
      image: null,
    },
    {
      id: 'cat-wearables',
      name: 'Wearables',
      slug: 'wearables',
      description: 'Exclusive apparel, embroidered heavyweight streetwear, and artisan jewelry.',
      image: null,
    },
    {
      id: 'cat-digital',
      name: 'Digital Editions',
      slug: 'digital-editions',
      description: 'Generative digital collectibles, 3D assets, and interactive media.',
      image: null,
    },
  ];

  const insertCat = db.prepare(`
    INSERT INTO categories (id, name, slug, description, image)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      slug=excluded.slug,
      description=excluded.description,
      image=excluded.image;
  `);

  for (const c of categories) {
    insertCat.run(c.id, c.name, c.slug, c.description, c.image);
    console.log(`  Processed category: ${c.name}`);
  }

  console.log('🎨 [Seed] Seeding Products...');
  const products = [
    {
      id: 'prod-obsidian-beast',
      title: 'Midnight Obsidian Beast',
      slug: 'midnight-obsidian-beast',
      description: 'Hand-cast obsidian resin sculpture finished with 24k gold leaf accents. Limited collector run.',
      artist_statement: 'Exploration of physical weight and light absorption using volcanic glass resin.',
      base_price: 350.0,
      status: 'published',
      category_id: 'cat-sculptures',
      shopify_product_id: 'gid://shopify/Product/101',
      featured_image: 'beast-featured.webp',
      gallery: JSON.stringify(['beast-1.webp', 'beast-2.webp']),
    },
    {
      id: 'prod-solar-eclipse',
      title: 'Solar Eclipse Figurine',
      slug: 'solar-eclipse-figurine',
      description: 'Polymer resin celestial figurine capturing the luminous corona during a total solar eclipse.',
      artist_statement: 'An intimate study of the fleeting corona horizon.',
      base_price: 275.0,
      status: 'published',
      category_id: 'cat-sculptures',
      shopify_product_id: 'gid://shopify/Product/102',
      featured_image: 'eclipse-featured.webp',
      gallery: JSON.stringify(['eclipse-1.webp']),
    },
    {
      id: 'prod-neon-tokyo',
      title: 'Neon Tokyo Dreams Archival Print',
      slug: 'neon-tokyo-dreams-print',
      description: '12-color archival giclée print on 310gsm German etching paper. Hand-signed and numbered by Chris.',
      artist_statement: 'Synthesizing cyberpunk metropolis atmosphere with traditional Japanese woodblock textures.',
      base_price: 120.0,
      status: 'published',
      category_id: 'cat-prints',
      shopify_product_id: 'gid://shopify/Product/103',
      featured_image: 'neon-tokyo-featured.webp',
      gallery: JSON.stringify([]),
    },
    {
      id: 'prod-astral-horizon',
      title: 'Astral Horizon Holographic Print',
      slug: 'astral-horizon-holographic-print',
      description: 'Custom screen-printed holographic foil artwork with shifting iridescent chromatic tones.',
      artist_statement: 'Reflective prism ink on black heavy cardstock.',
      base_price: 95.0,
      status: 'published',
      category_id: 'cat-prints',
      shopify_product_id: 'gid://shopify/Product/104',
      featured_image: 'astral-featured.webp',
      gallery: JSON.stringify([]),
    },
    {
      id: 'prod-cyberpunk-hoodie',
      title: 'Cyberpunk Heavyweight Hoodie',
      slug: 'cyberpunk-heavyweight-hoodie',
      description: '500gsm heavyweight french terry cotton hoodie featuring custom high-density chenille embroidery.',
      artist_statement: 'Wearable tactile artifact designed for cold weather urban exploration.',
      base_price: 140.0,
      status: 'published',
      category_id: 'cat-wearables',
      shopify_product_id: 'gid://shopify/Product/105',
      featured_image: 'hoodie-featured.webp',
      gallery: JSON.stringify([]),
    },
    {
      id: 'prod-glitch-ring',
      title: 'Glitch Artifact Ring',
      slug: 'glitch-artifact-ring',
      description: 'Solid .925 sterling silver cast ring inspired by parametric digital distortion patterns.',
      artist_statement: 'Lost-wax cast sterling silver embodying algorithmic topology.',
      base_price: 210.0,
      status: 'published',
      category_id: 'cat-wearables',
      shopify_product_id: 'gid://shopify/Product/106',
      featured_image: 'ring-featured.webp',
      gallery: JSON.stringify([]),
    },
  ];

  const insertProd = db.prepare(`
    INSERT INTO products (id, title, slug, description, artist_statement, base_price, status, category_id, shopify_product_id, featured_image, gallery)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      description=excluded.description,
      artist_statement=excluded.artist_statement,
      base_price=excluded.base_price,
      status=excluded.status,
      category_id=excluded.category_id,
      shopify_product_id=excluded.shopify_product_id,
      featured_image=excluded.featured_image,
      gallery=excluded.gallery;
  `);

  for (const p of products) {
    insertProd.run(
      p.id,
      p.title,
      p.slug,
      p.description,
      p.artist_statement,
      p.base_price,
      p.status,
      p.category_id,
      p.shopify_product_id,
      p.featured_image,
      p.gallery
    );
    console.log(`  Processed product: ${p.title}`);
  }

  console.log('🏷️ [Seed] Seeding Product Variations...');
  const variations = [
    {
      id: 'var-beast-std',
      product_id: 'prod-obsidian-beast',
      shopify_variant_id: 'gid://shopify/ProductVariant/201',
      variation_name: 'Standard Obsidian Edition',
      sku: 'BEAST-OBS-STD',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-beast-gld',
      product_id: 'prod-obsidian-beast',
      shopify_variant_id: 'gid://shopify/ProductVariant/202',
      variation_name: '24K Gold Leaf Inlay Edition',
      sku: 'BEAST-GLD-LTD',
      price_override: 495.0,
      is_limited_edition: 1,
      total_edition_count: 10,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-solar-mte',
      product_id: 'prod-solar-eclipse',
      shopify_variant_id: 'gid://shopify/ProductVariant/203',
      variation_name: 'Matte Eclipse Edition',
      sku: 'SOLAR-MTE-001',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 30,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-solar-crm',
      product_id: 'prod-solar-eclipse',
      shopify_variant_id: 'gid://shopify/ProductVariant/204',
      variation_name: 'Crimson Corona Edition',
      sku: 'SOLAR-CRM-002',
      price_override: 310.0,
      is_limited_edition: 1,
      total_edition_count: 15,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-ntd-a2',
      product_id: 'prod-neon-tokyo',
      shopify_variant_id: 'gid://shopify/ProductVariant/205',
      variation_name: 'A2 Archival Sheet (16x24)',
      sku: 'NTD-PRT-A2',
      price_override: null,
      is_limited_edition: 0,
      total_edition_count: null,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-ntd-a1',
      product_id: 'prod-neon-tokyo',
      shopify_variant_id: 'gid://shopify/ProductVariant/206',
      variation_name: "A1 Custom Framed Collector's Edition (24x36)",
      sku: 'NTD-PRT-A1-FRM',
      price_override: 260.0,
      is_limited_edition: 1,
      total_edition_count: 25,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-ast-a3',
      product_id: 'prod-astral-horizon',
      shopify_variant_id: 'gid://shopify/ProductVariant/207',
      variation_name: 'A3 Holographic Foil (12x18)',
      sku: 'AST-HOLO-A3',
      price_override: null,
      is_limited_edition: 0,
      total_edition_count: null,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-ast-a2',
      product_id: 'prod-astral-horizon',
      shopify_variant_id: 'gid://shopify/ProductVariant/208',
      variation_name: 'A2 Limited Metallic Master (16x24)',
      sku: 'AST-HOLO-A2-LTD',
      price_override: 165.0,
      is_limited_edition: 1,
      total_edition_count: 25,
      release_date: '2026-10-15T18:00:00.000Z',
      status: 'coming_soon',
    },
    {
      id: 'var-cp-m',
      product_id: 'prod-cyberpunk-hoodie',
      shopify_variant_id: 'gid://shopify/ProductVariant/209',
      variation_name: 'Size Medium',
      sku: 'CP-HD-BLK-M',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 100,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-cp-l',
      product_id: 'prod-cyberpunk-hoodie',
      shopify_variant_id: 'gid://shopify/ProductVariant/210',
      variation_name: 'Size Large',
      sku: 'CP-HD-BLK-L',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 100,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-cp-xl',
      product_id: 'prod-cyberpunk-hoodie',
      shopify_variant_id: 'gid://shopify/ProductVariant/211',
      variation_name: 'Size XL (Sold Out Edition)',
      sku: 'CP-HD-BLK-XL',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      release_date: null,
      status: 'sold_out',
    },
    {
      id: 'var-glitch-9',
      product_id: 'prod-glitch-ring',
      shopify_variant_id: 'gid://shopify/ProductVariant/212',
      variation_name: 'Size 9 / US',
      sku: 'GLITCH-RNG-09',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 25,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-glitch-10',
      product_id: 'prod-glitch-ring',
      shopify_variant_id: 'gid://shopify/ProductVariant/213',
      variation_name: 'Size 10 / US',
      sku: 'GLITCH-RNG-10',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 25,
      release_date: null,
      status: 'active',
    },
  ];

  const insertVar = db.prepare(`
    INSERT INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, price_override, is_limited_edition, total_edition_count, release_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      product_id=excluded.product_id,
      shopify_variant_id=excluded.shopify_variant_id,
      variation_name=excluded.variation_name,
      sku=excluded.sku,
      price_override=excluded.price_override,
      is_limited_edition=excluded.is_limited_edition,
      total_edition_count=excluded.total_edition_count,
      release_date=excluded.release_date,
      status=excluded.status;
  `);

  for (const v of variations) {
    insertVar.run(
      v.id,
      v.product_id,
      v.shopify_variant_id,
      v.variation_name,
      v.sku,
      v.price_override,
      v.is_limited_edition,
      v.total_edition_count,
      v.release_date,
      v.status
    );
    console.log(`  Processed variation: [${v.sku}] ${v.variation_name}`);
  }

  console.log('\n🎉 SQLite database seed completed successfully!');
  console.log(`Summary:`);
  console.log(`  - Categories: ${categories.length}`);
  console.log(`  - Products: ${products.length}`);
  console.log(`  - Product Variations: ${variations.length}\n`);

  return {
    categoriesCount: categories.length,
    productsCount: products.length,
    variationsCount: variations.length,
  };
}

if (process.argv[1]?.includes('seed-db')) {
  try {
    seedDatabase();
  } catch (err) {
    console.error('❌ Database seed failed:', err);
    process.exit(1);
  }
}
