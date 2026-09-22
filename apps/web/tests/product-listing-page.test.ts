import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchProducts,
  fetchCategories,
  FALLBACK_CATEGORIES,
  enrichProductWithShopifyPricing,
  enrichProductsWithShopifyPricing,
  StorefrontProduct,
} from '../src/lib/catalog';
import { defaultShopifyMock } from '../src/lib/shopify-mock';
import { ShopifyStorefrontClient } from '../src/lib/shopify';

describe('Story 3.1b: Product Listing Page & Category Navigation Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Category Navigation & Hierarchy', () => {
    it('should return fallback category hierarchy when no database is provided', async () => {
      const categories = await fetchCategories();
      assert.ok(categories.length >= FALLBACK_CATEGORIES.length);

      const apparel = categories.find((c) => c.slug === 'apparel');
      assert.ok(apparel);
      assert.equal(apparel.parent_id, null);

      const stormShells = categories.find((c) => c.slug === 'storm-shells');
      assert.ok(stormShells);
      assert.equal(stormShells.parent_id, 'cat-apparel');

      const brushPants = categories.find((c) => c.slug === 'brush-pants');
      assert.ok(brushPants);
      assert.equal(brushPants.parent_id, 'cat-apparel');
    });

    it('should filter products by category slug', async () => {
      const stormShellProducts = await fetchProducts({ categorySlug: 'storm-shells' });
      assert.ok(stormShellProducts.length > 0);
      assert.ok(stormShellProducts.every((p) => p.category?.slug === 'storm-shells'));

      const brushPantsProducts = await fetchProducts({ categorySlug: 'brush-pants' });
      assert.ok(brushPantsProducts.length > 0);
      assert.ok(brushPantsProducts.every((p) => p.category?.slug === 'brush-pants'));
    });

    it('should resolve parent category query to include child category products', async () => {
      const apparelProducts = await fetchProducts({ categorySlug: 'apparel' });
      assert.ok(apparelProducts.length >= 2);
      const slugs = apparelProducts.map((p) => p.category?.slug);
      assert.ok(slugs.includes('storm-shells'));
      assert.ok(slugs.includes('brush-pants'));
    });
  });

  describe('2. Real-Time Pricing & Stock Enrichment from Shopify Storefront API', () => {
    it('should enrich product with live pricing and variant inventory from WireMock', async () => {
      const baseProduct: StorefrontProduct = {
        id: 'prod-test-anorak',
        title: 'The Bushwhack Storm Anorak',
        slug: 'bushwhack-storm-anorak',
        shopify_product_id: 'gid://shopify/Product/101',
        base_price: 320,
        status: 'published',
        variations: [
          {
            id: 'var-test-1',
            product_id: 'prod-test-anorak',
            shopify_variant_id: 'gid://shopify/ProductVariant/201',
            variation_name: 'Field Olive — Standard Run',
            sku: 'BB-ANO-OLV-001',
            effective_price: 320,
            is_limited_edition: false,
            status: 'active',
            stock_quantity: 5,
          },
        ],
      };

      const enriched = await enrichProductWithShopifyPricing(baseProduct);

      // In WireMock (shopify-mock.ts), gid://shopify/Product/101 has minVariantPrice of 340.00
      assert.equal(enriched.base_price, 340.0);
      assert.equal(enriched.effective_min_price, 340.0);

      const variant = enriched.variations?.[0];
      assert.ok(variant);
      assert.equal(variant.effective_price, 340.0);
      assert.equal(variant.stock_quantity, 12);
      assert.equal(variant.status, 'active');
    });

    it('should enrich an array of catalog products in parallel', async () => {
      const rawProducts = await fetchProducts();
      assert.ok(rawProducts.length > 0);

      const enrichedList = await enrichProductsWithShopifyPricing(rawProducts);
      assert.equal(enrichedList.length, rawProducts.length);

      const anorak = enrichedList.find((p) => p.slug === 'bushwhack-storm-anorak');
      assert.ok(anorak);
      assert.equal(anorak.base_price, 340.0);
      assert.equal(anorak.effective_min_price, 340.0);
    });

    it('should gracefully return original product if product has no shopify_product_id', async () => {
      const unlinkedProduct: StorefrontProduct = {
        id: 'prod-unlinked',
        title: 'Unlinked Fly Patch',
        slug: 'unlinked-fly-patch',
        base_price: 45,
        status: 'published',
      };

      const result = await enrichProductWithShopifyPricing(unlinkedProduct);
      assert.deepEqual(result, unlinkedProduct);
    });

    it('should gracefully handle Shopify client failure without breaking catalog rendering', async () => {
      const mockFaultyClient = {
        getProductPriceAndAvailability: async () => {
          throw new Error('Network timeout talking to Shopify edge');
        },
      } as unknown as ShopifyStorefrontClient;

      const baseProduct: StorefrontProduct = {
        id: 'prod-fallback-test',
        title: 'Storm Anorak',
        slug: 'storm-anorak',
        shopify_product_id: 'gid://shopify/Product/999',
        base_price: 340,
        status: 'published',
      };

      const result = await enrichProductWithShopifyPricing(baseProduct, mockFaultyClient);
      assert.equal(result.base_price, 340);
      assert.equal(result.title, 'Storm Anorak');
    });
  });

  describe('3. Dynamic Sorting & Production Batch Filtering', () => {
    const testCatalog: StorefrontProduct[] = [
      {
        id: 'p-1',
        title: 'Z-Series Alpine Ruck',
        slug: 'z-series-alpine-ruck',
        base_price: 450,
        effective_min_price: 450,
        status: 'published',
        variations: [
          {
            id: 'v-1',
            product_id: 'p-1',
            variation_name: 'Standard Ruck',
            sku: 'RUCK-STD',
            effective_price: 450,
            is_limited_edition: false,
            status: 'active',
            stock_quantity: 10,
          },
        ],
      },
      {
        id: 'p-2',
        title: 'Apex Storm Anorak',
        slug: 'apex-storm-anorak',
        base_price: 340,
        effective_min_price: 340,
        status: 'published',
        variations: [
          {
            id: 'v-2',
            product_id: 'p-2',
            variation_name: 'Duck Camo Limited',
            sku: 'ANO-CAMO',
            variation_type: 'micro_batch',
            effective_price: 385,
            is_limited_edition: true,
            status: 'active',
            stock_quantity: 3,
          },
        ],
      },
      {
        id: 'p-3',
        title: 'Bramble Guide Pant',
        slug: 'bramble-guide-pant',
        base_price: 215,
        effective_min_price: 215,
        status: 'published',
        variations: [
          {
            id: 'v-3',
            product_id: 'p-3',
            variation_name: 'Standard Olive',
            sku: 'PANT-OLV',
            variation_type: 'standard',
            effective_price: 215,
            is_limited_edition: false,
            status: 'active',
            stock_quantity: 20,
          },
        ],
      },
    ];

    it('should sort products by price low-to-high (price-asc)', () => {
      const sorted = [...testCatalog].sort(
        (a, b) => (a.effective_min_price ?? a.base_price) - (b.effective_min_price ?? b.base_price)
      );
      assert.equal(sorted[0].slug, 'bramble-guide-pant'); // 215
      assert.equal(sorted[1].slug, 'apex-storm-anorak');   // 340
      assert.equal(sorted[2].slug, 'z-series-alpine-ruck'); // 450
    });

    it('should sort products by price high-to-low (price-desc)', () => {
      const sorted = [...testCatalog].sort(
        (a, b) => (b.effective_min_price ?? b.base_price) - (a.effective_min_price ?? a.base_price)
      );
      assert.equal(sorted[0].slug, 'z-series-alpine-ruck'); // 450
      assert.equal(sorted[1].slug, 'apex-storm-anorak');   // 340
      assert.equal(sorted[2].slug, 'bramble-guide-pant'); // 215
    });

    it('should sort products alphabetically by title (title)', () => {
      const sorted = [...testCatalog].sort((a, b) => a.title.localeCompare(b.title));
      assert.equal(sorted[0].slug, 'apex-storm-anorak');
      assert.equal(sorted[1].slug, 'bramble-guide-pant');
      assert.equal(sorted[2].slug, 'z-series-alpine-ruck');
    });

    it('should filter by micro-batch edition (micro_batch)', () => {
      const filtered = testCatalog.filter((p) =>
        p.variations?.some(
          (v) =>
            v.variation_type === 'micro_batch' ||
            v.variation_type === 'one_of_one' ||
            v.is_limited_edition
        )
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].slug, 'apex-storm-anorak');
    });

    it('should filter by standard production (standard)', () => {
      const filtered = testCatalog.filter(
        (p) =>
          !p.variations?.some(
            (v) =>
              v.variation_type === 'micro_batch' ||
              v.variation_type === 'one_of_one' ||
              v.is_limited_edition
          )
      );
      assert.equal(filtered.length, 2);
      const slugs = filtered.map((p) => p.slug);
      assert.ok(slugs.includes('z-series-alpine-ruck'));
      assert.ok(slugs.includes('bramble-guide-pant'));
      assert.ok(!slugs.includes('apex-storm-anorak'));
    });
  });

  describe('4. /catalog Route Query Preservation', () => {
    it('should construct redirect URL with search parameters preserved', () => {
      const incomingParams = {
        category: 'storm-shells',
        sort: 'price-asc',
        type: 'micro_batch',
      };

      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(incomingParams)) {
        params.set(key, value);
      }
      const targetUrl = `/products?${params.toString()}`;

      assert.equal(
        targetUrl,
        '/products?category=storm-shells&sort=price-asc&type=micro_batch'
      );
    });
  });
});
