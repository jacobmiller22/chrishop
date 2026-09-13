/**
 * ChrisShop Catalog Data Access Layer
 *
 * Cloudflare D1 catalog query engine with price fallback resolution
 * and Cloudflare R2 media URL formatting.
 *
 * Specification: docs/HIGH_LEVEL_DESIGN.md Section 3
 */

export interface D1DatabaseLike {
  prepare(sql: string): {
    bind?(...params: any[]): any;
    all(...params: any[]): Promise<any> | any;
    get(...params: any[]): Promise<any> | any;
    first?(...params: any[]): Promise<any> | any;
    run(...params: any[]): Promise<any> | any;
  };
  exec?(sql: string): Promise<any> | any;
}

export type DatabaseSync = D1DatabaseLike;

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
// Database Connection Resolver (Cloudflare D1)
// ============================================================================

let singletonDb: D1DatabaseLike | null = null;

export function getDatabase(): D1DatabaseLike {
  if (singletonDb) {
    return singletonDb;
  }

  // Check if live Cloudflare D1 binding is available
  const d1 =
    (typeof globalThis !== 'undefined' && (globalThis as any).DB) ||
    (typeof globalThis !== 'undefined' &&
      (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env?.DB);

  if (d1) {
    const d1Wrapper: D1DatabaseLike = {
      prepare(sql: string) {
        return {
          bind: (...params: any[]) => d1.prepare(sql).bind(...params),
          all: (...params: any[]) => {
            const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
            return stmt.all().then((res: any) => res?.results || []);
          },
          get: (...params: any[]) => {
            const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
            return stmt.first();
          },
          run: (...params: any[]) => {
            const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
            return stmt.run();
          },
        };
      },
      exec: async (sql: string) => d1.exec(sql),
    };
    singletonDb = d1Wrapper;
    return d1Wrapper;
  }

  // Pure edge / mock stub when no D1 binding is attached (e.g. static pre-render)
  const stubDb: D1DatabaseLike = {
    exec: async () => {},
    prepare: () => ({
      bind: () => stubDb.prepare(''),
      all: async () => [],
      get: async () => null,
      run: async () => ({ changes: 0 }),
    }),
  };
  return stubDb;
}

export function resetDatabase(): void {
  singletonDb = null;
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
    const rawRows = await db.prepare(`SELECT * FROM categories ORDER BY name ASC;`).all();
    const rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
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
      const parent = (await db.prepare(`SELECT base_price FROM products WHERE id = ?;`).get(productId)) as any;
      basePrice = parent ? Number(parent.base_price) : 0;
    }

    const rawRows = await db
      .prepare(`SELECT * FROM product_variations WHERE product_id = ? ORDER BY sku ASC;`)
      .all(productId);
    const rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];

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

    const productRow = (await db.prepare(`SELECT * FROM products WHERE slug = ?;`).get(slug)) as any;
    if (!productRow) return null;

    let category: Category | null = null;
    if (productRow.category_id) {
      const catRow = (await db.prepare(`SELECT * FROM categories WHERE id = ?;`).get(productRow.category_id)) as any;
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

    const rawRows = await db.prepare(query).all(...params);
    const rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];

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
