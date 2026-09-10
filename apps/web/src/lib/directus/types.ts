import type {
  Category,
  Product,
  ProductVariation,
  ProductStatus,
  VariationStatus,
  Order,
  OrderItem,
  ProcessedStripeEvent,
} from '@chrishop/types';
import { getEffectivePrice } from '@chrishop/types';

// ============================================================================
// Directus Schema Type Mappings
// ============================================================================

export interface DirectusFile {
  id: string;
  storage?: string;
  filename_disk?: string;
  filename_download?: string;
  title?: string | null;
  type?: string | null;
  folder?: string | null;
  uploaded_on?: string;
  modified_on?: string;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  description?: string | null;
}

export interface DirectusCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | DirectusFile | null;
}

export interface DirectusProduct {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  base_price: number | string;
  status: ProductStatus;
  hero_image?: string | DirectusFile | null;
  featured_image?: string | DirectusFile | null;
  gallery?: (string | DirectusFile)[] | null;
  category_id?: string | DirectusCategory | null;
}

export interface DirectusProductVariation {
  id: string;
  product_id: string | DirectusProduct;
  name?: string | null;
  variation_name: string;
  sku: string;
  price_override?: number | string | null;
  is_limited_edition: boolean;
  total_edition_count?: number | null;
  stock_quantity: number;
  release_date?: string | null;
  status: VariationStatus;
}

export interface DirectusSchema {
  categories: DirectusCategory[];
  products: DirectusProduct[];
  product_variations: DirectusProductVariation[];
  orders: Order[];
  order_items: OrderItem[];
  processed_stripe_events: ProcessedStripeEvent[];
  directus_files: DirectusFile[];
}

// ============================================================================
// Storefront Domain Models
// ============================================================================

export interface StorefrontVariation extends ProductVariation {
  effective_price: number;
}

export interface StorefrontProduct extends Product {
  category?: Category | null;
  variations?: StorefrontVariation[];
  effective_min_price?: number;
}

// ============================================================================
// Query Option Interfaces
// ============================================================================

export interface GetProductsOptions {
  category?: string;
  status?: string[];
  limit?: number;
  revalidate?: number;
}

export interface QueryOptions {
  revalidate?: number;
}

// ============================================================================
// Directus Entity Mappers
// ============================================================================

/**
 * Maps a raw Directus category record into a domain Category model.
 */
export function mapDirectusCategory(c: DirectusCategory): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? undefined,
    image: typeof c.image === 'object' && c.image !== null ? c.image.id : (c.image ?? undefined),
  };
}

/**
 * Maps a raw Directus variation record into a StorefrontVariation with
 * effective price resolution (HIGH_LEVEL_DESIGN Section 3.2).
 */
export function mapDirectusVariation(
  v: DirectusProductVariation,
  parentProduct?: Pick<Product, 'base_price'>
): StorefrontVariation {
  const variationObj: ProductVariation = {
    id: v.id,
    product_id:
      typeof v.product_id === 'object' && v.product_id !== null ? v.product_id.id : v.product_id,
    name: v.name ?? undefined,
    variation_name: v.variation_name,
    sku: v.sku,
    price_override: v.price_override != null ? Number(v.price_override) : null,
    is_limited_edition: Boolean(v.is_limited_edition),
    total_edition_count: v.total_edition_count != null ? Number(v.total_edition_count) : null,
    stock_quantity: Number(v.stock_quantity) || 0,
    release_date: v.release_date ?? null,
    status: v.status,
  };

  const effective_price = parentProduct
    ? getEffectivePrice(parentProduct, variationObj)
    : variationObj.price_override != null
      ? Number(variationObj.price_override)
      : 0;

  return {
    ...variationObj,
    effective_price,
  };
}

/**
 * Maps a raw Directus product and its variations into a StorefrontProduct domain model.
 */
export function mapDirectusProduct(
  raw: DirectusProduct,
  variations: DirectusProductVariation[] = []
): StorefrontProduct {
  const categoryObj =
    typeof raw.category_id === 'object' && raw.category_id !== null ? raw.category_id : null;
  const categoryId = categoryObj ? categoryObj.id : (raw.category_id as string | undefined);

  // Safely extract gallery file IDs
  const gallery = Array.isArray(raw.gallery)
    ? raw.gallery
        .map((g) => (typeof g === 'object' && g !== null ? g.id : g))
        .filter((g): g is string => typeof g === 'string')
    : undefined;

  const product: Product = {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    description: raw.description ?? undefined,
    base_price: Number(raw.base_price) || 0,
    status: raw.status,
    hero_image:
      typeof raw.hero_image === 'object' && raw.hero_image !== null
        ? raw.hero_image.id
        : (raw.hero_image ?? undefined),
    featured_image:
      typeof raw.featured_image === 'object' && raw.featured_image !== null
        ? raw.featured_image.id
        : (raw.featured_image ?? undefined),
    gallery: gallery && gallery.length > 0 ? gallery : undefined,
    category_id: categoryId,
  };

  const mappedVariations: StorefrontVariation[] = variations.map((v) =>
    mapDirectusVariation(v, product)
  );

  const prices =
    mappedVariations.length > 0
      ? mappedVariations.map((v) => v.effective_price)
      : [product.base_price];
  const effective_min_price = Math.min(...prices);

  return {
    ...product,
    category: categoryObj ? mapDirectusCategory(categoryObj) : null,
    variations: mappedVariations,
    effective_min_price,
  };
}
