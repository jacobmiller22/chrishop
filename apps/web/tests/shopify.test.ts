import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ShopifyStorefrontMockEngine, defaultShopifyMock } from '../src/lib/shopify-mock';
import { ShopifyStorefrontClient, shopify } from '../src/lib/shopify';

describe('Shopify Storefront API Client & In-Process GraphQL Mock Engine', () => {
  describe('1. ShopifyStorefrontMockEngine', () => {
    it('should export singleton defaultShopifyMock instance', () => {
      assert.ok(defaultShopifyMock instanceof ShopifyStorefrontMockEngine);
    });

    it('should handle cartCreate mutation and return valid cart with checkout URL', async () => {
      const mock = new ShopifyStorefrontMockEngine();
      const query = `
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              totalQuantity
            }
          }
        }
      `;
      const variables = {
        input: {
          lines: [{ merchandiseId: 'gid://shopify/ProductVariant/12345', quantity: 2 }],
        },
      };

      const result = await mock.handleGraphQLRequest(query, variables);
      assert.ok(result.data, 'GraphQL response should contain data field');
      assert.ok(result.data.cartCreate, 'data should contain cartCreate');
      assert.ok(result.data.cartCreate.cart.id.startsWith('gid://shopify/Cart/'));
      assert.ok(result.data.cartCreate.cart.checkoutUrl.includes('/checkouts/c/'));
      assert.equal(result.data.cartCreate.cart.totalQuantity, 2);
    });

    it('should handle cartLinesAdd mutation to add items to an existing cart', async () => {
      const mock = new ShopifyStorefrontMockEngine();
      // First create a cart
      const createRes = await mock.handleGraphQLRequest(
        'mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id } } }',
        { input: { lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1 }] } }
      );
      const cartId = createRes.data.cartCreate.cart.id;

      // Add lines to the cart
      const addRes = await mock.handleGraphQLRequest(
        'mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id totalQuantity } } }',
        {
          cartId,
          lines: [{ merchandiseId: 'gid://shopify/ProductVariant/2', quantity: 3 }],
        }
      );

      assert.equal(addRes.data.cartLinesAdd.cart.id, cartId);
      assert.equal(addRes.data.cartLinesAdd.cart.totalQuantity, 4);
    });

    it('should handle products catalog query', async () => {
      const mock = new ShopifyStorefrontMockEngine();
      const result = await mock.handleGraphQLRequest('query { products(first: 5) { edges { node { id title } } } }');
      assert.ok(result.data.products.edges.length > 0);
      assert.ok(result.data.products.edges[0].node.title);
    });

    it('should return empty data for unhandled query gracefully', async () => {
      const mock = new ShopifyStorefrontMockEngine();
      const result = await mock.handleGraphQLRequest('query getUnknown { unknownField }');
      assert.deepEqual(result, { data: {} });
    });
  });

  describe('2. ShopifyStorefrontClient', () => {
    it('should instantiate with default configuration', () => {
      const client = new ShopifyStorefrontClient();
      assert.ok(client.domain);
      assert.ok(client.token);
      assert.equal(client.apiVersion, '2025-01');
    });

    it('should execute createCart via mock routing in test environment', async () => {
      const client = new ShopifyStorefrontClient({ token: 'mock_token' });
      const result = await client.createCart('gid://shopify/ProductVariant/BEAST-STD', 1);

      assert.ok(result.data.cartCreate.cart);
      assert.ok(result.data.cartCreate.cart.checkoutUrl);
      assert.equal(result.data.cartCreate.cart.totalQuantity, 1);
    });

    it('should accept valid IPv4 and IPv6 buyer IP headers', async () => {
      const client = new ShopifyStorefrontClient({ token: 'mock_token' });

      // Valid IPv4
      const resIpv4 = await client.createCart('gid://shopify/ProductVariant/1', 1, '192.168.1.100');
      assert.ok(resIpv4.data.cartCreate.cart);

      // Valid IPv6
      const resIpv6 = await client.createCart('gid://shopify/ProductVariant/1', 1, '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      assert.ok(resIpv6.data.cartCreate.cart);
    });

    it('should reject invalid buyer IP format with informative error', async () => {
      const client = new ShopifyStorefrontClient({ token: 'mock_token' });

      await assert.rejects(
        async () => {
          await client.createCart('gid://shopify/ProductVariant/1', 1, 'invalid-ip-address');
        },
        {
          name: 'Error',
          message: 'Invalid Shopify-Storefront-Buyer-IP format: "invalid-ip-address"',
        }
      );
    });

    it('should verify global singleton shopify export is operational', async () => {
      assert.ok(shopify instanceof ShopifyStorefrontClient);
      const res = await shopify.createCart('gid://shopify/ProductVariant/99', 1);
      assert.ok(res.data.cartCreate.cart.checkoutUrl);
    });
  });
});
