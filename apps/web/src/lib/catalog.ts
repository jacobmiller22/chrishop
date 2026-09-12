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
  db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, parent_id, description)
    VALUES ('cat-apparel', 'Apparel', 'apparel', NULL, 'Technical outerwear, guide pants, and weather-resistant midlayers.')
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, parent_id, description)
    VALUES ('cat-outerwear', 'Outerwear', 'outerwear', 'cat-apparel', 'Weather-defense anoraks, wading shells, and storm jackets.')
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, parent_id, description)
    VALUES ('cat-storm-shells', 'Waterproof Storm Shells', 'waterproof-storm-shells', 'cat-outerwear', '3-layer fully seam-taped waterproof breathable membranes.')
  `).run();

  // Baseline Product
  db.prepare(`
    INSERT OR IGNORE INTO products (id, title, slug, description, maker_field_notes, materials, weight, fit_profile, origin, base_price, status, category_id, shopify_product_id)
    VALUES (
      'prod-bushwhack-anorak',
      'The Bushwhack Storm Anorak',
      'bushwhack-storm-anorak',
      'Bombproof 3-layer waterproof/breathable membrane with 500D Cordura reinforced forearms and oversized tackle kangaroo pouch.',
      'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles.',
      '3-Layer DWR Toray Ripstop, 500D Cordura® Panels, YKK AquaGuard®',
      '21.4 oz (606g)',
      'Relaxed Athletic (Engineered for layering and double-haul casting)',
      'Hand-cut & sewn in small batches in Chris workshop',
      340.0,
      'published',
      'cat-storm-shells',
      'gid://shopify/Product/101'
    )
  `).run();

  // Baseline Variations (Standard + Micro-Batch)
  db.prepare(`
    INSERT OR IGNORE INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, price_override, is_limited_edition, total_edition_count, stock_quantity, status)
    VALUES (
      'var-anorak-olive',
      'prod-bushwhack-anorak',
      'gid://shopify/ProductVariant/201',
      'Field Olive — Standard Run',
      'BWK-ANRK-OLV-STD',
      'standard',
      'Standard Production',
      'Standard production run in bombproof 3-layer olive ripstop with black 500D Cordura scuff guards.',
      NULL,
      1,
      25,
      12,
      'active'
    )
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, variation_type, edition_badge, variation_notes, variation_images, price_override, is_limited_edition, total_edition_count, stock_quantity, status)
    VALUES (
      'var-anorak-camo-micro',
      'prod-bushwhack-anorak',
      'gid://shopify/ProductVariant/202',
      'Deadstock Duck Camo Pocket Edition',
      'BWK-ANRK-CAMO-LTD',
      'micro_batch',
      'Only 3 Crafted',
      'Crafted at the sewing bench using salvaged 1990s deadstock Mil-Spec duck camo Cordura for the oversized kangaroo chest drop pouch. Only 3 jackets crafted in this micro-batch run. Signed and numbered interior label.',
      '[{"image":"camo-pocket-bench-1.webp","caption":"Bench shot: Deadstock 500D duck camo chest pouch under machine needle"}]',
      385.0,
      1,
      3,
      3,
      'active'
    )
  `).run();

  // Preserved baseline item for singleflight and regression test coverage
  db.prepare(`
    INSERT OR IGNORE INTO products (id, title, slug, description, base_price, status, category_id, shopify_product_id)
    VALUES (
      'prod-obsidian-beast',
      'Midnight Obsidian Beast',
      'midnight-obsidian-beast',
      'Hand-carved obsidian beast artifact.',
      350.0,
      'published',
      'cat-storm-shells',
      'gid://shopify/Product/1'
    )
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, variation_type, price_override, is_limited_edition, stock_quantity, status)
    VALUES (
      'var-beast-std',
      'prod-obsidian-beast',
      'gid://shopify/ProductVariant/1001',
      'Standard Edition',
      'BEAST-STD',
      'standard',
      NULL,
      1,
      5,
      'active'
    )
  `).run();
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

    query += ` ORDER BY p.title ASC`;

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
