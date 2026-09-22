import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import {
  ShopifyStorefrontClient,
  defaultShopifyMock,
  shopify,
  getShopInfo,
} from '../../apps/web/src/lib/shopify';
import {
  ShopifyAdminClient,
  defaultShopifyAdminMock,
  assertNoInventoryFields,
} from '../../apps/web/src/lib/shopify-admin';
import { POST as shopifyWebhookHandler } from '../../apps/web/src/app/api/webhooks/shopify/route';
import {
  verifyShopifyWebhookHmacSubtle,
  resetWebhookIdempotencyCache,
} from '../../apps/web/src/lib/shopify-webhook';
import {
  verifyStorefrontApi,
  verifyHeadlessCart,
  verifyAdminApi,
  verifyPaymentsAndCurrency,
  verifyWebhookDelivery,
  runShopifyVerification,
  parseArgs,
  generateSampleOrderPayload,
  computeHmacSignature,
} from '../../scripts/verify-shopify';

describe('Story 2.20: Shopify Store Setup & Headless Sales Channel Configuration', () => {
  const originalEnv = { ...process.env };
  const TEST_SECRET = 'shpss_test_store_setup_secret_789';

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
    defaultShopifyMock.reset();
    defaultShopifyAdminMock.reset();
    resetWebhookIdempotencyCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
    defaultShopifyAdminMock.reset();
    resetWebhookIdempotencyCache();
  });

  // ==========================================================================
  // 1. Storefront API Credentials & Scope Validation
  // ==========================================================================
  describe('1. Storefront API Credential & Scope Validation', () => {
    it('should query shop metadata and verify USD currency and primary domain', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const shopRes = await client.getShopInfo();

      assert.ok(shopRes.data?.shop, 'Shop metadata must be returned');
      const shop = shopRes.data.shop;
      assert.equal(shop.name, 'ChrisShop Leadville Workshop');
      assert.equal(shop.paymentSettings?.currencyCode, 'USD');
      assert.equal(shop.paymentSettings?.countryCode, 'US');
      assert.ok(shop.primaryDomain?.host);
    });

    it('should support singleton convenience helper getShopInfo', async () => {
      const shopRes = await getShopInfo();
      assert.ok(shopRes.data?.shop);
      assert.equal(shopRes.data.shop.paymentSettings.currencyCode, 'USD');
    });

    it('should verify catalog querying under unauthenticated_read_product_listings scope', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const catalogRes = await client.request(`
        query getCatalog {
          products(first: 2) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `);

      assert.ok(catalogRes.data?.products?.edges);
      assert.ok(catalogRes.data.products.edges.length > 0);
      assert.equal(catalogRes.data.products.edges[0].node.title, 'The Bushwhack Storm Anorak');
    });

    it('should execute verifyStorefrontApi stage successfully', async () => {
      const result = await verifyStorefrontApi({
        mock: true,
        storeDomain: 'chrishop-dev.myshopify.com',
        storefrontToken: 'mock_storefront_token',
      });

      assert.equal(result.passed, true);
      assert.equal(result.details?.currency, 'USD');
      assert.equal(result.details?.catalogVerified, true);
      assert.ok(result.details?.requiredScopes?.includes('unauthenticated_read_product_listings'));
      assert.ok(result.details?.requiredScopes?.includes('unauthenticated_write_checkouts'));
    });

    it('should handle dry-run mode for Storefront API stage', async () => {
      const result = await verifyStorefrontApi({ dryRun: true });
      assert.equal(result.passed, true);
      assert.equal(result.details?.mode, 'dry-run');
    });
  });

  // ==========================================================================
  // 2. Headless Cart Lifecycle & Checkout Redirection
  // ==========================================================================
  describe('2. Headless Cart & Checkout Redirection Lifecycle', () => {
    it('should create cart, forward buyer IP, and generate valid checkout URL', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const buyerIp = '203.0.113.195';

      const createRes = await client.createCart('gid://shopify/ProductVariant/201', 1, buyerIp);
      assert.ok(createRes.data?.cartCreate?.cart);
      const cart = createRes.data.cartCreate.cart;

      assert.ok(cart.id.startsWith('gid://shopify/Cart/'));
      assert.ok(cart.checkoutUrl.includes('/checkouts/c/'));
      assert.equal(cart.totalQuantity, 1);
      assert.equal(defaultShopifyMock.lastBuyerIp, buyerIp);
    });

    it('should append line items and preserve buyer locale upon identity update', async () => {
      const client = new ShopifyStorefrontClient({ useMock: true });
      const createRes = await client.createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      // Add lines
      const addRes = await client.addToCart(cartId, 'gid://shopify/ProductVariant/202', 2);
      assert.equal(addRes.data?.cartLinesAdd?.cart?.totalQuantity, 3);

      // Update buyer identity
      const identityRes = await client.cartBuyerIdentityUpdate(cartId, {
        email: 'collector@leadville.example',
        countryCode: 'CA',
      });

      assert.ok(identityRes.data?.cartBuyerIdentityUpdate?.cart?.checkoutUrl.includes('locale=ca'));
    });

    it('should execute verifyHeadlessCart stage successfully', async () => {
      const result = await verifyHeadlessCart({ mock: true });
      assert.equal(result.passed, true);
      assert.ok(result.details?.cartId);
      assert.ok(result.details?.checkoutUrl?.includes('/checkouts/c/'));
      assert.equal(result.details?.totalQuantity, 3);
      assert.equal(result.details?.buyerIpForwarded, '203.0.113.195');
    });
  });

  // ==========================================================================
  // 3. Admin API Credentials, Access Scopes & Domain Isolation
  // ==========================================================================
  describe('3. Admin API Credentials, Access Scopes & Domain Isolation', () => {
    it('should query shop information via Admin API client', async () => {
      const adminClient = new ShopifyAdminClient({ useMock: true });
      const shop = await adminClient.getShopInfo();

      assert.ok(shop);
      assert.equal(shop.name, 'ChrisShop Leadville Workshop');
      assert.equal(shop.currencyCode, 'USD');
      assert.equal(shop.plan?.displayName, 'Partner Development');
    });

    it('should verify required Admin API scopes', async () => {
      const adminClient = new ShopifyAdminClient({ useMock: true });
      const scopes = await adminClient.getAccessScopes();

      assert.ok(scopes.includes('write_products'), 'Must include write_products scope');
      assert.ok(scopes.includes('read_products'), 'Must include read_products scope');
      assert.ok(scopes.includes('write_inventory'), 'Must include write_inventory scope');
      assert.ok(scopes.includes('read_inventory'), 'Must include read_inventory scope');
    });

    it('should strictly enforce Zero Inventory Overwrites guard (assertNoInventoryFields)', () => {
      // Valid editorial input passes
      assert.doesNotThrow(() => {
        assertNoInventoryFields({
          title: 'Handmade Chest Rig',
          descriptionHtml: '<p>Ultralight pack</p>',
          tags: ['category:packs'],
        });
      });

      // Prohibited inventory fields throw SecurityViolation
      assert.throws(
        () => assertNoInventoryFields({ title: 'Rig', stock_quantity: 10 }),
        /Prohibited inventory field "stock_quantity" detected/
      );
      assert.throws(
        () => assertNoInventoryFields({ title: 'Rig', availableQuantity: 5 }),
        /Prohibited inventory field "availableQuantity" detected/
      );
      assert.throws(
        () => assertNoInventoryFields({ title: 'Rig', inventoryQuantities: [] }),
        /Prohibited inventory field "inventoryQuantities" detected/
      );
    });

    it('should execute verifyAdminApi stage successfully', async () => {
      const result = await verifyAdminApi({ mock: true });
      assert.equal(result.passed, true);
      assert.equal(result.details?.currency, 'USD');
      assert.equal(result.details?.zeroInventoryOverwriteGuardVerified, true);
      assert.ok(result.details?.scopes?.includes('write_products'));
    });
  });

  // ==========================================================================
  // 4. Shopify Payments, Currency & Test Mode Settings
  // ==========================================================================
  describe('4. Shopify Payments, Currency & Test Mode Settings', () => {
    it('should execute verifyPaymentsAndCurrency stage and assert USD currency', async () => {
      const result = await verifyPaymentsAndCurrency({ mock: true });
      assert.equal(result.passed, true);
      assert.equal(result.details?.currency, 'USD');
      assert.equal(result.details?.testModeBogusGatewayConfigured, true);
      assert.ok(result.details?.testCardInstructions?.includes('Card #1'));
    });
  });

  // ==========================================================================
  // 5. Webhook Delivery & Local Proxy Test Harness
  // ==========================================================================
  describe('5. Webhook Delivery & Local Proxy Test Harness', () => {
    it('should generate valid sample order payload and cryptographic HMAC-SHA256 signature', () => {
      const payload = generateSampleOrderPayload(88492018);
      const rawBody = JSON.stringify(payload);
      const hmac = computeHmacSignature(rawBody, TEST_SECRET);

      assert.ok(hmac, 'HMAC must be computed');
      assert.match(hmac, /^[A-Za-z0-9+/=]+$/, 'HMAC must be base64-encoded');
    });

    it('should deliver webhook to in-process route handler and verify 200 OK and idempotency', async () => {
      const webhookId = 'wh-test-local-proxy-001';
      const payload = generateSampleOrderPayload(1001);
      const rawBody = JSON.stringify(payload);
      const hmac = computeHmacSignature(rawBody, TEST_SECRET);

      // Delivery 1: Fresh delivery
      const req1 = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-topic': 'orders/create',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-webhook-id': webhookId,
        },
        body: rawBody,
      });

      const res1 = await shopifyWebhookHandler(req1);
      assert.equal(res1.status, 200);
      const json1 = await res1.json();
      assert.equal(json1.received, true);
      assert.equal(json1.webhookId, webhookId);
      assert.equal(res1.headers.get('x-idempotency-status'), 'miss');

      // Delivery 2: Replay delivery with identical webhookId
      const req2 = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-topic': 'orders/create',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-webhook-id': webhookId,
        },
        body: rawBody,
      });

      const res2 = await shopifyWebhookHandler(req2);
      assert.equal(res2.status, 200);
      const json2 = await res2.json();
      assert.equal(json2.received, true);
      assert.equal(json2.deduplicated, true);
      assert.equal(res2.headers.get('x-idempotency-status'), 'hit');
    });

    it('should reject webhook with corrupted HMAC signature with 401 Unauthorized', async () => {
      const payload = generateSampleOrderPayload(1002);
      const rawBody = JSON.stringify(payload);

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-topic': 'orders/create',
          'x-shopify-hmac-sha256': 'tampered_invalid_signature_base64=',
          'x-shopify-webhook-id': 'wh-test-corrupted-sig',
        },
        body: rawBody,
      });

      const res = await shopifyWebhookHandler(req);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error, 'Unauthorized: Invalid webhook signature');
    });

    it('should execute verifyWebhookDelivery stage successfully', async () => {
      const result = await verifyWebhookDelivery({
        mock: true,
        webhookSecret: TEST_SECRET,
        inProcess: true,
      });

      assert.equal(result.passed, true);
      assert.equal(result.details?.topic, 'orders/create');
      assert.equal(result.details?.idempotencyVerified, true);
      assert.ok(result.details?.latencyMs < 500);
    });
  });

  // ==========================================================================
  // 6. Turnkey Pipeline Orchestration & CLI Argument Parsing
  // ==========================================================================
  describe('6. Turnkey Pipeline Orchestration & CLI Parser', () => {
    it('should run full verification pipeline and return 5/5 passing stages in mock mode', async () => {
      const report = await runShopifyVerification({
        mock: true,
        webhookSecret: TEST_SECRET,
        inProcess: true,
      });

      assert.equal(report.passed, true);
      assert.equal(report.mode, 'mock');
      assert.equal(report.summary.total, 5);
      assert.equal(report.summary.passed, 5);
      assert.equal(report.summary.failed, 0);
    });

    it('should parse CLI arguments accurately', () => {
      const argv = [
        '--mock',
        '--dry-run',
        '--target',
        'live',
        '--store',
        'custom-store.myshopify.com',
        '--storefront-token',
        'shpat_custom_123',
        '--admin-token',
        'shpat_admin_456',
        '--webhook-secret',
        'whsec_789',
        '--webhook-url',
        'https://example.com/api/webhooks',
        '--max-latency',
        '350',
        '--verbose',
        '--json',
      ];

      const options = parseArgs(argv);
      assert.equal(options.mock, true);
      assert.equal(options.dryRun, true);
      assert.equal(options.target, 'live');
      assert.equal(options.storeDomain, 'custom-store.myshopify.com');
      assert.equal(options.storefrontToken, 'shpat_custom_123');
      assert.equal(options.adminToken, 'shpat_admin_456');
      assert.equal(options.webhookSecret, 'whsec_789');
      assert.equal(options.webhookUrl, 'https://example.com/api/webhooks');
      assert.equal(options.maxLatencyMs, 350);
      assert.equal(options.verbose, true);
      assert.equal(options.json, true);
    });
  });
});
