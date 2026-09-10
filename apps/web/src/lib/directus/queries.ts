import { readItems, type Query, type QueryFilter } from '@directus/sdk';
import type { Category, ProductStatus } from '@chrishop/types';
import { getDirectusClient, type DirectusRestClient } from './client';
import {
  type DirectusSchema,
  type DirectusProduct,
  type DirectusProductVariation,
  type DirectusCategory,
  type StorefrontProduct,
  type StorefrontVariation,
  type GetProductsOptions,
  mapDirectusCategory,
  mapDirectusProduct,
  mapDirectusVariation,
} from './types';

// ============================================================================
// Catalog Data Access Queries
// ============================================================================

/**
 * Fetch catalog products with optional filtering by category slug/ID, publication status,
 * and page size limit.
 *
 * Catches errors gracefully and returns an empty list if Directus is unreachable.
 */
export async function getProducts(
  options?: GetProductsOptions & { client?: DirectusRestClient }
): Promise<StorefrontProduct[]> {
  try {
    const client =
      options?.client ??
      getDirectusClient(options?.revalidate ? { revalidate: options.revalidate } : undefined);

    // Build category filter: support either UUID or category slug
    let categoryFilter: QueryFilter<DirectusSchema, DirectusProduct> = {};
    if (options?.category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        options.category
      );
      categoryFilter = isUuid
        ? { category_id: { id: { _eq: options.category } } }
        : { category_id: { slug: { _eq: options.category } } };
    }

    // Build status filter: defaults to ['published']
    const statuses =
      options?.status && options.status.length > 0
        ? (options.status as ProductStatus[])
        : (['published'] as ProductStatus[]);
    const statusFilter =
      statuses.length === 1 ? { status: { _eq: statuses[0] } } : { status: { _in: statuses } };

    const query: Query<DirectusSchema, DirectusProduct> = {
      fields: [
        '*',
        {
          category_id: ['*'],
          hero_image: ['*'],
          featured_image: ['*'],
        },
      ],
      filter: {
        ...statusFilter,
        ...categoryFilter,
      },
      sort: ['title'],
      ...(options?.limit ? { limit: options.limit } : {}),
    };

    const items = await client.request(readItems('products', query));
    return (items as unknown as DirectusProduct[]).map((p) => mapDirectusProduct(p));
  } catch (error) {
    console.error('Failed to get products from Directus:', error);
    return [];
  }
}

/**
 * Fetch a single product by unique slug, eagerly loading its category, gallery,
 * and all variations with effective prices resolved.
 *
 * Returns null if not found or if Directus is unreachable.
 */
export async function getProductBySlug(
  slug: string,
  options?: { revalidate?: number; client?: DirectusRestClient }
): Promise<StorefrontProduct | null> {
  try {
    const client =
      options?.client ??
      getDirectusClient(options?.revalidate ? { revalidate: options.revalidate } : undefined);

    const items = await client.request(
      readItems('products', {
        filter: {
          slug: { _eq: slug },
          status: { _eq: 'published' },
        },
        fields: [
          '*',
          {
            category_id: ['*'],
            hero_image: ['*'],
            featured_image: ['*'],
          },
        ],
        limit: 1,
      })
    );

    const rawProduct = (items as unknown as DirectusProduct[])[0];
    if (!rawProduct) return null;

    // Eagerly load all product variations
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
    console.error(`Failed to get product [${slug}] from Directus:`, error);
    return null;
  }
}

/**
 * Fetch all catalog categories sorted alphabetically by name.
 *
 * Catches errors gracefully and returns an empty list if Directus is unreachable.
 */
export async function getCategories(options?: {
  revalidate?: number;
  client?: DirectusRestClient;
}): Promise<Category[]> {
  try {
    const client =
      options?.client ??
      getDirectusClient(options?.revalidate ? { revalidate: options.revalidate } : undefined);

    const items = await client.request(
      readItems('categories', {
        fields: ['*'],
        sort: ['name'],
      })
    );

    return (items as unknown as DirectusCategory[]).map(mapDirectusCategory);
  } catch (error) {
    console.error('Failed to get categories from Directus:', error);
    return [];
  }
}

/**
 * Fetch all variations belonging to a specific product by ID, resolving their effective prices.
 *
 * Catches errors gracefully and returns an empty list if Directus is unreachable.
 */
export async function getProductVariations(
  productId: string,
  options?: {
    revalidate?: number;
    client?: DirectusRestClient;
    basePrice?: number;
  }
): Promise<StorefrontVariation[]> {
  try {
    const client =
      options?.client ??
      getDirectusClient(options?.revalidate ? { revalidate: options.revalidate } : undefined);

    let basePrice = options?.basePrice;
    if (basePrice === undefined) {
      const parentItems = await client.request(
        readItems('products', {
          filter: { id: { _eq: productId } },
          fields: ['id', 'base_price'],
          limit: 1,
        })
      );
      const parent = (parentItems as unknown as { base_price?: number | string }[])[0];
      if (parent) {
        basePrice = Number(parent.base_price) || 0;
      }
    }

    const items = await client.request(
      readItems('product_variations', {
        filter: {
          product_id: { _eq: productId },
        },
        sort: ['sku'],
      })
    );

    return (items as unknown as DirectusProductVariation[]).map((v) =>
      mapDirectusVariation(v, basePrice !== undefined ? { base_price: basePrice } : undefined)
    );
  } catch (error) {
    console.error(
      `Failed to get product variations for product [${productId}] from Directus:`,
      error
    );
    return [];
  }
}

/**
 * Fetch featured/active catalog products (e.g. for homepage showcases).
 * Supports optionally fetching variations for complete price breakdown.
 *
 * Catches errors gracefully and returns an empty list if Directus is unreachable.
 */
export async function getFeaturedProducts(
  limit: number = 4,
  options?: {
    revalidate?: number;
    client?: DirectusRestClient;
    includeVariations?: boolean;
  }
): Promise<StorefrontProduct[]> {
  try {
    const products = await getProducts({
      status: ['published'],
      limit,
      revalidate: options?.revalidate,
      client: options?.client,
    });

    if (options?.includeVariations && products.length > 0) {
      const client =
        options?.client ??
        getDirectusClient(options?.revalidate ? { revalidate: options.revalidate } : undefined);

      return await Promise.all(
        products.map(async (p) => {
          const variations = await getProductVariations(p.id, { client, basePrice: p.base_price });
          const prices =
            variations.length > 0 ? variations.map((v) => v.effective_price) : [p.base_price];
          return {
            ...p,
            variations,
            effective_min_price: Math.min(...prices),
          };
        })
      );
    }

    return products;
  } catch (error) {
    console.error('Failed to get featured products from Directus:', error);
    return [];
  }
}

// ============================================================================
// Backwards-Compatible Aliases (Story 1.12 Prototype Signature Compatibility)
// ============================================================================

export async function fetchProducts(options?: {
  limit?: number;
  categorySlug?: string;
}): Promise<StorefrontProduct[]> {
  return getProducts({
    limit: options?.limit,
    category: options?.categorySlug,
  });
}

export const fetchProductBySlug = getProductBySlug;
export const fetchCategories = getCategories;
