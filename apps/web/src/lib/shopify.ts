/**
 * ChrisShop Shopify Headless Storefront API Client
 *
 * Implements typed GraphQL client for cart creation, checkout redirection,
 * and live stock checks per docs/HIGH_LEVEL_DESIGN.md Section 4.
 */

import { defaultShopifyMock } from './shopify-mock';

export interface ShopifyClientConfig {
  domain?: string;
  token?: string;
  apiVersion?: string;
}

export class ShopifyStorefrontClient {
  public domain: string;
  public token: string;
  public apiVersion: string;

  constructor(config?: ShopifyClientConfig) {
    this.domain = config?.domain || process.env.SHOPIFY_STORE_DOMAIN || 'chrishop-dev.myshopify.com';
    this.token = config?.token || process.env.SHOPIFY_STOREFRONT_TOKEN || 'mock_storefront_token';
    this.apiVersion = config?.apiVersion || '2025-01';
  }

  async request<T = any>(
    query: string,
    variables?: Record<string, any>,
    buyerIp?: string
  ): Promise<{ data: T; errors?: any[] }> {
    // If running in development or test without live Shopify credentials, route through mock engine
    const isMock =
      !process.env.SHOPIFY_STOREFRONT_TOKEN ||
      process.env.SHOPIFY_STOREFRONT_TOKEN.includes('mock') ||
      process.env.NODE_ENV === 'test';

    if (isMock) {
      if (buyerIp) {
        // Validate buyer IP format per Shopify Headless spec
        const isIpv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(buyerIp);
        const isIpv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(buyerIp) || buyerIp.includes('::');
        if (!isIpv4 && !isIpv6) {
          throw new Error(`Invalid Shopify-Storefront-Buyer-IP format: "${buyerIp}"`);
        }
      }
      return defaultShopifyMock.handleGraphQLRequest(query, variables);
    }

    const endpoint = `https://${this.domain}/api/${this.apiVersion}/graphql.json`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': this.token,
    };

    if (buyerIp) {
      headers['Shopify-Storefront-Buyer-IP'] = buyerIp;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify Storefront API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
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
}

export const shopify = new ShopifyStorefrontClient();
