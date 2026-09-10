import { createDirectus, rest, readItems, type Query } from '@directus/sdk';
import {
  type Category,
  type Product,
  type ProductVariation,
  type ProductStatus,
  type VariationStatus,
  type Order,
  type OrderItem,
  type ProcessedStripeEvent,
  getEffectivePrice,
} from '@chrishop/types';

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
// Directus SDK Client Configuration
// ============================================================================

export function getDirectusUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_CMS_URL ||
    process.env.DIRECTUS_URL ||
    'http://localhost:8055'
  );
}

export function getDirectusClient() {
  return createDirectus<DirectusSchema>(getDirectusUrl()).with(rest());
}

export const directus = getDirectusClient();

// ============================================================================
// Image & Media URL Resolver (MinIO / Directus Assets)
// ============================================================================

export function getAssetUrl(fileOrId?: string | { id: string } | null): string | null {
  if (!fileOrId) return null;
  const id = typeof fileOrId === 'string' ? fileOrId : fileOrId.id;
  if (!id) return null;
  if (id.startsWith('http://') || id.startsWith('https://')) {
    return id;
  }
  const baseUrl = getDirectusUrl().replace(/\/+$/, '');
  return `${baseUrl}/assets/${id}`;
}

// ============================================================================
// Directus Entity Mappers
// ============================================================================

export function mapDirectusProduct(
  raw: DirectusProduct,
  variations: DirectusProductVariation[] = []
): StorefrontProduct {
  const categoryObj =
    typeof raw.category_id === 'object' && raw.category_id !== null ? raw.category_id : null;
  const categoryId = categoryObj ? categoryObj.id : (raw.category_id as string | undefined);

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
    category_id: categoryId,
  };

  const mappedVariations: StorefrontVariation[] = variations.map((v) => {
    const variationObj: ProductVariation = {
      id: v.id,
      product_id:
        typeof v.product_id === 'object' && v.product_id !== null ? v.product_id.id : v.product_id,
      name: v.name ?? undefined,
      variation_name: v.variation_name,
      sku: v.sku,
      price_override: v.price_override != null ? Number(v.price_override) : null,
      is_limited_edition: Boolean(v.is_limited_edition),
      total_edition_count: v.total_edition_count ?? null,
      stock_quantity: Number(v.stock_quantity) || 0,
      release_date: v.release_date ?? null,
      status: v.status,
    };
    return {
      ...variationObj,
      effective_price: getEffectivePrice(product, variationObj),
    };
  });

  const prices =
    mappedVariations.length > 0
      ? mappedVariations.map((v) => v.effective_price)
      : [product.base_price];
  const effective_min_price = Math.min(...prices);

  return {
    ...product,
    category: categoryObj
      ? {
          id: categoryObj.id,
          name: categoryObj.name,
          slug: categoryObj.slug,
          description: categoryObj.description ?? undefined,
          image:
            typeof categoryObj.image === 'object' && categoryObj.image !== null
              ? categoryObj.image.id
              : (categoryObj.image ?? undefined),
        }
      : null,
    variations: mappedVariations,
    effective_min_price,
  };
}

// ============================================================================
// Server-Side Data Fetchers
// ============================================================================

export async function fetchProducts(options?: {
  limit?: number;
  categorySlug?: string;
}): Promise<StorefrontProduct[]> {
  try {
    const client = getDirectusClient();
    const query: Query<DirectusSchema, DirectusProduct> = {
      fields: ['*', { category_id: ['*'], hero_image: ['*'], featured_image: ['*'] }],
      filter: {
        status: { _eq: 'published' },
        ...(options?.categorySlug
          ? {
              category_id: {
                slug: { _eq: options.categorySlug },
              },
            }
          : {}),
      },
      sort: ['title'],
      ...(options?.limit ? { limit: options.limit } : {}),
    };

    const items = await client.request(readItems('products', query));
    return (items as unknown as DirectusProduct[]).map((p) => mapDirectusProduct(p));
  } catch (error) {
    console.error('Failed to fetch products from Directus:', error);
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<StorefrontProduct | null> {
  try {
    const client = getDirectusClient();
    const items = await client.request(
      readItems('products', {
        filter: {
          slug: { _eq: slug },
          status: { _eq: 'published' },
        },
        fields: ['*', { category_id: ['*'], hero_image: ['*'], featured_image: ['*'] }],
        limit: 1,
      })
    );

    const rawProduct = (items as unknown as DirectusProduct[])[0];
    if (!rawProduct) return null;

    const variations = await client.request(
      readItems('product_variations', {
        filter: {
          product_id: { _eq: rawProduct.id },
        },
        sort: ['sku'],
      })
    );

    return mapDirectusProduct(rawProduct, variations as unknown as DirectusProductVariation[]);
  } catch (error) {
    console.error(`Failed to fetch product [${slug}] from Directus:`, error);
    return null;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const client = getDirectusClient();
    const items = await client.request(
      readItems('categories', {
        fields: ['*'],
        sort: ['name'],
      })
    );
    return (items as unknown as DirectusCategory[]).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? undefined,
      image:
        typeof c.image === 'object' && c.image !== null ? c.image.id : (c.image ?? undefined),
    }));
  } catch (error) {
    console.error('Failed to fetch categories from Directus:', error);
    return [];
  }
}
