import type { CollectionAfterChangeHook } from 'payload';

/**
 * Payload CMS afterChange hook for Pages collection.
 * Triggers Next.js on-demand path and tag revalidation for edge caching.
 */
export const revalidatePage: CollectionAfterChangeHook = async ({ doc }) => {
  if (!doc) return doc;

  try {
    const { revalidatePath, revalidateTag } = await import('next/cache');
    const slug = doc.slug;

    if (slug === 'homepage' || slug === 'home' || slug === '/') {
      revalidatePath('/', 'page');
    } else if (slug) {
      revalidatePath(`/${slug}`, 'page');
    }

    (revalidateTag as any)('pages', 'max');
    if (slug) {
      (revalidateTag as any)(`page-${slug}`, 'max');
    }
  } catch {
    // Graceful no-op when executing outside of Next.js server runtime (e.g. tests, CLI)
  }

  return doc;
};
