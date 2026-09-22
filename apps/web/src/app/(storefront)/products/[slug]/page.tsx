import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProductBySlug, getProducts, enrichProductWithShopifyPricing } from '@/lib/catalog';
import ProductDetailClient from './ProductDetailClient';

export const revalidate = 10;

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
  const rawProduct = await fetchProductBySlug(params.slug);

  if (!rawProduct) {
    return {
      title: 'Product Not Found | BankBeaters Adventure Gear',
      description: 'The requested technical outdoor gear could not be found.',
    };
  }

  return {
    title: `${rawProduct.title} | BankBeaters Adventure Gear`,
    description:
      rawProduct.description ||
      'Handcrafted technical outdoor adventure gear built for rugged alpine exploration.',
  };
}

export default async function ProductDetailPage(props: ProductPageProps) {
  const params = await props.params;
  const rawProduct = await fetchProductBySlug(params.slug);

  if (!rawProduct) {
    notFound();
  }

  const product = await enrichProductWithShopifyPricing(rawProduct);

  return <ProductDetailClient product={product} />;
}
