import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchProductBySlug,
  enrichProductWithShopifyPricing,
  StorefrontProduct,
  StorefrontVariation,
} from '../src/lib/catalog';
import { defaultShopifyMock } from '../src/lib/shopify-mock';
import { generateStaticParams, generateMetadata } from '../src/app/(storefront)/products/[slug]/page';

describe('Story 3.1c: Product Detail Page & Variation Selector Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Static Params & Metadata Generation', () => {
    it('should generate static params for all published product slugs', async () => {
      const params = await generateStaticParams();
      assert.ok(Array.isArray(params));
      assert.ok(params.length > 0);

      for (const param of params) {
        assert.ok(param.slug, 'Static param must contain a slug');
        assert.equal(typeof param.slug, 'string');
      }

      const slugs = params.map((p) => p.slug);
      assert.ok(slugs.includes('bushwhack-storm-anorak'));
    });

    it('should generate accurate metadata for existing product', async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: 'bushwhack-storm-anorak' }),
      });

      assert.ok(metadata.title);
      assert.match(String(metadata.title), /The Bushwhack Storm Anorak/);
      assert.ok(metadata.description);
    });

    it('should return fallback metadata when product is not found', async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: 'non-existent-gear-slug-999' }),
      });

      assert.ok(metadata.title);
      assert.match(String(metadata.title), /Product Not Found/);
    });
  });

  describe('2. Variation Selection & Effective Price Resolution', () => {
    const mockProduct: StorefrontProduct = {
      id: 'prod-test-jacket',
      title: 'Alpine Storm Parka',
      slug: 'alpine-storm-parka',
      base_price: 250,
      status: 'published',
      variations: [
        {
          id: 'var-standard',
          product_id: 'prod-test-jacket',
          variation_name: 'Standard Field Gray',
          sku: 'ASP-GRY-01',
          effective_price: 250,
          price_override: null,
          is_limited_edition: false,
          variation_type: 'standard',
          status: 'active',
          stock_quantity: 10,
        },
        {
          id: 'var-micro',
          product_id: 'prod-test-jacket',
          variation_name: 'Leadville Edition — Raw Titanium',
          sku: 'ASP-TITAN-01',
          effective_price: 295,
          price_override: 295,
          is_limited_edition: true,
          total_edition_count: 20,
          edition_badge: 'Edition of 20',
          variation_type: 'micro_batch',
          status: 'active',
          stock_quantity: 3,
        },
        {
          id: 'var-depleted',
          product_id: 'prod-test-jacket',
          variation_name: 'Desert Waxed Canvas',
          sku: 'ASP-WAX-01',
          effective_price: 280,
          price_override: 280,
          is_limited_edition: true,
          total_edition_count: 10,
          status: 'sold_out',
          stock_quantity: 0,
        },
        {
          id: 'var-prototype',
          product_id: 'prod-test-jacket',
          variation_name: '1-of-1 Workshop Prototype',
          sku: 'ASP-1OF1-01',
          effective_price: 450,
          price_override: 450,
          is_limited_edition: true,
          total_edition_count: 1,
          variation_type: 'one_of_one',
          status: 'coming_soon',
          stock_quantity: 1,
        },
      ],
    };

    it('should correctly determine effective price without price override', () => {
      const standardVar = mockProduct.variations![0];
      const isOverride = standardVar.price_override != null;
      const currentPrice = standardVar.effective_price;

      assert.equal(isOverride, false);
      assert.equal(currentPrice, 250);
      assert.equal(currentPrice, mockProduct.base_price);
    });

    it('should correctly flag price override and support base price strikethrough', () => {
      const microVar = mockProduct.variations![1];
      const isOverride = microVar.price_override != null;
      const currentPrice = microVar.effective_price;

      assert.equal(isOverride, true);
      assert.equal(currentPrice, 295);
      assert.notEqual(currentPrice, mockProduct.base_price);
      assert.equal(mockProduct.base_price, 250);
    });

    it('should format edition info string accurately for limited runs', () => {
      const microVar = mockProduct.variations![1];
      assert.ok(microVar.is_limited_edition);
      assert.equal(microVar.total_edition_count, 20);

      const editionNotice = `Limited Edition — ${microVar.stock_quantity ?? 0} of ${microVar.total_edition_count} remaining`;
      assert.equal(editionNotice, 'Limited Edition — 3 of 20 remaining');
    });
  });

  describe('3. Stock Availability & Badge Logic', () => {
    function getStockIndicatorState(variation: Partial<StorefrontVariation>) {
      const isSoldOut =
        variation.status === 'sold_out' ||
        (variation.stock_quantity !== undefined && variation.stock_quantity <= 0);
      const isComingSoon = variation.status === 'coming_soon';

      if (isSoldOut) {
        return { label: 'Batch Depleted', variant: 'danger' };
      }
      if (isComingSoon) {
        return { label: 'In Production', variant: 'neutral' };
      }
      if (
        variation.stock_quantity !== undefined &&
        variation.stock_quantity > 0 &&
        variation.stock_quantity <= 5
      ) {
        return {
          label: `Only ${variation.stock_quantity} Remaining`,
          variant: 'warning',
        };
      }
      if (variation.is_limited_edition && variation.total_edition_count) {
        return {
          label: `${variation.stock_quantity} of ${variation.total_edition_count} Available`,
          variant: 'success',
        };
      }
      return {
        label: variation.stock_quantity !== undefined
          ? `In Stock (${variation.stock_quantity} Ready)`
          : 'In Stock · Ready to Ship',
        variant: 'success',
      };
    }

    it('should report "Batch Depleted" when status is sold_out or stock is 0', () => {
      assert.deepEqual(getStockIndicatorState({ status: 'sold_out', stock_quantity: 0 }), {
        label: 'Batch Depleted',
        variant: 'danger',
      });
      assert.deepEqual(getStockIndicatorState({ status: 'active', stock_quantity: 0 }), {
        label: 'Batch Depleted',
        variant: 'danger',
      });
    });

    it('should report "In Production" when status is coming_soon', () => {
      assert.deepEqual(getStockIndicatorState({ status: 'coming_soon', stock_quantity: 5 }), {
        label: 'In Production',
        variant: 'neutral',
      });
    });

    it('should report "Only X Remaining" warning when stock is between 1 and 5', () => {
      assert.deepEqual(getStockIndicatorState({ status: 'active', stock_quantity: 3 }), {
        label: 'Only 3 Remaining',
        variant: 'warning',
      });
      assert.deepEqual(getStockIndicatorState({ status: 'active', stock_quantity: 1 }), {
        label: 'Only 1 Remaining',
        variant: 'warning',
      });
    });

    it('should report limited edition availability for larger limited runs', () => {
      assert.deepEqual(
        getStockIndicatorState({
          status: 'active',
          stock_quantity: 12,
          is_limited_edition: true,
          total_edition_count: 50,
        }),
        {
          label: '12 of 50 Available',
          variant: 'success',
        }
      );
    });

    it('should report general in stock for standard runs', () => {
      assert.deepEqual(
        getStockIndicatorState({
          status: 'active',
          stock_quantity: 25,
          is_limited_edition: false,
        }),
        {
          label: 'In Stock (25 Ready)',
          variant: 'success',
        }
      );
    });
  });

  describe('4. AddToCartButton State Transitions', () => {
    function getAddToCartState(
      price: number,
      status: string = 'active',
      stockQuantity: number = 1,
      isLoading: boolean = false
    ) {
      const isSoldOut = status === 'sold_out' || stockQuantity <= 0;
      const isComingSoon = status === 'coming_soon';
      const isDisabled = isSoldOut || isComingSoon || isLoading;

      let label: string;
      if (isLoading) {
        label = 'Preparing Gear Roll...';
      } else if (isSoldOut) {
        label = 'Batch Depleted';
      } else if (isComingSoon) {
        label = 'Releases Soon';
      } else {
        label = `Deploy Gear • $${Number(price).toFixed(2)}`;
      }

      return { isDisabled, label };
    }

    it('should be enabled and format price when active and in stock', () => {
      const state = getAddToCartState(320.0, 'active', 5, false);
      assert.equal(state.isDisabled, false);
      assert.equal(state.label, 'Deploy Gear • $320.00');
    });

    it('should disable button with "Batch Depleted" when sold out', () => {
      const state = getAddToCartState(320.0, 'sold_out', 0, false);
      assert.equal(state.isDisabled, true);
      assert.equal(state.label, 'Batch Depleted');
    });

    it('should disable button with "Releases Soon" when coming soon', () => {
      const state = getAddToCartState(320.0, 'coming_soon', 10, false);
      assert.equal(state.isDisabled, true);
      assert.equal(state.label, 'Releases Soon');
    });

    it('should disable button with "Preparing Gear Roll..." when checkout is loading', () => {
      const state = getAddToCartState(320.0, 'active', 5, true);
      assert.equal(state.isDisabled, true);
      assert.equal(state.label, 'Preparing Gear Roll...');
    });
  });

  describe('5. Real-Time Shopify PDP Enrichment Integration', () => {
    it('should enrich single product details with live Shopify pricing and variant inventory', async () => {
      const rawProduct = await fetchProductBySlug('bushwhack-storm-anorak');
      assert.ok(rawProduct, 'Product must exist in catalog');

      const enriched = await enrichProductWithShopifyPricing(rawProduct);
      assert.ok(enriched);
      assert.equal(enriched.slug, 'bushwhack-storm-anorak');

      // Check variant pricing enrichment from WireMock
      const variant = enriched.variations?.[0];
      assert.ok(variant);
      assert.equal(variant.effective_price, 340.0);
      assert.equal(variant.stock_quantity, 12);
      assert.equal(variant.status, 'active');
    });
  });
});
