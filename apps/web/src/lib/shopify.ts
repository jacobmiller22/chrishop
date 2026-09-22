/**
 * ChrisShop Shopify Headless Storefront API Client
 *
 * Implements typed GraphQL client for cart creation, checkout redirection,
 * and live stock checks per docs/HIGH_LEVEL_DESIGN.md Section 4.
 *
 * Enforces Cloudflare Edge buyer IP forwarding via `Shopify-Storefront-Buyer-IP`
 * using Cloudflare's `CF-Connecting-IP` or `X-Forwarded-For` to prevent global IP rate-limiting
 * by Shopify during flash drop traffic rushes.
 *
 * Supports intelligent dual-mode fallback:
 * - When valid live credentials exist and mock mode is not forced, executes authentic GraphQL requests.
 * - When credentials are absent/placeholders or when FLAG_ENABLE_WIREMOCK/SHOPIFY_USE_MOCK is set,
 *   delegates seamlessly to the in-process WireMock engine (shopify-mock.ts).
 */

import { defaultShopifyMock, ShopifyStorefrontMockEngine } from './shopify-mock';
export { defaultShopifyMock, ShopifyStorefrontMockEngine };

export interface ShopifyClientConfig {
  domain?: string;
  token?: string;
  apiVersion?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  useMock?: boolean;
}

/**
 * Validates buyer IP address format (IPv4 or IPv6) per Shopify Headless Storefront API specs.
 */
export function isValidBuyerIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  const isIpv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed);
  const isIpv6 =
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(trimmed) ||
    (trimmed.includes('::') && /^[0-9a-fA-F:]+$/.test(trimmed));
  return isIpv4 || isIpv6;
}

/**
 * Extracts buyer IP from standard HTTP request headers, prioritizing Cloudflare Edge headers.
 * Order of precedence:
 * 1. `cf-connecting-ip` (Cloudflare edge client IP)
 * 2. `true-client-ip` (Enterprise Cloudflare header)
 * 3. `x-real-ip` (Standard reverse proxy header)
 * 4. `x-forwarded-for` (First IP in comma-separated chain)
 */
export function extractBuyerIp(
  requestOrHeaders?: Request | Headers | Record<string, string | string[] | undefined>
): string | undefined {
  if (!requestOrHeaders) return undefined;

  let getHeader: (name: string) => string | null | undefined;

  if (requestOrHeaders instanceof Request) {
    getHeader = (name) => requestOrHeaders.headers.get(name);
  } else if (typeof (requestOrHeaders as Headers).get === 'function') {
    getHeader = (name) => (requestOrHeaders as Headers).get(name);
  } else {
    const record = requestOrHeaders as Record<string, string | string[] | undefined>;
    getHeader = (name) => {
      const direct = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
      if (Array.isArray(direct)) return direct[0];
      return direct;
    };
  }

  // 1. Cloudflare edge header
  const cfIp = getHeader('cf-connecting-ip');
  if (cfIp && isValidBuyerIp(cfIp.trim())) return cfIp.trim();

  // 2. Enterprise True-Client-IP
  const trueClientIp = getHeader('true-client-ip');
  if (trueClientIp && isValidBuyerIp(trueClientIp.trim())) return trueClientIp.trim();

  // 3. X-Real-IP
  const realIp = getHeader('x-real-ip');
  if (realIp && isValidBuyerIp(realIp.trim())) return realIp.trim();

  // 4. X-Forwarded-For (take the first client IP in chain)
  const xForwardedFor = getHeader('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (isValidBuyerIp(firstIp)) return firstIp;
  }

  return undefined;
}

export class ShopifyStorefrontClient {
  public domain: string;
  public token: string;
  public apiVersion: string;
  public maxRetries: number;
  public baseDelayMs: number;
  private configUseMock?: boolean;
  private static hasLoggedMockNotice = false;
  public mockEngine: ShopifyStorefrontMockEngine;

  constructor(config?: ShopifyClientConfig) {
    this.domain =
      config?.domain || process.env.SHOPIFY_STORE_DOMAIN || 'chrishop-dev.myshopify.com';
    this.token = config?.token || process.env.SHOPIFY_STOREFRONT_TOKEN || 'mock_storefront_token';
    this.apiVersion = config?.apiVersion || '2025-01';
    this.maxRetries = config?.maxRetries ?? 3;
    this.baseDelayMs = config?.baseDelayMs ?? 100;
    this.configUseMock = config?.useMock;
    this.mockEngine = defaultShopifyMock;
  }

  /**
   * Helper to extract buyer IP using class instance method.
   */
  extractBuyerIp(
    requestOrHeaders?: Request | Headers | Record<string, string | string[] | undefined>
  ): string | undefined {
    return extractBuyerIp(requestOrHeaders);
  }

