import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as webhookHandler } from '../../apps/web/src/app/api/webhooks/shopify/route';
import {
  handleOrderQueueBatch,
  calculateRetryDelay,
  DEFAULT_MAX_RETRIES,
  DEFAULT_INITIAL_RETRY_DELAY_SECONDS,
  type OrderQueueMessage,
  type QueueMessage,
  type QueueMessageBatch,
  type OrderConsumerEnv,
  type ShopifyOrderWebhookPayload,
} from '../../apps/web/src/lib/order-consumer';
import {
  ResendNotificationProvider,
  WebhookNotificationProvider,
} from '@chrishop/notifications';

// ============================================================================
// Test Constants & Fixtures
// ============================================================================

const TEST_SECRET = 'shpss_story_3_8_webhook_pipeline_secret';
const MERCHANT_EMAIL = 'merchant-ops@shop.jacobmiller22.com';

function createMockShopifyOrder(overrides: Partial<ShopifyOrderWebhookPayload> = {}): ShopifyOrderWebhookPayload {
  return {
    id: 9918273645,
    name: '#1055',
    order_number: 1055,
    email: 'buyer@example.com',
    customer: {
      first_name: 'Miles',
      last_name: 'Davis',
      email: 'buyer@example.com',
    },
    total_price: '750.00',
    subtotal_price: '700.00',
    total_shipping: '35.00',
    total_tax: '15.00',
    currency: 'USD',
    financial_status: 'paid',
    fulfillment_status: 'unfulfilled',
    shipping_address: {
      name: 'Miles Davis',
      address1: '52nd Street',
      city: 'New York',
      province: 'NY',
      zip: '10019',
      country: 'US',
    },
    line_items: [
      {
        id: 771122,
        title: 'Kind of Blue Silk Screen',
        variant_title: 'Archival Print Edition',
        sku: 'KOB-PRINT-01',
        quantity: 1,
        price: '700.00',
        stock_quantity: 4,
      },
    ],
    created_at: new Date().toISOString(),
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

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    _store: store,
  };
}

