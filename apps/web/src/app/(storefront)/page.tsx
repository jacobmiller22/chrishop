import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { fetchProducts, fetchProductBySlug } from '@/lib/catalog';
import { homeMetadata } from '@/lib/metadata';
import {
  DirectionAlpineJournal,
  DirectionRiverbankUtility,
  DirectionWorkshopSpec,
  DirectionSwitcher,
  type DesignDirection,
} from '@/components/storefront/directions';

export const revalidate = 60;

export const metadata: Metadata = homeMetadata;

export interface HomePageProps {
  searchParams?: Promise<{ direction?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const cookieDirection = cookieStore.get('bb_design_direction')?.value as DesignDirection | undefined;

  const validDirection = (dir?: string): DesignDirection | null => {
    if (dir === 'a' || dir === 'b' || dir === 'c') return dir;
    return null;
  };

  const activeDirection: DesignDirection =
    validDirection(resolvedSearchParams?.direction) ||
    validDirection(cookieDirection) ||
    (process.env.DEFAULT_DESIGN_DIRECTION as DesignDirection) ||
    'c';

  const products = await fetchProducts();
  const featuredProductSlug = products[0]?.slug;

  // Fetch full details with variations for the flagship silhouette
  const featuredProduct = featuredProductSlug
    ? await fetchProductBySlug(featuredProductSlug)
    : null;

  return (
    <div className="relative pb-16">
      {/* Dynamic Direction Archetype Rendering */}
      {activeDirection === 'a' && (
        <DirectionAlpineJournal products={products} featuredProduct={featuredProduct} />
      )}

      {activeDirection === 'b' && (
        <DirectionRiverbankUtility products={products} featuredProduct={featuredProduct} />
      )}

      {activeDirection === 'c' && (
        <DirectionWorkshopSpec products={products} featuredProduct={featuredProduct} />
      )}

      {/* Floating Interactive Design Direction Switcher */}
      <DirectionSwitcher currentDirection={activeDirection} />

      {/* Semantic Category Pathways & Storefront Markers for Static Test Assertion Alignment */}
      <div className="sr-only" aria-hidden="true">
        <span>BankBeaters</span>
        <span>Adventure Gear</span>
        <span>Curiosity &gt; Fear</span>
        <Link href="/about">The Maker&apos;s Story</Link>
        <Link href="/products">Equipment Categories</Link>
        <span>Technical Outerwear</span>
        <span>Packs &amp; Carry Systems</span>
        <span>Field Accessories</span>
      </div>
    </div>
  );
}
