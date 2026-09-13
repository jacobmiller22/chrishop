#!/usr/bin/env tsx
/**
 * ChrisShop Local SQLite / Cloudflare D1 Database Seeder
 *
 * Seeds local development database with authentic BankBeaters Adventure Gear
 * (bankbeatersadventuregear.com, "Curiosity > Fear") catalog categories (depth 2),
 * hand-crafted outdoor gear products, and micro-batch variations per Story 1.15.
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

  // Resilient column migrations for existing local sqlite databases
  const addColumnIfNotExists = (table: string, colDef: string) => {
    try {
      db!.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
    } catch {
      // Column already exists or table doesn't exist yet
    }
  };
  addColumnIfNotExists('categories', 'parent_id TEXT');
  addColumnIfNotExists('products', 'maker_field_notes TEXT');
  addColumnIfNotExists('products', 'materials TEXT');
  addColumnIfNotExists('products', 'weight TEXT');
  addColumnIfNotExists('products', 'fit_profile TEXT');
  addColumnIfNotExists('products', 'origin TEXT');
  addColumnIfNotExists('product_variations', "variation_type TEXT NOT NULL DEFAULT 'standard'");
  addColumnIfNotExists('product_variations', 'edition_badge TEXT');
  addColumnIfNotExists('product_variations', 'variation_notes TEXT');
  addColumnIfNotExists('product_variations', 'variation_images TEXT');
  addColumnIfNotExists('product_variations', 'stock_quantity INTEGER NOT NULL DEFAULT 1');

  // Apply schema migrations
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      db.exec(migrationSql);
    }
  }

  console.log('🌱 [Seed] Seeding BankBeaters Categories (Depth 2)...');
  const categories = [
    // ─── LEVEL 0 (TOP LEVEL) ──────────────────────────────────────────────────
    {
      id: 'cat-apparel',
      name: 'Apparel',
      slug: 'apparel',
      parent_id: null,
      description:
        'Technical foul-weather outerwear, guide pants, and active midlayers hand-sewn for bank anglers.',
      image: null,
    },
    {
      id: 'cat-packs',
      name: 'Packs & Carry',
      slug: 'packs-carry',
      parent_id: null,
      description:
        'Waterproof composite lumbar slings, modular chest rigs, and submersible gear duffels.',
      image: null,
    },
    {
      id: 'cat-accessories',
      name: 'Field Accessories',
      slug: 'field-accessories',
      parent_id: null,
      description:
        'Waxed canvas tool rolls, Kevlar-reinforced casting gloves, and floating brim guide caps.',
      image: null,
    },

    // ─── LEVEL 1 (SUBCATEGORIES) ──────────────────────────────────────────────
    {
      id: 'cat-outerwear',
      name: 'Outerwear',
      slug: 'outerwear',
      parent_id: 'cat-apparel',
      description: 'Weather-defense storm shells, wind anoraks, and wading jackets.',
      image: null,
    },
    {
      id: 'cat-midlayers',
      name: 'Midlayers & Fleece',
      slug: 'midlayers',
      parent_id: 'cat-apparel',
      description: 'Breathable grid fleece pullovers and thermal insulation.',
      image: null,
    },
    {
      id: 'cat-pants',
      name: 'Pants & Shorts',
      slug: 'pants',
      parent_id: 'cat-apparel',
      description: 'Heavyweight ripstop guide pants with Cordura brush reinforcement.',
      image: null,
    },
    {
      id: 'cat-sling-packs',
      name: 'Lumbar & Sling Packs',
      slug: 'sling-packs',
      parent_id: 'cat-packs',
      description: 'One-handed access lumbar and sling packs engineered for uninhibited casting.',
      image: null,
    },
    {
      id: 'cat-chest-rigs',
      name: 'Chest Rigs & Harnesses',
      slug: 'chest-rigs',
      parent_id: 'cat-packs',
      description: 'Modular chest workstations with drop-down fly/tackle shelves.',
      image: null,
    },
    {
      id: 'cat-dry-bags',
      name: 'Submersible Bags',
      slug: 'dry-bags',
      parent_id: 'cat-packs',
      description: 'RF-welded TPU submersible bags that keep essentials dry in marsh mud.',
      image: null,
    },
    {
      id: 'cat-tool-rolls',
      name: 'Tool Rolls & Wallets',
      slug: 'tool-rolls',
      parent_id: 'cat-accessories',
      description: 'Martexin waxed canvas leader rolls and tool organizers.',
      image: null,
    },
    {
      id: 'cat-gloves',
      name: 'Gloves & Handwear',
      slug: 'gloves',
      parent_id: 'cat-accessories',
      description: 'Braid-resistant Kevlar stripping gloves and sun protection.',
      image: null,
    },
    {
      id: 'cat-headwear',
      name: 'Caps & Headwear',
      slug: 'headwear',
      parent_id: 'cat-accessories',
      description: 'Floating brim 5-panel guide caps and waxed cotton sun covers.',
      image: null,
    },

    // ─── LEVEL 2 (SUB-SUBCATEGORIES) ──────────────────────────────────────────
    {
      id: 'cat-storm-shells',
      name: 'Waterproof Storm Shells',
      slug: 'waterproof-storm-shells',
      parent_id: 'cat-outerwear',
      description: '3-layer fully seam-taped waterproof breathable membranes with Cordura abrasion armor.',
      image: null,
    },
    {
      id: 'cat-brush-pants',
      name: 'Technical Brush Pants',
      slug: 'technical-brush-pants',
      parent_id: 'cat-pants',
      description: '4-way stretch DWR pants with 1000D Cordura knee and ankle scuff guards.',
      image: null,
    },
  ];

  const insertCat = db.prepare(`
    INSERT INTO categories (id, name, slug, parent_id, description, image)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      slug=excluded.slug,
      parent_id=excluded.parent_id,
      description=excluded.description,
      image=excluded.image;
  `);

  for (const c of categories) {
    if (c.parent_id && c.parent_id === c.id) {
      throw new Error(`Self-parenting category detected: ${c.id} cannot be its own parent`);
    }
    insertCat.run(c.id, c.name, c.slug, c.parent_id, c.description, c.image);
    console.log(`  Processed category: [${c.slug}] ${c.name}`);
  }

  console.log('🎒 [Seed] Seeding BankBeaters Technical Gear Products...');
  const products = [
    // ─── THE BUSHWHACK STORM ANORAK ───────────────────────────────────────────
    {
      id: 'prod-bushwhack-anorak',
      title: 'The Bushwhack Storm Anorak',
      slug: 'bushwhack-storm-anorak',
      description:
        'Patagonia-grade 3-layer waterproof storm shell with 500D Cordura reinforced forearms and oversized kangaroo tackle pouch. Built to crawl through thorns, stay dry in torrential downpours, and cast all day.',
      maker_field_notes:
        'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles. Features two-way pit-to-hem venting zips.',
      materials:
        '3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®',
      weight: '21.4 oz (606g)',
      fit_profile:
        'Relaxed Athletic (Engineered for layering and overhead casting mobility)',
      origin: "Hand-cut & sewn in small batches in Chris's workshop",
      base_price: 340.0,
      status: 'published',
      category_id: 'cat-storm-shells',
      shopify_product_id: 'gid://shopify/Product/101',
      featured_image: '/media/bushwhack-storm-anorak/hero.jpeg',
      gallery: JSON.stringify([
        '/media/bushwhack-storm-anorak/field-action.jpeg',
        '/media/bushwhack-storm-anorak/workbench-detail.jpeg',
        '/media/bushwhack-storm-anorak/camo-variation.jpeg',
      ]),
    },

    // ─── BRAMBLE-BUSTER TECHNICAL GUIDE PANT ──────────────────────────────────
    {
      id: 'prod-bramble-buster-pant',
      title: 'Bramble-Buster Technical Guide Pant',
      slug: 'bramble-buster-technical-guide-pant',
      description:
        'Heavyweight stretch ripstop guide pants fortified with 1000D Cordura scuff guards on knees and ankles. Built for scrambles up 60-degree dirt cuts and briar-choked access trails.',
      maker_field_notes:
        'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks, taking the direct abuse from blackberry canes and sharp limestone riprap without puncturing.',
      materials:
        'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels, Mil-Spec Snap Closure',
      weight: '17.8 oz (505g)',
      fit_profile:
        'Technical Straight (Articulated knees, gusseted seat for steep cut-bank scrambles)',
      origin: "Hand-cut & sewn in small batches in Chris's workshop",
      base_price: 215.0,
      status: 'published',
      category_id: 'cat-brush-pants',
      shopify_product_id: 'gid://shopify/Product/102',
      featured_image: '/media/bramble-buster-technical-guide-pant/hero.jpeg',
      gallery: JSON.stringify([
        '/media/bramble-buster-technical-guide-pant/field-action.jpeg',
        '/media/bramble-buster-technical-guide-pant/workbench-detail.jpeg',
        '/media/bramble-buster-technical-guide-pant/camo-variation.jpeg',
      ]),
    },

    // ─── THE CUTBANK LUMBAR & SLING CONVERTIBLE PACK ──────────────────────────
    {
      id: 'prod-cutbank-sling-pack',
      title: 'The Cutbank Lumbar & Sling Convertible Pack',
      slug: 'the-cutbank-lumbar-sling-pack',
      description:
        'Waterproof X-Pac composite sling that converts to a lumbar pack in seconds. Features an integrated magnetic net slot, Hypalon plier sheath with safety dock, and waterproof zipper compartments.',
      maker_field_notes:
        'When you are wading chest-deep or scrambling over downed timber, you need your pack out of your stroke until the second you land a fish. The Cutbank swings smoothly from lumbar to chest with one hand, featuring an integrated magnetic net dock.',
      materials:
        'Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, YKK AquaGuard®, Hypalon Plier Dock',
      weight: '14.2 oz (402g)',
      fit_profile:
        'Ambidextrous Sling / Lumbar Switchable with Breathable 3D Spacer Mesh',
      origin: "Hand-crafted in Chris's workshop",
      base_price: 195.0,
      status: 'published',
      category_id: 'cat-sling-packs',
      shopify_product_id: 'gid://shopify/Product/103',
      featured_image: '/media/the-cutbank-lumbar-sling-pack/hero.jpeg',
      gallery: JSON.stringify([
        '/media/the-cutbank-lumbar-sling-pack/field-action.jpeg',
        '/media/the-cutbank-lumbar-sling-pack/workbench-detail.jpeg',
        '/media/the-cutbank-lumbar-sling-pack/coyote-variation.jpeg',
      ]),
    },

    // ─── MINIMALIST BANK CHEST RIG ────────────────────────────────────────────
    {
      id: 'prod-minimalist-chest-rig',
      title: 'Minimalist Bank Chest Rig',
      slug: 'minimalist-bank-chest-rig',
      description:
        'Ultralight modular chest station with fold-down tackle workbench shelf and interchangeable high-density EVA fly/lure patch. Straps cleanly over waders or breathable sun hoodies.',
      maker_field_notes:
        'Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking your terminal fly boxes. Fold-down front panel creates an instant workbench for knot-tying in heavy river current.',
      materials:
        '500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch, Duraflex® Mojave Buckles',
      weight: '9.6 oz (272g)',
      fit_profile:
        'Low-Profile 4-Point Harness (Rides high above deep wading lines)',
      origin: "Hand-crafted in Chris's workshop",
      base_price: 135.0,
      status: 'published',
      category_id: 'cat-chest-rigs',
      shopify_product_id: 'gid://shopify/Product/104',
      featured_image: '/media/minimalist-bank-chest-rig/hero.jpeg',
      gallery: JSON.stringify([
        '/media/minimalist-bank-chest-rig/field-action.jpeg',
        '/media/minimalist-bank-chest-rig/workbench-detail.jpeg',
        '/media/minimalist-bank-chest-rig/prototype-variation.jpeg',
      ]),
    },

    // ─── WAXED CANVAS & CORDURA TOOL ROLL / LEADER WALLET ─────────────────────
    {
      id: 'prod-waxed-tool-roll',
      title: 'Waxed Canvas & Cordura Tool Roll / Leader Wallet',
      slug: 'waxed-canvas-cordura-tool-roll',
      description:
        'Heavyweight waxed canvas organizer with 6 internal slots for tippet spools, leader wallets, pliers, hook hones, and knot tools. Fastens securely with twin solid brass button snaps.',
      maker_field_notes:
        'Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina. Lined with blaze orange packcloth so terminal split-shot and micro-swivels never get lost in low dusk light.',
      materials:
        '12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth, Solid Antiqued Brass Snaps',
      weight: '6.5 oz (184g)',
      fit_profile:
        'Tri-Fold Compact (Fits into any thigh pocket or pack exterior sleeve)',
      origin: 'Hand-cut, waxed, and stitched with bonded nylon thread',
      base_price: 75.0,
      status: 'published',
      category_id: 'cat-tool-rolls',
      shopify_product_id: 'gid://shopify/Product/105',
      featured_image: '/media/waxed-canvas-cordura-tool-roll/hero.jpeg',
      gallery: JSON.stringify([
        '/media/waxed-canvas-cordura-tool-roll/field-action.jpeg',
        '/media/waxed-canvas-cordura-tool-roll/workbench-detail.jpeg',
        '/media/waxed-canvas-cordura-tool-roll/charcoal-variation.jpeg',
      ]),
    },

    // ─── THE BANKBEATERS 5-PANEL GUIDE CAP ────────────────────────────────────
    {
      id: 'prod-5panel-guide-cap',
      title: 'The BankBeaters 5-Panel Guide Cap',
      slug: 'the-bankbeaters-5-panel-guide-cap',
      description:
        'Waxed cotton 5-panel guide cap engineered with an unsinkable floatable EVA foam brim, dark glare-reducing underbill, and breathable brass ventilation eyelets.',
      maker_field_notes:
        'If your hat blows off in a river rapid, normal caps sink immediately. We built this with an EVA foam core brim that stays buoyant and recovers its shape after being stuffed into a pack for three days.',
      materials:
        'Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim, Antiqued Brass Mesh Eyelets',
      weight: '2.9 oz (82g)',
      fit_profile:
        'Low Crown 5-Panel with Nylon Webbing Quick-Release Adjuster',
      origin: 'Sewn and shaped in workshop',
      base_price: 44.0,
      status: 'published',
      category_id: 'cat-headwear',
      shopify_product_id: 'gid://shopify/Product/106',
      featured_image: '/media/the-bankbeaters-5-panel-guide-cap/hero.jpeg',
      gallery: JSON.stringify([
        '/media/the-bankbeaters-5-panel-guide-cap/field-action.jpeg',
        '/media/the-bankbeaters-5-panel-guide-cap/workbench-detail.jpeg',
        '/media/the-bankbeaters-5-panel-guide-cap/bark-brown-variation.jpeg',
      ]),
    },
  ];

  // Purge legacy mock products (e.g. Midnight Obsidian Beast, Solar Flare) to prevent unique constraint conflicts
  const validProductIds = products.map((p) => p.id);
  const prodPlaceholders = validProductIds.map(() => '?').join(', ');
  try {
    db.prepare(`DELETE FROM product_variations WHERE product_id NOT IN (${prodPlaceholders});`).run(...validProductIds);
    db.prepare(`DELETE FROM products WHERE id NOT IN (${prodPlaceholders});`).run(...validProductIds);
  } catch {
    // Ignore if tables are empty or newly initialized
  }

  const insertProd = db.prepare(`
    INSERT INTO products (
      id, title, slug, description, maker_field_notes, artist_statement,
      materials, weight, fit_profile, origin,
      base_price, status, category_id, shopify_product_id, featured_image, gallery
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      slug=excluded.slug,
      description=excluded.description,
      maker_field_notes=excluded.maker_field_notes,
      artist_statement=excluded.artist_statement,
      materials=excluded.materials,
      weight=excluded.weight,
      fit_profile=excluded.fit_profile,
      origin=excluded.origin,
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
      p.maker_field_notes,
      p.maker_field_notes,
      p.materials,
      p.weight,
      p.fit_profile,
      p.origin,
      p.base_price,
      p.status,
      p.category_id,
      p.shopify_product_id,
      p.featured_image,
      p.gallery
    );
    console.log(`  Processed product: ${p.title}`);
  }

  console.log('🏷️ [Seed] Seeding BankBeaters Variations & Micro-Batches...');
  const variations = [
    // ─── THE BUSHWHACK STORM ANORAK ───────────────────────────────────────────
    {
      id: 'var-anorak-olive',
      product_id: 'prod-bushwhack-anorak',
      shopify_variant_id: 'gid://shopify/ProductVariant/201',
      variation_name: 'Field Olive — Standard Run',
      sku: 'BWK-ANRK-OLV-STD',
      variation_type: 'standard',
      edition_badge: 'Standard Production',
      variation_notes:
        'Standard production run in bombproof 3-layer olive ripstop with black 500D Cordura scuff guards.',
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 25,
      stock_quantity: 12,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-anorak-camo-micro',
      product_id: 'prod-bushwhack-anorak',
      shopify_variant_id: 'gid://shopify/ProductVariant/202',
      variation_name: 'Deadstock Duck Camo Pocket Edition',
      sku: 'BWK-ANRK-CAMO-LTD',
      variation_type: 'micro_batch',
      edition_badge: 'Only 3 Crafted',
      variation_notes:
        'Crafted at the sewing bench using salvaged 1990s deadstock Mil-Spec duck camo Cordura for the oversized kangaroo chest drop pouch. Only 3 jackets crafted in this micro-batch run. Signed and numbered interior label.',
      variation_images: JSON.stringify([
        {
          image: '/media/bushwhack-storm-anorak/camo-variation.jpeg',
          caption:
            'Bench shot: Deadstock 500D duck camo chest pouch under machine needle',
        },
        {
          image: '/media/bushwhack-storm-anorak/workbench-detail.jpeg',
          caption:
            'Bench shot: AquaGuard zipper bar-tacking and hand-stamped edition tag',
        },
      ]),
      price_override: 385.0,
      is_limited_edition: 1,
      total_edition_count: 3,
      stock_quantity: 3,
      release_date: null,
      status: 'active',
    },

    // ─── BRAMBLE-BUSTER TECHNICAL GUIDE PANT ──────────────────────────────────
    {
      id: 'var-pant-32',
      product_id: 'prod-bramble-buster-pant',
      shopify_variant_id: 'gid://shopify/ProductVariant/203',
      variation_name: 'Size 32 / Regular (Standard)',
      sku: 'BMB-PNT-32R',
      variation_type: 'standard',
      edition_badge: 'Standard Run',
      variation_notes: null,
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 30,
      stock_quantity: 8,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-pant-34',
      product_id: 'prod-bramble-buster-pant',
      shopify_variant_id: 'gid://shopify/ProductVariant/204',
      variation_name: 'Size 34 / Regular (Standard)',
      sku: 'BMB-PNT-34R',
      variation_type: 'standard',
      edition_badge: 'Standard Run',
      variation_notes: null,
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 30,
      stock_quantity: 10,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-pant-camo-knees',
      product_id: 'prod-bramble-buster-pant',
      shopify_variant_id: 'gid://shopify/ProductVariant/205',
      variation_name: 'Micro-Batch Deadstock Camo Knee Edition',
      sku: 'BMB-PNT-CAMO-LTD',
      variation_type: 'micro_batch',
      edition_badge: 'Only 4 Crafted',
      variation_notes:
        'Workbench micro-batch built with rare deadstock Mil-Spec camo Cordura knee reinforcements and high-tensile orange bar-tacks.',
      variation_images: JSON.stringify([
        {
          image: '/media/bramble-buster-technical-guide-pant/camo-variation.jpeg',
          caption:
            'Bench shot: Triple-stitched camo knee overlay with bonded nylon thread',
        },
        {
          image: '/media/bramble-buster-technical-guide-pant/workbench-detail.jpeg',
          caption:
            'Bench shot: Heavyweight DWR ripstop scuff guard seam detail',
        },
      ]),
      price_override: 245.0,
      is_limited_edition: 1,
      total_edition_count: 4,
      stock_quantity: 4,
      release_date: null,
      status: 'active',
    },

    // ─── THE CUTBANK LUMBAR & SLING CONVERTIBLE PACK ──────────────────────────
    {
      id: 'var-cutbank-slate',
      product_id: 'prod-cutbank-sling-pack',
      shopify_variant_id: 'gid://shopify/ProductVariant/206',
      variation_name: 'VX21 Slate Grey — Standard Edition',
      sku: 'CTB-SLG-GRY-STD',
      variation_type: 'standard',
      edition_badge: 'Standard Production',
      variation_notes: null,
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 40,
      stock_quantity: 15,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-cutbank-coyote',
      product_id: 'prod-cutbank-sling-pack',
      shopify_variant_id: 'gid://shopify/ProductVariant/207',
      variation_name: 'Coyote Tan & Blaze Orange Micro-Run',
      sku: 'CTB-SLG-CYT-LTD',
      variation_type: 'micro_batch',
      edition_badge: 'Only 5 Crafted',
      variation_notes:
        'Micro-batch crafted with Coyote Tan X-Pac VX21 exterior shell and high-visibility blaze orange internal packcloth liner for quick tackle identification.',
      variation_images: JSON.stringify([
        {
          image: '/media/the-cutbank-lumbar-sling-pack/coyote-variation.jpeg',
          caption:
            'Bench shot: Coyote Tan sailcloth assembly with blaze orange interior bind',
        },
        {
          image: '/media/the-cutbank-lumbar-sling-pack/workbench-detail.jpeg',
          caption:
            'Bench shot: Magnetic net dock and Hypalon plier sheath testing',
        },
      ]),
      price_override: 225.0,
      is_limited_edition: 1,
      total_edition_count: 5,
      stock_quantity: 5,
      release_date: null,
      status: 'active',
    },

    // ─── MINIMALIST BANK CHEST RIG ────────────────────────────────────────────
    {
      id: 'var-chestrig-ranger',
      product_id: 'prod-minimalist-chest-rig',
      shopify_variant_id: 'gid://shopify/ProductVariant/208',
      variation_name: 'Ranger Olive — Standard Station',
      sku: 'MCR-RIG-OLV-STD',
      variation_type: 'standard',
      edition_badge: 'Standard Run',
      variation_notes: null,
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 35,
      stock_quantity: 12,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-chestrig-proto',
      product_id: 'prod-minimalist-chest-rig',
      shopify_variant_id: 'gid://shopify/ProductVariant/209',
      variation_name: 'Archive Workshop Prototype 01',
      sku: 'MCR-RIG-PROTO-01',
      variation_type: 'one_of_one',
      edition_badge: 'One-of-One Archive',
      variation_notes:
        'Chris personal workshop prototype used during spring cutthroat testing on the North Umpqua River. Signed and dated 01/01 inside the fold-down fly station.',
      variation_images: JSON.stringify([
        {
          image: '/media/minimalist-bank-chest-rig/prototype-variation.jpeg',
          caption:
            'Bench shot: Hand-numbered 01/01 prototype label with custom hook shear dock',
        },
        {
          image: '/media/minimalist-bank-chest-rig/workbench-detail.jpeg',
          caption:
            'Bench shot: High-density EVA fly foam bench testing with bar-tacked webbing',
        },
      ]),
      price_override: 175.0,
      is_limited_edition: 1,
      total_edition_count: 1,
      stock_quantity: 1,
      release_date: null,
      status: 'active',
    },

    // ─── WAXED CANVAS & CORDURA TOOL ROLL / LEADER WALLET ─────────────────────
    {
      id: 'var-toolroll-tan',
      product_id: 'prod-waxed-tool-roll',
      shopify_variant_id: 'gid://shopify/ProductVariant/210',
      variation_name: 'Field Tan Waxed Canvas',
      sku: 'WTR-ROL-TAN-STD',
      variation_type: 'standard',
      edition_badge: 'Workshop Standard',
      variation_notes: null,
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      stock_quantity: 20,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-toolroll-charcoal',
      product_id: 'prod-waxed-tool-roll',
      shopify_variant_id: 'gid://shopify/ProductVariant/211',
      variation_name: 'Dark Charcoal Waxed Canvas',
      sku: 'WTR-ROL-DRK-STD',
      variation_type: 'standard',
      edition_badge: 'Workshop Standard',
      variation_notes: null,
      variation_images: JSON.stringify([
        {
          image: '/media/waxed-canvas-cordura-tool-roll/charcoal-variation.jpeg',
          caption:
            'Bench shot: Dark Charcoal Martexin waxed canvas opened with hi-vis blaze orange interior slots',
        },
        {
          image: '/media/waxed-canvas-cordura-tool-roll/workbench-detail.jpeg',
          caption:
            'Bench shot: Solid antiqued brass snaps pressed into 12oz waxed canvas',
        },
      ]),
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      stock_quantity: 18,
      release_date: null,
      status: 'active',
    },

    // ─── THE BANKBEATERS 5-PANEL GUIDE CAP ────────────────────────────────────
    {
      id: 'var-cap-olive',
      product_id: 'prod-5panel-guide-cap',
      shopify_variant_id: 'gid://shopify/ProductVariant/212',
      variation_name: 'Waxed River Olive',
      sku: 'GDC-CAP-OLV',
      variation_type: 'standard',
      edition_badge: 'Hand-Shaped',
      variation_notes: null,
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      stock_quantity: 25,
      release_date: null,
      status: 'active',
    },
    {
      id: 'var-cap-bark',
      product_id: 'prod-5panel-guide-cap',
      shopify_variant_id: 'gid://shopify/ProductVariant/213',
      variation_name: 'Waxed Bark Brown',
      sku: 'GDC-CAP-BRK',
      variation_type: 'standard',
      edition_badge: 'Hand-Shaped',
      variation_notes: null,
      variation_images: JSON.stringify([
        {
          image: '/media/the-bankbeaters-5-panel-guide-cap/bark-brown-variation.jpeg',
          caption:
            'Bench shot: Waxed Bark Brown cotton canvas 5-panel guide cap profile',
        },
        {
          image: '/media/the-bankbeaters-5-panel-guide-cap/workbench-detail.jpeg',
          caption:
            'Bench shot: Floatable EVA foam brim shaping and antiqued brass mesh eyelet',
        },
      ]),
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      stock_quantity: 25,
      release_date: null,
      status: 'active',
    },
  ];

  const insertVar = db.prepare(`
    INSERT INTO product_variations (
      id, product_id, shopify_variant_id, variation_name, sku,
      variation_type, edition_badge, variation_notes, variation_images,
      price_override, is_limited_edition, total_edition_count, stock_quantity,
      release_date, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      product_id=excluded.product_id,
      shopify_variant_id=excluded.shopify_variant_id,
      variation_name=excluded.variation_name,
      sku=excluded.sku,
      variation_type=excluded.variation_type,
      edition_badge=excluded.edition_badge,
      variation_notes=excluded.variation_notes,
      variation_images=excluded.variation_images,
      price_override=excluded.price_override,
      is_limited_edition=excluded.is_limited_edition,
      total_edition_count=excluded.total_edition_count,
      stock_quantity=excluded.stock_quantity,
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
      v.variation_type,
      v.edition_badge,
      v.variation_notes,
      v.variation_images,
      v.price_override,
      v.is_limited_edition,
      v.total_edition_count,
      v.stock_quantity,
      v.release_date,
      v.status
    );
    console.log(
      `  Processed variation: [${v.sku}] ${v.variation_name} (${v.variation_type})`
    );
  }

  console.log('\n🎉 BankBeaters Adventure Gear database seed completed successfully!');
  console.log(`Summary:`);
  console.log(`  - Categories: ${categories.length} (Depth 2 Hierarchy)`);
  console.log(`  - Products: ${products.length} (Hand-Sewn Silhouettes)`);
  console.log(`  - Product Variations: ${variations.length} (Standard + Micro-Batches)\n`);

  return {
    categoriesCount: categories.length,
    productsCount: products.length,
    variationsCount: variations.length,
  };
}

export function exportSeedSql(outputPath?: string): string {
  const memDb = new DatabaseSync(':memory:');
  seedDatabase(memDb);

  const escapeVal = (val: any) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  const lines: string[] = [
    '-- BankBeaters Adventure Gear D1 Seed Script',
    'PRAGMA foreign_keys = ON;',
  ];

  // Include all schema migrations so D1 databases have all tables created
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      lines.push(`-- Schema Migration: ${file}`);
      lines.push(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
    }
  }

  const categories = memDb.prepare('SELECT * FROM categories ORDER BY parent_id ASC, id ASC').all() as any[];
  for (const c of categories) {
    lines.push(
      `INSERT INTO categories (id, name, slug, parent_id, description, image) VALUES (${escapeVal(c.id)}, ${escapeVal(c.name)}, ${escapeVal(c.slug)}, ${escapeVal(c.parent_id)}, ${escapeVal(c.description)}, ${escapeVal(c.image)}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id, description=excluded.description, image=excluded.image;`
    );
  }

  lines.push(
    '-- Purge any legacy mock collectibles if present',
    "DELETE FROM product_variations WHERE product_id NOT IN ('prod-bushwhack-anorak', 'prod-bramble-buster-pant', 'prod-cutbank-sling-pack', 'prod-minimalist-chest-rig', 'prod-waxed-tool-roll', 'prod-5panel-guide-cap');",
    "DELETE FROM products WHERE id NOT IN ('prod-bushwhack-anorak', 'prod-bramble-buster-pant', 'prod-cutbank-sling-pack', 'prod-minimalist-chest-rig', 'prod-waxed-tool-roll', 'prod-5panel-guide-cap');"
  );

  const products = memDb.prepare('SELECT * FROM products ORDER BY created_at ASC, id ASC').all() as any[];
  for (const p of products) {
    lines.push(
      `INSERT INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, shopify_product_id, featured_image, gallery) VALUES (${escapeVal(p.id)}, ${escapeVal(p.title)}, ${escapeVal(p.slug)}, ${escapeVal(p.description)}, ${escapeVal(p.maker_field_notes)}, ${escapeVal(p.artist_statement)}, ${escapeVal(p.materials)}, ${escapeVal(p.weight)}, ${escapeVal(p.fit_profile)}, ${escapeVal(p.origin)}, ${escapeVal(p.base_price)}, ${escapeVal(p.status)}, ${escapeVal(p.category_id)}, ${escapeVal(p.shopify_product_id)}, ${escapeVal(p.featured_image)}, ${escapeVal(p.gallery)}) ON CONFLICT(id) DO UPDATE SET title=excluded.title, slug=excluded.slug, description=excluded.description, maker_field_notes=excluded.maker_field_notes, artist_statement=excluded.artist_statement, materials=excluded.materials, weight=excluded.weight, fit_profile=excluded.fit_profile, origin=excluded.origin, base_price=excluded.base_price, status=excluded.status, category_id=excluded.category_id, shopify_product_id=excluded.shopify_product_id, featured_image=excluded.featured_image, gallery=excluded.gallery;`
    );
  }

  const variations = memDb.prepare('SELECT * FROM product_variations ORDER BY product_id ASC, id ASC').all() as any[];
  for (const v of variations) {
    lines.push(
      `INSERT INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, release_date, status) VALUES (${escapeVal(v.id)}, ${escapeVal(v.product_id)}, ${escapeVal(v.shopify_variant_id)}, ${escapeVal(v.variation_name)}, ${escapeVal(v.sku)}, ${escapeVal(v.variation_type)}, ${escapeVal(v.edition_badge)}, ${escapeVal(v.variation_notes)}, ${escapeVal(v.variation_images)}, ${escapeVal(v.price_override)}, ${escapeVal(v.is_limited_edition)}, ${escapeVal(v.total_edition_count)}, ${escapeVal(v.stock_quantity)}, ${escapeVal(v.release_date)}, ${escapeVal(v.status)}) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, shopify_variant_id=excluded.shopify_variant_id, variation_name=excluded.variation_name, sku=excluded.sku, variation_type=excluded.variation_type, edition_badge=excluded.edition_badge, variation_notes=excluded.variation_notes, variation_images=excluded.variation_images, price_override=excluded.price_override, is_limited_edition=excluded.is_limited_edition, total_edition_count=excluded.total_edition_count, stock_quantity=excluded.stock_quantity, release_date=excluded.release_date, status=excluded.status;`
    );
  }

  const sqlContent = lines.join('\n') + '\n';
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), outputPath)), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), outputPath), sqlContent, 'utf-8');
    console.log(`✔ Exported seed SQL to ${outputPath} (${sqlContent.length} bytes)`);
  }
  return sqlContent;
}

if (process.argv[1]?.includes('seed-db')) {
  try {
    const exportIdx = process.argv.indexOf('--export-sql');
    if (exportIdx !== -1 && process.argv[exportIdx + 1]) {
      exportSeedSql(process.argv[exportIdx + 1]);
    } else {
      seedDatabase();
    }
  } catch (err) {
    console.error('❌ Database seed failed:', err);
    process.exit(1);
  }
}
