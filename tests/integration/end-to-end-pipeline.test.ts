import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

// Storefront & Catalog
import { getProducts, getProductBySlug } from '../../apps/web/src/lib/catalog';
import {
  shopify,
  defaultShopifyMock,
} from '../../apps/web/src/lib/shopify';
import {
  createCart,
  getCart,
  addCartLines,
  updateCartLines,
  updateBuyerIdentity,
} from '../../apps/web/src/lib/shopify/storefront';

// Turnstile & Edge APIs
import { TURNSTILE_TEST_TOKENS, resetTurnstileRateLimits } from '../../apps/web/src/lib/turnstile';
import { resetWebhookIdempotencyCache } from '../../apps/web/src/lib/shopify-webhook';
import { POST as cartCreatePost } from '../../apps/web/src/app/api/cart/create/route';
import { GET as cartGetHandler } from '../../apps/web/src/app/api/cart/[cartId]/route';
import { POST as cartLinesAddPost } from '../../apps/web/src/app/api/cart/lines/add/route';
import { POST as cartLinesUpdatePost } from '../../apps/web/src/app/api/cart/lines/update/route';
import { POST as cartBuyerIdentityPost } from '../../apps/web/src/app/api/cart/buyer-identity/route';
import { POST as verifyTurnstilePost } from '../../apps/web/src/app/api/checkout/verify-turnstile/route';

// Webhook Ingestion & Queue Pipeline
import { POST as webhookHandler } from '../../apps/web/src/app/api/webhooks/shopify/route';
import {
  handleOrderQueueBatch,
  type OrderQueueMessage,
  type QueueMessage,
  type QueueMessageBatch,
  type ShopifyOrderWebhookPayload,
} from '../../apps/web/src/lib/order-consumer';
import {
  ResendNotificationProvider,
  WebhookNotificationProvider,
} from '@chrishop/notifications';

// ============================================================================
// Test Constants & Fixtures
// ============================================================================

const TEST_WEBHOOK_SECRET = 'shpss_e2e_pipeline_test_secret_3_6';
const MERCHANT_EMAIL = 'merchant-ops@shop.jacobmiller22.com';

