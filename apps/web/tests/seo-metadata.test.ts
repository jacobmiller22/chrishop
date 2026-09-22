import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

// Import route metadata and components
import {
  defaultStorefrontMetadata as layoutMetadata,
  homeMetadata,
  dropsMetadata,
  aboutMetadata,
} from '../src/lib/metadata';
import { generateMetadata as generateProductsMetadata } from '../src/app/(storefront)/products/page';
import { generateMetadata as generateProductDetailMetadata } from '../src/app/(storefront)/products/[slug]/page';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import { GET as getOgImage } from '../src/app/api/og/route';
import { buildOpenGraphImageUrl } from '../src/lib/r2-image';
import { createProductJsonLd, createBreadcrumbJsonLd } from '@chrishop/ui';

describe('Story 3.1f: SEO, OpenGraph, JSON-LD & Metadata Suite', () => {
  describe('1. Global & Storefront Route Metadata', () => {
    it('should define robust global layout metadata with metadataBase and robots', () => {
      assert.ok(layoutMetadata.metadataBase instanceof URL);
      assert.equal(layoutMetadata.metadataBase.hostname, 'chrishop.jacobmiller22.com');
      assert.ok(layoutMetadata.title);
      assert.ok(layoutMetadata.description);
      assert.ok(layoutMetadata.openGraph);
      assert.equal((layoutMetadata.openGraph as any).siteName, 'BankBeaters');
      assert.equal((layoutMetadata.openGraph as any).type, 'website');
      assert.ok(layoutMetadata.twitter);
      assert.equal((layoutMetadata.twitter as any).card, 'summary_large_image');
      assert.equal((layoutMetadata.robots as any)?.index, true);
      assert.equal((layoutMetadata.robots as any)?.follow, true);
    });

    it('should configure canonical URL and OpenGraph for Home page', () => {
      assert.ok(homeMetadata.alternates?.canonical);
      assert.equal(homeMetadata.alternates.canonical, '/');
      assert.ok(homeMetadata.openGraph?.title);
      assert.ok(homeMetadata.openGraph?.images);
      assert.ok(homeMetadata.twitter?.images);
    });

    it('should generate dynamic metadata for products catalog and filter views', async () => {
      // Default view
      const defaultMeta = await generateProductsMetadata({});
      assert.equal(defaultMeta.title, 'Field Gear & Technical Packs');
      assert.equal(defaultMeta.alternates?.canonical, '/products');

      // Category filter view
      const categoryMeta = await generateProductsMetadata({
        searchParams: Promise.resolve({ category: 'packs-carry' }),
      });
      assert.ok(
        (categoryMeta.title as string).includes('Pack') ||
          (categoryMeta.title as string).includes('packs-carry') ||
          (categoryMeta.title as string).includes('Gear')
      );
      assert.equal(categoryMeta.alternates?.canonical, '/products?category=packs-carry');

      // Micro-batch filter view
      const batchMeta = await generateProductsMetadata({
        searchParams: Promise.resolve({ type: 'micro_batch' }),
      });
      assert.equal(batchMeta.title, 'Micro-Batch & Limited Edition Gear');
    });

    it('should generate dynamic product metadata for PDP with Cloudflare R2 assets', async () => {
      const pdpMeta = await generateProductDetailMetadata({
        params: Promise.resolve({ slug: 'leadville-ultralight-wading-pack' }),
      });

      assert.ok(pdpMeta.title);
      assert.ok(
        (pdpMeta.title as string).includes('Leadville Ultralight')
      );
      assert.ok(pdpMeta.description);
      assert.equal(
        pdpMeta.alternates?.canonical,
        'https://chrishop.jacobmiller22.com/products/leadville-ultralight-wading-pack'
      );
      assert.ok(pdpMeta.openGraph?.images);
      const ogImages = pdpMeta.openGraph?.images as any[];
      assert.ok(ogImages.length > 0);
      assert.equal(ogImages[0].width, 1200);
      assert.equal(ogImages[0].height, 630);
      assert.ok(
        ogImages[0].url.includes('cdn-cgi/image') ||
          ogImages[0].url.includes('/api/og') ||
          ogImages[0].url.includes('chrishop.jacobmiller22.com')
      );

      // Twitter card
      assert.equal((pdpMeta.twitter as any)?.card, 'summary_large_image');
      assert.ok(pdpMeta.twitter?.images);
    });

    it('should return 404 metadata when product is not found', async () => {
      const notFoundMeta = await generateProductDetailMetadata({
        params: Promise.resolve({ slug: 'non-existent-product' }),
      });
      assert.equal(notFoundMeta.title, 'Product Not Found | BankBeaters Adventure Gear');
    });

    it('should configure canonical URL and OpenGraph for Drops and About pages', () => {
      assert.equal(dropsMetadata.alternates?.canonical, '/drops');
      assert.ok(dropsMetadata.openGraph?.title);
      assert.ok(dropsMetadata.twitter?.images);

      assert.equal(aboutMetadata.alternates?.canonical, '/about');
      assert.ok(aboutMetadata.openGraph?.title);
      assert.ok(aboutMetadata.twitter?.images);
    });
  });

  describe('2. Schema.org JSON-LD Structured Data', () => {
    it('should generate valid Google Rich Results compliant Product schema with single price', () => {
      const productSchema = createProductJsonLd({
        product: {
          title: 'Leadville Alpine Chest Rig',
          slug: 'leadville-alpine-chest-rig',
          description: 'Ultra-durable chest rig built for high mountain rivers.',
          base_price: 185,
          status: 'published',
          featured_image: 'https://media.chrishop.jacobmiller22.com/uploads/chest-rig.jpg',
        },
        baseUrl: 'https://chrishop.jacobmiller22.com',
      });

      assert.equal(productSchema['@context'], 'https://schema.org');
      assert.equal(productSchema['@type'], 'Product');
      assert.equal(productSchema.name, 'Leadville Alpine Chest Rig');
      assert.deepEqual(productSchema.brand, { '@type': 'Brand', name: 'BankBeaters' });
      assert.equal(productSchema.offers['@type'], 'Offer');
      assert.equal(productSchema.offers.price, '185.00');
      assert.equal(productSchema.offers.priceCurrency, 'USD');
      assert.equal(productSchema.offers.availability, 'https://schema.org/InStock');
      assert.equal(
        productSchema.offers.url,
        'https://chrishop.jacobmiller22.com/products/leadville-alpine-chest-rig'
      );
      assert.deepEqual(productSchema.image, [
        'https://media.chrishop.jacobmiller22.com/uploads/chest-rig.jpg',
      ]);
    });

    it('should generate multi-offer variation schema for small-batch releases', () => {
      const schema = createProductJsonLd({
        product: {
          title: 'Bramble Buster Technical Guide Pant',
          slug: 'bramble-buster-technical-guide-pant',
          description: 'Alpine guide pant with Cordura brush panels.',
          base_price: 245,
          variations: [
            {
              id: 'v1',
              sku: 'BB-BP-S',
              variation_name: 'Size S / 30W',
              effective_price: 245,
              stock_quantity: 3,
              status: 'active',
            },
            {
              id: 'v2',
              sku: 'BB-BP-M',
              variation_name: 'Size M / 32W',
              effective_price: 245,
              stock_quantity: 0,
              status: 'sold_out',
            },
          ],
        },
        baseUrl: 'https://chrishop.jacobmiller22.com',
      });

      assert.ok(Array.isArray(schema.offers));
      assert.equal(schema.offers.length, 2);
      assert.equal(schema.offers[0].availability, 'https://schema.org/InStock');
      assert.equal(schema.offers[1].availability, 'https://schema.org/OutOfStock');
    });

    it('should generate BreadcrumbList structured data', () => {
      const breadcrumbs = createBreadcrumbJsonLd([
        { name: 'Home', url: 'https://chrishop.jacobmiller22.com' },
        { name: 'Field Gear', url: 'https://chrishop.jacobmiller22.com/products' },
        {
          name: 'Leadville Pack',
          url: 'https://chrishop.jacobmiller22.com/products/leadville-pack',
        },
      ]);

      assert.equal(breadcrumbs['@context'], 'https://schema.org');
      assert.equal(breadcrumbs['@type'], 'BreadcrumbList');
      assert.equal(breadcrumbs.itemListElement.length, 3);
      assert.equal(breadcrumbs.itemListElement[0].name, 'Home');
      assert.equal(breadcrumbs.itemListElement[1].name, 'Field Gear');
      assert.equal(breadcrumbs.itemListElement[2].name, 'Leadville Pack');
    });
  });

  describe('3. Dynamic Edge Sitemap & Robots', () => {
    it('should generate dynamic sitemap indexing static routes, products, and categories', async () => {
      const entries = await sitemap();

      assert.ok(Array.isArray(entries));
      assert.ok(entries.length >= 4, 'Sitemap should include at least core static routes');

      // Check for core routes
      const urls = entries.map((e) => e.url);
      assert.ok(urls.includes('https://chrishop.jacobmiller22.com'));
      assert.ok(urls.includes('https://chrishop.jacobmiller22.com/products'));
      assert.ok(urls.includes('https://chrishop.jacobmiller22.com/drops'));
      assert.ok(urls.includes('https://chrishop.jacobmiller22.com/about'));

      // Check product routes if published products exist
      const productEntries = entries.filter((e) => e.url.includes('/products/'));
      assert.ok(productEntries.length >= 1, 'Should index at least one product page');

      for (const entry of entries) {
        assert.ok(entry.url.startsWith('https://chrishop.jacobmiller22.com'));
        assert.ok(entry.lastModified instanceof Date);
        assert.ok(typeof entry.priority === 'number');
      }
    });

    it('should generate valid robots.txt rules protecting admin and checkout routes', () => {
      const config = robots();

      assert.ok(Array.isArray(config.rules));
      const rule = config.rules[0];
      assert.equal(rule.userAgent, '*');
      assert.equal(rule.allow, '/');
      assert.ok(Array.isArray(rule.disallow));
      assert.ok(rule.disallow.includes('/admin/'));
      assert.ok(rule.disallow.includes('/api/checkout/'));
      assert.ok(rule.disallow.includes('/api/cart/'));
      assert.equal(config.sitemap, 'https://chrishop.jacobmiller22.com/sitemap.xml');
      assert.equal(config.host, 'chrishop.jacobmiller22.com');
    });
  });

  describe('4. Dynamic OpenGraph Edge Card Generator (/api/og)', () => {
    it('should generate SVG OpenGraph card with custom title, badge, and price', async () => {
      const request = new NextRequest(
        'https://chrishop.jacobmiller22.com/api/og?title=Leadville%20Alpine%20Chest%20Rig&badge=Micro-Batch%20Drop&price=%24185'
      );
      const response = await getOgImage(request);

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
      assert.ok(response.headers.get('Cache-Control')?.includes('public'));

      const svgContent = await response.text();
      assert.ok(svgContent.includes('<svg'));
      assert.ok(svgContent.includes('width="1200"'));
      assert.ok(svgContent.includes('height="630"'));
      assert.ok(svgContent.includes('LEADVILLE ALPINE CHEST RIG'));
      assert.ok(svgContent.includes('MICRO-BATCH DROP'));
      assert.ok(svgContent.includes('$185'));
      assert.ok(svgContent.includes('BANKBEATERS'));
      assert.ok(svgContent.includes('CURIOSITY &gt; FEAR'));
    });

    it('should generate fallback OpenGraph card when query params are omitted', async () => {
      const request = new NextRequest('https://chrishop.jacobmiller22.com/api/og');
      const response = await getOgImage(request);

      assert.equal(response.status, 200);
      const svgContent = await response.text();
      assert.ok(svgContent.includes('BANKBEATERS ADVENTURE GEAR'));
    });

    it('should format Cloudflare Image Resizing OpenGraph URLs properly', () => {
      const ogUrl = buildOpenGraphImageUrl(
        'https://media.chrishop.jacobmiller22.com/uploads/pack.jpg',
        'https://chrishop.jacobmiller22.com'
      );

      assert.ok(ogUrl.startsWith('https://chrishop.jacobmiller22.com/cdn-cgi/image/'));
      assert.ok(ogUrl.includes('width=1200'));
      assert.ok(ogUrl.includes('height=630'));
      assert.ok(ogUrl.includes('fit=cover'));
    });
  });
});
