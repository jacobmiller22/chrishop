import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as shopifyWebhookHandler } from '../src/app/api/webhooks/shopify/route';
import {
  checkAndSetIdempotency,
  resetWebhookIdempotencyCache,
  verifyShopifyWebhookHmacSubtle,
} from '../src/lib/shopify-webhook';

const TEST_SECRET = 'shpss_test_webhook_secret_key_12345';

function createSignedRequest(
  payload: Record<string, unknown> | string,
  options: {
    secret?: string;
    webhookId?: string;
    topic?: string;
    corruptSignature?: boolean;
    omitSignature?: boolean;
  } = {}
): NextRequest {
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const secret = options.secret ?? TEST_SECRET;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (!options.omitSignature) {
    let hmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (options.corruptSignature) {
      hmac = 'tampered_invalid_base64_hmac_signature=';
    }
    headers['x-shopify-hmac-sha256'] = hmac;
  }

  if (options.webhookId) {
    headers['x-shopify-webhook-id'] = options.webhookId;
  }

  if (options.topic) {
    headers['x-shopify-topic'] = options.topic;
  }

  return new NextRequest('https://chrishop.jacobmiller22.com/api/webhooks/shopify', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

function mockShopifyOrder(id: number = 771029384756): Record<string, unknown> {
  return {
    id,
    order_number: 1042,
    name: '#1042',
    email: 'collector@leadville.example',
    financial_status: 'paid',
    fulfillment_status: null,
    currency: 'USD',
    total_price: '345.00',
    subtotal_price: '320.00',
    total_shipping: '25.00',
    total_tax: '0.00',
    shipping_address: {
      first_name: 'Jane',
      last_name: 'Leadville',
      address1: '400 Harrison Ave',
      city: 'Leadville',
      province: 'CO',
      zip: '80461',
      country: 'US',
    },
    line_items: [
      {
        id: 9918237465,
        title: 'Leadville Edition Fly Reel',
        variant_title: 'Raw Titanium / Micro-Batch 01',
        sku: 'BB-REEL-RAW-01',
        quantity: 1,
        price: '320.00',
        remaining_stock: 2,
      },
    ],
  };
}

describe('Story 3.3: Shopify Order Webhook Ingestion & Idempotency Pipeline', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
    resetWebhookIdempotencyCache();
    delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
    delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetWebhookIdempotencyCache();
    delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
    delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
  });

  // ==========================================================================
  // 1. Web Crypto API HMAC-SHA256 Cryptographic Verification (crypto.subtle)
  // ==========================================================================
  describe('1. Web Crypto HMAC-SHA256 Verification (crypto.subtle)', () => {
    it('should verify legitimate Shopify HMAC-SHA256 signature using crypto.subtle', async () => {
      const rawBody = JSON.stringify({ id: 1001, test: true });
      const expectedHmac = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(rawBody, 'utf8')
        .digest('base64');

      const isValid = await verifyShopifyWebhookHmacSubtle(rawBody, expectedHmac, TEST_SECRET);
      assert.equal(isValid, true, 'Valid signature must verify successfully');
    });

    it('should reject tampered payload against original HMAC signature', async () => {
      const legitimateBody = JSON.stringify({ id: 1001, amount: '500.00' });
      const tamperedBody = JSON.stringify({ id: 1001, amount: '1.00' });

      const legitimateHmac = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(legitimateBody, 'utf8')
        .digest('base64');

      const isValid = await verifyShopifyWebhookHmacSubtle(tamperedBody, legitimateHmac, TEST_SECRET);
      assert.equal(isValid, false, 'Tampered payload must be rejected');
    });

    it('should reject forged or corrupted HMAC signature', async () => {
      const rawBody = JSON.stringify({ id: 1001 });
      const forgedHmac = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=';

      const isValid = await verifyShopifyWebhookHmacSubtle(rawBody, forgedHmac, TEST_SECRET);
      assert.equal(isValid, false, 'Forged signature must be rejected');
    });

    it('should reject when signature header is missing or empty', async () => {
      const rawBody = JSON.stringify({ id: 1001 });
      const isValidNull = await verifyShopifyWebhookHmacSubtle(rawBody, null, TEST_SECRET);
      const isValidEmpty = await verifyShopifyWebhookHmacSubtle(rawBody, '', TEST_SECRET);

      assert.equal(isValidNull, false, 'Null signature header must fail');
      assert.equal(isValidEmpty, false, 'Empty signature header must fail');
    });

    it('should handle UTF-8 and multibyte characters in raw body', async () => {
      const rawBody = JSON.stringify({
        title: 'Leadville Workshop 🏔️ Special Edition #1',
        note: 'Crafted with Ultra-PE™ & Titanium ⚙️',
      });
      const hmac = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(rawBody, 'utf8')
        .digest('base64');

      const isValid = await verifyShopifyWebhookHmacSubtle(rawBody, hmac, TEST_SECRET);
      assert.equal(isValid, true, 'Multibyte characters must verify accurately');
    });
  });

  // ==========================================================================
  // 2. HTTP Endpoint Security & Input Validation
  // ==========================================================================
  describe('2. HTTP Endpoint Security & Input Validation', () => {
    it('should return 401 Unauthorized when HMAC signature is invalid', async () => {
      const req = createSignedRequest(mockShopifyOrder(), {
        corruptSignature: true,
      });

      const response = await shopifyWebhookHandler(req);
      assert.equal(response.status, 401, 'Invalid signature must return 401');

      const json = await response.json();
      assert.equal(json.error, 'Unauthorized: Invalid webhook signature');
    });

    it('should return 400 Bad Request when JSON payload is malformed', async () => {
      const malformedJson = '{"id": 12345, "broken": [unclosed';
      const req = createSignedRequest(malformedJson);

      const response = await shopifyWebhookHandler(req);
      assert.equal(response.status, 400, 'Malformed JSON must return 400');

      const json = await response.json();
      assert.equal(json.error, 'Invalid JSON payload');
    });

    it('should succeed with 200 OK when valid HMAC and payload are provided', async () => {
      const order = mockShopifyOrder(881920381);
      const req = createSignedRequest(order, {
        webhookId: 'wh-initial-success-1',
        topic: 'orders/create',
      });

      const response = await shopifyWebhookHandler(req);
      assert.equal(response.status, 200, 'Valid request must return 200');

      const json = await response.json();
      assert.equal(json.received, true);
      assert.equal(json.webhookId, 'wh-initial-success-1');
      assert.equal(json.topic, 'orders/create');
      assert.equal(response.headers.get('x-idempotency-status'), 'miss');
    });
  });

  // ==========================================================================
  // 3. Idempotency Gate (order_webhook:<id> & KV Storage)
  // ==========================================================================
  describe('3. Idempotency Deduplication Gate', () => {
    it('should allow first delivery and deduplicate identical webhook replay without reprocessing', async () => {
      const enqueued: any[] = [];
      (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
        send: async (msg: any) => {
          enqueued.push(msg);
        },
      };

      const webhookId = 'wh-idempotency-replay-001';
      const order = mockShopifyOrder(99112233);

      // Delivery 1: Initial delivery
      const req1 = createSignedRequest(order, { webhookId, topic: 'orders/create' });
      const res1 = await shopifyWebhookHandler(req1);
      assert.equal(res1.status, 200);

      const json1 = await res1.json();
      assert.equal(json1.received, true);
      assert.equal(json1.queued, true);
      assert.equal(res1.headers.get('x-idempotency-status'), 'miss');
      assert.equal(enqueued.length, 1, 'Delivery 1 must enqueue message');

      // Delivery 2: Webhook replay (identical webhookId)
      const req2 = createSignedRequest(order, { webhookId, topic: 'orders/create' });
      const res2 = await shopifyWebhookHandler(req2);
      assert.equal(res2.status, 200, 'Duplicate replay must return 200 OK');

      const json2 = await res2.json();
      assert.equal(json2.received, true);
      assert.equal(json2.deduplicated, true, 'Must identify duplicate event');
      assert.equal(res2.headers.get('x-idempotency-status'), 'hit');
      assert.equal(enqueued.length, 1, 'Delivery 2 must NOT enqueue duplicate message');
    });

    it('should interface with Cloudflare Workers KV when NEXT_CACHE_WORKERS_KV is bound', async () => {
      const kvStore = new Map<string, { value: string; options?: any }>();
      const mockKV = {
        get: async (key: string) => {
          const entry = kvStore.get(key);
          return entry ? entry.value : null;
        },
        put: async (key: string, value: string, options?: any) => {
          kvStore.set(key, { value, options });
        },
      };

      (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;

      const webhookId = 'wh-kv-backed-test-99';
      const order = mockShopifyOrder(773344);

      // Request 1
      const req1 = createSignedRequest(order, { webhookId });
      const res1 = await shopifyWebhookHandler(req1);
      assert.equal(res1.status, 200);

      // Verify KV was populated with 24h TTL (86400 seconds)
      const stored = kvStore.get(`order_webhook:${webhookId}`);
      assert.ok(stored, 'KV must store idempotency key');
      assert.equal(stored.options?.expirationTtl, 86400, 'TTL must be 86400 seconds (24h)');

      // Request 2 (Replay)
      const req2 = createSignedRequest(order, { webhookId });
      const res2 = await shopifyWebhookHandler(req2);
      assert.equal(res2.status, 200);
      const json2 = await res2.json();
      assert.equal(json2.deduplicated, true);
      assert.equal(res2.headers.get('x-idempotency-status'), 'hit');
    });

    it('should gracefully fall back to in-memory idempotency cache if KV throws', async () => {
      const failingKV = {
        get: async () => {
          throw new Error('KV storage unavailable');
        },
        put: async () => {
          throw new Error('KV storage unavailable');
        },
      };

      (globalThis as any).NEXT_CACHE_WORKERS_KV = failingKV;

      const webhookId = 'wh-kv-failover-memory-1';
      const outcome1 = await checkAndSetIdempotency(webhookId, failingKV);
      assert.equal(outcome1.isDuplicate, false, 'First call should record in memory');

      const outcome2 = await checkAndSetIdempotency(webhookId, failingKV);
      assert.equal(outcome2.isDuplicate, true, 'Second call should hit memory cache');
    });
  });

  // ==========================================================================
  // 4. Discord Notification & Queue Offloading Out-of-Band Resilience
  // ==========================================================================
  describe('4. Discord & Queue Offloading Resilience', () => {
    it('should dispatch to Discord #store-orders webhook URL when configured', async () => {
      const dispatchedPayloads: any[] = [];

      // Intercept fetch for webhook dispatch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('discord.com/api/webhooks')) {
          dispatchedPayloads.push(JSON.parse(init?.body || '{}'));
          return new Response(JSON.stringify({ id: 'discord-msg-123' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(url, init);
      };

      try {
        process.env.DISCORD_WEBHOOK_STORE_ORDERS =
          'https://discord.com/api/webhooks/123456789/mock-store-orders';

        const order = mockShopifyOrder(667788);
        const req = createSignedRequest(order, {
          webhookId: 'wh-discord-notification-1',
          topic: 'orders/paid',
        });

        const response = await shopifyWebhookHandler(req);
        assert.equal(response.status, 200);

        // Allow microtask tick for async background execution
        await new Promise((r) => setTimeout(r, 60));

        assert.ok(dispatchedPayloads.length >= 1, 'Discord webhook must receive at least 1 dispatch');
        const orderAlert = dispatchedPayloads.find(
          (p) => p.event === 'orders/paid' || p.event === 'order.created'
        );
        assert.ok(orderAlert, 'Discord webhook must receive order created/paid alert');
        assert.ok(orderAlert.content, 'Discord payload must include content field');
        assert.ok(
          orderAlert.content.includes('#1042'),
          'Alert content must mention order number'
        );
        assert.ok(
          orderAlert.content.includes('collector@leadville.example'),
          'Alert content must include customer email'
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should never fail the HTTP response when out-of-band notification fails', async () => {
      process.env.DISCORD_WEBHOOK_STORE_ORDERS =
        'https://discord.com/api/webhooks/failing-endpoint';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: any, init?: any) => {
        if (String(url).includes('failing-endpoint')) {
          return new Response('Webhook Gateway Down', { status: 502 });
        }
        return originalFetch(url, init);
      };

      try {
        const order = mockShopifyOrder(998811);
        const req = createSignedRequest(order, {
          webhookId: 'wh-resilience-test-1',
        });

        const response = await shopifyWebhookHandler(req);
        assert.equal(response.status, 200, 'Edge HTTP response must remain 200 OK');

        const json = await response.json();
        assert.equal(json.received, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ==========================================================================
  // 5. Latency & Performance Guardrail (< 500ms)
  // ==========================================================================
  describe('5. Latency & Performance SLA', () => {
    it('should acknowledge webhook in under 500ms (and attach x-response-time-ms header)', async () => {
      const order = mockShopifyOrder(112244);
      const req = createSignedRequest(order, {
        webhookId: 'wh-latency-benchmark-1',
      });

      const startTime = Date.now();
      const response = await shopifyWebhookHandler(req);
      const totalElapsed = Date.now() - startTime;

      assert.equal(response.status, 200);
      assert.ok(
        totalElapsed < 500,
        `Total edge response time (${totalElapsed}ms) must be < 500ms`
      );

      const headerTime = parseInt(response.headers.get('x-response-time-ms') || '0', 10);
      assert.ok(headerTime < 500, `Recorded time (${headerTime}ms) must be < 500ms`);
    });
  });
});
