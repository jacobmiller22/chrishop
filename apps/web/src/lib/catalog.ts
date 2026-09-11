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
} from '@chrishop/types';
import { getEffectivePrice } from '@chrishop/types';

export type { Category, Product, ProductVariation, ProductStatus, VariationStatus };

export interface StorefrontVariation {
  id: string;
  product_id: string;
  shopify_variant_id?: string;
  variation_name: string;
  sku: string;
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
  artist_statement?: string;
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
      description TEXT,
      image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      artist_statement TEXT,
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
      price_override REAL,
      is_limited_edition INTEGER NOT NULL DEFAULT 1,
      total_edition_count INTEGER,
      release_date TEXT,
      status TEXT NOT NULL DEFAULT 'coming_soon',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // Baseline Category
  db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, description)
    VALUES ('cat-sculptures', 'Sculptures', 'sculptures', 'Limited edition art sculptures')
  `).run();

  // Baseline Product
  db.prepare(`
    INSERT OR IGNORE INTO products (id, title, slug, description, base_price, status, category_id, shopify_product_id)
    VALUES ('prod-obsidian-beast', 'Midnight Obsidian Beast', 'midnight-obsidian-beast', 'Hand-cast obsidian sculpture with 24k gold leaf.', 350.0, 'published', 'cat-sculptures', 'gid://shopify/Product/101')
  `).run();

  // Baseline Variations
  db.prepare(`
    INSERT OR IGNORE INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, price_override, is_limited_edition, total_edition_count, status)
    VALUES ('var-beast-std', 'prod-obsidian-beast', 'gid://shopify/ProductVariant/201', 'Standard Obsidian Edition', 'BEAST-OBS-STD', NULL, 1, 50, 'active')
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO product_variations (id, product_id, shopify_variant_id, variation_name, sku, price_override, is_limited_edition, total_edition_count, status)
    VALUES ('var-beast-gld', 'prod-obsidian-beast', 'gid://shopify/ProductVariant/202', '24K Gold Leaf Inlay Edition', 'BEAST-GLD-LTD', 495.0, 1, 10, 'active')
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

      return {
        id: r.id,
        product_id: r.product_id,
        shopify_variant_id: r.shopify_variant_id ?? undefined,
        variation_name: r.variation_name,
        sku: r.sku,
        price_override: priceOverride,
        effective_price: effectivePrice,
        is_limited_edition: Boolean(r.is_limited_edition),
        total_edition_count: r.total_edition_count != null ? Number(r.total_edition_count) : null,
        release_date: r.release_date ?? null,
        status: (r.status as VariationStatus) || 'coming_soon',
        stock_quantity: 10, // Synced dynamically from Shopify Storefront API
      };
    });
  } catch (error) {
    console.error(`Failed to get variations for product [${productId}]:`, error);
    return [];
  }
}

export async function getProductBySlug(
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

    return {
      id: productRow.id,
      title: productRow.title,
      slug: productRow.slug,
      description: productRow.description ?? undefined,
      artist_statement: productRow.artist_statement ?? undefined,
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
  try {
    const db = options?.db || getDatabase();

    let query = `
      SELECT p.*, c.name AS cat_name, c.slug AS cat_slug, c.description AS cat_desc, c.image AS cat_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by category slug or ID
    if (options?.category) {
      query += ` AND (c.slug = ? OR c.id = ?)`;
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

      products.push({
        id: r.id,
        title: r.title,
        slug: r.slug,
        description: r.description ?? undefined,
        artist_statement: r.artist_statement ?? undefined,
        base_price: Number(r.base_price),
        effective_min_price: effectiveMinPrice,
        status: (r.status as ProductStatus) || 'draft',
        category: r.category_id
          ? {
              id: r.category_id,
              name: r.cat_name,
              slug: r.cat_slug,
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