  /**
   * Evaluates whether the client should operate in mock mode vs. live Storefront API mode.
   */
  public isMockMode(): boolean {
    if (this.configUseMock !== undefined) {
      return this.configUseMock;
    }

    const isWireMock =
      process.env.FLAG_ENABLE_WIREMOCK === 'true' ||
      process.env.FLAG_ENABLE_WIREMOCK === '1' ||
      process.env.SHOPIFY_USE_MOCK === 'true' ||
      process.env.SHOPIFY_USE_MOCK === '1';

    if (isWireMock) {
      return true;
    }

    const hasValidDomain =
      Boolean(this.domain) && !this.domain.includes('mock') && this.domain !== 'placeholder';

    const hasValidToken =
      Boolean(this.token) &&
      !this.token.includes('mock') &&
      this.token !== 'placeholder' &&
      this.token !== 'mock_storefront_token' &&
      this.token.length >= 10;

    const isTest = process.env.NODE_ENV === 'test';

    if (!hasValidDomain || !hasValidToken || isTest) {
      this.logMockNoticeIfNeeded();
      return true;
    }

    return false;
  }

  private logMockNoticeIfNeeded() {
    if (!ShopifyStorefrontClient.hasLoggedMockNotice && process.env.NODE_ENV !== 'test') {
      ShopifyStorefrontClient.hasLoggedMockNotice = true;
      console.info(
        '[Shopify Storefront Client] No live credentials configured; delegating to in-process WireMock engine.'
      );
    }
  }

  async request<T = any>(
    query: string,
    variables?: Record<string, any>,
    buyerIp?: string
  ): Promise<{ data: T; errors?: any[] }> {
    // Check operational kill switches / circuit breakers (ADR-001)
    const isKilled =
      process.env.FLAG_EMERGENCY_KILL_SWITCH === 'true' ||
      process.env.FLAG_EMERGENCY_KILL_SWITCH === '1';
    const isCheckoutDisabled =
      process.env.FLAG_DISABLE_CHECKOUT === 'true' || process.env.FLAG_DISABLE_CHECKOUT === '1';

    if (
      (isKilled || isCheckoutDisabled) &&
      (query.includes('cartCreate') || query.includes('cartLines') || query.includes('checkout'))
    ) {
      return {
        data: null as any,
        errors: [
          {
            message:
              'Checkout and cart operations are temporarily disabled by operational circuit breaker (FLAG_EMERGENCY_KILL_SWITCH / FLAG_DISABLE_CHECKOUT).',
            code: 'CIRCUIT_BREAKER_ACTIVE',
          },
        ],
      };
    }

    if (buyerIp) {
      if (!isValidBuyerIp(buyerIp)) {
        throw new Error(`Invalid Shopify-Storefront-Buyer-IP format: "${buyerIp}"`);
      }
    }

    // If mock mode is active, delegate to mock engine
    if (this.isMockMode()) {
      return this.mockEngine.handleGraphQLRequest(query, variables, buyerIp);
    }

    const endpoint = `https://${this.domain}/api/${this.apiVersion}/graphql.json`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': this.token,
    };

    if (buyerIp) {
      headers['Shopify-Storefront-Buyer-IP'] = buyerIp;
    }

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if ((response.status === 429 || response.status === 503) && attempt <= this.maxRetries) {
        // Leaky bucket rate limit backoff with jitter
        const retryAfterSec = response.headers.get('Retry-After');
        const jitter = Math.random() * 50;
        const delayMs = retryAfterSec
          ? Number(retryAfterSec) * 1000 + jitter
          : this.baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Shopify Storefront API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (
        json.errors?.some(
          (e: any) =>
            e.extensions?.code === 'THROTTLED' ||
            (typeof e.message === 'string' && e.message.toLowerCase().includes('throttled'))
        ) &&
        attempt <= this.maxRetries
      ) {
        const jitter = Math.random() * 50;
        const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return json;
    }

    throw new Error(`Shopify Storefront API rate limit exceeded after ${this.maxRetries} retries`);
  }

