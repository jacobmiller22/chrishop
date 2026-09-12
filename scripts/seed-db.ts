#!/usr/bin/env tsx
/**
 * ChrisShop Local SQLite / Cloudflare D1 Database Seeder
 *
 * Seeds local development database with creator-authentic catalog categories,
 * products, and variations per docs/HIGH_LEVEL_DESIGN.md Section 3.2.
 *
 * All content reflects a boutique creator studio drop platform:
 * - Handcrafted sculptures & physical artifacts
 * - Archival fine art prints
 * - Studio wearables & accessories
 * - Digital editions & collectibles
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
      description:
        'Handcrafted limited edition art sculptures, cast artifacts, and tangible three-dimensional works from the studio. Each piece is inspected and serialized by Chris.',
      image: null,
    },
    {
      id: 'cat-prints',
      name: 'Archival Prints',
      slug: 'prints',
      description:
        'Museum-grade giclée prints on 310gsm cotton rag paper, signed and numbered. Pigment inks with 100+ year archival longevity rating.',
      image: null,
    },
    {
      id: 'cat-wearables',
      name: 'Studio Goods',
      slug: 'wearables',
      description:
        'Heavyweight embroidered studio apparel, bespoke leather goods, and solid sterling silver accessories. Designed in-studio and produced in strictly limited runs.',
      image: null,
    },
    {
      id: 'cat-digital',
      name: 'Digital Editions',
      slug: 'digital-editions',
      description:
        'High-resolution generative artworks, 3D-rendered collectibles, and interactive digital pieces. Each digital edition includes a provenance certificate.',
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
    // ─── SCULPTURES ──────────────────────────────────────────────────────────────
    {
      id: 'prod-cast-bronze-totem',
      title: 'Cast Bronze Studio Totem',
      slug: 'cast-bronze-studio-totem',
      description:
        'Hand-poured lost-wax cast bronze totem standing 14 cm. Naturally patinated with a warm antique finish. Each casting is unique due to the hand-finishing process. Ships with archival foam casing and numbered provenance card.',
      artist_statement:
        'The Studio Totem is a meditation on weight, permanence, and the tactile language of craft. Bronze was chosen for its ability to carry history — each surface imperfection is intentional, a record of the making.',
      base_price: 420.0,
      status: 'published',
      category_id: 'cat-sculptures',
      shopify_product_id: 'gid://shopify/Product/101',
      featured_image: 'bronze-totem-featured.webp',
      gallery: JSON.stringify(['bronze-totem-1.webp', 'bronze-totem-2.webp', 'bronze-totem-3.webp']),
    },
    {
      id: 'prod-stoneware-vessel',
      title: 'Hand-Turned Stoneware Vessel',
      slug: 'hand-turned-stoneware-vessel',
      description:
        'Wheel-thrown and hand-turned high-fire stoneware vessel with a natural ash glaze. Fired at 1280°C in a wood-kiln, each vessel carries unique flame marks and glaze breaks. Approx. 18 cm tall, 200ml capacity. Food safe.',
      artist_statement:
        'Clay is the oldest creative medium. This vessel series explores the tension between utility and stillness — functional enough to hold water, quiet enough to hold attention.',
      base_price: 280.0,
      status: 'published',
      category_id: 'cat-sculptures',
      shopify_product_id: 'gid://shopify/Product/102',
      featured_image: 'stoneware-vessel-featured.webp',
      gallery: JSON.stringify(['stoneware-vessel-1.webp', 'stoneware-vessel-2.webp']),
    },
    // ─── ARCHIVAL PRINTS ────────────────────────────────────────────────────────
    {
      id: 'prod-solstice-study',
      title: 'Solstice Study — Archival Giclée Print',
      slug: 'solstice-study-archival-giclee',
      description:
        '12-color archival giclée print on 310gsm Hahnemühle Photo Rag cotton paper. Hand-signed and numbered by Chris in graphite. Printed with UltraChrome HDX pigment inks rated for 100+ year archival permanence. Unframed; ships flat with acid-free tissue and backing board.',
      artist_statement:
        'Solstice Study began as a series of field sketches made over three consecutive summer solstices. The composition distills those light observations into a single geometric language — golden ratio proportions, warm-cool colour split, and deliberate negative space.',
      base_price: 145.0,
      status: 'published',
      category_id: 'cat-prints',
      shopify_product_id: 'gid://shopify/Product/103',
      featured_image: 'solstice-study-featured.webp',
      gallery: JSON.stringify(['solstice-study-1.webp']),
    },
    {
      id: 'prod-threshold-series',
      title: 'Threshold Series No. 7 — Collector Print',
      slug: 'threshold-series-no-7-collector-print',
      description:
        'Limited collector print from the acclaimed Threshold Series. Museum-quality giclée on 300gsm Canson Platine Fibre Rag. Embossed studio chop mark, hand-signed. Includes certificate of authenticity with edition number. Available in two formats.',
      artist_statement:
        'The Threshold Series investigates liminal spaces — doorways, shorelines, the moment between intention and action. No. 7 is the final work in the series, closing the cycle with stillness rather than resolution.',
      base_price: 185.0,
      status: 'published',
      category_id: 'cat-prints',
      shopify_product_id: 'gid://shopify/Product/104',
      featured_image: 'threshold-7-featured.webp',
      gallery: JSON.stringify(['threshold-7-1.webp', 'threshold-7-2.webp']),
    },
    // ─── STUDIO GOODS ───────────────────────────────────────────────────────────
    {
      id: 'prod-studio-coach-jacket',
      title: 'Studio Coach Jacket — Numbered Edition',
      slug: 'studio-coach-jacket-numbered-edition',
      description:
        '100% organic cotton twill coach jacket with custom high-density chain-stitch embroidery on the back. Contrast satin lining, snap-button front, and welt pockets. Garment washed for a lived-in feel. Each jacket carries an interior numbered woven label limited to this release.',
      artist_statement:
        'Clothing as archive. The Studio Coach Jacket is designed to age — the cotton twill softens, the embroidery holds. Wear it until it tells a story.',
      base_price: 220.0,
      status: 'published',
      category_id: 'cat-wearables',
      shopify_product_id: 'gid://shopify/Product/105',
      featured_image: 'coach-jacket-featured.webp',
      gallery: JSON.stringify(['coach-jacket-1.webp', 'coach-jacket-2.webp']),
    },
    {
      id: 'prod-sterling-signet',
      title: 'Sterling Silver Studio Signet Ring',
      slug: 'sterling-silver-studio-signet-ring',
      description:
        'Solid .925 sterling silver signet ring, lost-wax cast from an original hand-carved wax model. Flat bezel with recessed studio monogram intaglio. Matte finish with polished edges. Each ring is individually hallmarked. Available in whole US sizes 7–11.',
      artist_statement:
        'The signet is the oldest form of personal mark-making — a seal, a signature, a claim. This ring is designed to be worn daily, acquiring its own patina and story over time.',
      base_price: 260.0,
      status: 'published',
      category_id: 'cat-wearables',
      shopify_product_id: 'gid://shopify/Product/106',
      featured_image: 'signet-ring-featured.webp',
      gallery: JSON.stringify(['signet-ring-1.webp', 'signet-ring-2.webp']),
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
    // Cast Bronze Studio Totem
    {
      id: 'var-totem-natural',
      product_id: 'prod-cast-bronze-totem',
      shopify_variant_id: 'gid://shopify/ProductVariant/201',
      variation_name: 'Natural Patina — Standard Edition',
      sku: 'TOTEM-BRZ-NAT',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 25,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-totem-dark',
      product_id: 'prod-cast-bronze-totem',
      shopify_variant_id: 'gid://shopify/ProductVariant/202',
      variation_name: 'Dark Oxide — Hand-Signed & Embellished Edition',
      sku: 'TOTEM-BRZ-DRK-LTD',
      price_override: 595.0,
      is_limited_edition: 1,
      total_edition_count: 8,
      release_date: null,
      status: 'active',
    },
    // Hand-Turned Stoneware Vessel
    {
      id: 'var-vessel-ash',
      product_id: 'prod-stoneware-vessel',
      shopify_variant_id: 'gid://shopify/ProductVariant/203',
      variation_name: 'Natural Ash Glaze',
      sku: 'VESSEL-STN-ASH',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 20,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-vessel-iron',
      product_id: 'prod-stoneware-vessel',
      shopify_variant_id: 'gid://shopify/ProductVariant/204',
      variation_name: 'Iron Slip — Collectors Firing',
      sku: 'VESSEL-STN-IRN-LTD',
      price_override: 360.0,
      is_limited_edition: 1,
      total_edition_count: 10,
      release_date: null,
      status: 'active',
    },
    // Solstice Study Print
    {
      id: 'var-solstice-a2',
      product_id: 'prod-solstice-study',
      shopify_variant_id: 'gid://shopify/ProductVariant/205',
      variation_name: 'A2 Archival Sheet (16.5 × 23.4 in)',
      sku: 'SOLSTICE-PRT-A2',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-solstice-a1',
      product_id: 'prod-solstice-study',
      shopify_variant_id: 'gid://shopify/ProductVariant/206',
      variation_name: 'A1 Custom Oak Framed — Numbered Collector Series (23.4 × 33.1 in)',
      sku: 'SOLSTICE-PRT-A1-FRM',
      price_override: 310.0,
      is_limited_edition: 1,
      total_edition_count: 20,
      release_date: null,
      status: 'active',
    },
    // Threshold Series No. 7
    {
      id: 'var-threshold-a3',
      product_id: 'prod-threshold-series',
      shopify_variant_id: 'gid://shopify/ProductVariant/207',
      variation_name: 'A3 Archival Print (11.7 × 16.5 in)',
      sku: 'THRESH7-PRT-A3',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 30,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-threshold-a2-ltd',
      product_id: 'prod-threshold-series',
      shopify_variant_id: 'gid://shopify/ProductVariant/208',
      variation_name: 'A2 Archival Print — Final Edition (16.5 × 23.4 in)',
      sku: 'THRESH7-PRT-A2-LTD',
      price_override: 340.0,
      is_limited_edition: 1,
      total_edition_count: 15,
      release_date: '2026-10-20T18:00:00.000Z',
      status: 'coming_soon',
    },
    // Studio Coach Jacket
    {
      id: 'var-jacket-s',
      product_id: 'prod-studio-coach-jacket',
      shopify_variant_id: 'gid://shopify/ProductVariant/209',
      variation_name: 'Size Small',
      sku: 'COACH-JKT-ORG-S',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 60,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-jacket-m',
      product_id: 'prod-studio-coach-jacket',
      shopify_variant_id: 'gid://shopify/ProductVariant/210',
      variation_name: 'Size Medium',
      sku: 'COACH-JKT-ORG-M',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 60,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-jacket-l',
      product_id: 'prod-studio-coach-jacket',
      shopify_variant_id: 'gid://shopify/ProductVariant/211',
      variation_name: 'Size Large',
      sku: 'COACH-JKT-ORG-L',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 60,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-jacket-xl',
      product_id: 'prod-studio-coach-jacket',
      shopify_variant_id: 'gid://shopify/ProductVariant/212',
      variation_name: 'Size XL (Sold Out — Archive)',
      sku: 'COACH-JKT-ORG-XL',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 40,
      release_date: null,
      status: 'sold_out',
    },
    // Sterling Silver Signet Ring
    {
      id: 'var-signet-sz8',
      product_id: 'prod-sterling-signet',
      shopify_variant_id: 'gid://shopify/ProductVariant/213',
      variation_name: 'US Size 8',
      sku: 'SIGNET-AG-US8',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 15,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-signet-sz9',
      product_id: 'prod-sterling-signet',
      shopify_variant_id: 'gid://shopify/ProductVariant/214',
      variation_name: 'US Size 9',
      sku: 'SIGNET-AG-US9',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 15,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-signet-sz10',
      product_id: 'prod-sterling-signet',
      shopify_variant_id: 'gid://shopify/ProductVariant/215',
      variation_name: 'US Size 10',
      sku: 'SIGNET-AG-US10',
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 15,
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
