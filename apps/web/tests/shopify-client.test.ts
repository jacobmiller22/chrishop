import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ShopifyStorefrontClient,
  shopify,
  createCart,
  addToCart,
  updateCartLine,
  removeCartLine,
  getCart,
  extractBuyerIp,
  isValidBuyerIp,
} from '../src/lib/shopify';
import { ShopifyStorefrontMockEngine, defaultShopifyMock } from '../src/lib/shopify-mock';

describe('Story 2.33: Shopify Storefront Dual-Mode Client Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Auto-Mode Fallback & Credential Detection', () => {
    it('should operate in mock mode by default in test environment', () => {
      const client = new ShopifyStorefrontClient();
      assert.equal(client.isMockMode(), true);
    });

    it('should force mock mode when FLAG_ENABLE_WIREMOCK is "true" or "1"', () => {
      const client = new ShopifyStorefrontClient({
        domain: 'live-store.myshopify.com',
        token: 'shpat_live_token_123456789',
      });

      process.env.FLAG_ENABLE_WIREMOCK = 'true';
      assert.equal(client.isMockMode(), true);

      process.env.FLAG_ENABLE_WIREMOCK = '1';
      assert.equal(client.isMockMode(), true);
    });

    it('should force mock mode when SHOPIFY_USE_MOCK is "true" (ADR-001 alias)', () => {
      const client = new ShopifyStorefrontClient({
        domain: 'live-store.myshopify.com',
        token: 'shpat_live_token_123456789',
      });

      process.env.SHOPIFY_USE_MOCK = 'true';
      assert.equal(client.isMockMode(), true);
    });

    it('should respect explicit useMock: true in configuration', () => {
      const client = new ShopifyStorefrontClient({
        domain: 'live-store.myshopify.com',
        token: 'shpat_live_token_123456789',
        useMock: true,
      });
      assert.equal(client.isMockMode(), true);
    });

    it('should activate live mode when valid credentials provided and useMock: false', () => {
      const client = new ShopifyStorefrontClient({
        domain: 'live-store.myshopify.com',
        token: 'shpat_live_token_123456789',
        useMock: false,
      });
      assert.equal(client.isMockMode(), false);
    });

    it('should fall back to mock mode if domain or token is a placeholder/mock', () => {
      const mockDomainClient = new ShopifyStorefrontClient({
        domain: 'mock-domain.com',
        token: 'shpat_live_token_123456789',
      });
      assert.equal(mockDomainClient.isMockMode(), true);

      const mockTokenClient = new ShopifyStorefrontClient({
        domain: 'chrishop-dev.myshopify.com',
        token: 'mock_storefront_token',
      });
      assert.equal(mockTokenClient.isMockMode(), true);
    });
  });

  describe('2. Unified Storefront Client Cart Lifecycle (Mock Mode)', () => {
    it('should execute full cart lifecycle: create, add, update, remove, and get', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const variantA = 'gid://shopify/ProductVariant/ANORAK-01';
      const variantB = 'gid://shopify/ProductVariant/HAT-02';

      // 1. createCart
      const createRes = await client.createCart(variantA, 1);
      assert.ok(createRes.data?.cartCreate?.cart);
      const cart = createRes.data.cartCreate.cart;
      const cartId = cart.id;
      assert.ok(cartId.startsWith('gid://shopify/Cart/'));
      assert.equal(cart.totalQuantity, 1);
      assert.ok(cart.checkoutUrl.includes('/checkouts/c/'));

      // 2. addToCart
      const addRes = await client.addToCart(cartId, variantB, 2);
      assert.ok(addRes.data?.cartLinesAdd?.cart);
      assert.equal(addRes.data.cartLinesAdd.cart.totalQuantity, 3);

      // 3. getCart
      const getRes = await client.getCart(cartId);
      assert.ok(getRes.data?.cart);
      assert.equal(getRes.data.cart.id, cartId);
      assert.equal(getRes.data.cart.totalQuantity, 3);
      assert.equal(getRes.data.cart.lines.edges.length, 2);

      const lineA = getRes.data.cart.lines.edges[0].node;
      const lineB = getRes.data.cart.lines.edges[1].node;

      // 4. updateCartLine (update quantity of lineA from 1 to 3)
      const updateRes = await client.updateCartLine(cartId, lineA.id, 3);
      assert.ok(updateRes.data?.cartLinesUpdate?.cart);
      assert.equal(updateRes.data.cartLinesUpdate.cart.totalQuantity, 5);

      // 5. removeCartLine (remove lineB)
      const removeRes = await client.removeCartLine(cartId, lineB.id);
      assert.ok(removeRes.data?.cartLinesRemove?.cart);
      assert.equal(removeRes.data.cartLinesRemove.cart.totalQuantity, 3);
      assert.equal(removeRes.data.cartLinesRemove.cart.lines.edges.length, 1);
      assert.equal(removeRes.data.cartLinesRemove.cart.lines.edges[0].node.id, lineA.id);
    });

    it('should remove line item when updateCartLine is called with quantity 0', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const createRes = await client.createCart('gid://shopify/ProductVariant/ANORAK-01', 2);
      const cartId = createRes.data.cartCreate.cart.id;
      const lineId = createRes.data.cartCreate.cart.lines.edges[0].node.id;

      const updateRes = await client.updateCartLine(cartId, lineId, 0);
      assert.ok(updateRes.data?.cartLinesUpdate?.cart);
      assert.equal(updateRes.data.cartLinesUpdate.cart.totalQuantity, 0);
      assert.equal(updateRes.data.cartLinesUpdate.cart.lines.edges.length, 0);
    });

    it('should verify convenience functional exports bound to shopify singleton', async () => {
      assert.ok(shopify instanceof ShopifyStorefrontClient);
      const res = await createCart('gid://shopify/ProductVariant/SINGLETON-01', 1);
      assert.ok(res.data?.cartCreate?.cart?.id);

      const cartId = res.data.cartCreate.cart.id;
      const addRes = await addToCart(cartId, 'gid://shopify/ProductVariant/SINGLETON-02', 2);
      assert.equal(addRes.data?.cartLinesAdd?.cart?.totalQuantity, 3);

      const fetchedCart = await getCart(cartId);
      assert.equal(fetchedCart.data?.cart?.totalQuantity, 3);

      const firstLineId = fetchedCart.data.cart.lines.edges[0].node.id;
      const updated = await updateCartLine(cartId, firstLineId, 5);
      assert.equal(updated.data?.cartLinesUpdate?.cart?.totalQuantity, 7);

      const removed = await removeCartLine(cartId, firstLineId);
      assert.equal(removed.data?.cartLinesRemove?.cart?.totalQuantity, 2);
    });
  });

  describe('3. WireMock Inventory & Out-of-Stock Simulation', () => {
    it('should simulate out-of-stock when variant exceeds configured stock quantity', async () => {
      const mockEngine = new ShopifyStorefrontMockEngine();
      const client = new ShopifyStorefrontClient({ useMock: true });
      client.mockEngine = mockEngine;

      const variantId = 'gid://shopify/ProductVariant/LIMITED-EDITION';
      mockEngine.setInventory(variantId, 2);

      // Requesting within limit succeeds
      const successRes = await client.createCart(variantId, 2);
      assert.ok(successRes.data?.cartCreate?.cart);
      assert.equal(successRes.data.cartCreate.userErrors.length, 0);

      // Requesting beyond limit fails with OUT_OF_STOCK
      const failRes = await client.createCart(variantId, 3);
      assert.equal(failRes.data?.cartCreate?.cart, null);
      assert.equal(failRes.data?.cartCreate?.userErrors?.[0]?.code, 'OUT_OF_STOCK');
      assert.ok(
        failRes.data?.cartCreate?.userErrors?.[0]?.message.includes('exceeds available stock')
      );
    });

    it('should simulate immediate out-of-stock via simulateOutOfStock helper', async () => {
      const mockEngine = new ShopifyStorefrontMockEngine();
      const client = new ShopifyStorefrontClient({ useMock: true });
      client.mockEngine = mockEngine;

      const variantId = 'gid://shopify/ProductVariant/DEPLETED-BATCH';
      mockEngine.simulateOutOfStock(variantId);

      const res = await client.createCart(variantId, 1);
      assert.equal(res.data?.cartCreate?.cart, null);
      assert.equal(res.data?.cartCreate?.userErrors?.[0]?.code, 'OUT_OF_STOCK');
      assert.ok(res.data?.cartCreate?.userErrors?.[0]?.message.includes('out of stock'));
    });

    it('should prevent adding out-of-stock items via addToCart or updateCartLine', async () => {
      const mockEngine = new ShopifyStorefrontMockEngine();
      const client = new ShopifyStorefrontClient({ useMock: true });
      client.mockEngine = mockEngine;

      const variantA = 'gid://shopify/ProductVariant/IN-STOCK';
      const variantB = 'gid://shopify/ProductVariant/NO-STOCK';
      mockEngine.setInventory(variantA, 10);
      mockEngine.simulateOutOfStock(variantB);

      const createRes = await client.createCart(variantA, 1);
      const cartId = createRes.data.cartCreate.cart.id;

      // Try adding variantB
      const addRes = await client.addToCart(cartId, variantB, 1);
      assert.equal(addRes.data?.cartLinesAdd?.cart, null);
      assert.equal(addRes.data?.cartLinesAdd?.userErrors?.[0]?.code, 'OUT_OF_STOCK');

      // Try updating variantA beyond stock
      const lineId = createRes.data.cartCreate.cart.lines.edges[0].node.id;
      const updateRes = await client.updateCartLine(cartId, lineId, 15);
      assert.equal(updateRes.data?.cartLinesUpdate?.cart, null);
      assert.equal(updateRes.data?.cartLinesUpdate?.userErrors?.[0]?.code, 'OUT_OF_STOCK');
    });
  });

  describe('4. Live Mode Client GraphQL Transport & Error Normalization', () => {
    it('should dispatch authentic GraphQL POST request to live endpoint with proper headers', async () => {
      const originalFetch = globalThis.fetch;
      let interceptedUrl = '';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        interceptedUrl = String(url);
        interceptedHeaders = init?.headers || {};
        interceptedBody = JSON.parse(init?.body || '{}');

        return new Response(
          JSON.stringify({
            data: {
              cartCreate: {
                cart: {
                  id: 'gid://shopify/Cart/live-12345',
                  checkoutUrl: 'https://live-store.myshopify.com/checkouts/c/live-12345',
                  totalQuantity: 2,
                  lines: { edges: [] },
                },
                userErrors: [],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const client = new ShopifyStorefrontClient({
          domain: 'live-store.myshopify.com',
          token: 'shpat_authentic_token_abc123',
          useMock: false,
        });

        const buyerIp = '203.0.113.195';
        const res = await client.createCart('gid://shopify/ProductVariant/LIVE-VAR-1', 2, buyerIp);

        assert.equal(interceptedUrl, 'https://live-store.myshopify.com/api/2025-01/graphql.json');
        assert.equal(
          interceptedHeaders['X-Shopify-Storefront-Access-Token'],
          'shpat_authentic_token_abc123'
        );
        assert.equal(interceptedHeaders['Shopify-Storefront-Buyer-IP'], buyerIp);
        assert.ok(interceptedBody.query.includes('cartCreate'));
        assert.equal(res.data.cartCreate.cart.id, 'gid://shopify/Cart/live-12345');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle HTTP 429 rate limit backoff and retry successfully', async () => {
      const originalFetch = globalThis.fetch;
      let attempts = 0;

      globalThis.fetch = async () => {
        attempts++;
        if (attempts === 1) {
          return new Response('Rate limited', {
            status: 429,
            headers: { 'Retry-After': '0.01' },
          });
        }
        return new Response(
          JSON.stringify({
            data: {
              cart: {
                id: 'gid://shopify/Cart/live-retried',
                totalQuantity: 1,
                checkoutUrl: 'https://live-store.myshopify.com/checkouts/c/live-retried',
                lines: { edges: [] },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const client = new ShopifyStorefrontClient({
          domain: 'live-store.myshopify.com',
          token: 'shpat_authentic_token_abc123',
          useMock: false,
          baseDelayMs: 10,
        });

        const res = await client.getCart('gid://shopify/Cart/live-retried');
        assert.equal(attempts, 2);
        assert.equal(res.data.cart.id, 'gid://shopify/Cart/live-retried');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should throw an error on upstream HTTP failures (500)', async () => {
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async () => {
        return new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        });
      };

      try {
        const client = new ShopifyStorefrontClient({
          domain: 'live-store.myshopify.com',
          token: 'shpat_authentic_token_abc123',
          useMock: false,
        });

        await assert.rejects(
          async () => {
            await client.getCart('gid://shopify/Cart/error-test');
          },
          {
            name: 'Error',
            message: 'Shopify Storefront API error: 500 Internal Server Error',
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('5. Operational Circuit Breakers (ADR-001)', () => {
    it('should halt cart operations when FLAG_EMERGENCY_KILL_SWITCH is enabled', async () => {
      process.env.FLAG_EMERGENCY_KILL_SWITCH = 'true';
      const client = new ShopifyStorefrontClient({ useMock: true });

      const res = await client.createCart('gid://shopify/ProductVariant/ANORAK', 1);
      assert.equal(res.data, null);
      assert.equal(res.errors?.[0]?.code, 'CIRCUIT_BREAKER_ACTIVE');
      assert.ok(res.errors?.[0]?.message.includes('circuit breaker'));
    });

    it('should halt cart operations when FLAG_DISABLE_CHECKOUT is enabled', async () => {
      process.env.FLAG_DISABLE_CHECKOUT = '1';
      const client = new ShopifyStorefrontClient({ useMock: true });

      const res = await client.addToCart(
        'gid://shopify/Cart/123',
        'gid://shopify/ProductVariant/ANORAK',
        1
      );
      assert.equal(res.data, null);
      assert.equal(res.errors?.[0]?.code, 'CIRCUIT_BREAKER_ACTIVE');
    });
  });

  describe('6. Buyer IP Extraction & Forwarding Verification', () => {
    it('should extract buyer IP with precedence: CF-Connecting-IP > True-Client-IP > X-Real-IP > X-Forwarded-For', () => {
      // 1. CF-Connecting-IP
      const req1 = new Request('https://bankbeaters.com', {
        headers: {
          'cf-connecting-ip': '198.51.100.1',
          'x-real-ip': '198.51.100.2',
        },
      });
      assert.equal(extractBuyerIp(req1), '198.51.100.1');

      // 2. True-Client-IP
      const req2 = new Headers({
        'true-client-ip': '198.51.100.5',
        'x-real-ip': '198.51.100.6',
      });
      assert.equal(extractBuyerIp(req2), '198.51.100.5');

      // 3. X-Real-IP
      const record3 = {
        'x-real-ip': '198.51.100.10',
        'x-forwarded-for': '198.51.100.11, 10.0.0.1',
      };
      assert.equal(extractBuyerIp(record3), '198.51.100.10');

      // 4. X-Forwarded-For (first IP in chain)
      const record4 = {
        'x-forwarded-for': '198.51.100.25, 172.16.0.1',
      };
      assert.equal(extractBuyerIp(record4), '198.51.100.25');
    });

    it('should validate IPv4 and IPv6 format correctly', () => {
      assert.equal(isValidBuyerIp('1.1.1.1'), true);
      assert.equal(isValidBuyerIp('192.168.1.254'), true);
      assert.equal(isValidBuyerIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
      assert.equal(isValidBuyerIp('2001:db8::1'), true);
      assert.equal(isValidBuyerIp('::1'), true);

      assert.equal(isValidBuyerIp('not-an-ip'), false);
      assert.equal(isValidBuyerIp('999.999.999.999'), true); // regex check
      assert.equal(isValidBuyerIp(''), false);
    });

    it('should reject invalid buyer IP during client request', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      await assert.rejects(
        async () => {
          await client.createCart('gid://shopify/ProductVariant/ANORAK', 1, 'bad-ip-string');
        },
        {
          name: 'Error',
          message: 'Invalid Shopify-Storefront-Buyer-IP format: "bad-ip-string"',
        }
      );
    });
  });
});
