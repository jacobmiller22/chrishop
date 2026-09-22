/**
 * ChrisShop Shopify Pricing & Availability Merger Utility
 *
 * Implements authoritative price and stock reconciliation between
 * Payload CMS editorial content and the live Shopify Storefront API
 * per docs/HIGH_LEVEL_DESIGN.md Section 4 and Story 2.21.
 *
 * Architecture Invariant:
 * - Shopify is the sole authority for price, inventory, and stock status.
 * - Payload CMS is the sole authority for rich content, photography, and artisan notes.
 * - When Shopify is unavailable or unconfigured, gracefully falls back to Payload values.
 */

import type { StorefrontProduct, StorefrontVariation } from './catalog';
import type { ShopifyProductPricing, ShopifyVariantNode } from './shopify';

/**
 * Reconciles a single variation against a matched Shopify variant node.
 */
export function mergeVariationWithShopifyPricing(
  variation: StorefrontVariation,
  shopifyVariant: ShopifyVariantNode | null | undefined,
  shopifyBasePrice?: number
): StorefrontVariation {
  if (!shopifyVariant) {
    return variation;
  }

  const merged = { ...variation };

  // 1. Reconcile Variant Price
  if (shopifyVariant.price?.amount) {
    const parsedPrice = parseFloat(shopifyVariant.price.amount);
    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      if (shopifyBasePrice !== undefined && parsedPrice !== shopifyBasePrice) {
        merged.price_override = parsedPrice;
      }
      merged.effective_price = parsedPrice;
    }
  }

  // 2. Reconcile Stock Quantity & Availability
  if (shopifyVariant.quantityAvailable !== undefined && shopifyVariant.quantityAvailable !== null) {
    merged.stock_quantity = Math.max(0, shopifyVariant.quantityAvailable);
  }

  // 3. Status Transition: Sold Out vs Active (Preserving coming_soon)
  const isAvailable =
    shopifyVariant.availableForSale !== false &&
    (shopifyVariant.quantityAvailable === undefined ||
      shopifyVariant.quantityAvailable === null ||
      shopifyVariant.quantityAvailable > 0);

  if (!isAvailable && merged.status !== 'coming_soon') {
    merged.status = 'sold_out';
  } else if (isAvailable && merged.status === 'sold_out') {
    merged.status = 'active';
  }

  return merged;
}

/**
 * Merges Payload CMS product data with authoritative Shopify Storefront API pricing and stock.
 */
export function mergeProductWithShopifyPricing(
  payloadProduct: StorefrontProduct,
  shopifyProduct: ShopifyProductPricing | null | undefined
): StorefrontProduct {
  if (!shopifyProduct) {
    return payloadProduct;
  }

  const merged: StorefrontProduct = {
    ...payloadProduct,
  };

  // 1. Authoritative Base Price Resolution
  let shopifyBasePrice = payloadProduct.base_price;
  if (shopifyProduct.priceRange?.minVariantPrice?.amount) {
    const parsed = parseFloat(shopifyProduct.priceRange.minVariantPrice.amount);
    if (!isNaN(parsed) && parsed > 0) {
      shopifyBasePrice = parsed;
      merged.base_price = parsed;
    }
  }

  // 2. Variants Reconciliation
  if (payloadProduct.variations && payloadProduct.variations.length > 0) {
    const shopifyVariants = shopifyProduct.variants?.edges?.map((e) => e.node) || [];

    merged.variations = payloadProduct.variations.map((variation) => {
      // Find matching variant by shopify_variant_id, sku, or title
      const match = shopifyVariants.find(
        (sv) =>
          (variation.shopify_variant_id && sv.id === variation.shopify_variant_id) ||
          (variation.sku && sv.sku && sv.sku.toLowerCase() === variation.sku.toLowerCase()) ||
          (sv.title && sv.title.toLowerCase() === variation.variation_name.toLowerCase())
      );

      return mergeVariationWithShopifyPricing(variation, match, shopifyBasePrice);
    });
  }

  return merged;
}
