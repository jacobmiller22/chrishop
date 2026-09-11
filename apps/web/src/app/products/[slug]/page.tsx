import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProductBySlug, getProducts } from '@/lib/catalog';
import ProductDetailClient from './ProductDetailClient';

export const revalidate = 60;

export async function generateStaticParams() {
  const products = await getProducts({ status: ['published'], limit: 100 });
  return products.map((p) => ({ slug: p.slug }));
}

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
      title: "Product Not Found | Chris's Shop",
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