  /**
   * Creates a new cart with the given variant and quantity.
   */
  async createCart(variantId: string, quantity = 1, buyerIp?: string) {
    const mutation = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 25) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.request(
      mutation,
      {
        input: {
          lines: [{ merchandiseId: variantId, quantity }],
        },
      },
      buyerIp
    );
  }

  /**
   * Adds a variant to an existing cart.
   */
  async addToCart(cartId: string, variantId: string, quantity = 1, buyerIp?: string) {
    return this.cartLinesAdd(cartId, [{ merchandiseId: variantId, quantity }], buyerIp);
  }

  /**
   * Appends line items to an existing cart.
   */
  async cartLinesAdd(
    cartId: string,
    lines: Array<{ merchandiseId: string; quantity: number }>,
    buyerIp?: string
  ) {
    const mutation = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 25) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.request(
      mutation,
      {
        cartId,
        lines,
      },
      buyerIp
    );
  }

  /**
   * Updates the quantity of an existing line item in a cart.
   */
  async updateCartLine(cartId: string, lineId: string, quantity: number, buyerIp?: string) {
    return this.cartLinesUpdate(cartId, [{ id: lineId, quantity }], buyerIp);
  }

  /**
   * Updates multiple cart lines in bulk.
   */
  async cartLinesUpdate(
    cartId: string,
    lines: Array<{ id: string; quantity: number }>,
    buyerIp?: string
  ) {
    const mutation = `
      mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 25) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.request(
      mutation,
      {
        cartId,
        lines,
      },
      buyerIp
    );
  }

  /**
   * Removes a single line item from a cart.
   */
  async removeCartLine(cartId: string, lineId: string, buyerIp?: string) {
    return this.cartLinesRemove(cartId, [lineId], buyerIp);
  }

  /**
   * Removes multiple line items from a cart by their line IDs.
   */
  async cartLinesRemove(cartId: string, lineIds: string[], buyerIp?: string) {
    const mutation = `
      mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 25) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.request(
      mutation,
      {
        cartId,
        lineIds,
      },
      buyerIp
    );
  }

  /**
   * Fetches the current state of a cart by its ID.
   */
  async getCart(cartId: string, buyerIp?: string) {
    const query = `
      query getCart($id: ID!) {
        cart(id: $id) {
          id
          checkoutUrl
          totalQuantity
          lines(first: 25) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.request(
      query,
      {
        id: cartId,
      },
      buyerIp
    );
  }

  /**
   * Updates buyer identity (email, phone, countryCode/currency) on an existing cart.
   * Ensures seamless preservation of customer locale and currency upon checkout redirection.
   */
  async cartBuyerIdentityUpdate(
    cartId: string,
    buyerIdentity: {
      email?: string;
      phone?: string;
      countryCode?: string;
      customerAccessToken?: string;
    },
    buyerIp?: string
  ) {
    const mutation = `
      mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
        cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 25) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.request(
      mutation,
      {
        cartId,
        buyerIdentity,
      },
      buyerIp
    );
  }

  /**
   * Fetches real-time price and stock availability for a product by its Shopify Product GID.
   */
  async getProductPriceAndAvailability(shopifyProductId: string, buyerIp?: string) {
    const query = `
      query getProductPriceAndAvailability($id: ID!) {
        product(id: $id) {
          id
          title
          availableForSale
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                quantityAvailable
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    return this.request<{ product: ShopifyProductPricing | null }>(
      query,
      { id: shopifyProductId },
      buyerIp
    );
  }

  /**
   * Fetches real-time stock and price for a specific variant by its Shopify Variant GID.
   */
  async getVariantStock(shopifyVariantId: string, buyerIp?: string) {
    const query = `
      query getVariantStock($id: ID!) {
        node(id: $id) {
          ... on ProductVariant {
            id
            title
            sku
            availableForSale
            quantityAvailable
            price {
              amount
              currencyCode
            }
          }
        }
      }
    `;

    return this.request<{ node: ShopifyVariantNode | null }>(
      query,
      { id: shopifyVariantId },
      buyerIp
    );
  }

  /**
   * Fetches shop metadata (name, description, currency, primary domain) via Storefront API.
   */
  async getShopInfo(buyerIp?: string) {
    const query = `
      query getShopInfo {
        shop {
          name
          description
          primaryDomain {
            host
            url
          }
          paymentSettings {
            currencyCode
            countryCode
          }
        }
      }
    `;

    return this.request<{ shop: ShopifyShopInfo | null }>(query, {}, buyerIp);
  }
}

export interface ShopifyShopInfo {
  name: string;
  description?: string;
  primaryDomain: {
    host: string;
    url: string;
  };
  paymentSettings: {
    currencyCode: string;
    countryCode: string;
    supportedCardBrands?: string[];
  };
  shipsToCountries?: string[];
}

export interface ShopifyProductPriceRange {
  minVariantPrice: { amount: string; currencyCode: string };
  maxVariantPrice: { amount: string; currencyCode: string };
}

export interface ShopifyVariantNode {
  id: string;
  title: string;
  sku?: string | null;
  availableForSale: boolean;
  quantityAvailable?: number | null;
  price: { amount: string; currencyCode: string };
}

export interface ShopifyProductPricing {
  id: string;
  title: string;
  availableForSale: boolean;
  priceRange: ShopifyProductPriceRange;
  variants: {
    edges: Array<{ node: ShopifyVariantNode }>;
  };
}

export const shopify = new ShopifyStorefrontClient();

// Convenience functional exports bound to singleton instance
export const createCart = shopify.createCart.bind(shopify);
export const addToCart = shopify.addToCart.bind(shopify);
export const updateCartLine = shopify.updateCartLine.bind(shopify);
export const removeCartLine = shopify.removeCartLine.bind(shopify);
export const getCart = shopify.getCart.bind(shopify);
export const getProductPriceAndAvailability = shopify.getProductPriceAndAvailability.bind(shopify);
export const getVariantStock = shopify.getVariantStock.bind(shopify);
export const getShopInfo = shopify.getShopInfo.bind(shopify);