function createMockQueueMessage<T>(
  body: T,
  attempts: number = 1,
  id: string = `msg-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
): {
  message: QueueMessage<T>;
  acked: boolean;
  retried: boolean;
} {
  const state = { acked: false, retried: false };
  const message: QueueMessage<T> = {
    id,
    timestamp: new Date(),
    body,
    attempts,
    ack: () => {
      state.acked = true;
    },
    retry: () => {
      state.retried = true;
    },
  };
  return { message, get acked() { return state.acked; }, get retried() { return state.retried; } };
}

describe('Story 3.6: End-to-End Integration Test Suite — Cart-to-Checkout Pipeline', () => {
  beforeEach(() => {
    defaultShopifyMock.reset();
    resetTurnstileRateLimits();
    resetWebhookIdempotencyCache();
  });

  describe('1. Discovery: Catalog Browsing & Real-Time Stock Lookups', () => {
    it('should retrieve published storefront products and verify drop variations', async () => {
      const products = await getProducts();
      assert.ok(Array.isArray(products), 'Catalog must return array of products');
      assert.ok(products.length > 0, 'Catalog should contain seeded products');

      const product = products[0];
      assert.ok(product.id, 'Product must have an id');
      assert.ok(product.slug, 'Product must have a slug');
      assert.ok(Array.isArray(product.variations), 'Product must have variations array');

      // Verify detailed lookup by slug
      const detailed = await getProductBySlug(product.slug);
      assert.ok(detailed, `Product with slug ${product.slug} must be resolvable`);
      assert.equal(detailed?.title, product.title);
    });

    it('should query live Shopify stock and price for a product', async () => {
      const liveData = await shopify.getProductPriceAndAvailability('gid://shopify/Product/101');
      assert.ok(liveData.data?.product);
      const prod = liveData.data.product;

      assert.equal(prod.availableForSale, true);
      assert.ok(Number(prod.priceRange.minVariantPrice.amount) > 0);
      assert.ok(prod.variants.edges.length > 0);
    });
  });

  describe('2. Handshake: Bot-Protected Cart Creation & Line Item Flow', () => {
    it('should deny bot traffic failing Turnstile challenge', async () => {
      const botReq = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS }),
      });

      const res = await verifyTurnstilePost(botReq);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('should create cart for legitimate buyer with forwarded buyer IP', async () => {
      const buyerIp = '198.51.100.88';
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': buyerIp,
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/201',
          quantity: 1,
          turnstileToken: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES,
        }),
      });

      const res = await cartCreatePost(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.cart.id.startsWith('gid://shopify/Cart/'));
      assert.ok(data.cart.checkoutUrl.includes('/checkouts/c/'));
      assert.equal(data.forwardedBuyerIp, buyerIp);
      assert.equal(defaultShopifyMock.lastBuyerIp, buyerIp);
    });

    it('should execute full cart lifecycle: add line, update quantity, set locale, and inspect cart', async () => {
      const buyerIp = '198.51.100.90';

      // 1. Initialize cart
      const createRes = await createCart('gid://shopify/ProductVariant/201', 1, buyerIp);
      const cartId = createRes.data.cartCreate.cart.id;

      // 2. Add companion item via API
      const addReq = new NextRequest('http://localhost:3000/api/cart/lines/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': buyerIp },
        body: JSON.stringify({
          cartId,
          variantId: 'gid://shopify/ProductVariant/202',
          quantity: 2,
        }),
      });
      const addRes = await cartLinesAddPost(addReq);
      assert.equal(addRes.status, 200);
      const addData = await addRes.json();
      assert.equal(addData.cart.totalQuantity, 3);

      // 3. Update line item quantity via API
      const lineToUpdate = addData.cart.lines.edges[0].node.id;
      const updateReq = new NextRequest('http://localhost:3000/api/cart/lines/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': buyerIp },
        body: JSON.stringify({
          cartId,
          lineId: lineToUpdate,
          quantity: 3,
        }),
      });
      const updateRes = await cartLinesUpdatePost(updateReq);
      assert.equal(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.equal(updateData.cart.totalQuantity, 5);

      // 4. Update buyer identity & countryCode for locale preservation
      const buyerIdentityReq = new NextRequest('http://localhost:3000/api/cart/buyer-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': buyerIp },
        body: JSON.stringify({
          cartId,
          buyerIdentity: {
            email: 'alpine.angler@example.com',
            countryCode: 'US',
          },
        }),
      });
      const identityRes = await cartBuyerIdentityPost(buyerIdentityReq);
      assert.equal(identityRes.status, 200);
      const identityData = await identityRes.json();
      assert.ok(identityData.cart.checkoutUrl.includes('locale=us'));

      // 5. Inspect final cart state via GET
      const getReq = new NextRequest(`http://localhost:3000/api/cart/${encodeURIComponent(cartId)}`, {
        method: 'GET',
        headers: { 'cf-connecting-ip': buyerIp },
      });
      const getRes = await cartGetHandler(getReq, {
        params: Promise.resolve({ cartId: encodeURIComponent(cartId) }),
      });
      assert.equal(getRes.status, 200);
      const getData = await getRes.json();
      assert.equal(getData.cart.id, cartId);
      assert.equal(getData.cart.totalQuantity, 5);
      assert.ok(getData.cart.checkoutUrl.includes('locale=us'));
    });
  });

  describe('3. Exhaustion: Drop Rush Sold-Out Protection', () => {
    it('should reject cart line additions when inventory is depleted without database locking', async () => {
      // Mark variant as depleted
      defaultShopifyMock.setVariantSoldOut('gid://shopify/ProductVariant/202');

      const createRes = await createCart('gid://shopify/ProductVariant/201', 1);
      const cartId = createRes.data.cartCreate.cart.id;

      const addReq = new NextRequest('http://localhost:3000/api/cart/lines/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          variantId: 'gid://shopify/ProductVariant/202',
          quantity: 1,
        }),
      });

      const res = await cartLinesAddPost(addReq);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('out of stock'));
      assert.equal(data.userErrors[0].code, 'OUT_OF_STOCK');
    });
  });

  describe('4. Checkout Completion: Webhook Ingestion & Queue Dispatch', () => {
    it('should reject unauthenticated webhook requests with invalid HMAC', async () => {
      process.env.SHOPIFY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
      const payload = JSON.stringify({ id: 99999 });
      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-topic': 'orders/create',
          'x-shopify-hmac-sha256': 'invalid_signature_hash',
          'x-shopify-webhook-id': 'wh_test_invalid_001',
        },
        body: payload,
      });

      const res = await webhookHandler(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Unauthorized: Invalid webhook signature');
      delete process.env.SHOPIFY_WEBHOOK_SECRET;
    });

    it('should verify authentic Shopify order webhook and enqueue order message', async () => {
      process.env.SHOPIFY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

      const orderPayload: ShopifyOrderWebhookPayload = {
        id: 7788990011,
        name: '#1099',
        order_number: 1099,
        email: 'alpine.buyer@example.com',
        customer: {
          first_name: 'Miles',
          last_name: 'Leadville',
          email: 'alpine.buyer@example.com',
        },
        total_price: '425.00',
        subtotal_price: '385.00',
        total_shipping: '25.00',
        total_tax: '15.00',
        currency: 'USD',
        financial_status: 'paid',
        fulfillment_status: 'unfulfilled',
        shipping_address: {
          name: 'Miles Leadville',
          address1: '1000 Cloud City Way',
          city: 'Leadville',
          province: 'CO',
          zip: '80461',
          country: 'US',
        },
        line_items: [
          {
            id: 554433,
            title: 'The Bushwhack Storm Anorak',
            variant_title: 'Deadstock Duck Camo Pocket Edition',
            sku: 'BB-ANO-CAM-002',
            quantity: 1,
            price: '385.00',
            stock_quantity: 2, // triggers low stock notification (<= 3)
          },
        ],
        created_at: new Date().toISOString(),
      };

      const payloadStr = JSON.stringify(orderPayload);
      const hmac = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(payloadStr, 'utf8')
        .digest('base64');

      const webhookId = `wh_e2e_${Date.now()}`;
      const enqueuedMessages: any[] = [];
      const mockQueue = {
        async send(msg: any) {
          enqueuedMessages.push(msg);
        },
      };

      // Set queue on globalThis for edge route access
      (globalThis as any).SHOPIFY_ORDERS_QUEUE = mockQueue;

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-topic': 'orders/create',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-webhook-id': webhookId,
        },
        body: payloadStr,
      });

      const res = await webhookHandler(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.received, true);
      assert.equal(body.queued, true);
      assert.equal(enqueuedMessages.length, 1);
      assert.equal(enqueuedMessages[0].order.id, 7788990011);

      // Verify deduplication on replayed delivery
      const replayReq = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-topic': 'orders/create',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-webhook-id': webhookId,
        },
        body: payloadStr,
      });

      const replayRes = await webhookHandler(replayReq);
      assert.equal(replayRes.status, 200);
      const replayBody = await replayRes.json();
      assert.equal(replayBody.deduplicated, true);
      assert.equal(enqueuedMessages.length, 1, 'Duplicate webhook must not re-enqueue message');

      delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
      delete process.env.SHOPIFY_WEBHOOK_SECRET;
    });
  });

  describe('5. Fulfillment & Operations: Queue Consumer & Notification Delivery', () => {
    it('should consume queue message and dispatch operational alerts and customer receipt', async () => {
      const opsAlerts: any[] = [];
      const emailDeliveries: any[] = [];

      const mockOpsProvider = new WebhookNotificationProvider('https://ops.example.com/alerts');
      mockOpsProvider.sendJson = async (data: any) => {
        opsAlerts.push(data);
        return { success: true, statusCode: 200 };
      };
      mockOpsProvider.notifyLowStock = async (
        productTitle: string,
        variationName: string,
        remainingStock: number,
        sku?: string
      ) => {
        opsAlerts.push({ event: 'low_stock', productTitle, variationName, remainingStock, sku });
        return { success: true, statusCode: 200 };
      };

      const mockResendProvider = new ResendNotificationProvider({
        apiKey: 're_mock_test_key_123',
        fromEmail: 'orders@shop.jacobmiller22.com',
        merchantAlertEmail: MERCHANT_EMAIL,
      });
      mockResendProvider.notifyOrderReceipt = async (receipt: any) => {
        emailDeliveries.push({ type: 'receipt', to: receipt.customer_email, receipt });
        return { success: true, id: 'mock-rec-1' };
      };
      mockResendProvider.notifyMerchantOrderAlert = async (order: any) => {
        emailDeliveries.push({ type: 'merchant_alert', to: MERCHANT_EMAIL, order });
        return { success: true, id: 'mock-merch-1' };
      };
      mockResendProvider.notifyLowStock = async (
        productTitle: string,
        variationName: string,
        remainingStock: number,
        sku?: string
      ) => {
        emailDeliveries.push({ type: 'low_stock', to: MERCHANT_EMAIL, productTitle, variationName, remainingStock, sku });
        return { success: true, id: 'mock-stock-1' };
      };

      const orderData: ShopifyOrderWebhookPayload = {
        id: 8877665544,
        name: '#1102',
        order_number: 1102,
        email: 'highland.guide@example.com',
        customer: {
          first_name: 'Finn',
          last_name: 'MacLeod',
          email: 'highland.guide@example.com',
        },
        total_price: '340.00',
        subtotal_price: '340.00',
        total_shipping: '0.00',
        total_tax: '0.00',
        currency: 'USD',
        financial_status: 'paid',
        fulfillment_status: 'unfulfilled',
        shipping_address: {
          name: 'Finn MacLeod',
          address1: 'Glen Coe Way',
          city: 'Inverness',
          province: 'Highlands',
          zip: 'IV2 4AB',
          country: 'GB',
        },
        line_items: [
          {
            id: 998877,
            title: 'The Bushwhack Storm Anorak',
            variant_title: 'Field Olive — Standard Run',
            sku: 'BB-ANO-OLV-001',
            quantity: 1,
            price: '340.00',
            stock_quantity: 1, // Low stock trigger (<= 3)
          },
        ],
        created_at: new Date().toISOString(),
      };

      const mockMsg = createMockQueueMessage<OrderQueueMessage>({
        eventId: 'evt_e2e_001',
        order: orderData,
        receivedAt: new Date().toISOString(),
        retryCount: 0,
      });

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [mockMsg.message],
        ackAll: () => {},
        retryAll: () => {},
      };

      const env = {
        MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL,
        OPS_ALERT_WEBHOOK_URL: 'https://ops.example.com/alerts',
        RESEND_API_KEY: 're_mock_test_key_123',
        RESEND_FROM_EMAIL: 'orders@shop.jacobmiller22.com',
      };

      const summary = await handleOrderQueueBatch(batch, env, null, {
        resendProvider: mockResendProvider,
        webhookProvider: mockOpsProvider,
      });

      assert.equal(summary.total, 1);
      assert.equal(summary.succeeded, 1);
      assert.equal(summary.retried, 0);
      assert.equal(summary.deadLettered, 0);
      assert.equal(mockMsg.acked, true);

      // Verify operational alert dispatch
      assert.ok(opsAlerts.length >= 1, 'At least one operational alert must be dispatched');
      assert.ok(
        opsAlerts.some((a) => a.order_number === 1102 || a.text?.includes('#1102') || a.content?.includes('#1102')),
        'Operational alert must reference order #1102'
      );

      // Verify authoritative customer receipt dispatch (Option A policy)
      assert.ok(emailDeliveries.length >= 1, 'At least one email must be dispatched');
      const customerReceipt = emailDeliveries.find(
        (e) => e.type === 'receipt' && e.to === 'highland.guide@example.com'
      );
      assert.ok(customerReceipt, 'Customer receipt must target customer email address');
      assert.equal(customerReceipt.receipt.order_number, '#1102');

      // Verify low-stock warning dispatch (stock_quantity 1 <= 3)
      const lowStockAlert = emailDeliveries.find((e) => e.type === 'low_stock');
      assert.ok(lowStockAlert, 'Low stock warning email must be dispatched');
      assert.equal(lowStockAlert.remainingStock, 1);
    });
  });
});
