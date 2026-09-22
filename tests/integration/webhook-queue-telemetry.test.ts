/**
 * ChrisShop Integration Test Suite: Shopify Webhook Queue Telemetry & Retry Backpressure Monitor
 *
 * Story 4.29 (#334): Shopify Webhook Queue Telemetry & Retry Backpressure Monitor
 *
 * Validates:
 * 1. Detailed webhook ingestion timing instrumentation (HMAC, parse, idempotency, queue) in headers and body.
 * 2. Idempotency gate tracking, replay deduplication, and hit-rate percentage calculation.
 * 3. Queue consumer batch lag and retry backpressure telemetry.
 * 4. Automated Discord alerting upon message routing to SHOPIFY_ORDERS_DLQ.
 * 5. Workers Analytics Engine sink formatting (WEBHOOK_ANALYTICS).
 * 6. Edge Ingestion Diagnostic API (GET /api/webhooks/shopify) and /api/health probe integration.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  POST as webhookPostHandler,
  GET as webhookGetHandler,
} from '../../apps/web/src/app/api/webhooks/shopify/route';
import {
  handleOrderQueueBatch,
  type OrderQueueMessage,
  type QueueMessage,
  type QueueMessageBatch,
  type OrderConsumerEnv,
} from '../../apps/web/src/lib/order-consumer';
import {
  getWebhookTelemetryMetrics,
  clearWebhookTelemetry,
  dispatchDlqAlert,
  formatServerTimingHeader,
  getDlqRecords,
  getIngestionRecords,
  getBatchRecords,
  writeToWebhookAnalyticsEngine,
  onWebhookTelemetryEvent,
  type WebhookIngestionTimings,
} from '../../apps/web/src/lib/webhook-telemetry';
import { performHealthCheck } from '../../apps/web/src/lib/health-monitoring';

const TEST_SECRET = 'whsec_integration_test_secret_story_429';

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
  };
}

function createMockQueueMessage<T>(
  body: T,
  attempts: number = 1,
  timestamp: Date = new Date(),
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
    timestamp,
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

describe('Story 4.29: Shopify Webhook Queue Telemetry & Retry Backpressure Monitor', () => {
  beforeEach(() => {
    clearWebhookTelemetry();
  });

  describe('1. Webhook Ingestion Timing & Response Headers', () => {
    it('should return microsecond-accurate timing breakdown in headers and response body', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        const mockKV = createMockKV();
        (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;
        (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
          send: async () => {},
        };

        const payload = {
          id: 445566,
          order_number: 1099,
          total_price: '450.00',
          currency: 'USD',
          line_items: [{ id: 10, title: 'Alpine Rig Gen3', quantity: 1, price: '450.00' }],
        };
        const rawBody = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', TEST_SECRET).update(rawBody, 'utf8').digest('base64');

        const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': hmac,
            'x-shopify-topic': 'orders/create',
            'x-shopify-webhook-id': 'wh-timing-test-001',
          },
          body: rawBody,
        });

        const res = await webhookPostHandler(req);
        assert.equal(res.status, 200);

        // Headers
        const serverTiming = res.headers.get('Server-Timing');
        assert.ok(serverTiming, 'Server-Timing header must exist');
        assert.ok(serverTiming.includes('hmac;dur='));
        assert.ok(serverTiming.includes('parse;dur='));
        assert.ok(serverTiming.includes('idem;dur='));
        assert.ok(serverTiming.includes('queue;dur='));
        assert.ok(serverTiming.includes('total;dur='));

        assert.ok(res.headers.get('x-hmac-duration-ms'));
        assert.ok(res.headers.get('x-parse-duration-ms'));
        assert.ok(res.headers.get('x-idempotency-duration-ms'));
        assert.ok(res.headers.get('x-queue-duration-ms'));
        assert.equal(res.headers.get('x-idempotency-status'), 'miss');

        const body = await res.json();
        assert.equal(body.received, true);
        assert.equal(body.queued, true);
        assert.ok(body.timings);
        assert.ok(typeof body.timings.hmacMs === 'number');
        assert.ok(typeof body.timings.parseMs === 'number');
        assert.ok(typeof body.timings.idempotencyMs === 'number');
        assert.ok(typeof body.timings.queueMs === 'number');
        assert.ok(typeof body.timings.totalMs === 'number');
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
      }
    });

    it('should format Server-Timing header correctly via helper', () => {
      const sampleTimings: WebhookIngestionTimings = {
        hmacMs: 1.25,
        parseMs: 0.45,
        idempotencyMs: 2.1,
        queueMs: 3.8,
        totalMs: 7.6,
      };

      const formatted = formatServerTimingHeader(sampleTimings);
      assert.equal(
        formatted,
        'hmac;dur=1.25, parse;dur=0.45, idem;dur=2.10, queue;dur=3.80, total;dur=7.60'
      );
    });
  });

  describe('2. Idempotency Gate Telemetry & Replay Disambiguation', () => {
    it('should track idempotency hit rates and bypass queue on repeated webhook IDs', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        const mockKV = createMockKV();
        (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;
        let queueSendCount = 0;
        (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
          send: async () => {
            queueSendCount++;
          },
        };

        const payload = { id: 778899, order_number: 1100 };
        const rawBody = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', TEST_SECRET).update(rawBody, 'utf8').digest('base64');

        // First attempt (miss)
        const req1 = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': hmac,
            'x-shopify-topic': 'orders/create',
            'x-shopify-webhook-id': 'wh-idem-test-99',
          },
          body: rawBody,
        });
        const res1 = await webhookPostHandler(req1);
        assert.equal(res1.status, 200);
        assert.equal(res1.headers.get('x-idempotency-status'), 'miss');
        assert.equal(queueSendCount, 1);

        // Second attempt (hit)
        const req2 = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-hmac-sha256': hmac,
            'x-shopify-topic': 'orders/create',
            'x-shopify-webhook-id': 'wh-idem-test-99',
          },
          body: rawBody,
        });
        const res2 = await webhookPostHandler(req2);
        assert.equal(res2.status, 200);
        assert.equal(res2.headers.get('x-idempotency-status'), 'hit');
        assert.equal(queueSendCount, 1, 'Queue send must not be called again on replay');

        const body2 = await res2.json();
        assert.equal(body2.deduplicated, true);
        assert.equal(body2.timings.queueMs, 0);

        const metrics = getWebhookTelemetryMetrics();
        assert.equal(metrics.totalReceived, 2);
        assert.equal(metrics.idempotencyHits, 1);
        assert.equal(metrics.idempotencyMisses, 1);
        assert.equal(metrics.idempotencyHitRate, 50);
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
      }
    });
  });

  describe('3. Queue Processing Lag & Batch Telemetry', () => {
    it('should calculate queue lag and record batch processing statistics', async () => {
      const now = Date.now();
      const m1 = createMockQueueMessage(
        { topic: 'orders/create', order: { id: 101, total_price: '100.00' } },
        1,
        new Date(now - 300)
      );
      const m2 = createMockQueueMessage(
        { topic: 'orders/create', order: { id: 102, total_price: '200.00' } },
        1,
        new Date(now - 100)
      );

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [m1.message, m2.message],
        ackAll: () => {},
        retryAll: () => {},
      };

      const result = await handleOrderQueueBatch(batch, {});
      assert.equal(result.total, 2);
      assert.equal(result.succeeded, 2);

      const records = getBatchRecords();
      assert.equal(records.length, 1);
      const batchRec = records[0];
      assert.equal(batchRec.batchSize, 2);
      assert.equal(batchRec.succeeded, 2);
      assert.equal(batchRec.retried, 0);
      assert.equal(batchRec.deadLettered, 0);
      assert.ok(batchRec.avgQueueLagMs >= 100);

      const metrics = getWebhookTelemetryMetrics();
      assert.equal(metrics.batchesProcessed, 1);
      assert.equal(metrics.messagesProcessed, 2);
      assert.equal(metrics.messagesSucceeded, 2);
      assert.ok(metrics.averageQueueLagMs >= 100);
      assert.equal(metrics.healthStatus, 'healthy');
    });
  });

  describe('4. Automated DLQ Alerting & Poison Pill Escalation', () => {
    it('should route poison pill to DLQ, dispatch automated Discord alert, and update health status to unhealthy', async () => {
      let dlqPayload: any = null;
      let discordAlertReceived = false;
      let discordAlertBody: any = null;

      const originalFetch = globalThis.fetch;
      (globalThis as any).fetch = async (url: string, init: any) => {
        if (url.includes('discord')) {
          discordAlertReceived = true;
          discordAlertBody = JSON.parse(init.body);
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return originalFetch(url, init);
      };

      try {
        const poison = createMockQueueMessage<OrderQueueMessage>(
          {
            topic: 'orders/create',
            order: { id: 8888, order_number: 'POISON-TEST', total_price: '500.00' },
            eventId: 'evt-poison-999',
          },
          3 // Max retries reached
        );

        const batch: QueueMessageBatch<OrderQueueMessage> = {
          queue: 'shopify-orders-queue',
          messages: [poison.message],
        };

        const env: OrderConsumerEnv = {
          SHOPIFY_ORDERS_DLQ: {
            send: async (msg: any) => {
              dlqPayload = msg;
            },
          },
          OPS_ALERT_WEBHOOK_URL: 'https://discord.com/api/webhooks/ops/dlq-alerts',
        };

        const result = await handleOrderQueueBatch(batch, env, null, {
          maxRetries: 3,
          resendProvider: {
            notifyOrderReceipt: async () => ({
              success: false,
              error: 'Downstream payment gateway unreachable (500)',
            }),
            notifyMerchantOrderAlert: async () => ({ success: false, error: 'Network timeout' }),
            notifyLowStockAlert: async () => ({ success: true }),
            notifyShippingUpdate: async () => ({ success: true }),
          } as any,
        });

        assert.equal(result.deadLettered, 1);
        assert.equal(poison.acked, true, 'Poison pill must be acknowledged from primary queue');
        assert.ok(dlqPayload, 'Payload must be sent to SHOPIFY_ORDERS_DLQ');
        assert.equal(dlqPayload.originalMessageId, poison.message.id);

        assert.equal(discordAlertReceived, true, 'Automated Discord alert must be triggered');
        assert.ok(discordAlertBody.content.includes('CRITICAL DLQ ALERT'));
        assert.ok(discordAlertBody.content.includes('POISON-TEST'));

        const dlqRecords = getDlqRecords();
        assert.equal(dlqRecords.length, 1);
        assert.equal(dlqRecords[0].alertDispatched, true);

        const metrics = getWebhookTelemetryMetrics();
        assert.equal(metrics.dlqDepth, 1);
        assert.equal(metrics.healthStatus, 'unhealthy');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format and dispatch standalone DLQ alert via dispatchDlqAlert', async () => {
      let alertCaptured: any = null;
      const originalFetch = globalThis.fetch;
      (globalThis as any).fetch = async (url: string, init: any) => {
        alertCaptured = JSON.parse(init.body);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      try {
        const sent = await dispatchDlqAlert(
          {
            originalMessageId: 'msg-direct-dlq-001',
            payload: { id: 9911, order_number: 'DIRECT-01' },
            error: 'Test simulated poison pill',
            attempts: 3,
          },
          'https://discord.com/api/webhooks/test'
        );

        assert.equal(sent, true);
        assert.ok(alertCaptured);
        assert.ok(alertCaptured.content.includes('msg-direct-dlq-001'));
        assert.ok(alertCaptured.content.includes('DIRECT-01'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('5. Workers Analytics Engine Sink Dispatching', () => {
    it('should format data points for Workers Analytics Engine', () => {
      let writtenData: any = null;
      const mockEnv = {
        WEBHOOK_ANALYTICS: {
          writeDataPoint: (data: any) => {
            writtenData = data;
          },
        },
      };

      const ok = writeToWebhookAnalyticsEngine(
        {
          type: 'ingestion',
          key: 'orders/create',
          status: 'miss',
          durationMs: 4.5,
          lagMs: 0,
          correlationId: 'trace-wh-001',
        },
        mockEnv
      );

      assert.equal(ok, true);
      assert.ok(writtenData);
      assert.deepEqual(writtenData.blobs, ['ingestion', 'orders/create', 'miss', 'trace-wh-001']);
      assert.deepEqual(writtenData.indexes, ['ingestion', 'miss']);
    });

    it('should gracefully return false when Analytics Engine binding is missing', () => {
      const ok = writeToWebhookAnalyticsEngine(
        {
          type: 'batch',
          key: 'batch-001',
          status: 'clean',
          durationMs: 2.1,
        },
        {}
      );
      assert.equal(ok, false);
    });
  });

  describe('6. Diagnostic API & Health Probe Integration', () => {
    it('should serve webhook metrics via GET /api/webhooks/shopify', async () => {
      clearWebhookTelemetry();

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'GET',
      });
      const res = await webhookGetHandler(req);

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('x-webhook-dlq-depth'));
      assert.ok(res.headers.get('x-webhook-idempotency-rate'));
      assert.ok(res.headers.get('x-webhook-queue-lag-ms'));

      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.service, 'shopify-webhook-pipeline');
      assert.ok(data.metrics);
      assert.equal(data.metrics.healthStatus, 'healthy');
    });

    it('should include webhook probe in /api/health and report unhealthy if DLQ messages exist', async () => {
      clearWebhookTelemetry();

      // Normal baseline
      const baseline = await performHealthCheck();
      assert.equal(baseline.httpStatus, 200);
      assert.equal(baseline.payload.probes.webhook?.status, 'healthy');

      // Inject poison pill in DLQ
      const poison = createMockQueueMessage<OrderQueueMessage>(
        { topic: 'orders/create', order: { id: 555 } },
        3
      );
      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [poison.message],
      };
      await handleOrderQueueBatch(batch, {}, null, {
        maxRetries: 3,
        resendProvider: {
          notifyOrderReceipt: async () => ({ success: false, error: 'Database fail' }),
          notifyMerchantOrderAlert: async () => ({ success: false }),
        } as any,
      });

      // Degraded health check
      const degraded = await performHealthCheck();
      assert.equal(degraded.httpStatus, 503);
      assert.equal(degraded.payload.status, 'unhealthy');
      assert.equal(degraded.payload.probes.webhook?.status, 'unhealthy');
      assert.ok(degraded.payload.webhookTelemetry);
      assert.equal(degraded.payload.webhookTelemetry?.dlqDepth, 1);
    });
  });
});
