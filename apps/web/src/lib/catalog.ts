/**
 * ChrisShop Catalog Data Access Layer
 *
 * Cloudflare D1 catalog query engine with price fallback resolution,
 * Payload CMS v3 schema alignment, Lexical rich-text extraction,
 * and Cloudflare R2 media URL formatting.
 *
 * Specification: docs/HIGH_LEVEL_DESIGN.md Section 3 & Issue #241
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
export {
  mergeProductWithShopifyPricing,
  mergeVariationWithShopifyPricing,
  enrichProductWithShopifyPricing,
  enrichProductsWithShopifyPricing,
} from './shopify-pricing';
import { createRemoteD1Client } from '@chrishop/config';

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

export interface StorefrontProductLine {
  id: string;
  title: string;
  slug: string;
  story?: string;
  default_price?: number;
  hero_image?: string;
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
  sku?: string;
  price?: number | null;
  effective_price?: number;
  product_line?: StorefrontProductLine | null;
  options?: any[];
  base_price: number;
  effective_min_price?: number;
  status: ProductStatus;
  release_date?: string | null;
  category?: Category | null;
  shopify_product_id?: string;
  featured_image?: string | null;
  hero_image?: string | null;
  gallery?: string[];
  variations?: StorefrontVariation[];
}

export interface GetProductsOptions {
  category?: string;
  status?: (ProductStatus | 'active')[];
  limit?: number;
  db?: DatabaseSync;
  bypassSingleFlight?: boolean;
}

export const FALLBACK_CATEGORIES: Category[] = [
  {
    id: 'cat-apparel',
    name: 'Apparel & Outerwear',
    slug: 'apparel',
    parent_id: null,
    description: 'Technical outerwear, waterproof shells, and puncture-resistant guide pants.',
  },
  {
    id: 'cat-packs',
    name: 'Packs & Carry',
    slug: 'packs-carry',
    parent_id: null,
    description: 'Modular chest rigs, waterproof roll-top bags, and technical sling carry.',
  },
  {
    id: 'cat-accessories',
    name: 'Field Accessories',
    slug: 'field-accessories',
    parent_id: null,
    description: 'Artisanal tool rolls, heavy-duty wading belts, and workshop accessories.',
  },
  {
    id: 'cat-storm-shells',
    name: 'Waterproof Storm Shells',
    slug: 'storm-shells',
    parent_id: 'cat-apparel',
    description: '3-layer waterproof ripstop storm shells built for torrential conditions.',
  },
  {
    id: 'cat-brush-pants',
    name: 'Brush & Guide Pants',
    slug: 'brush-pants',
    parent_id: 'cat-apparel',
    description: 'Cordura-reinforced technical wading and scrambling pants.',
  },
];

export const FALLBACK_PRODUCTS_BY_SLUG: Record<string, StorefrontProduct> = {
  'bushwhack-storm-anorak': {
    id: 'prod-bushwhack-anorak',
    title: 'The Bushwhack Storm Anorak',
    slug: 'bushwhack-storm-anorak',
    shopify_product_id: 'gid://shopify/Product/101',
    description:
      'Patagonia-grade 3-layer waterproof storm shell with 500D Cordura reinforced forearms and oversized kangaroo tackle pouch. Built to crawl through thorns, stay dry in torrential downpours, and cast all day.',
    maker_field_notes:
      'Designed for bushwhacking through dense alder thickets to find unpressured cutthroat runs. The 500D Cordura panels on the forearms take the beating so your membrane does not shred on thorny bank scrambles.',
    materials: '3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®',
    weight: '21.4 oz (606g)',
    fit_profile: 'Relaxed Athletic (Engineered for layering and overhead casting mobility)',
    origin: "Hand-cut & sewn in small batches in Chris's workshop",
    base_price: 340,
    effective_price: 340,
    status: 'published',
    category: {
      id: 'cat-storm-shells',
      name: 'Waterproof Storm Shells',
      slug: 'storm-shells',
    },
    featured_image: '/media/bushwhack-storm-anorak/hero.jpeg',
    hero_image: '/media/bushwhack-storm-anorak/hero.jpeg',
    gallery: [
      '/media/bushwhack-storm-anorak/field-action.jpeg',
      '/media/bushwhack-storm-anorak/workbench-detail.jpeg',
      '/media/bushwhack-storm-anorak/camo-variation.jpeg',
    ],
    variations: [
      {
        id: 'var-anorak-olive',
        product_id: 'prod-bushwhack-anorak',
        shopify_variant_id: 'gid://shopify/ProductVariant/201',
        variation_name: 'Field Olive — Standard Run',
        sku: 'BWK-ANRK-OLV-STD',
        variation_type: 'standard',
        edition_badge: 'Standard Production',
        effective_price: 340,
        is_limited_edition: false,
        status: 'active',
        stock_quantity: 12,
      },
      {
        id: 'var-anorak-camo-micro',
        product_id: 'prod-bushwhack-anorak',
        shopify_variant_id: 'gid://shopify/ProductVariant/202',
        variation_name: 'Deadstock Duck Camo Pocket Edition',
        sku: 'BWK-ANRK-CAMO-LTD',
        variation_type: 'micro_batch',
        edition_badge: 'Only 3 Crafted',
        price_override: 385,
        effective_price: 385,
        is_limited_edition: true,
        total_edition_count: 3,
        status: 'active',
        stock_quantity: 3,
      },
    ],
  },
  'bramble-buster-technical-guide-pant': {
    id: 'prod-bramble-buster-pant',
    title: 'Bramble-Buster Technical Guide Pant',
    slug: 'bramble-buster-technical-guide-pant',
    shopify_product_id: 'gid://shopify/Product/102',
    description:
      'Heavyweight stretch ripstop guide pants fortified with 1000D Cordura scuff guards on knees and ankles.',
    maker_field_notes:
      'Standard fishing waders get shredded by briars on the walk-in. These pants wear over thermal tights or wet-wading socks.',
    materials: 'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels',
    weight: '17.8 oz (505g)',
    fit_profile: 'Technical Straight (Articulated knees, gusseted seat for steep cut-bank scrambles)',
    origin: "Hand-cut & sewn in small batches in Chris's workshop",
    base_price: 215,
    effective_price: 215,
    status: 'published',
    category: {
      id: 'cat-brush-pants',
      name: 'Brush & Guide Pants',
      slug: 'brush-pants',
    },
    featured_image: '/media/bramble-buster-technical-guide-pant/hero.jpeg',
    hero_image: '/media/bramble-buster-technical-guide-pant/hero.jpeg',
    gallery: [],
    variations: [],
  },
  'leadville-ultralight-wading-pack': {
    id: 'prod-leadville-wading-pack',
    title: 'Leadville Ultralight Wading Chest Pack',
    slug: 'leadville-ultralight-wading-pack',
    shopify_product_id: 'gid://shopify/Product/103',
    description:
      'Engineered for alpine squalls and brush navigation in the Colorado high country. Built with Challenge ULTRA 200TX and YKK AquaGuard zips.',
    maker_field_notes:
      'Patterned specifically for long walk-ins along the upper Arkansas River. Ultralight, waterproof, and keeps your fly boxes dry when wading deep.',
    materials: 'Challenge ULTRA™ 200TX, 500D Cordura® Backer, YKK AquaGuard®',
    weight: '7.8 oz (221g)',
    fit_profile: 'Low-profile ergonomic chest & sling mount',
    origin: "Hand-cut & sewn in small batches in Chris's workshop",
    base_price: 185,
    effective_price: 185,
    status: 'coming_soon',
    release_date: '2026-10-15T16:00:00Z',
    category: {
      id: 'cat-packs',
      name: 'Packs & Carry',
      slug: 'packs-carry',
    },
    featured_image: '/media/leadville-ultralight-wading-pack/hero.jpeg',
    hero_image: '/media/leadville-ultralight-wading-pack/hero.jpeg',
    gallery: [],
    variations: [
      {
        id: 'var-pack-batch-01',
        product_id: 'prod-leadville-wading-pack',
        shopify_variant_id: 'gid://shopify/ProductVariant/203',
        variation_name: 'Leadville Edition — Batch 01',
        sku: 'LV-PACK-B01',
        variation_type: 'micro_batch',
        edition_badge: 'Batch of 15',
        effective_price: 185,
        is_limited_edition: true,
        total_edition_count: 15,
        status: 'coming_soon',
        release_date: '2026-10-15T16:00:00Z',
        stock_quantity: 15,
      },
    ],
  },
};
FALLBACK_PRODUCTS_BY_SLUG['the-bushwhack-storm-anorak'] = FALLBACK_PRODUCTS_BY_SLUG['bushwhack-storm-anorak'];

// ============================================================================
// Lexical RichText Serializer & Text Extractor
// ============================================================================

export function extractLexicalText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const text = extractFromNode(parsed.root || parsed);
        if (text) return text;
      } catch {
        return raw;
      }
    }
    return raw;
  }
  if (typeof raw === 'object') {
    const text = extractFromNode(raw.root || raw);
    if (text) return text;
  }
  return String(raw);
}

function extractFromNode(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.children)) {
    return node.children.map(extractFromNode).filter(Boolean).join(' ');
  }
  return '';
}

// ============================================================================
// Database Connection Resolver (Cloudflare D1)
// ============================================================================

let singletonDb: D1DatabaseLike | null = null;

export function setDatabase(db: D1DatabaseLike | null): void {
  singletonDb = db;
}

export function getDatabase(): D1DatabaseLike {
  if (singletonDb) {
    return singletonDb;
  }

  // Check if an Integration Matrix profile requests remote Cloudflare D1
  if (typeof process !== 'undefined' && process.env.MATRIX_PROFILE) {
    const profile = process.env.MATRIX_PROFILE;
    if (profile === 'hybrid-staging' || profile === 'prod-readonly-probe') {
      const readOnly = profile === 'prod-readonly-probe' && process.env.ALLOW_PROD_WRITES !== 'true';
      const databaseId =
        profile === 'prod-readonly-probe'
          ? (process.env.CLOUDFLARE_PROD_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID || 'chrishop-prod-db')
          : (process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID || 'chrishop-staging-db');

      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
        singletonDb = createRemoteD1Client({
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          databaseId,
          apiToken: process.env.CLOUDFLARE_API_TOKEN,
          readOnly,
        });
        return singletonDb;
      }
    }
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

function resolveMediaUrl(m?: { url?: string; filename?: string } | null): string | null {
  if (!m) return null;
  if (m.url) return m.url;
  if (m.filename) return `/media/${m.filename}`;
  return null;
}

// ============================================================================
// Catalog Queries
// ============================================================================

export async function getProductLines(options?: { db?: DatabaseSync }): Promise<StorefrontProductLine[]> {
  try {
    const db = options?.db || getDatabase();
    const raw = await db.prepare("SELECT * FROM product_lines ORDER BY title ASC;").all();
    const rows = (Array.isArray(raw) ? raw : (raw as any)?.results || []) as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      story: r.story ?? undefined,
      default_price: r.default_price != null ? Number(r.default_price) : undefined,
      hero_image: r.hero_image ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function getCategories(options?: { db?: DatabaseSync }): Promise<Category[]> {
  try {
    const db = options?.db || getDatabase();
    let rows: any[] = [];
    try {
      const rawRows = await db
        .prepare(`
          SELECT c.*, m.filename AS media_filename, m.url AS media_url
          FROM categories c
          LEFT JOIN media m ON c.image_id = m.id
          ORDER BY c.name ASC;
        `)
        .all();
      rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
    } catch {
      const rawRows = await db.prepare(`SELECT * FROM categories ORDER BY name ASC;`).all();
      rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
    }

    if (rows.length === 0 && !options?.db) {
      return FALLBACK_CATEGORIES;
    }

    return rows.map((r) => {
      const rawImage =
        r.media_url ||
        (r.media_filename ? `/media/${r.media_filename}` : undefined) ||
        r.image ||
        undefined;

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        parent_id: r.parent_id ?? null,
        description: r.description ?? undefined,
        image: rawImage ? getAssetUrl(rawImage) || rawImage : undefined,
      };
    });
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

    let rows: any[] = [];
    try {
      const rawRows = await db
        .prepare(`SELECT * FROM product_variations WHERE product_id_id = ? ORDER BY sku ASC;`)
        .all(productId);
      rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
    } catch {
      const rawRows = await db
        .prepare(`SELECT * FROM product_variations WHERE product_id = ? ORDER BY sku ASC;`)
        .all(productId);
      rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
    }

    const variations: StorefrontVariation[] = [];

    for (const r of rows) {
      const rawOverride = r.price_override;
      const priceOverride =
        rawOverride != null && rawOverride !== 'null' && rawOverride !== ''
          ? Number(rawOverride)
          : null;
      const effectivePrice = getEffectivePrice(
        { base_price: basePrice! },
        { price_override: priceOverride }
      );

      let variationImages: Array<{ id?: string; url: string; caption?: string }> = [];

      // 1. Try relational table product_variations_variation_images
      try {
        const rawImgRows = await db
          .prepare(`
            SELECT vi.id, vi.caption, m.url AS media_url, m.filename AS media_filename
            FROM product_variations_variation_images vi
            LEFT JOIN media m ON vi.image_id = m.id
            WHERE vi._parent_id = ?
            ORDER BY vi._order ASC;
          `)
          .all(r.id);
        const imgRows = (Array.isArray(rawImgRows)
          ? rawImgRows
          : ((rawImgRows as any)?.results || [])) as any[];
        if (imgRows.length > 0) {
          variationImages = imgRows.map((img) => {
            const rawKey = img.media_url || (img.media_filename ? `/media/${img.media_filename}` : '');
            return {
              id: String(img.id),
              url: getAssetUrl(rawKey) || rawKey,
              caption: img.caption || undefined,
            };
          });
        }
      } catch {
        // Relational table not present
      }

      // 2. Fall back to JSON variation_images column
      if (variationImages.length === 0 && r.variation_images) {
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

      const defaultStock = r.status === 'sold_out' ? 0 : 10;
      const stockQuantity =
        r.stock_quantity != null ? Number(r.stock_quantity) : defaultStock;

      variations.push({
        id: r.id,
        product_id: r.product_id_id || r.product_id || productId,
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
        stock_quantity: stockQuantity,
      });
    }

    return variations;
  } catch (error) {
    if (!String(error).includes("no such table")) console.error(`Failed to get variations for product [${productId}]:`, error);
    return [];
  }
}

export async function getProductBySlug(
  slug: string,
  options?: { db?: DatabaseSync; bypassSingleFlight?: boolean }
): Promise<StorefrontProduct | null> {
  if (options?.bypassSingleFlight || options?.db) {
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

    let productRow: any = null;
    try {
      productRow = await db.prepare(`SELECT * FROM products WHERE slug = ?;`).get(slug);
    } catch {
      // D1 query failed or table absent
    }

    if (!productRow) {
      const fallback = FALLBACK_PRODUCTS_BY_SLUG[slug];
      if (fallback) return fallback;
      return null;
    }

    const categoryId = productRow.category_id_id || productRow.category_id;
    let category: Category | null = null;
    if (categoryId) {
      try {
        const catRow = (await db
          .prepare(`
            SELECT c.*, m.filename AS media_filename, m.url AS media_url
            FROM categories c
            LEFT JOIN media m ON c.image_id = m.id
            WHERE c.id = ?;
          `)
          .get(categoryId)) as any;
        if (catRow) {
          const rawCatImage =
            catRow.media_url ||
            (catRow.media_filename ? `/media/${catRow.media_filename}` : undefined) ||
            catRow.image ||
            undefined;
          category = {
            id: catRow.id,
            name: catRow.name,
            slug: catRow.slug,
            parent_id: catRow.parent_id ?? null,
            description: catRow.description ?? undefined,
            image: rawCatImage ? getAssetUrl(rawCatImage) || rawCatImage : undefined,
          };
        }
      } catch {
        try {
          const catRow = (await db.prepare(`SELECT * FROM categories WHERE id = ?;`).get(categoryId)) as any;
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
        } catch {
          category = {
            id: String(categoryId),
            name: String(categoryId).toUpperCase(),
            slug: String(categoryId),
          };
        }
      }
    }

    if (!category && (productRow.category || productRow.category_id)) {
      const c = productRow.category || productRow.category_id;
      category = {
        id: String(c),
        name: String(c).toUpperCase(),
        slug: String(c),
      };
    }

    let productLine: StorefrontProductLine | null = null;
    const lineId = productRow.product_line_id || productRow.product_line_id_id;
    if (lineId) {
      try {
        const lineRow = (await db.prepare("SELECT * FROM product_lines WHERE id = ?;").get(lineId)) as any;
        if (lineRow) {
          productLine = {
            id: lineRow.id,
            title: lineRow.title,
            slug: lineRow.slug,
            story: lineRow.story ?? undefined,
            default_price: lineRow.default_price != null ? Number(lineRow.default_price) : undefined,
            hero_image: lineRow.hero_image ?? undefined,
          };
        }
      } catch {}
    }

    const rawExplicitPrice = productRow.price != null ? Number(productRow.price) : (productRow.base_price != null ? Number(productRow.base_price) : null);
    const effectiveBase = rawExplicitPrice ?? (productLine?.default_price ?? 0);

    const variations = await getProductVariations(productRow.id, {
      db,
      basePrice: effectiveBase,
    });

    const prices =
      variations.length > 0 ? variations.map((v) => v.effective_price) : [effectiveBase];
    const effectiveMinPrice = Math.min(...prices);

    let gallery: string[] = [];

    // 1. Try relational products_gallery table
    try {
      const rawGalleryRows = await db
        .prepare(`
          SELECT pg.id, m.url AS media_url, m.filename AS media_filename
          FROM products_gallery pg
          LEFT JOIN media m ON pg.image_id = m.id
          WHERE pg._parent_id = ?
          ORDER BY pg._order ASC;
        `)
        .all(productRow.id);
      const galleryRows = (Array.isArray(rawGalleryRows)
        ? rawGalleryRows
        : ((rawGalleryRows as any)?.results || [])) as any[];
      if (galleryRows.length > 0) {
        gallery = galleryRows
          .map((g) => g.media_url || (g.media_filename ? `/media/${g.media_filename}` : ''))
          .filter(Boolean);
      }
    } catch {
      // products_gallery not present
    }

    // 2. Fall back to JSON gallery column
    if (gallery.length === 0 && productRow.gallery) {
      try {
        gallery = typeof productRow.gallery === 'string' ? JSON.parse(productRow.gallery) : productRow.gallery;
      } catch {
        gallery = [];
      }
    }

    // Resolve featured image
    let featuredImage: string | null = null;
    if (productRow.featured_image_id) {
      try {
        const m = (await db.prepare(`SELECT url, filename FROM media WHERE id = ?;`).get(productRow.featured_image_id)) as any;
        if (m) {
          featuredImage = resolveMediaUrl(m);
        }
      } catch {}
    }
    if (!featuredImage && productRow.featured_image) {
      featuredImage = productRow.featured_image;
    }

    const makerNotes = productRow.maker_field_notes || productRow.artist_statement || undefined;
    const cleanDescription = extractLexicalText(productRow.description) || undefined;

    return {
      id: productRow.id,
      title: productRow.title,
      slug: productRow.slug,
      description: cleanDescription,
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
      sku: productRow.sku ?? undefined,
      price: productRow.price != null ? Number(productRow.price) : null,
      base_price: effectiveBase,
      effective_price: effectiveBase,
      product_line: productLine,
      options: productRow.options ? (typeof productRow.options === "string" ? JSON.parse(productRow.options) : productRow.options) : undefined,
      effective_min_price: effectiveMinPrice,
      status: (productRow.status as ProductStatus) || 'draft',
      release_date: productRow.release_date ?? undefined,
      category,
      shopify_product_id: productRow.shopify_product_id ?? undefined,
      featured_image: featuredImage,
      hero_image: productRow.hero_image ?? featuredImage,
      gallery,
      variations,
    };
  } catch (error) {
    console.error(`Failed to get product [${slug}]:`, error);
    return null;
  }
}

export async function getProducts(options?: GetProductsOptions): Promise<StorefrontProduct[]> {
  if (options?.bypassSingleFlight || options?.db) {
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

    const requestedStatuses =
      options?.status && options.status.length > 0 ? options.status : ['published', 'active'];
    const normalizedStatuses = new Set<string>();
    for (const s of requestedStatuses) {
      normalizedStatuses.add(s);
      if (s === 'published') normalizedStatuses.add('active');
      if (s === 'active') normalizedStatuses.add('published');
    }
    const statuses = Array.from(normalizedStatuses);

    let rows: any[] = [];
    const params: any[] = [];

    // Try primary Payload D1 query joined with categories and media
    try {
      let query = `
        SELECT p.*,
          c.name AS cat_name, c.slug AS cat_slug, c.description AS cat_desc, c.parent_id AS cat_parent_id,
          fm.url AS featured_media_url, fm.filename AS featured_media_filename
        FROM products p
        LEFT JOIN categories c ON p.category_id_id = c.id
        LEFT JOIN media fm ON p.featured_image_id = fm.id
        WHERE 1=1
      `;

      if (options?.category) {
        query += ` AND p.category_id_id IN (
          WITH RECURSIVE cat_tree(id) AS (
            SELECT id FROM categories WHERE slug = ? OR id = ?
            UNION ALL
            SELECT c2.id FROM categories c2 JOIN cat_tree ct ON c2.parent_id = ct.id
          )
          SELECT id FROM cat_tree
        )`;
        params.push(options.category, options.category);
      }

      const placeholders = statuses.map(() => '?').join(',');
      query += ` AND p.status IN (${placeholders})`;
      params.push(...statuses);

      query += ` ORDER BY p.created_at ASC, p.id ASC`;

      if (options?.limit) {
        query += ` LIMIT ?`;
        params.push(options.limit);
      }

      const rawRows = await db.prepare(query).all(...params);
      rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
    } catch {
      // Fallback query for schemas without media table or without categories table
      let hasCat = false;
      try {
        await db.prepare('SELECT 1 FROM categories LIMIT 1;').all();
        hasCat = true;
      } catch {}

      let fallbackQuery = hasCat
        ? `SELECT p.*, c.name AS cat_name, c.slug AS cat_slug, c.description AS cat_desc, c.image AS cat_image, c.parent_id AS cat_parent_id
           FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`
        : `SELECT p.* FROM products p WHERE 1=1`;
      const fallbackParams: any[] = [];

      if (options?.category) {
        if (hasCat) {
          fallbackQuery += ` AND p.category_id IN (
            WITH RECURSIVE cat_tree(id) AS (
              SELECT id FROM categories WHERE slug = ? OR id = ?
              UNION ALL
              SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
            )
            SELECT id FROM cat_tree
          )`;
          fallbackParams.push(options.category, options.category);
        } else {
          let catCol = 'category';
          try {
            const cols = ((await db.prepare('PRAGMA table_info(products);').all()) as any[]).map((c: any) => c.name);
            if (cols.includes('category')) catCol = 'category';
            else if (cols.includes('category_id')) catCol = 'category_id';
          } catch {}
          fallbackQuery += ` AND p.${catCol} = ?`;
          fallbackParams.push(options.category);
        }
      }

      const placeholders = statuses.map(() => '?').join(',');
      fallbackQuery += ` AND p.status IN (${placeholders})`;
      fallbackParams.push(...statuses);

      let orderClause = ` ORDER BY p.created_at ASC, p.id ASC`;
      try {
        db.prepare(`SELECT created_at FROM products LIMIT 1`).all();
      } catch {
        orderClause = ` ORDER BY p.id ASC`;
      }

      let finalQuery = fallbackQuery + orderClause;
      if (options?.limit) {
        finalQuery += ` LIMIT ?`;
        fallbackParams.push(options.limit);
      }

      const rawRows = await db.prepare(finalQuery).all(...fallbackParams);
      rows = (Array.isArray(rawRows) ? rawRows : ((rawRows as any)?.results || [])) as any[];
    }

    const products: StorefrontProduct[] = [];
    for (const r of rows) {
      let productLine: StorefrontProductLine | null = null;
      const lineId = r.product_line_id || r.product_line_id_id;
      if (lineId) {
        try {
          const lineRow = (await db.prepare("SELECT * FROM product_lines WHERE id = ?;").get(lineId)) as any;
          if (lineRow) {
            productLine = {
              id: lineRow.id,
              title: lineRow.title,
              slug: lineRow.slug,
              story: lineRow.story ?? undefined,
              default_price: lineRow.default_price != null ? Number(lineRow.default_price) : undefined,
            };
          }
        } catch {}
      }

      const rawPrice = r.price != null ? Number(r.price) : (r.base_price != null ? Number(r.base_price) : null);
      const effectiveBase = rawPrice ?? (productLine?.default_price ?? 0);

      const variations = await getProductVariations(r.id, { db, basePrice: effectiveBase });
      const prices =
        variations.length > 0 ? variations.map((v) => v.effective_price) : [Number(r.base_price)];
      const effectiveMinPrice = Math.min(...prices);

      let gallery: string[] = [];
      try {
        const rawGalleryRows = await db
          .prepare(`
            SELECT pg.id, m.url AS media_url, m.filename AS media_filename
            FROM products_gallery pg
            LEFT JOIN media m ON pg.image_id = m.id
            WHERE pg._parent_id = ?
            ORDER BY pg._order ASC;
          `)
          .all(r.id);
        const galleryRows = (Array.isArray(rawGalleryRows)
          ? rawGalleryRows
          : ((rawGalleryRows as any)?.results || [])) as any[];
        if (galleryRows.length > 0) {
          gallery = galleryRows
            .map((g) => g.media_url || (g.media_filename ? `/media/${g.media_filename}` : ''))
            .filter(Boolean);
        }
      } catch {}

      if (gallery.length === 0 && r.gallery) {
        try {
          gallery = typeof r.gallery === 'string' ? JSON.parse(r.gallery) : r.gallery;
        } catch {
          gallery = [];
        }
      }

      let featuredImage: string | null = null;
      if (r.featured_media_url) {
        featuredImage = r.featured_media_url;
      } else if (r.featured_media_filename) {
        featuredImage = `/media/${r.featured_media_filename}`;
      } else if (r.featured_image) {
        featuredImage = r.featured_image;
      } else if (r.featured_image_id) {
        try {
          const m = (await db.prepare(`SELECT url, filename FROM media WHERE id = ?;`).get(r.featured_image_id)) as any;
          if (m) {
            featuredImage = resolveMediaUrl(m);
          }
        } catch {}
      }

      const makerNotes = r.maker_field_notes || r.artist_statement || undefined;
      const cleanDescription = extractLexicalText(r.description) || undefined;
      const catId = r.resolved_category_id || r.category_id_id || r.category_id;

      products.push({
        id: r.id,
        title: r.title,
        slug: r.slug,
        description: cleanDescription,
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
        sku: r.sku ?? undefined,
        price: r.price != null ? Number(r.price) : null,
        base_price: effectiveBase,
        effective_price: effectiveBase,
        product_line: productLine,
        options: r.options ? (typeof r.options === "string" ? JSON.parse(r.options) : r.options) : undefined,
        effective_min_price: effectiveMinPrice,
        status: (r.status as ProductStatus) || 'draft',
        release_date: r.release_date ?? undefined,
        category: catId
          ? {
              id: catId,
              name: r.cat_name,
              slug: r.cat_slug,
              parent_id: r.cat_parent_id ?? null,
              description: r.cat_desc ?? undefined,
              image: r.cat_image ?? undefined,
            }
          : null,
        shopify_product_id: r.shopify_product_id ?? undefined,
        featured_image: featuredImage,
        hero_image: r.hero_image ?? featuredImage,
        gallery,
        variations,
      });
    }

    if (products.length === 0 && !options?.db) {
      const fallbackList = Object.values(FALLBACK_PRODUCTS_BY_SLUG).filter(
        (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
      );
      if (options?.category) {
        return fallbackList.filter(
          (p) =>
            p.category?.slug === options.category ||
            p.category?.id === options.category ||
            (options.category === 'apparel' &&
              (p.category?.slug === 'storm-shells' || p.category?.slug === 'brush-pants'))
        );
      }
      return fallbackList;
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

/**
 * Retrieves all scheduled or upcoming drop products.
 * Includes items with status === 'coming_soon' or a future release_date,
 * or variations with status === 'coming_soon' / release_date.
 */
export async function getScheduledDrops(options?: { db?: DatabaseSync }): Promise<StorefrontProduct[]> {
  const allProducts = await getProducts({
    status: ['published', 'coming_soon' as any, 'active'],
    db: options?.db,
  });

  return allProducts
    .filter((p) => {
      if (p.status === 'coming_soon') return true;
      if (p.release_date && new Date(p.release_date).getTime() > Date.now()) return true;
      if (p.variations?.some((v) => v.status === 'coming_soon' || (v.release_date && new Date(v.release_date).getTime() > Date.now()))) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      const getEarliestTimestamp = (prod: StorefrontProduct): number => {
        const timestamps: number[] = [];
        if (prod.release_date) {
          const t = new Date(prod.release_date).getTime();
          if (!isNaN(t)) timestamps.push(t);
        }
        if (prod.variations) {
          for (const v of prod.variations) {
            if (v.release_date) {
              const t = new Date(v.release_date).getTime();
              if (!isNaN(t)) timestamps.push(t);
            }
          }
        }
        return timestamps.length > 0 ? Math.min(...timestamps) : Number.MAX_SAFE_INTEGER;
      };

      return getEarliestTimestamp(a) - getEarliestTimestamp(b);
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
