import React from 'react';

export interface ProductJsonLdVariation {
  id?: string;
  sku?: string;
  variation_name?: string;
  effective_price?: number;
  price_override?: number | null;
  status?: string;
  stock_quantity?: number;
  release_date?: string | null;
  variation_images?: Array<{ url: string } | string>;
}

export interface ProductJsonLdData {
  title: string;
  slug: string;
  description?: string;
  sku?: string;
  base_price?: number;
  price?: number | null;
  effective_price?: number;
  currency?: string;
  images?: string[];
  featured_image?: string;
  hero_image?: string;
  gallery?: Array<{ url: string } | string>;
  brand?: string;
  status?: string;
  release_date?: string | null;
  variations?: ProductJsonLdVariation[];
  category?: string;
}

export interface ProductJsonLdProps {
  product: ProductJsonLdData;
  baseUrl?: string;
}

export function resolveAvailability(
  status?: string,
  stockQuantity?: number,
  releaseDate?: string | null
): string {
  if (releaseDate && new Date(releaseDate).getTime() > Date.now()) {
    return 'https://schema.org/PreOrder';
  }
  if (status === 'archived') {
    return 'https://schema.org/Discontinued';
  }
  if (status === 'coming_soon') {
    return 'https://schema.org/PreOrder';
  }
  if (status === 'sold_out' || (typeof stockQuantity === 'number' && stockQuantity <= 0)) {
    return 'https://schema.org/OutOfStock';
  }
  return 'https://schema.org/InStock';
}

export function createProductJsonLd({
  product,
  baseUrl = 'https://chrishop.jacobmiller22.com',
}: ProductJsonLdProps) {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const productUrl = `${cleanBaseUrl}/products/${product.slug}`;

  // Collect image URLs
  const rawImages: string[] = [];
  if (product.images && Array.isArray(product.images)) {
    rawImages.push(...product.images);
  }
  if (product.featured_image) {
    rawImages.push(product.featured_image);
  }
  if (product.hero_image) {
    rawImages.push(product.hero_image);
  }
  if (product.gallery && Array.isArray(product.gallery)) {
    for (const item of product.gallery) {
      if (typeof item === 'string') rawImages.push(item);
      else if (item && typeof item === 'object' && item.url) rawImages.push(item.url);
    }
  }

  // Format absolute image URLs
  const images = Array.from(new Set(rawImages)).map((img) => {
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    if (img.startsWith('/')) return `${cleanBaseUrl}${img}`;
    return `${cleanBaseUrl}/${img}`;
  });

  const currency = product.currency || 'USD';
  const brandName = product.brand || 'BankBeaters';

  // Sku fallback
  const primarySku =
    product.sku || product.variations?.[0]?.sku || `BB-${product.slug.toUpperCase()}`;

  // Build offers
  let offers: any;
  if (product.variations && product.variations.length > 0) {
    offers = product.variations.map((v) => {
      const priceVal =
        v.effective_price ?? v.price_override ?? product.effective_price ?? product.base_price ?? 0;
      return {
        '@type': 'Offer',
        name: v.variation_name ? `${product.title} - ${v.variation_name}` : product.title,
        sku: v.sku || primarySku,
        url: productUrl,
        priceCurrency: currency,
        price: Number(priceVal).toFixed(2),
        itemCondition: 'https://schema.org/NewCondition',
        availability: resolveAvailability(
          v.status || product.status,
          v.stock_quantity,
          v.release_date || product.release_date
        ),
        seller: {
          '@type': 'Organization',
          name: brandName,
        },
      };
    });
  } else {
    const priceVal = product.effective_price ?? product.price ?? product.base_price ?? 0;
    offers = {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: currency,
      price: Number(priceVal).toFixed(2),
      itemCondition: 'https://schema.org/NewCondition',
      availability: resolveAvailability(product.status, undefined, product.release_date),
      seller: {
        '@type': 'Organization',
        name: brandName,
      },
    };
  }

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description:
      product.description ||
      'Handcrafted technical outdoor adventure gear hand-sewn in Leadville, Colorado.',
    sku: primarySku,
    brand: {
      '@type': 'Brand',
      name: brandName,
    },
    offers,
  };

  if (images.length > 0) {
    schema.image = images;
  }
  if (product.category) {
    schema.category = product.category;
  }

  return schema;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

export function createBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export const ProductJsonLd: React.FC<ProductJsonLdProps> = (props) => {
  const schema = createProductJsonLd(props);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export const BreadcrumbJsonLd: React.FC<BreadcrumbJsonLdProps> = ({ items }) => {
  const schema = createBreadcrumbJsonLd(items);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};