describe('Story 3.8: Async Shopify Webhook Pipeline with Cloudflare Queues & Dead Letter Queue', () => {
  // --------------------------------------------------------------------------
  // 1. Fast Ingestion Edge Endpoint (/api/webhooks/shopify)
  // --------------------------------------------------------------------------
  describe('1. Fast Ingestion Edge Endpoint (/api/webhooks/shopify)', () => {
    it('should acknowledge valid Shopify webhook with HTTP 200 in < 100ms and enqueue payload', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      const enqueuedMessages: any[] = [];
      const mockKV = createMockKV();

      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;
        (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
          send: async (msg: any) => {
            enqueuedMessages.push(msg);
          },
        };

        const mockOrder = createMockShopifyOrder();
        const rawBody = JSON.stringify(mockOrder);
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
            'x-shopify-webhook-id': 'wh-story38-fast-ack-01',
          },
          body: rawBody,
        });

        const start = Date.now();
        const response = await webhookHandler(req);
        const elapsed = Date.now() - start;

        assert.equal(response.status, 200, 'Webhook must return HTTP 200 OK');
        assert.ok(elapsed < 100, `Webhook acknowledgment took ${elapsed}ms, target is < 100ms`);

        const json = await response.json();
        assert.equal(json.received, true);
        assert.equal(json.queued, true);
        assert.equal(json.topic, 'orders/create');
        assert.equal(json.webhookId, 'wh-story38-fast-ack-01');
        assert.equal(response.headers.get('x-idempotency-status'), 'miss');

        // Verify enqueued message payload
        assert.equal(enqueuedMessages.length, 1);
        assert.equal(enqueuedMessages[0].topic, 'orders/create');
        assert.equal(enqueuedMessages[0].eventId, 'wh-story38-fast-ack-01');
        assert.equal(enqueuedMessages[0].order.id, 9918273645);
        assert.ok(enqueuedMessages[0].timestamp, 'Timestamp must be present');
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
        delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
        delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
      }
    });

    it('should reject requests with invalid HMAC signature with HTTP 401 Unauthorized', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;

        const rawBody = JSON.stringify(createMockShopifyOrder());
        const invalidHmac = 'forge-hmac-signature-unauthorized';

        const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': invalidHmac,
            'x-shopify-topic': 'orders/create',
            'x-shopify-webhook-id': 'wh-unauth-01',
          },
          body: rawBody,
        });

        const response = await webhookHandler(req);
        assert.equal(response.status, 401, 'Endpoint must return 401 on HMAC mismatch');
        const json = await response.json();
        assert.ok(json.error.includes('Unauthorized'), 'Error message must specify unauthorized signature');
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
      }
    });

    it('should deduplicate replayed webhook IDs via KV idempotency gate', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      const enqueuedMessages: any[] = [];
      const mockKV = createMockKV();

      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;
        (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
          send: async (msg: any) => {
            enqueuedMessages.push(msg);
          },
        };

        const mockOrder = createMockShopifyOrder();
        const rawBody = JSON.stringify(mockOrder);
        const validHmac = crypto
          .createHmac('sha256', TEST_SECRET)
          .update(rawBody, 'utf8')
          .digest('base64');

        const makeReq = () =>
          new NextRequest('http://localhost:3000/api/webhooks/shopify', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-shopify-hmac-sha256': validHmac,
              'x-shopify-topic': 'orders/create',
              'x-shopify-webhook-id': 'wh-idempotent-repeat-01',
            },
            body: rawBody,
          });

        // First delivery
        const resp1 = await webhookHandler(makeReq());
        assert.equal(resp1.status, 200);
        assert.equal(resp1.headers.get('x-idempotency-status'), 'miss');
        assert.equal(enqueuedMessages.length, 1);

        // Duplicate replay delivery
        const resp2 = await webhookHandler(makeReq());
        assert.equal(resp2.status, 200);
        assert.equal(resp2.headers.get('x-idempotency-status'), 'hit');
        const json2 = await resp2.json();
        assert.equal(json2.deduplicated, true);
        assert.equal(json2.received, true);
        // Ensure no second message was enqueued
        assert.equal(enqueuedMessages.length, 1, 'Duplicate webhook must not enqueue a second message');
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
        delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
        delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Queue Consumer Handler, Retry Backoff & DLQ Poison-Pill Routing
  // --------------------------------------------------------------------------
  describe('2. Queue Consumer Handler, Retry Backoff & DLQ Routing', () => {
    it('should acknowledge successfully processed order messages in a batch', async () => {
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });
      mockResend.notifyOrderReceipt = async () => ({ success: true, id: 'resend-rec-01' });
      mockResend.notifyMerchantOrderAlert = async () => ({ success: true, id: 'resend-mer-01' });

      const msg1 = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#BATCH-01' }),
      });
      const msg2 = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#BATCH-02' }),
      });

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [msg1.message, msg2.message],
      };

      const result = await handleOrderQueueBatch(
        batch,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        undefined,
        { resendProvider: mockResend }
      );

      assert.equal(result.total, 2);
      assert.equal(result.succeeded, 2);
      assert.equal(result.retried, 0);
      assert.equal(result.deadLettered, 0);

      assert.equal(msg1.acked, true, 'Message 1 must be acknowledged');
      assert.equal(msg2.acked, true, 'Message 2 must be acknowledged');
      assert.equal(msg1.retried, false);
      assert.equal(msg2.retried, false);
    });

    it('should calculate correct exponential backoff delay intervals', () => {
      const initialDelay = DEFAULT_INITIAL_RETRY_DELAY_SECONDS; // 5s
      assert.equal(calculateRetryDelay(1, initialDelay, 2), 5);   // Attempt 1: 5 * 2^0 = 5s
      assert.equal(calculateRetryDelay(2, initialDelay, 2), 10);  // Attempt 2: 5 * 2^1 = 10s
      assert.equal(calculateRetryDelay(3, initialDelay, 2), 20);  // Attempt 3: 5 * 2^2 = 20s
      assert.equal(calculateRetryDelay(4, initialDelay, 2), 40);  // Attempt 4: 5 * 2^3 = 40s
    });

    it('should retry transient failures with exponential backoff when attempts < maxRetries', async () => {
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });
      mockResend.notifyOrderReceipt = async () => ({
        success: false,
        error: 'Resend rate limit (429)',
      });

      const msg = createMockQueueMessage<OrderQueueMessage>(
        {
          topic: 'orders/create',
          order: createMockShopifyOrder(),
        },
        1 // First attempt
      );

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [msg.message],
      };

      const result = await handleOrderQueueBatch(
        batch,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        undefined,
        { resendProvider: mockResend, maxRetries: 3, initialRetryDelaySeconds: 5 }
      );

      assert.equal(result.succeeded, 0);
      assert.equal(result.retried, 1);
      assert.equal(result.deadLettered, 0);

      assert.equal(msg.retried, true, 'Message must be marked for retry');
      assert.equal(msg.acked, false, 'Failed message must not be acked yet');
      assert.equal(msg.retryOptions?.delaySeconds, 5, 'Attempt 1 retry delay should be 5s');
    });

    it('should route poison-pill messages exceeding maxRetries to SHOPIFY_ORDERS_DLQ and acknowledge message', async () => {
      const dlqMessages: any[] = [];
      const env: OrderConsumerEnv = {
        MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL,
        SHOPIFY_ORDERS_DLQ: {
          send: async (dlqPayload: any) => {
            dlqMessages.push(dlqPayload);
          },
        },
      };

      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });
      mockResend.notifyOrderReceipt = async () => ({
        success: false,
        error: 'Permanent delivery failure (500)',
      });

      const poisonMsg = createMockQueueMessage<OrderQueueMessage>(
        {
          topic: 'orders/create',
          order: createMockShopifyOrder({ name: '#POISON-PILL' }),
        },
        3 // Reached max retries (attempt 3 of 3)
      );

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [poisonMsg.message],
      };

      const result = await handleOrderQueueBatch(
        batch,
        env,
        undefined,
        { resendProvider: mockResend, maxRetries: 3 }
      );

      assert.equal(result.succeeded, 0);
      assert.equal(result.retried, 0);
      assert.equal(result.deadLettered, 1);

      // Verify poison pill was acked so it leaves the primary queue
      assert.equal(poisonMsg.acked, true, 'Poison pill must be acknowledged from main queue');
      assert.equal(poisonMsg.retried, false, 'Poison pill must not be retried on main queue');

      // Verify DLQ received diagnostic error envelope
      assert.equal(dlqMessages.length, 1, 'DLQ must receive the failed message');
      assert.equal(dlqMessages[0].originalMessageId, poisonMsg.message.id);
      assert.ok(dlqMessages[0].error.includes('Permanent delivery failure'));
      assert.equal(dlqMessages[0].attempts, 3);
      assert.ok(dlqMessages[0].failedAt, 'failedAt timestamp must be recorded');
      assert.equal((dlqMessages[0].payload as any).order.name, '#POISON-PILL');
    });

    it('should isolate errors in mixed batch so poisoned messages never crash or block healthy messages', async () => {
      const dlqMessages: any[] = [];
      const env: OrderConsumerEnv = {
        MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL,
        SHOPIFY_ORDERS_DLQ: {
          send: async (dlqPayload: any) => {
            dlqMessages.push(dlqPayload);
          },
        },
      };

      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });
      mockResend.notifyOrderReceipt = async (receipt) => {
        if (receipt.order_number === '#POISON') {
          return { success: false, error: 'Corrupt email address' };
        }
        return { success: true, id: 'resend-ok' };
      };
      mockResend.notifyMerchantOrderAlert = async () => ({ success: true });

      const healthy1 = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#HEALTHY-1' }),
      }, 1);

      const poison = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#POISON' }),
      }, 3); // Max retries exceeded

      const healthy2 = createMockQueueMessage<OrderQueueMessage>({
        topic: 'orders/create',
        order: createMockShopifyOrder({ name: '#HEALTHY-2' }),
      }, 1);

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [healthy1.message, poison.message, healthy2.message],
      };

      const result = await handleOrderQueueBatch(batch, env, undefined, {
        resendProvider: mockResend,
        maxRetries: 3,
      });

      assert.equal(result.total, 3);
      assert.equal(result.succeeded, 2);
      assert.equal(result.deadLettered, 1);
      assert.equal(result.retried, 0);

      assert.equal(healthy1.acked, true, 'Healthy message 1 must be acked');
      assert.equal(poison.acked, true, 'Poison message must be acked to clear queue');
      assert.equal(healthy2.acked, true, 'Healthy message 2 must be acked');
      assert.equal(dlqMessages.length, 1, 'Only poison message sent to DLQ');
      assert.equal((dlqMessages[0].payload as any).order.name, '#POISON');
    });
  });
});
