import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEffectivePrice, type Product, type ProductVariation } from '../src/index';

describe('Price Fallback Resolution Rule', () => {
  const baseProduct: Product = {
    id: 'prod-001',
    title: 'Midnight Obsidian Beast',
    slug: 'midnight-obsidian-beast',
    base_price: 350.0,
    status: 'published',
  };

  it('should return variation price_override when explicitly defined', () => {
    const variation: Partial<ProductVariation> = {
      price_override: 495.0,
    };
    const price = getEffectivePrice(baseProduct, variation as ProductVariation);
    assert.equal(price, 495.0);
  });

  it('should fallback to product base_price when variation price_override is null', () => {
    const variation: Partial<ProductVariation> = {
      price_override: null,
    };
    const price = getEffectivePrice(baseProduct, variation as ProductVariation);
    assert.equal(price, 350.0);
  });

  it('should fallback to product base_price when variation price_override is undefined', () => {
    const variation: Partial<ProductVariation> = {
      price_override: undefined,
    };
    const price = getEffectivePrice(baseProduct, variation as ProductVariation);
    assert.equal(price, 350.0);
  });

  it('should fallback to product base_price when variation is omitted', () => {
    const price = getEffectivePrice(baseProduct);
    assert.equal(price, 350.0);
  });

  it('should preserve a 0.00 price_override for promotional editions', () => {
    const freeVariation: Partial<ProductVariation> = {
      price_override: 0,
    };
    const price = getEffectivePrice(baseProduct, freeVariation as ProductVariation);
    assert.equal(price, 0);
  });
});
