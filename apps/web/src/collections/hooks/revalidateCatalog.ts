import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';
import { catalogSingleFlight } from '../../lib/singleflight';

export interface CatalogRevalidationEvent {
  action: 'change' | 'delete';
  collection: 'products' | 'categories' | 'product_variations' | 'product_lines';
  id?: string;
  slug?: string;
  productId?: string;
  timestamp: number;
  revalidatedPaths: string[];
  revalidatedTags: string[];
}

const g = globalThis as any;
if (!g.__catalogRevalidationHistory) {
  g.__catalogRevalidationHistory = [];
}

const revalidationHistory: CatalogRevalidationEvent[] = g.__catalogRevalidationHistory;

export function getCatalogRevalidationHistory(): CatalogRevalidationEvent[] {
  return [...revalidationHistory];
}

export function clearCatalogRevalidationHistory(): void {
  revalidationHistory.length = 0;
}

/**
 * Triggers Next.js on-demand ISR revalidation and clears SingleFlight edge caches
 * when a Product document is created or updated in Payload CMS.
 */
export const revalidateProductAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  if (!doc) return doc;

  const slug = doc.slug || previousDoc?.slug;
  const revalidatedPaths: string[] = ['/products', '/'];
  const revalidatedTags: string[] = ['products', 'catalog'];

  if (slug) {
    revalidatedPaths.push(`/products/${slug}`);
    revalidatedTags.push(`product-${slug}`);
  }

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    for (const p of revalidatedPaths) {
      try {
        revalidatePath(p, 'page');
      } catch {}
    }
    for (const t of revalidatedTags) {
      try {
        (revalidateTag as any)(t, 'max');
      } catch {}
    }
  } catch {
    // Graceful no-op when executing outside of Next.js server runtime (e.g. tests, CLI)
  }

  // Invalidate in-memory SingleFlight cache keys
  try {
    catalogSingleFlight.forget('products:all:published:all');
    catalogSingleFlight.forget('products:all:published,active:all');
    if (slug) {
      catalogSingleFlight.forget(`product:${slug}`);
    }
  } catch {}

  revalidationHistory.push({
    action: 'change',
    collection: 'products',
    id: doc.id,
    slug: doc.slug,
    timestamp: Date.now(),
    revalidatedPaths,
    revalidatedTags,
  });

  return doc;
};

/**
 * Triggers Next.js on-demand ISR revalidation when a Product document is deleted in Payload CMS.
 */
export const revalidateProductAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  if (!doc) return doc;

  const slug = doc.slug;
  const revalidatedPaths: string[] = ['/products', '/'];
  const revalidatedTags: string[] = ['products', 'catalog'];

  if (slug) {
    revalidatedPaths.push(`/products/${slug}`);
    revalidatedTags.push(`product-${slug}`);
  }

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    for (const p of revalidatedPaths) {
      try {
        revalidatePath(p, 'page');
      } catch {}
    }
    for (const t of revalidatedTags) {
      try {
        (revalidateTag as any)(t, 'max');
      } catch {}
    }
  } catch {}

  try {
    catalogSingleFlight.forget('products:all:published:all');
    if (slug) {
      catalogSingleFlight.forget(`product:${slug}`);
    }
  } catch {}

  revalidationHistory.push({
    action: 'delete',
    collection: 'products',
    id: doc.id,
    slug: doc.slug,
    timestamp: Date.now(),
    revalidatedPaths,
    revalidatedTags,
  });

  return doc;
};

/**
 * Triggers Next.js on-demand ISR revalidation when a Category document is created or updated.
 */
export const revalidateCategoryAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  if (!doc) return doc;

  const revalidatedPaths: string[] = ['/products'];
  const revalidatedTags: string[] = ['categories', 'catalog'];

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    for (const p of revalidatedPaths) {
      try {
        revalidatePath(p, 'page');
      } catch {}
    }
    for (const t of revalidatedTags) {
      try {
        (revalidateTag as any)(t, 'max');
      } catch {}
    }
  } catch {}

  try {
    catalogSingleFlight.forget('products:all:published:all');
  } catch {}

  revalidationHistory.push({
    action: 'change',
    collection: 'categories',
    id: doc.id,
    slug: doc.slug,
    timestamp: Date.now(),
    revalidatedPaths,
    revalidatedTags,
  });

  return doc;
};

/**
 * Triggers Next.js on-demand ISR revalidation when a Category document is deleted.
 */
export const revalidateCategoryAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  if (!doc) return doc;

  const revalidatedPaths: string[] = ['/products'];
  const revalidatedTags: string[] = ['categories', 'catalog'];

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    for (const p of revalidatedPaths) {
      try {
        revalidatePath(p, 'page');
      } catch {}
    }
    for (const t of revalidatedTags) {
      try {
        (revalidateTag as any)(t, 'max');
      } catch {}
    }
  } catch {}

  try {
    catalogSingleFlight.forget('products:all:published:all');
  } catch {}

  revalidationHistory.push({
    action: 'delete',
    collection: 'categories',
    id: doc.id,
    slug: doc.slug,
    timestamp: Date.now(),
    revalidatedPaths,
    revalidatedTags,
  });

  return doc;
};

/**
 * Triggers Next.js on-demand ISR revalidation when a Product Variation is created or updated.
 */
export const revalidateVariationAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  if (!doc) return doc;

  const productId = typeof doc.product_id === 'object' ? doc.product_id?.id : doc.product_id;
  const revalidatedPaths: string[] = ['/products', '/'];
  const revalidatedTags: string[] = ['products', 'catalog'];

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    for (const p of revalidatedPaths) {
      try {
        revalidatePath(p, 'page');
      } catch {}
    }
    for (const t of revalidatedTags) {
      try {
        (revalidateTag as any)(t, 'max');
      } catch {}
    }
  } catch {}

  try {
    catalogSingleFlight.forget('products:all:published:all');
  } catch {}

  revalidationHistory.push({
    action: 'change',
    collection: 'product_variations',
    id: doc.id,
    productId,
    timestamp: Date.now(),
    revalidatedPaths,
    revalidatedTags,
  });

  return doc;
};

/**
 * Triggers Next.js on-demand ISR revalidation when a Product Variation is deleted.
 */
export const revalidateVariationAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  if (!doc) return doc;

  const productId = typeof doc.product_id === 'object' ? doc.product_id?.id : doc.product_id;
  const revalidatedPaths: string[] = ['/products', '/'];
  const revalidatedTags: string[] = ['products', 'catalog'];

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    for (const p of revalidatedPaths) {
      try {
        revalidatePath(p, 'page');
      } catch {}
    }
    for (const t of revalidatedTags) {
      try {
        (revalidateTag as any)(t, 'max');
      } catch {}
    }
  } catch {}

  try {
    catalogSingleFlight.forget('products:all:published:all');
  } catch {}

  revalidationHistory.push({
    action: 'delete',
    collection: 'product_variations',
    id: doc.id,
    productId,
    timestamp: Date.now(),
    revalidatedPaths,
    revalidatedTags,
  });

  return doc;
};

