import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  handleOrderQueueBatch,
  processOrderEvent,
  normalizeOrderEvent,
  calculateRetryDelay,
  verifyShopifyWebhookHmac,
  LOW_STOCK_THRESHOLD,
  type OrderQueueMessage,
  type QueueMessage,
  type QueueMessageBatch,
  type OrderConsumerEnv,
  type ShopifyOrderWebhookPayload,
} from '../../apps/web/src/lib/order-consumer';
import { POST as webhookHandler } from '../../apps/web/src/app/api/webhooks/shopify/route';
import {
  ResendNotificationProvider,
  WebhookNotificationProvider,
} from '@chrishop/notifications';
import type { Order } from '@chrishop/types';

// ============================================================================
// Test Fixtures & Mock Helpers
// ============================================================================

const TEST_SECRET = 'shpss_test_order_pipeline_secret_3.4';
const MERCHANT_EMAIL = 'merchant-ops@shop.jacobmiller22.com';
const OPS_WEBHOOK = 'https://ops.example.com/webhooks/order-telemetry';

function createMockShopifyOrder(overrides: Partial<ShopifyOrderWebhookPayload> = {}): ShopifyOrderWebhookPayload {
  return {
    id: 8849102837461,
    name: '#1042',
    order_number: 1042,
    email: 'collector@example.com',
    customer: {
      first_name: 'Elena',
      last_name: 'Rostova',
      email: 'collector@example.com',
    },
    total_price: '540.00',
    subtotal_price: '480.00',
    total_shipping: '45.00',
    total_tax: '15.00',
    currency: 'USD',
    financial_status: 'paid',
    fulfillment_status: 'unfulfilled',
    shipping_address: {
      name: 'Elena Rostova',
      address1: '742 Evergreen Terrace',
      city: 'Springfield',
      province: 'OR',
      zip: '97477',
      country: 'US',
    },
    line_items: [
      {
        id: 192837461,
        title: 'Midnight Obsidian Beast',
        variant_title: 'Limited Edition 24K Bronze',
        sku: 'MOB-BRONZE-01',
        quantity: 1,
        price: '480.00',
        stock_quantity: 2, // Low stock threshold trigger (<= 3)
      },
    ],
    created_at: '2026-09-12T10:00:00Z',
    ...overrides,
  };
}

function createMockQueueMessage<T>(
  body: T,
  attempts: number = 1,
  id: string = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
): {
  message: QueueMessage<T>;
  acked: boolean;
  retried: boolean;
  retryOptions?: { delaySeconds?: number };
} {
  const state = {
    acked: false,
    retried: false,
    retryOptions: undefined as { delaySeconds?: number } | undefined,
  };

  const message: QueueMessage<T> = {
    id,
    timestamp: new Date(),
    body,
    attempts,
    ack: () => {
      state.acked = true;
    },
    retry: (options) => {
      state.retried = true;
      state.retryOptions = options;
    },
  };

  return {
    message,
    get acked() {
      return state.acked;
    },
    get retried() {
      return state.retried;
    },
    get retryOptions() {
      return state.retryOptions;
    },
  };
}

