/**
 * ChrisShop Headless Shopify Storefront API Client Singleton
 *
 * Implements typed GraphQL client singleton and helpers for:
 * - cart creation (`cartCreate`)
 * - line item mutations (`cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`)
 * - buyer identity binding (`cartBuyerIdentityUpdate`)
 * - edge checkout redirection with locale/currency preservation
 * - live stock checks and out-of-stock user errors
 *
 * Specification: Story 3.2 (#17) & docs/HIGH_LEVEL_DESIGN.md Section 4.
 */

import { createStorefrontApiClient, type StorefrontApiClient } from '@shopify/storefront-api-client';
import { shopify, ShopifyStorefrontClient } from '../shopify';

export * from '../shopify';
export { shopify as storefrontClient, shopify as default, ShopifyStorefrontClient };

/**
 * Creates or retrieves an official Shopify Storefront API Client instance
 * from `@shopify/storefront-api-client`.
 */
export function getOfficialStorefrontApiClient(options?: {
  storeDomain?: string;
  publicAccessToken?: string;
  apiVersion?: string;
}): StorefrontApiClient {
  const storeDomain =
    options?.storeDomain ||
    process.env.SHOPIFY_STORE_DOMAIN ||
    'chrishop-dev.myshopify.com';
  const publicAccessToken =
    options?.publicAccessToken ||
    process.env.SHOPIFY_STOREFRONT_TOKEN ||
    'mock_storefront_token';
  const apiVersion = options?.apiVersion || '2026-01';

  return createStorefrontApiClient({
    storeDomain,
    apiVersion,
    publicAccessToken,
  });
}

/**
 * Direct convenience helpers for headless storefront cart operations
 */
export async function createCart(variantId: string, quantity = 1, buyerIp?: string) {
  return shopify.createCart(variantId, quantity, buyerIp);
}

export async function getCart(cartId: string, buyerIp?: string) {
  return shopify.getCart(cartId, buyerIp);
}

export async function addCartLines(
  cartId: string,
  lines: Array<{ merchandiseId: string; quantity: number }>,
  buyerIp?: string
) {
  return shopify.cartLinesAdd(cartId, lines, buyerIp);
}

export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>,
  buyerIp?: string
) {
  return shopify.cartLinesUpdate(cartId, lines, buyerIp);
}

export async function removeCartLines(cartId: string, lineIds: string[], buyerIp?: string) {
  return shopify.cartLinesRemove(cartId, lineIds, buyerIp);
}

export async function updateBuyerIdentity(
  cartId: string,
  buyerIdentity: { email?: string; phone?: string; countryCode?: string },
  buyerIp?: string
) {
  return shopify.cartBuyerIdentityUpdate(cartId, buyerIdentity, buyerIp);
}
