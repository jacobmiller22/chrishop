import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ShopifyStorefrontClient,
  getProductPriceAndAvailability,
  getVariantStock,
  ShopifyProductPricing,
  ShopifyVariantNode,
} from '../src/lib/shopify';
import { defaultShopifyMock } from '../src/lib/shopify-mock';
import {
  mergeProductWithShopifyPricing,
  mergeVariationWithShopifyPricing,
} from '../src/lib/shopify-pricing';
import type { StorefrontProduct, StorefrontVariation } from '../src/lib/catalog';

describe('Story 2.21: Shopify Storefront API Real-Time Pricing & Stock Client', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Real-Time Pricing & Stock GraphQL Queries', () => {
    it('should query real-time product price and availability via WireMock in test mode', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const result = await client.getProductPriceAndAvailability('gid://shopify/Product/101');

      assert.ok(result.data?.product);
      assert.equal(result.data.product.id, 'gid://shopify/Product/101');
      assert.equal(result.data.product.availableForSale, true);
      assert.equal(result.data.product.priceRange.minVariantPrice.amount, '340.00');
      assert.equal(result.data.product.priceRange.maxVariantPrice.amount, '385.00');
      assert.equal(result.data.product.variants.edges.length, 2);

      const variant1 = result.data.product.variants.edges[0].node;
      assert.equal(variant1.sku, 'BB-ANO-OLV-001');
      assert.equal(variant1.availableForSale, true);
      assert.equal(variant1.quantityAvailable, 12);
    });

    it('should query variant stock via WireMock in test mode', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const result = await client.getVariantStock('gid://shopify/ProductVariant/201');

      assert.ok(result.data?.node);
      assert.equal(result.data.node.id, 'gid://shopify/ProductVariant/201');
      assert.equal(result.data.node.availableForSale, true);
      assert.equal(result.data.node.quantityAvailable, 10);
      assert.equal(result.data.node.price.amount, '340.00');
    });

    it('should forward Shopify-Storefront-Buyer-IP on live queries and attach access token', async () => {
      const originalFetch = globalThis.fetch;
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      globalThis.fetch = async (_url: any, init: any) => {
        interceptedHeaders = init?.headers || {};
        interceptedBody = JSON.parse(init?.body || '{}');

        return new Response(
          JSON.stringify({
            data: {
              product: {
                id: 'gid://shopify/Product/999',
                title: 'Live Anorak',
                availableForSale: true,
                priceRange: {
                  minVariantPrice: { amount: '350.00', currencyCode: 'USD' },
                  maxVariantPrice: { amount: '350.00', currencyCode: 'USD' },
                },
                variants: { edges: [] },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const client = new ShopifyStorefrontClient({
          domain: 'bankbeaters-live.myshopify.com',
          token: 'shpat_live_test_token_123',
          useMock: false,
        });

        const buyerIp = '198.51.100.42';
        const res = await client.getProductPriceAndAvailability(
          'gid://shopify/Product/999',
          buyerIp
        );

        assert.equal(interceptedHeaders['Shopify-Storefront-Buyer-IP'], buyerIp);
        assert.equal(
          interceptedHeaders['X-Shopify-Storefront-Access-Token'],
          'shpat_live_test_token_123'
        );
        assert.ok(interceptedBody.query.includes('getProductPriceAndAvailability'));
        assert.equal(res.data?.product?.id, 'gid://shopify/Product/999');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should retry on GraphQL THROTTLED response with jitter', async () => {
      const originalFetch = globalThis.fetch;
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        if (attempts === 1) {
          return new Response(
            JSON.stringify({
              errors: [
                {
                  message: 'Throttled by Shopify Storefront API',
                  extensions: { code: 'THROTTLED' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            data: {
              node: {
                id: 'gid://shopify/ProductVariant/201',
                title: 'Field Olive',
                availableForSale: true,
                quantityAvailable: 5,
                price: { amount: '340.00', currencyCode: 'USD' },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const client = new ShopifyStorefrontClient({
          domain: 'bankbeaters-live.myshopify.com',
          token: 'shpat_live_test_token_123',
          useMock: false,
          baseDelayMs: 10,
        });

        const res = await client.getVariantStock('gid://shopify/ProductVariant/201', '1.1.1.1');
        assert.equal(attempts, 2);
        assert.equal(res.data?.node?.quantityAvailable, 5);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should verify convenience functional exports bound to shopify singleton', async () => {
      const prodRes = await getProductPriceAndAvailability('gid://shopify/Product/101');
      assert.ok(prodRes.data?.product?.title);

      const varRes = await getVariantStock('gid://shopify/ProductVariant/201');
      assert.ok(varRes.data?.node?.id);
    });
  });

  describe('2. Pricing & Stock Merger Utility (mergeProductWithShopifyPricing)', () => {
    const mockPayloadProduct: StorefrontProduct = {
      id: 'payload-prod-1',
      title: 'The Bushwhack Storm Anorak',
      slug: 'bushwhack-storm-anorak',
      status: 'published',
      base_price: 320.0,
      description: 'Hand-patterned alpine storm shell.',
      materials: '500D Cordura & Toray 3-Layer',
      weight: '480g',
      fit_profile: 'Athletic Alpine',
      origin: 'Leadville, CO',
      maker_field_notes: 'Tested in high alpine whiteouts.',
      gallery: ['/media/gallery-1.jpg', '/media/gallery-2.jpg'],
      variations: [
        {
          id: 'var-1',
          product_id: 'payload-prod-1',
          shopify_variant_id: 'gid://shopify/ProductVariant/201',
          variation_name: 'Field Olive — Standard Run',
          sku: 'BB-ANO-OLV-001',
          edition_badge: 'Standard Edition',
          effective_price: 320.0,
          is_limited_edition: false,
          status: 'active',
          stock_quantity: 5,
        },
        {
          id: 'var-2',
          product_id: 'payload-prod-1',
          shopify_variant_id: 'gid://shopify/ProductVariant/202',
          variation_name: 'Deadstock Duck Camo Pocket Edition',
          sku: 'BB-ANO-CAM-002',
          edition_badge: '1-of-10',
          price_override: 375.0,
          effective_price: 375.0,
          is_limited_edition: true,
          status: 'active',
          stock_quantity: 2,
        },
      ],
    };

    it('should overwrite base price with authoritative Shopify minVariantPrice', () => {
      const shopifyData: ShopifyProductPricing = {
        id: 'gid://shopify/Product/101',
        title: 'The Bushwhack Storm Anorak',
        availableForSale: true,
        priceRange: {
          minVariantPrice: { amount: '340.00', currencyCode: 'USD' },
          maxVariantPrice: { amount: '385.00', currencyCode: 'USD' },
        },
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/201',
                title: 'Field Olive — Standard Run',
                sku: 'BB-ANO-OLV-001',
                availableForSale: true,
                quantityAvailable: 15,
                price: { amount: '340.00', currencyCode: 'USD' },
              },
            },
          ],
        },
      };

      const merged = mergeProductWithShopifyPricing(mockPayloadProduct, shopifyData);

      // Base price updated to Shopify authoritative value
      assert.equal(merged.base_price, 340.0);

      // Variant 1 matched and updated
      const v1 = merged.variations?.find((v) => v.id === 'var-1');
      assert.equal(v1?.effective_price, 340.0);
      assert.equal(v1?.stock_quantity, 15);
      assert.equal(v1?.status, 'active');

      // Preserves Payload CMS content
      assert.equal(merged.title, 'The Bushwhack Storm Anorak');
      assert.equal(merged.description, 'Hand-patterned alpine storm shell.');
      assert.equal(merged.materials, '500D Cordura & Toray 3-Layer');
      assert.equal(merged.maker_field_notes, 'Tested in high alpine whiteouts.');
      assert.deepEqual(merged.gallery, ['/media/gallery-1.jpg', '/media/gallery-2.jpg']);
    });

    it('should transition depleted variant to sold_out and update variant price override', () => {
      const shopifyData: ShopifyProductPricing = {
        id: 'gid://shopify/Product/101',
        title: 'The Bushwhack Storm Anorak',
        availableForSale: true,
        priceRange: {
          minVariantPrice: { amount: '340.00', currencyCode: 'USD' },
          maxVariantPrice: { amount: '395.00', currencyCode: 'USD' },
        },
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/201',
                title: 'Field Olive — Standard Run',
                sku: 'BB-ANO-OLV-001',
                availableForSale: false,
                quantityAvailable: 0,
                price: { amount: '340.00', currencyCode: 'USD' },
              },
            },
            {
              node: {
                id: 'gid://shopify/ProductVariant/202',
                title: 'Deadstock Duck Camo Pocket Edition',
                sku: 'BB-ANO-CAM-002',
                availableForSale: true,
                quantityAvailable: 1,
                price: { amount: '395.00', currencyCode: 'USD' },
              },
            },
          ],
        },
      };

      const merged = mergeProductWithShopifyPricing(mockPayloadProduct, shopifyData);

      const v1 = merged.variations?.find((v) => v.id === 'var-1');
      assert.equal(v1?.status, 'sold_out');
      assert.equal(v1?.stock_quantity, 0);

      const v2 = merged.variations?.find((v) => v.id === 'var-2');
      assert.equal(v2?.status, 'active');
      assert.equal(v2?.stock_quantity, 1);
      assert.equal(v2?.effective_price, 395.0);
      assert.equal(v2?.price_override, 395.0);
    });

    it('should transition all variations to sold_out if all variants are depleted in Shopify', () => {
      const shopifyData: ShopifyProductPricing = {
        id: 'gid://shopify/Product/101',
        title: 'The Bushwhack Storm Anorak',
        availableForSale: false,
        priceRange: {
          minVariantPrice: { amount: '340.00', currencyCode: 'USD' },
          maxVariantPrice: { amount: '340.00', currencyCode: 'USD' },
        },
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/201',
                title: 'Field Olive — Standard Run',
                sku: 'BB-ANO-OLV-001',
                availableForSale: false,
                quantityAvailable: 0,
                price: { amount: '340.00', currencyCode: 'USD' },
              },
            },
            {
              node: {
                id: 'gid://shopify/ProductVariant/202',
                title: 'Deadstock Duck Camo Pocket Edition',
                sku: 'BB-ANO-CAM-002',
                availableForSale: false,
                quantityAvailable: 0,
                price: { amount: '385.00', currencyCode: 'USD' },
              },
            },
          ],
        },
      };

      const merged = mergeProductWithShopifyPricing(mockPayloadProduct, shopifyData);
      assert.ok(merged.variations?.every((v) => v.status === 'sold_out'));
    });

    it('should preserve coming_soon status on unreleased variations even if stock is 0', () => {
      const comingSoonVariation: StorefrontVariation = {
        id: 'var-coming-soon',
        product_id: 'payload-prod-1',
        shopify_variant_id: 'gid://shopify/ProductVariant/301',
        variation_name: 'Upcoming Drop',
        sku: 'BB-ANO-UP-003',
        effective_price: 340.0,
        is_limited_edition: true,
        status: 'coming_soon',
        stock_quantity: 0,
      };

      const shopifyVariantNode: ShopifyVariantNode = {
        id: 'gid://shopify/ProductVariant/301',
        title: 'Upcoming Drop',
        sku: 'BB-ANO-UP-003',
        availableForSale: false,
        quantityAvailable: 0,
        price: { amount: '340.00', currencyCode: 'USD' },
      };

      const reconciled = mergeVariationWithShopifyPricing(comingSoonVariation, shopifyVariantNode);
      assert.equal(reconciled.status, 'coming_soon');
    });

    it('should gracefully return payload product unmodified when shopifyProduct is null or undefined', () => {
      const fallbackNull = mergeProductWithShopifyPricing(mockPayloadProduct, null);
      assert.deepEqual(fallbackNull, mockPayloadProduct);

      const fallbackUndefined = mergeProductWithShopifyPricing(mockPayloadProduct, undefined);
      assert.deepEqual(fallbackUndefined, mockPayloadProduct);
    });
  });
});
