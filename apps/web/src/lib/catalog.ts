/**
 * ChrisShop Catalog Data Access Layer
 *
 * Cloudflare-native / SQLite catalog query engine with price fallback resolution
 * and Cloudflare R2 media URL formatting.
 *
 * Specification: docs/HIGH_LEVEL_DESIGN.md Section 3
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Category,
  Product,
  ProductVariation,
  ProductStatus,
  VariationStatus,
  VariationType,
  VariationImage,
  ProductTechnicalSpecs,
} from '@chrishop/types';
import { getEffectivePrice } from '@chrishop/types';
import { catalogSingleFlight } from './singleflight';
import { getAssetUrl } from './assets';

export type {
  Category,
  Product,
  ProductVariation,
  ProductStatus,
  VariationStatus,
  VariationType,
  VariationImage,
  ProductTechnicalSpecs,
};
export { catalogSingleFlight };

export interface StorefrontVariation {
  id: string;
  product_id: string;
  shopify_variant_id?: string;
  variation_name: string;
  sku: string;
  variation_type?: VariationType;
  edition_badge?: string | null;
  variation_notes?: string | null;
  variation_images?: Array<{ id?: string; url: string; caption?: string }>;
  price_override?: number | null;
  effective_price: number;
  is_limited_edition: boolean;
  total_edition_count?: number | null;
  release_date?: string | null;
  status: VariationStatus;
  stock_quantity: number;
}

export interface StorefrontProduct {
  id: string;
  title: string;
  slug: string;
  description?: string;
  maker_field_notes?: string;
  artist_statement?: string;
  technical_specs?: ProductTechnicalSpecs;
  materials?: string;
  weight?: string;
  fit_profile?: string;
  origin?: string;
  base_price: number;
  effective_min_price?: number;
  status: ProductStatus;
  category?: Category | null;
  shopify_product_id?: string;
  featured_image?: string | null;
  hero_image?: string | null;
  gallery?: string[];
  variations?: StorefrontVariation[];
}

export interface GetProductsOptions {
  category?: string;
  status?: ProductStatus[];
  limit?: number;
  db?: DatabaseSync;
  bypassSingleFlight?: boolean;
}

// ============================================================================
// Database Connection Resolver (Local SQLite / Miniflare D1)
// ============================================================================

let singletonDb: DatabaseSync | null = null;

export function getDatabase(customPath?: string): DatabaseSync {
  if (singletonDb && !customPath) {
    return singletonDb;
  }

  const dbPath =
    customPath ||
    process.env.SQLITE_DB_PATH ||
    path.resolve(process.cwd(), '.wrangler/state/v3/d1/local.sqlite');

  try {
    if (fs.existsSync(dbPath)) {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON;');
      if (!customPath) singletonDb = db;
      return db;
    }
  } catch {
    // Fall back to in-memory SQLite if file cannot be opened
  }

  // Fallback in-memory database seeded with baseline catalog
  const fallbackDb = new DatabaseSync(':memory:');
  fallbackDb.exec('PRAGMA foreign_keys = ON;');
  ensureSchemaAndBaselineData(fallbackDb);
  if (!customPath) singletonDb = fallbackDb;
  return fallbackDb;
}

export function resetDatabase(): void {
  singletonDb = null;
}

function ensureSchemaAndBaselineData(db: DatabaseSync): void {
  db.exec(`
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
  `);

  // Baseline Category Hierarchy (Depth 2)
  const baselineCategories = [
    { id: 'cat-apparel', name: 'Apparel', slug: 'apparel', parent_id: null, description: 'Technical outerwear, guide pants, and weather-resistant midlayers.' },
    { id: 'cat-outerwear', name: 'Outerwear', slug: 'outerwear', parent_id: 'cat-apparel', description: 'Weather-defense anoraks, wading shells, and storm jackets.' },
    { id: 'cat-pants', name: 'Pants & Shorts', slug: 'pants', parent_id: 'cat-apparel', description: 'Heavyweight ripstop guide pants with Cordura brush reinforcement.' },
    { id: 'cat-storm-shells', name: 'Waterproof Storm Shells', slug: 'waterproof-storm-shells', parent_id: 'cat-outerwear', description: '3-layer fully seam-taped waterproof breathable membranes.' },
    { id: 'cat-brush-pants', name: 'Technical Brush Pants', slug: 'technical-brush-pants', parent_id: 'cat-pants', description: '4-way stretch DWR pants with 1000D Cordura knee and ankle scuff guards.' },
    { id: 'cat-packs', name: 'Packs & Carry', slug: 'packs-carry', parent_id: null, description: 'Waterproof composite lumbar slings, modular chest rigs, and submersible gear duffels.' },
    { id: 'cat-sling-packs', name: 'Lumbar & Sling Packs', slug: 'sling-packs', parent_id: 'cat-packs', description: 'One-handed access lumbar and sling packs engineered for uninhibited casting.' },
    { id: 'cat-chest-rigs', name: 'Chest Rigs & Harnesses', slug: 'chest-rigs', parent_id: 'cat-packs', description: 'Modular chest workstations with drop-down fly/tackle shelves.' },
    { id: 'cat-accessories', name: 'Field Accessories', slug: 'field-accessories', parent_id: null, description: 'Waxed canvas tool rolls, Kevlar-reinforced casting gloves, and floating brim guide caps.' },
    { id: 'cat-tool-rolls', name: 'Tool Rolls & Wallets', slug: 'tool-rolls', parent_id: 'cat-accessories', description: 'Martexin waxed canvas leader rolls and tool organizers.' },
    { id: 'cat-headwear', name: 'Caps & Headwear', slug: 'headwear', parent_id: 'cat-accessories', description: 'Floating brim 5-panel guide caps and waxed cotton sun covers.' },
  ];

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, parent_id, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const c of baselineCategories) {
    insertCat.run(c.id, c.name, c.slug, c.parent_id, c.description);
  }

  // Baseline Products (Authentic BankBeaters Catalog)
  const baselineProducts = [
    {
      id: 'prod-bushwhack-anorak',
      title: 'The Bushwhack Storm Anorak',
      slug: 'bushwhack-storm-anorak',
      description: 'Bombproof 3-layer waterproof/breathable membrane with 500D Cordura reinforced forearms and oversized tackle kangaroo pouch.',
      maker_field_notes: 'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles.',
      materials: '3-Layer DWR Toray Ripstop, 500D Cordura® Panels, YKK AquaGuard®',
      weight: '21.4 oz (606g)',
      fit_profile: 'Relaxed Athletic (Engineered for layering and double-haul casting)',
      origin: "Hand-cut & sewn in small batches in Chris's workshop",
      base_price: 340.0,
      status: 'published',
      category_id: 'cat-storm-shells',
      shopify_product_id: 'gid://shopify/Product/101',
      featured_image: 'bushwhack-anorak-olive.webp',
      gallery: JSON.stringify(['bushwhack-anorak-front.webp', 'bushwhack-anorak-pocket.webp', 'bushwhack-anorak-cuff.webp']),
    },
    {
      id: 'prod-bramble-buster-pant',
      title: 'Bramble-Buster Technical Guide Pant',
      slug: 'bramble-buster-technical-guide-pant',
      description: 'Heavyweight stretch ripstop guide pants fortified with 1000D Cordura scuff guards on knees and ankles.',
      maker_field_notes: 'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks, taking direct abuse from blackberry canes.',
      materials: 'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels',
      weight: '17.8 oz (505g)',
      fit_profile: 'Technical Straight (Articulated knees, gusseted seat)',
      origin: "Hand-cut & sewn in small batches in Chris's workshop",
      base_price: 215.0,
      status: 'published',
      category_id: 'cat-brush-pants',
      shopify_product_id: 'gid://shopify/Product/102',
      featured_image: 'bramble-pant-featured.webp',
      gallery: JSON.stringify(['bramble-pant-knees.webp', 'bramble-pant-cuff.webp']),
    },
    {
      id: 'prod-cutbank-sling-pack',
      title: 'The Cutbank Lumbar & Sling Convertible Pack',
      slug: 'the-cutbank-lumbar-sling-pack',
      description: 'Waterproof X-Pac composite sling that converts to a lumbar pack in seconds with integrated magnetic net slot.',
      maker_field_notes: 'When wading chest-deep or scrambling over downed timber, you need your pack out of your stroke until the second you land a fish.',
      materials: 'Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, YKK AquaGuard®',
      weight: '14.2 oz (402g)',
      fit_profile: 'Ambidextrous Sling / Lumbar Switchable with Breathable 3D Spacer Mesh',
      origin: "Hand-crafted in Chris's workshop",
      base_price: 195.0,
      status: 'published',
      category_id: 'cat-sling-packs',
      shopify_product_id: 'gid://shopify/Product/103',
      featured_image: 'cutbank-sling-featured.webp',
      gallery: JSON.stringify(['cutbank-sling-net.webp', 'cutbank-sling-internal.webp']),
    },
    {
      id: 'prod-minimalist-chest-rig',
      title: 'Minimalist Bank Chest Rig',
      slug: 'minimalist-bank-chest-rig',
      description: 'Ultralight modular chest station with fold-down tackle workbench shelf and interchangeable EVA fly/lure patch.',
      maker_field_notes: 'Eliminates heavy vests. Rides high on your chest so you can wade to your armpits without soaking your terminal fly boxes.',
      materials: '500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch, Duraflex® Mojave Buckles',
      weight: '9.6 oz (272g)',
      fit_profile: 'Low-Profile 4-Point Harness (Rides high above deep wading lines)',
      origin: "Hand-crafted in Chris's workshop",
      base_price: 135.0,
      status: 'published',
      category_id: 'cat-chest-rigs',
      shopify_product_id: 'gid://shopify/Product/104',
      featured_image: 'chest-rig-featured.webp',
      gallery: JSON.stringify(['chest-rig-open.webp', 'chest-rig-harness.webp']),
    },
    {
      id: 'prod-waxed-tool-roll',
      title: 'Waxed Canvas & Cordura Tool Roll / Leader Wallet',
      slug: 'waxed-canvas-cordura-tool-roll',
      description: 'Heavyweight waxed canvas organizer with 6 internal slots for tippet spools, leader wallets, pliers, and knot tools.',
      maker_field_notes: 'Built with Martexin waxed canvas that sheds river spray and weathers into a deep personal patina.',
      materials: '12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth, Solid Brass Snaps',
      weight: '6.5 oz (184g)',
      fit_profile: 'Tri-Fold Compact (Fits into any thigh pocket or pack exterior sleeve)',
      origin: 'Hand-cut, waxed, and stitched with bonded nylon thread',
      base_price: 75.0,
      status: 'published',
      category_id: 'cat-tool-rolls',
      shopify_product_id: 'gid://shopify/Product/105',
      featured_image: 'tool-roll-featured.webp',
      gallery: JSON.stringify(['tool-roll-open.webp', 'tool-roll-snaps.webp']),
    },
    {
      id: 'prod-5panel-guide-cap',
      title: 'The BankBeaters 5-Panel Guide Cap',
      slug: 'the-bankbeaters-5-panel-guide-cap',
      description: 'Waxed cotton 5-panel guide cap engineered with an unsinkable floatable EVA foam brim and dark glare-reducing underbill.',
      maker_field_notes: 'If your hat blows off in a river rapid, normal caps sink immediately. Built with an EVA foam core brim that stays buoyant.',
      materials: 'Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim, Antiqued Brass Eyelets',
      weight: '2.9 oz (82g)',
      fit_profile: 'Low Crown 5-Panel with Nylon Webbing Quick-Release Adjuster',
      origin: 'Sewn and shaped in workshop',
      base_price: 44.0,
      status: 'published',
      category_id: 'cat-headwear',
      shopify_product_id: 'gid://shopify/Product/106',
      featured_image: 'guide-cap-featured.webp',
      gallery: JSON.stringify(['guide-cap-side.webp', 'guide-cap-brim.webp']),
    },
  ];

  const insertProd = db.prepare(`
    INSERT OR IGNORE INTO products (id, title, slug, description, maker_field_notes, artist_statement, materials, weight, fit_profile, origin, base_price, status, category_id, shopify_product_id, featured_image, gallery)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of baselineProducts) {
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
  }

  // Baseline Variations
  const baselineVariations = [
    {
      id: 'var-anorak-olive',
      product_id: 'prod-bushwhack-anorak',
      shopify_variant_id: 'gid://shopify/ProductVariant/201',
      variation_name: 'Field Olive — Standard Run',
      sku: 'BWK-ANRK-OLV-STD',
      variation_type: 'standard',
      edition_badge: 'Standard Production',
      variation_notes: 'Standard production run in bombproof 3-layer olive ripstop with black 500D Cordura scuff guards.',
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 25,
      stock_quantity: 12,
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
      variation_notes: 'Crafted at the sewing bench using salvaged 1990s deadstock Mil-Spec duck camo Cordura for the oversized kangaroo chest drop pouch.',
      variation_images: '[{"image":"camo-pocket-bench-1.webp","caption":"Bench shot: Deadstock 500D duck camo chest pouch under machine needle"}]',
      price_override: 385.0,
      is_limited_edition: 1,
      total_edition_count: 3,
      stock_quantity: 3,
      status: 'active',
    },
    {
      id: 'var-pant-olive-32',
      product_id: 'prod-bramble-buster-pant',
      shopify_variant_id: 'gid://shopify/ProductVariant/203',
      variation_name: 'Field Olive Ripstop — 32x32',
      sku: 'BMB-PNT-OLV-3232',
      variation_type: 'standard',
      edition_badge: 'Batch of 30',
      variation_notes: 'Field olive stretch ripstop with black 1000D Cordura knees and cuffs.',
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 30,
      stock_quantity: 10,
      status: 'active',
    },
    {
      id: 'var-sling-camo-xpac',
      product_id: 'prod-cutbank-sling-pack',
      shopify_variant_id: 'gid://shopify/ProductVariant/204',
      variation_name: 'MultiCam Alpine X-Pac Edition',
      sku: 'CTB-SLG-MCAM-LTD',
      variation_type: 'micro_batch',
      edition_badge: 'Only 5 Crafted',
      variation_notes: 'Laser-cut MultiCam Alpine laminated sailcloth with safety orange high-vis lining.',
      variation_images: null,
      price_override: 225.0,
      is_limited_edition: 1,
      total_edition_count: 5,
      stock_quantity: 4,
      status: 'active',
    },
    {
      id: 'var-rig-ranger',
      product_id: 'prod-minimalist-chest-rig',
      shopify_variant_id: 'gid://shopify/ProductVariant/205',
      variation_name: 'Ranger Green / Blaze Accent',
      sku: 'MIN-RIG-RGR-STD',
      variation_type: 'standard',
      edition_badge: 'Batch of 40',
      variation_notes: '500D Mil-Spec Cordura with dual front zip pockets and high-vis blaze tabs.',
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 40,
      stock_quantity: 18,
      status: 'active',
    },
    {
      id: 'var-roll-waxed-tan',
      product_id: 'prod-waxed-tool-roll',
      shopify_variant_id: 'gid://shopify/ProductVariant/206',
      variation_name: 'Field Tan Waxed Canvas',
      sku: 'TLR-WAX-TAN-STD',
      variation_type: 'standard',
      edition_badge: 'Standard Run',
      variation_notes: '12oz Martexin waxed canvas in Field Tan with blaze orange liner.',
      variation_images: null,
      price_override: null,
      is_limited_edition: 1,
      total_edition_count: 50,
      stock_quantity: 22,
      status: 'active',
    },
    {
      id: 'var-cap-duck-camo',
      product_id: 'prod-5panel-guide-cap',
      shopify_variant_id: 'gid://shopify/ProductVariant/207',
      variation_name: 'Deadstock Duck Camo / Floatable Brim',
      sku: 'CAP-5PNL-DCAM-LTD',
      variation_type: 'micro_batch',
      edition_badge: 'Only 12 Crafted',
      variation_notes: 'Vintage duck camo canvas with buoyant closed-cell EVA brim.',
      variation_images: null,
      price_override: 52.0,
      is_limited_edition: 1,
      total_edition_count: 12,
      stock_quantity: 8,
      status: 'active',
    },
  ];

  const insertVar = db.prepare(`
    INSERT OR IGNORE INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const v of baselineVariations) {
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
      v.status
    );
  }
}

// ============================================================================
// Cloudflare R2 Media Asset URL Resolver
// ============================================================================

export { getAssetUrl } from './assets';

// ============================================================================
// Catalog Queries
// ============================================================================

export async function getCategories(options?: { db?: DatabaseSync }): Promise<Category[]> {
  try {
    const db = options?.db || getDatabase();
    const rows = db.prepare(`SELECT * FROM categories ORDER BY name ASC;`).all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      parent_id: r.parent_id ?? null,
      description: r.description ?? undefined,
      image: r.image ?? undefined,
    }));
  } catch (error) {
    console.error('Failed to get categories:', error);
    return [];
  }
}

export async function getProductVariations(
  productId: string,
  options?: { db?: DatabaseSync; basePrice?: number }
): Promise<StorefrontVariation[]> {
  try {
    const db = options?.db || getDatabase();

    let basePrice = options?.basePrice;
    if (basePrice === undefined) {
      const parent = db.prepare(`SELECT base_price FROM products WHERE id = ?;`).get(productId) as any;
      basePrice = parent ? Number(parent.base_price) : 0;
    }

    const rows = db
      .prepare(`SELECT * FROM product_variations WHERE product_id = ? ORDER BY sku ASC;`)
      .all(productId) as any[];

    return rows.map((r) => {
      const priceOverride = r.price_override != null ? Number(r.price_override) : null;
      const effectivePrice = getEffectivePrice({ base_price: basePrice! }, { price_override: priceOverride });

      let variationImages: Array<{ id?: string; url: string; caption?: string }> = [];
      if (r.variation_images) {
        try {
          const parsed =
            typeof r.variation_images === 'string'
              ? JSON.parse(r.variation_images)
              : r.variation_images;
          if (Array.isArray(parsed)) {
            variationImages = parsed.map((item: any, idx: number) => {
              const rawKey = typeof item === 'string' ? item : item.image || item.url;
              return {
                id: `var-img-${r.id}-${idx}`,
                url: getAssetUrl(rawKey) || rawKey,
                caption: typeof item === 'object' ? item.caption : undefined,
              };
            });
          }
        } catch {
          variationImages = [];
        }
      }

      return {
        id: r.id,
        product_id: r.product_id,
        shopify_variant_id: r.shopify_variant_id ?? undefined,
        variation_name: r.variation_name,
        sku: r.sku,
        variation_type: (r.variation_type as VariationType) || 'standard',
        edition_badge: r.edition_badge ?? null,
        variation_notes: r.variation_notes ?? null,
        variation_images: variationImages,
        price_override: priceOverride,
        effective_price: effectivePrice,
        is_limited_edition: Boolean(r.is_limited_edition),
        total_edition_count: r.total_edition_count != null ? Number(r.total_edition_count) : null,
        release_date: r.release_date ?? null,
        status: (r.status as VariationStatus) || 'coming_soon',
        stock_quantity: r.stock_quantity != null ? Number(r.stock_quantity) : 10,
      };
    });
  } catch (error) {
    console.error(`Failed to get variations for product [${productId}]:`, error);
    return [];
  }
}

export async function getProductBySlug(
  slug: string,
  options?: { db?: DatabaseSync; bypassSingleFlight?: boolean }
): Promise<StorefrontProduct | null> {
  if (options?.bypassSingleFlight) {
    return fetchProductBySlugDirect(slug, options);
  }
  return catalogSingleFlight.do(`product:${slug}`, () =>
    fetchProductBySlugDirect(slug, options)
  );
}

async function fetchProductBySlugDirect(
  slug: string,
  options?: { db?: DatabaseSync }
): Promise<StorefrontProduct | null> {
  try {
    const db = options?.db || getDatabase();

    const productRow = db.prepare(`SELECT * FROM products WHERE slug = ?;`).get(slug) as any;
    if (!productRow) return null;

    let category: Category | null = null;
    if (productRow.category_id) {
      const catRow = db.prepare(`SELECT * FROM categories WHERE id = ?;`).get(productRow.category_id) as any;
      if (catRow) {
        category = {
          id: catRow.id,
          name: catRow.name,
          slug: catRow.slug,
          parent_id: catRow.parent_id ?? null,
          description: catRow.description ?? undefined,
          image: catRow.image ?? undefined,
        };
      }
    }

    const variations = await getProductVariations(productRow.id, {
      db,
      basePrice: Number(productRow.base_price),
    });

    const prices =
      variations.length > 0 ? variations.map((v) => v.effective_price) : [Number(productRow.base_price)];
    const effectiveMinPrice = Math.min(...prices);

    let gallery: string[] = [];
    if (productRow.gallery) {
      try {
        gallery = typeof productRow.gallery === 'string' ? JSON.parse(productRow.gallery) : productRow.gallery;
      } catch {
        gallery = [];
      }
    }

    const makerNotes = productRow.maker_field_notes || productRow.artist_statement || undefined;

    return {
      id: productRow.id,
      title: productRow.title,
      slug: productRow.slug,
      description: productRow.description ?? undefined,
      maker_field_notes: makerNotes,
      artist_statement: makerNotes,
      technical_specs: {
        materials: productRow.materials ?? undefined,
        weight: productRow.weight ?? undefined,
        fit_profile: productRow.fit_profile ?? undefined,
        origin: productRow.origin ?? undefined,
      },
      materials: productRow.materials ?? undefined,
      weight: productRow.weight ?? undefined,
      fit_profile: productRow.fit_profile ?? undefined,
      origin: productRow.origin ?? undefined,
      base_price: Number(productRow.base_price),
      effective_min_price: effectiveMinPrice,
      status: (productRow.status as ProductStatus) || 'draft',
      category,
      shopify_product_id: productRow.shopify_product_id ?? undefined,
      featured_image: productRow.featured_image ?? null,
      hero_image: productRow.hero_image ?? productRow.featured_image ?? null,
      gallery,
      variations,
    };
  } catch (error) {
    console.error(`Failed to get product [${slug}]:`, error);
    return null;
  }
}

export async function getProducts(options?: GetProductsOptions): Promise<StorefrontProduct[]> {
  if (options?.bypassSingleFlight) {
    return fetchProductsDirect(options);
  }
  const catKey = options?.category || 'all';
  const statusKey = (options?.status || ['published']).join(',');
  const limitKey = options?.limit ?? 'all';
  const key = `products:${catKey}:${statusKey}:${limitKey}`;

  return catalogSingleFlight.do(key, () => fetchProductsDirect(options));
}

async function fetchProductsDirect(options?: GetProductsOptions): Promise<StorefrontProduct[]> {
  try {
    const db = options?.db || getDatabase();

    let query = `
      SELECT p.*, c.name AS cat_name, c.slug AS cat_slug, c.description AS cat_desc, c.image AS cat_image, c.parent_id AS cat_parent_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by category slug or ID (including recursive child categories)
    if (options?.category) {
      query += ` AND p.category_id IN (
        WITH RECURSIVE cat_tree(id) AS (
          SELECT id FROM categories WHERE slug = ? OR id = ?
          UNION ALL
          SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
        )
        SELECT id FROM cat_tree
      )`;
      params.push(options.category, options.category);
    }

    // Filter by publication status
    const statuses = options?.status && options.status.length > 0 ? options.status : ['published'];
    const placeholders = statuses.map(() => '?').join(',');
    query += ` AND p.status IN (${placeholders})`;
    params.push(...statuses);

    query += ` ORDER BY p.created_at ASC, p.id ASC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = db.prepare(query).all(...params) as any[];

    const products: StorefrontProduct[] = [];
    for (const r of rows) {
      const variations = await getProductVariations(r.id, { db, basePrice: Number(r.base_price) });
      const prices =
        variations.length > 0 ? variations.map((v) => v.effective_price) : [Number(r.base_price)];
      const effectiveMinPrice = Math.min(...prices);

      let gallery: string[] = [];
      if (r.gallery) {
        try {
          gallery = typeof r.gallery === 'string' ? JSON.parse(r.gallery) : r.gallery;
        } catch {
          gallery = [];
        }
      }

      const makerNotes = r.maker_field_notes || r.artist_statement || undefined;

      products.push({
        id: r.id,
        title: r.title,
        slug: r.slug,
        description: r.description ?? undefined,
        maker_field_notes: makerNotes,
        artist_statement: makerNotes,
        technical_specs: {
          materials: r.materials ?? undefined,
          weight: r.weight ?? undefined,
          fit_profile: r.fit_profile ?? undefined,
          origin: r.origin ?? undefined,
        },
        materials: r.materials ?? undefined,
        weight: r.weight ?? undefined,
        fit_profile: r.fit_profile ?? undefined,
        origin: r.origin ?? undefined,
        base_price: Number(r.base_price),
        effective_min_price: effectiveMinPrice,
        status: (r.status as ProductStatus) || 'draft',
        category: r.category_id
          ? {
              id: r.category_id,
              name: r.cat_name,
              slug: r.cat_slug,
              parent_id: r.cat_parent_id ?? null,
              description: r.cat_desc ?? undefined,
              image: r.cat_image ?? undefined,
            }
          : null,
        shopify_product_id: r.shopify_product_id ?? undefined,
        featured_image: r.featured_image ?? null,
        hero_image: r.hero_image ?? r.featured_image ?? null,
        gallery,
        variations,
      });
    }

    return products;
  } catch (error) {
    console.error('Failed to get products:', error);
    return [];
  }
}

export async function getFeaturedProducts(
  limit: number = 4,
  options?: { db?: DatabaseSync }
): Promise<StorefrontProduct[]> {
  return getProducts({
    status: ['published'],
    limit,
    db: options?.db,
  });
}

// ============================================================================
// Compatibility Signatures for Storefront Pages
// ============================================================================

export async function fetchProducts(options?: {
  limit?: number;
  categorySlug?: string;
  db?: DatabaseSync;
}): Promise<StorefrontProduct[]> {
  return getProducts({
    limit: options?.limit,
    category: options?.categorySlug,
    db: options?.db,
  });
}

export const fetchProductBySlug = getProductBySlug;
export const fetchCategories = getCategories;
