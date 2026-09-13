/**
 * ChrisShop Shopify Headless Storefront API Client
 *
 * Implements typed GraphQL client for cart creation, checkout redirection,
 * and live stock checks per docs/HIGH_LEVEL_DESIGN.md Section 4.
 *
 * Enforces Cloudflare Edge buyer IP forwarding via `Shopify-Storefront-Buyer-IP`
 * using Cloudflare's `CF-Connecting-IP` or `X-Forwarded-For` to prevent global IP rate-limiting
 * by Shopify during flash drop traffic rushes.
 */

import { defaultShopifyMock } from './shopify-mock';

export interface ShopifyClientConfig {
  domain?: string;
  token?: string;
  apiVersion?: string;
  maxRetries?: number;
  baseDelayMs?: number;
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

  constructor(config?: ShopifyClientConfig) {
    this.domain =
      config?.domain || process.env.SHOPIFY_STORE_DOMAIN || 'chrishop-dev.myshopify.com';
    this.token =
      config?.token || process.env.SHOPIFY_STOREFRONT_TOKEN || 'mock_storefront_token';
    this.apiVersion = config?.apiVersion || '2025-01';
    this.maxRetries = config?.maxRetries ?? 3;
    this.baseDelayMs = config?.baseDelayMs ?? 100;
  }

  /**
   * Helper to extract buyer IP using class instance method.
   */
  extractBuyerIp(
    requestOrHeaders?: Request | Headers | Record<string, string | string[] | undefined>
  ): string | undefined {
    return extractBuyerIp(requestOrHeaders);
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
      process.env.FLAG_DISABLE_CHECKOUT === 'true' ||
      process.env.FLAG_DISABLE_CHECKOUT === '1';

    if ((isKilled || isCheckoutDisabled) && (query.includes('cartCreate') || query.includes('checkout'))) {
      return {
        data: null as any,
        errors: [
          {
            message:
              'Checkout and cart creation are temporarily disabled by operational circuit breaker (FLAG_EMERGENCY_KILL_SWITCH).',
            code: 'CIRCUIT_BREAKER_ACTIVE',
          },
        ],
      };
    }

    // If running in development, test, or if FLAG_ENABLE_WIREMOCK is active, route through mock engine
    const isWireMock =
      process.env.FLAG_ENABLE_WIREMOCK === 'true' ||
      process.env.FLAG_ENABLE_WIREMOCK === '1';

    const isMock =
      isWireMock ||
      !process.env.SHOPIFY_STOREFRONT_TOKEN ||
      process.env.SHOPIFY_STOREFRONT_TOKEN.includes('mock') ||
      process.env.NODE_ENV === 'test';

    if (isMock) {
      if (buyerIp) {
        if (!isValidBuyerIp(buyerIp)) {
          throw new Error(`Invalid Shopify-Storefront-Buyer-IP format: "${buyerIp}"`);
        }
      }
      return defaultShopifyMock.handleGraphQLRequest(query, variables, buyerIp);
    }

    const endpoint = `https://${this.domain}/api/${this.apiVersion}/graphql.json`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': this.token,
    };

    if (buyerIp) {
      if (!isValidBuyerIp(buyerIp)) {
        throw new Error(`Invalid Shopify-Storefront-Buyer-IP format: "${buyerIp}"`);
      }
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

      if (response.status === 429 && attempt <= this.maxRetries) {
        // Leaky bucket rate limit backoff
        const retryAfterSec = response.headers.get('Retry-After');
        const delayMs = retryAfterSec
          ? Number(retryAfterSec) * 1000
          : this.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Shopify Storefront API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    }

    throw new Error(`Shopify Storefront API rate limit exceeded after ${this.maxRetries} retries`);
  }

  async createCart(variantId: string, quantity = 1, buyerIp?: string) {
    const mutation = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            totalQuantity
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
}

export const shopify = new ShopifyStorefrontClient();
