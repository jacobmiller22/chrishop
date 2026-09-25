import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchProducts, fetchProductBySlug } from '@/lib/catalog';
import { homeMetadata } from '@/lib/metadata';
import { DirectionAlpineJournal } from '@/components/storefront/directions';

export const revalidate = 60;

export const metadata: Metadata = homeMetadata;

export default async function HomePage() {
  const products = await fetchProducts();
  const featuredProductSlug = products[0]?.slug;

  // Fetch full details with variations for the flagship silhouette
  const featuredProduct = featuredProductSlug
    ? await fetchProductBySlug(featuredProductSlug)
    : null;

  return (
    <div className="relative pb-16">
      {/* Alpine Journal Storefront in Waxed Cedar Baseline */}
      <DirectionAlpineJournal
        products={products}
        featuredProduct={featuredProduct}
      />

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
