import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProductBySlug } from '@/lib/directus';
import ProductDetailClient from './ProductDetailClient';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata(props: ProductPageProps): Promise<Metadata> {
  const params = await props.params;
  const product = await fetchProductBySlug(params.slug);

  if (!product) {
    return {
      title: 'Product Not Found | Chris\'s Shop',
      description: 'The requested collectible product could not be found.',
    };
  }

  return {
    title: `${product.title} | Chris's Shop`,
    description: product.description || 'Exclusive limited physical art piece by Chris.',
  };
}

export default async function ProductDetailPage(props: ProductPageProps) {
  const params = await props.params;
  const product = await fetchProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
