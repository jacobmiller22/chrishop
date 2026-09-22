import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductJsonLd, BreadcrumbJsonLd } from '@chrishop/ui';
import {
  fetchProductBySlug,
  getProducts,
  enrichProductWithShopifyPricing,
  getAssetUrl,
} from '@/lib/catalog';
import { buildOpenGraphImageUrl } from '@/lib/r2-image';
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

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://chrishop.jacobmiller22.com'
  ).replace(/\/+$/, '');

  const productUrl = `${baseUrl}/products/${rawProduct.slug}`;
  const rawImage =
    rawProduct.featured_image ||
    rawProduct.hero_image ||
    (rawProduct.gallery && rawProduct.gallery[0]
      ? typeof rawProduct.gallery[0] === 'string'
        ? rawProduct.gallery[0]
        : (rawProduct.gallery[0] as any).url
      : null);

  const assetUrl = rawImage ? getAssetUrl(rawImage) : null;
  const ogImageUrl = assetUrl
    ? buildOpenGraphImageUrl(assetUrl, baseUrl)
    : `${baseUrl}/api/og?title=${encodeURIComponent(rawProduct.title)}&badge=${encodeURIComponent(
        rawProduct.status === 'published' ? 'Field Gear' : 'Upcoming Drop'
      )}&price=${encodeURIComponent(`$${rawProduct.base_price}`)}`;

  const description =
    rawProduct.description ||
    'Handcrafted technical outdoor adventure gear built for rugged alpine exploration.';

  return {
    title: rawProduct.title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: `${rawProduct.title} | BankBeaters Adventure Gear`,
      description,
      url: productUrl,
      siteName: 'BankBeaters',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${rawProduct.title} - BankBeaters Adventure Gear`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${rawProduct.title} | BankBeaters Adventure Gear`,
      description,
      site: '@bankbeaters',
      creator: '@bankbeaters',
      images: [ogImageUrl],
    },
  };
}

export default async function ProductDetailPage(props: ProductPageProps) {
  const params = await props.params;
  const rawProduct = await fetchProductBySlug(params.slug);

  if (!rawProduct) {
    notFound();
  }

  const product = await enrichProductWithShopifyPricing(rawProduct);

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://chrishop.jacobmiller22.com'
  ).replace(/\/+$/, '');

  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Field Gear', url: `${baseUrl}/products` },
    { name: product.title, url: `${baseUrl}/products/${product.slug}` },
  ];

  return (
    <>
      <ProductJsonLd product={product as any} baseUrl={baseUrl} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <ProductDetailClient product={product} />
    </>
  );
}
