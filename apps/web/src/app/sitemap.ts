import type { MetadataRoute } from 'next';
import { getProducts, fetchCategories } from '@/lib/catalog';

export const revalidate = 3600; // Edge ISR revalidation every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://chrishop.jacobmiller22.com'
  ).replace(/\/+$/, '');

  // 1. Static Core Storefront Routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/drops`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  // 2. Dynamic Published Products from D1 / Payload CMS
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts({ status: ['published'], limit: 500 });
    productRoutes = products.map((p) => ({
      url: `${baseUrl}/products/${p.slug}`,
      lastModified: (p as any).updated_at ? new Date((p as any).updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch (err) {
    console.warn('[Sitemap] Failed to fetch products for dynamic sitemap:', err);
  }

  // 3. Dynamic Category Indexing
  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const categories = await fetchCategories();
    categoryRoutes = categories.map((cat) => ({
      url: `${baseUrl}/products?category=${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch (err) {
    console.warn('[Sitemap] Failed to fetch categories for dynamic sitemap:', err);
  }

  return [...staticRoutes, ...productRoutes, ...categoryRoutes];
}