describe('Story 3.4: Order Event Pipeline & Notification Dispatch Integration', () => {
  // --------------------------------------------------------------------------
  // 1. Order Event Normalization & Data Contracts
  // --------------------------------------------------------------------------
  describe('1. Order Event Normalization', () => {
    it('should normalize raw Shopify webhook payload into domain Order and Receipt', () => {
      const rawShopify = createMockShopifyOrder();
      const { order, receipt, rawLineItems } = normalizeOrderEvent(rawShopify);

      assert.equal(order.id, '8849102837461');
      assert.equal(order.shopify_order_number, '#1042');
      assert.equal(order.customer_email, 'collector@example.com');
      assert.equal(order.customer_name, 'Elena Rostova');
      assert.equal(order.amount_total, 540.0);
      assert.equal(order.amount_subtotal, 480.0);
      assert.equal(order.amount_shipping, 45.0);
      assert.equal(order.amount_tax, 15.0);
      assert.equal(order.order_status, 'paid');
      assert.equal(order.shipping_address.city, 'Springfield');
      assert.equal(order.shipping_address.postal_code, '97477');

      assert.equal(receipt.items.length, 1);
      assert.equal(receipt.items[0].title, 'Midnight Obsidian Beast');
      assert.equal(receipt.items[0].sku, 'MOB-BRONZE-01');
      assert.equal(receipt.items[0].unit_price, 480.0);

      assert.equal(rawLineItems.length, 1);
      assert.equal(rawLineItems[0].stock_quantity, 2);
    });

    it('should normalize pre-normalized Order entity without data loss', () => {
      const existingOrder: Order = {
        id: 'ord-771122',
        shopify_order_id: 'gid://shopify/Order/771122',
        shopify_order_number: '#7711',
        customer_email: 'collector2@example.com',
        customer_name: 'Marcus Vance',
        shipping_name: 'Marcus Vance',
        shipping_address: {
          street: '100 Arts Blvd',
          city: 'Portland',
          state: 'OR',
          postal_code: '97201',
          country: 'US',
        },
        order_status: 'paid',
        shipping_status: 'unfulfilled',
        amount_total: 250.0,
        amount_subtotal: 220.0,
        amount_shipping: 30.0,
        amount_tax: 0,
        currency: 'USD',
        created_at: '2026-09-12T11:00:00Z',
      };

      const { order, receipt } = normalizeOrderEvent(existingOrder);
      assert.equal(order.id, 'ord-771122');
      assert.equal(order.customer_email, 'collector2@example.com');
      assert.equal(receipt.order_number, '#7711');
      assert.equal(receipt.amount_total, 250.0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Queue Message Receipt & Notification Dispatch (Resend + Webhook)
  // --------------------------------------------------------------------------
  describe('2. Pipeline Notification Dispatch via Resend & Ops Webhook', () => {
    it('should dispatch customer receipt to customer_email via Resend', async () => {
      const capturedReceipts: any[] = [];
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });

      // Spy on notifyOrderReceipt
      mockResend.notifyOrderReceipt = async (receipt) => {
        capturedReceipts.push(receipt);
        return { success: true, id: 'resend-msg-receipt-01' };
      };

      const queueMessage: OrderQueueMessage = {
        topic: 'orders/create',
        order: createMockShopifyOrder(),
      };

      const result = await processOrderEvent(
        queueMessage,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        { resendProvider: mockResend }
      );

      assert.equal(result.customerEmailSent, true, 'Customer email must be flagged as sent');
      assert.equal(capturedReceipts.length, 1);
      assert.equal(capturedReceipts[0].customer_email, 'collector@example.com');
      assert.equal(capturedReceipts[0].order_number, '#1042');
      assert.equal(capturedReceipts[0].amount_total, 540.0);
      assert.equal(capturedReceipts[0].items[0].sku, 'MOB-BRONZE-01');
    });

    it('should dispatch merchant order summary to MERCHANT_ALERT_EMAIL', async () => {
      const capturedMerchantAlerts: any[] = [];
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });

      mockResend.notifyMerchantOrderAlert = async (order) => {
        capturedMerchantAlerts.push(order);
        return { success: true, id: 'resend-msg-merchant-01' };
      };

      const queueMessage: OrderQueueMessage = {
        topic: 'orders/paid',
        order: createMockShopifyOrder(),
      };

      const result = await processOrderEvent(
        queueMessage,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        { resendProvider: mockResend }
      );

      assert.equal(result.merchantAlertSent, true, 'Merchant alert must be sent');
      assert.equal(capturedMerchantAlerts.length, 1);
      assert.equal(capturedMerchantAlerts[0].id, '8849102837461');
      assert.equal(capturedMerchantAlerts[0].amount_total, 540.0);
      assert.equal(capturedMerchantAlerts[0].customer_email, 'collector@example.com');
    });

    it('should trigger notifyLowStock alert when stock_quantity <= 3', async () => {
      const capturedLowStock: any[] = [];
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });

      mockResend.notifyLowStock = async (productTitle, variationName, remainingStock, sku) => {
        capturedLowStock.push({ productTitle, variationName, remainingStock, sku });
        return { success: true, id: 'resend-msg-lowstock-01' };
      };

      // Order with item stock_quantity = 2 (<= 3 threshold)
      const order = createMockShopifyOrder({
        line_items: [
          {
            title: 'Solar Flare Archival Print',
            variant_title: 'Framed Giclée 24x36',
            sku: 'SF-FRAMED-01',
            quantity: 1,
            price: '220.00',
            stock_quantity: 2,
          },
          {
            title: 'Standard Art Postcard',
            variant_title: 'Standard',
            sku: 'POST-01',
            quantity: 1,
            price: '15.00',
            stock_quantity: 45, // Healthy stock (> 3), should NOT trigger alert
          },
        ],
      });

      const result = await processOrderEvent(
        { topic: 'orders/paid', order },
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        { resendProvider: mockResend }
      );

      assert.equal(result.lowStockAlertsSent, 1, 'Exactly 1 low stock alert should fire');
      assert.equal(capturedLowStock.length, 1);
      assert.equal(capturedLowStock[0].productTitle, 'Solar Flare Archival Print');
      assert.equal(capturedLowStock[0].variationName, 'Framed Giclée 24x36');
      assert.equal(capturedLowStock[0].remainingStock, 2);
      assert.equal(capturedLowStock[0].sku, 'SF-FRAMED-01');
    });

    it('should trigger notifyLowStock when remainingStockMap is provided in queue message', async () => {
      const capturedLowStock: any[] = [];
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });

      mockResend.notifyLowStock = async (productTitle, variationName, remainingStock, sku) => {
        capturedLowStock.push({ productTitle, variationName, remainingStock, sku });
        return { success: true };
      };

      const queueMessage: OrderQueueMessage = {
        topic: 'orders/create',
        order: createMockShopifyOrder({
          line_items: [{ title: 'Obsidian', quantity: 1, price: '400', stock_quantity: 10 }],
        }),
        remainingStockMap: {
          'MOB-BRONZE-01': {
            productTitle: 'Midnight Obsidian Beast',
            variationName: 'Bronze Edition',
            remainingStock: 1, // <= 3 threshold
            sku: 'MOB-BRONZE-01',
          },
        },
      };

      const result = await processOrderEvent(
        queueMessage,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        { resendProvider: mockResend }
      );

      assert.equal(result.lowStockAlertsSent, 1);
      assert.equal(capturedLowStock[0].remainingStock, 1);
    });

    it('should dispatch generic telemetry JSON when OPS_ALERT_WEBHOOK_URL is configured', async () => {
      const capturedTelemetry: any[] = [];
      const mockWebhook = new WebhookNotificationProvider(OPS_WEBHOOK);

      mockWebhook.sendJson = async (data) => {
        capturedTelemetry.push(data);
        return { success: true, statusCode: 200 };
      };

      const queueMessage: OrderQueueMessage = {
        topic: 'orders/create',
        order: createMockShopifyOrder(),
      };

      const result = await processOrderEvent(
        queueMessage,
        {
          MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL,
          OPS_ALERT_WEBHOOK_URL: OPS_WEBHOOK,
        },
        { webhookProvider: mockWebhook }
      );

      assert.equal(result.opsAlertSent, true, 'Ops telemetry must be sent');
      const orderTelemetry = capturedTelemetry.find((t) => t.event === 'orders/create');
      assert.ok(orderTelemetry, 'Order telemetry event must be dispatched');
      assert.equal(orderTelemetry.order_number, '#1042');
      assert.equal(orderTelemetry.amount_total, 540.0);
      assert.ok(orderTelemetry.timestamp);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Cloudflare Queue Batch Consumer & Isolated Retry Semantics
  // --------------------------------------------------------------------------
  describe('3. Queue Batch Consumer & Error Isolation Semantics', () => {
    it('should process full batch successfully and acknowledge messages on clean delivery', async () => {
      const mockResend = new ResendNotificationProvider();
      mockResend.notifyOrderReceipt = async () => ({ success: true });
      mockResend.notifyMerchantOrderAlert = async () => ({ success: true });

      const msg1 = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ id: 101, order_number: 101 }),
      });
      const msg2 = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/paid',
        order: createMockShopifyOrder({ id: 102, order_number: 102 }),
      });

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'SHOPIFY_ORDERS_QUEUE',
        messages: [msg1.message, msg2.message],
      };

      const batchResult = await handleOrderQueueBatch(
        batch,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        undefined,
        { resendProvider: mockResend }
      );

      assert.equal(batchResult.total, 2);
      assert.equal(batchResult.succeeded, 2);
      assert.equal(batchResult.retried, 0);
      assert.equal(batchResult.deadLettered, 0);

      assert.equal(msg1.acked, true, 'Message 1 must be acknowledged');
      assert.equal(msg2.acked, true, 'Message 2 must be acknowledged');
    });

    it('should retry failed notification message with exponential backoff without crashing the consumer isolate', async () => {
      const mockResend = new ResendNotificationProvider();
      // Simulate transient Resend API failure
      mockResend.notifyOrderReceipt = async () => ({
        success: false,
        error: 'Resend API HTTP 429: Rate limit exceeded',
      });
      mockResend.notifyMerchantOrderAlert = async () => ({ success: true });

      const msg = createMockQueueMessage<OrderQueueMessage>(
        {
          topic: 'orders/create',
          order: createMockShopifyOrder(),
        },
        1 // Attempt 1
      );

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'SHOPIFY_ORDERS_QUEUE',
        messages: [msg.message],
      };

      const batchResult = await handleOrderQueueBatch(
        batch,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        undefined,
        {
          resendProvider: mockResend,
          maxRetries: 3,
          initialRetryDelaySeconds: 5,
        }
      );

      assert.equal(batchResult.succeeded, 0);
      assert.equal(batchResult.retried, 1);
      assert.equal(msg.retried, true, 'Message must be queued for retry');
      assert.equal(msg.acked, false, 'Failed message must NOT be acked');
      assert.equal(msg.retryOptions?.delaySeconds, 5, 'Initial backoff must be 5 seconds');
    });

    it('should compute exponential backoff delay correctly across multiple attempts', () => {
      assert.equal(calculateRetryDelay(1, 5, 2), 5); // 5 * 2^0 = 5s
      assert.equal(calculateRetryDelay(2, 5, 2), 10); // 5 * 2^1 = 10s
      assert.equal(calculateRetryDelay(3, 5, 2), 20); // 5 * 2^2 = 20s
      assert.equal(calculateRetryDelay(4, 5, 2), 40); // 5 * 2^3 = 40s
    });

    it('should route poison pill to DLQ and acknowledge from main queue when maxRetries is reached', async () => {
      const mockResend = new ResendNotificationProvider();
      mockResend.notifyOrderReceipt = async () => ({
        success: false,
        error: 'Resend API HTTP 500: Internal Server Error',
      });

      const dlqEnqueued: any[] = [];
      const mockDlq = {
        send: async (payload: any) => {
          dlqEnqueued.push(payload);
        },
      };

      const msg = createMockQueueMessage<OrderQueueMessage>(
        {
          topic: 'orders/paid',
          order: createMockShopifyOrder(),
        },
        3 // Attempt 3 (reaches maxRetries of 3)
      );

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'SHOPIFY_ORDERS_QUEUE',
        messages: [msg.message],
      };

      const batchResult = await handleOrderQueueBatch(
        batch,
        {
          MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL,
          SHOPIFY_ORDERS_DLQ: mockDlq,
        },
        undefined,
        {
          resendProvider: mockResend,
          maxRetries: 3,
        }
      );

      assert.equal(batchResult.deadLettered, 1);
      assert.equal(batchResult.retried, 0);
      assert.equal(dlqEnqueued.length, 1, 'Poison pill must be routed to DLQ');
      assert.ok(dlqEnqueued[0].error.includes('HTTP 500'));
      assert.equal(msg.acked, true, 'Dead-lettered message must be acked to prevent poison loops');
    });

    it('should ensure independent message isolation: failing message does not prevent adjacent message success', async () => {
      const mockResend = new ResendNotificationProvider();
      let callCount = 0;

      mockResend.notifyOrderReceipt = async (receipt) => {
        callCount++;
        if (receipt.order_number === '#FAIL') {
          return { success: false, error: 'Simulated failure on bad message' };
        }
        return { success: true };
      };
      mockResend.notifyMerchantOrderAlert = async () => ({ success: true });

      const failingMsg = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#FAIL' }),
      });

      const passingMsg = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#PASS' }),
      });

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'SHOPIFY_ORDERS_QUEUE',
        messages: [failingMsg.message, passingMsg.message],
      };

      const batchResult = await handleOrderQueueBatch(
        batch,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        undefined,
        { resendProvider: mockResend }
      );

      assert.equal(batchResult.total, 2);
      assert.equal(batchResult.succeeded, 1);
      assert.equal(batchResult.retried, 1);

      assert.equal(failingMsg.retried, true, 'Failing message must be retried');
      assert.equal(failingMsg.acked, false, 'Failing message must not be acked');

      assert.equal(passingMsg.acked, true, 'Passing message must be acknowledged cleanly');
      assert.equal(passingMsg.retried, false, 'Passing message must not be retried');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Edge Webhook Endpoint Integration (/api/webhooks/shopify)
  // --------------------------------------------------------------------------
  describe('4. Edge Webhook Ingestion & Out-of-Band Decoupling', () => {
    it('should verify valid Shopify HMAC-SHA256 signature', () => {
      const rawBody = JSON.stringify({ id: 12345, event: 'orders/create' });
      const computedHmac = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(rawBody, 'utf8')
        .digest('base64');

      const isValid = verifyShopifyWebhookHmac(rawBody, computedHmac, TEST_SECRET);
      assert.equal(isValid, true, 'Valid HMAC signature must verify');
    });

    it('should reject tampered or forged payloads with invalid signature', () => {
      const legitimateBody = JSON.stringify({ id: 12345, price: '480.00' });
      const tamperedBody = JSON.stringify({ id: 12345, price: '1.00' });

      const legitimateHmac = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(legitimateBody, 'utf8')
        .digest('base64');

      const isValid = verifyShopifyWebhookHmac(tamperedBody, legitimateHmac, TEST_SECRET);
      assert.equal(isValid, false, 'Tampered payload must be rejected');
    });

    it('should return 401 Unauthorized from webhook endpoint when HMAC verification fails', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;

        const body = JSON.stringify({ id: 999 });
        const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': 'invalid-base64-signature',
            'x-shopify-topic': 'orders/create',
          },
          body,
        });

        const response = await webhookHandler(req);
        assert.equal(response.status, 401, 'Endpoint must return 401 Unauthorized on bad signature');
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
      }
    });

    it('should return HTTP 200 OK immediately (< 100ms) and enqueue payload to SHOPIFY_ORDERS_QUEUE', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      const enqueuedMessages: any[] = [];

      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
          send: async (msg: any) => {
            enqueuedMessages.push(msg);
          },
        };

        const rawBody = JSON.stringify(createMockShopifyOrder());
        const validHmac = crypto
          .createHmac('sha256', TEST_SECRET)
          .update(rawBody, 'utf8')
          .digest('base64');

        const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': validHmac,
            'x-shopify-topic': 'orders/create',
            'x-shopify-webhook-id': 'wh-998877',
          },
          body: rawBody,
        });

        const response = await webhookHandler(req);
        assert.equal(response.status, 200, 'Endpoint must return 200 OK');

        const json = await response.json();
        assert.equal(json.received, true);
        assert.equal(json.queued, true);
        assert.equal(json.topic, 'orders/create');
        assert.ok(json.durationMs < 100, `Execution (${json.durationMs}ms) should be < 100ms`);

        assert.equal(enqueuedMessages.length, 1);
        assert.equal(enqueuedMessages[0].topic, 'orders/create');
        assert.equal(enqueuedMessages[0].eventId, 'wh-998877');
        assert.equal(enqueuedMessages[0].order.id, 8849102837461);
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
        delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
      }
    });

    it('should ensure out-of-band notification failures NEVER fail the edge webhook response', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      const originalResendKey = process.env.RESEND_API_KEY;

      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        // Invalid Resend Key that will cause out-of-band failures
        process.env.RESEND_API_KEY = 're_invalid_failing_key';

        const rawBody = JSON.stringify(createMockShopifyOrder());
        const validHmac = crypto
          .createHmac('sha256', TEST_SECRET)
          .update(rawBody, 'utf8')
          .digest('base64');

        const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': validHmac,
            'x-shopify-topic': 'orders/paid',
          },
          body: rawBody,
        });

        const response = await webhookHandler(req);
        assert.equal(
          response.status,
          200,
          'Edge response must remain 200 OK even if background notification fails'
        );

        const json = await response.json();
        assert.equal(json.received, true);
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
        process.env.RESEND_API_KEY = originalResendKey;
      }
    });
  });
});
