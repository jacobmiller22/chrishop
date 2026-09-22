#!/usr/bin/env tsx
/**
 * ChrisShop Webhook Queue Telemetry & Retry Backpressure Verification Script
 *
 * Story 4.29 (#334): Shopify Webhook Queue Telemetry & Retry Backpressure Monitor
 *
 * Validates:
 * 1. Detailed webhook ingestion timing breakdown (HMAC, JSON parse, idempotency, queue) in headers and response body.
 * 2. Idempotency hit/miss ratios and time-series telemetry.
 * 3. Queue batch processing lag and retry backpressure calculations.
 * 4. Automated Discord alert dispatching upon message routing to SHOPIFY_ORDERS_DLQ.
 * 5. Diagnostic metrics exposition via GET /api/webhooks/shopify and /api/health probes.
 *
 * Usage:
 *   pnpm run webhook:telemetry:verify
 *   tsx scripts/verify-webhook-telemetry.ts
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  POST as webhookPostHandler,
  GET as webhookGetHandler,
} from '../apps/web/src/app/api/webhooks/shopify/route';
import {
  handleOrderQueueBatch,
  type OrderQueueMessage,
  type QueueMessage,
  type QueueMessageBatch,
  type OrderConsumerEnv,
} from '../apps/web/src/lib/order-consumer';
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
} from '../apps/web/src/lib/webhook-telemetry';
import { performHealthCheck } from '../apps/web/src/lib/health-monitoring';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const TEST_SECRET = 'whsec_verification_test_secret_334';

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
} {
  const state = { acked: false, retried: false };
  const message: QueueMessage<T> = {
    id,
    timestamp,
    body,
    attempts,
    ack: () => {
      state.acked = true;
    },
    retry: () => {
      state.retried = true;
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
  };
}

async function verifyWebhookTelemetry() {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   ⚡ ChrisShop Webhook Queue Telemetry & DLQ Monitor           ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  clearWebhookTelemetry();

  // --------------------------------------------------------------------------
  // Test 1: Ingestion Timing Breakdown & Headers
  // --------------------------------------------------------------------------
  console.log(`${colors.bold}1. Ingestion Timing Breakdown & Response Headers:${colors.reset}`);
  {
    const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    try {
      process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
      const mockKV = createMockKV();
      (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;
      (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
        send: async () => {},
      };

      const payload = {
        id: 1122334455,
        order_number: 1088,
        total_price: '345.00',
        currency: 'USD',
        line_items: [{ id: 1, title: 'Alpine Chest Rig', quantity: 1, price: '345.00' }],
      };
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', TEST_SECRET).update(rawBody, 'utf8').digest('base64');

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': 'orders/paid',
          'x-shopify-webhook-id': 'wh-test-ingest-01',
        },
        body: rawBody,
      });

      const res = await webhookPostHandler(req);
      assert.equal(res.status, 200, 'Webhook POST must return 200 OK');

      // Assert timing response headers
      assert.ok(res.headers.get('Server-Timing'), 'Must return Server-Timing header');
      assert.ok(res.headers.get('x-hmac-duration-ms'), 'Must return x-hmac-duration-ms header');
      assert.ok(res.headers.get('x-parse-duration-ms'), 'Must return x-parse-duration-ms header');
      assert.ok(res.headers.get('x-idempotency-duration-ms'), 'Must return x-idempotency-duration-ms header');
      assert.ok(res.headers.get('x-queue-duration-ms'), 'Must return x-queue-duration-ms header');
      assert.equal(res.headers.get('x-idempotency-status'), 'miss');

      const body = await res.json();
      assert.equal(body.received, true);
      assert.equal(body.queued, true);
      assert.ok(body.timings, 'Response body must contain timings breakdown');
      assert.ok(typeof body.timings.hmacMs === 'number');
      assert.ok(typeof body.timings.parseMs === 'number');
      assert.ok(typeof body.timings.idempotencyMs === 'number');
      assert.ok(typeof body.timings.queueMs === 'number');
      assert.ok(typeof body.timings.totalMs === 'number');

      console.log(`  ✔ Ingestion timings returned: HMAC=${body.timings.hmacMs}ms, Parse=${body.timings.parseMs}ms, Idempotency=${body.timings.idempotencyMs}ms, Queue=${body.timings.queueMs}ms`);
      console.log(`  ✔ Server-Timing header: "${res.headers.get('Server-Timing')}"`);
    } finally {
      process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
    }
  }

  // --------------------------------------------------------------------------
  // Test 2: Idempotency Gate Telemetry & Replay Disambiguation
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}2. Idempotency Gate Tracking & Replay Hit Metrics:${colors.reset}`);
  {
    const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    try {
      process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
      const payload = { id: 1122334455, order_number: 1088 };
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', TEST_SECRET).update(rawBody, 'utf8').digest('base64');

      // Send the same webhook ID again to trigger idempotency hit
      const replayReq = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': 'orders/paid',
          'x-shopify-webhook-id': 'wh-test-ingest-01',
        },
        body: rawBody,
      });

      const replayRes = await webhookPostHandler(replayReq);
      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.headers.get('x-idempotency-status'), 'hit');

      const replayBody = await replayRes.json();
      assert.equal(replayBody.received, true);
      assert.equal(replayBody.deduplicated, true);
      assert.equal(replayBody.timings.queueMs, 0, 'Deduplicated webhook must bypass queue enqueue');

      const metrics = getWebhookTelemetryMetrics();
      assert.equal(metrics.totalReceived, 2);
      assert.equal(metrics.idempotencyHits, 1);
      assert.equal(metrics.idempotencyMisses, 1);
      assert.equal(metrics.idempotencyHitRate, 50);

      console.log(`  ✔ Replay deduplication verified: Hit Rate = ${metrics.idempotencyHitRate}% (1 hit, 1 miss)`);
    } finally {
      process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
    }
  }

  // --------------------------------------------------------------------------
  // Test 3: Queue Processing Lag & Batch Telemetry
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}3. Queue Consumer Batch Lag & Throughput Calculations:${colors.reset}`);
  {
    // Simulate messages enqueued 250ms and 150ms ago
    const now = Date.now();
    const m1 = createMockQueueMessage(
      { topic: 'orders/create', order: { id: 8001, total_price: '150.00' } },
      1,
      new Date(now - 250)
    );
    const m2 = createMockQueueMessage(
      { topic: 'orders/create', order: { id: 8002, total_price: '220.00' } },
      1,
      new Date(now - 150)
    );

    const batch: QueueMessageBatch<OrderQueueMessage> = {
      queue: 'shopify-orders-queue',
      messages: [m1.message, m2.message],
      ackAll: () => {},
      retryAll: () => {},
    };

    const mockEnv: OrderConsumerEnv = {};
    const batchResult = await handleOrderQueueBatch(batch, mockEnv);

    assert.equal(batchResult.total, 2);
    assert.equal(batchResult.succeeded, 2);
    assert.equal(m1.acked, true);
    assert.equal(m2.acked, true);

    const batchRecords = getBatchRecords();
    assert.ok(batchRecords.length >= 1);
    const lastBatch = batchRecords[batchRecords.length - 1];
    assert.equal(lastBatch.batchSize, 2);
    assert.equal(lastBatch.succeeded, 2);
    assert.ok(lastBatch.avgQueueLagMs >= 140, 'Calculated average queue lag should reflect message age');

    const metrics = getWebhookTelemetryMetrics();
    assert.ok(metrics.averageQueueLagMs >= 140);
    assert.equal(metrics.messagesProcessed, 2);
    assert.equal(metrics.messagesSucceeded, 2);

    console.log(`  ✔ Batch processed 2 messages in ${lastBatch.durationMs}ms (Avg Queue Lag: ${lastBatch.avgQueueLagMs}ms)`);
  }

  // --------------------------------------------------------------------------
  // Test 4: Automated DLQ Alerting & Poison Pill Escalation
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}4. Automated DLQ Alerting & Poison Pill Escalation:${colors.reset}`);
  {
    let capturedDlqPayload: any = null;
    let discordAlertPosted = false;
    let postedDiscordBody: any = null;

    const mockDlq = {
      send: async (msg: any) => {
        capturedDlqPayload = msg;
      },
    };

    // Override global fetch temporarily to intercept Discord alert
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async (url: string, init: any) => {
      if (url.includes('discord')) {
        discordAlertPosted = true;
        postedDiscordBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return originalFetch(url, init);
    };

    try {
      const poisonMessage = createMockQueueMessage(
        {
          topic: 'orders/create',
          order: { id: 99999, order_number: 'POISON-01', total_price: '999.00' },
          eventId: 'evt-poison-pill-01',
        },
        3 // attempts = maxRetries (3)
      );

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [poisonMessage.message],
        ackAll: () => {},
        retryAll: () => {},
      };

      const mockEnv: OrderConsumerEnv = {
        SHOPIFY_ORDERS_DLQ: mockDlq,
        OPS_ALERT_WEBHOOK_URL: 'https://discord.com/api/webhooks/test/orders',
      };

      // Pass options that cause order processing failure
      const batchResult = await handleOrderQueueBatch(batch, mockEnv, null, {
        maxRetries: 3,
        resendProvider: {
          notifyOrderReceipt: async () => ({
            success: false,
            error: 'Fatal database corruption on receipt generator',
          }),
          notifyMerchantOrderAlert: async () => ({
            success: false,
            error: 'Merchant email unreachable',
          }),
          notifyLowStockAlert: async () => ({ success: true }),
          notifyShippingUpdate: async () => ({ success: true }),
        } as any,
      });

      assert.equal(batchResult.deadLettered, 1, 'Should record dead lettered message');
      assert.equal(poisonMessage.acked, true, 'Poison pill must be acknowledged from primary queue');
      assert.ok(capturedDlqPayload, 'Message must be enqueued to SHOPIFY_ORDERS_DLQ');
      assert.equal(capturedDlqPayload.originalMessageId, poisonMessage.message.id);

      assert.equal(discordAlertPosted, true, 'Must trigger immediate Discord alert upon DLQ routing');
      assert.ok(postedDiscordBody.content.includes('CRITICAL DLQ ALERT'));
      assert.ok(postedDiscordBody.content.includes('POISON-01'));

      const dlqRecords = getDlqRecords();
      assert.equal(dlqRecords.length, 1);
      assert.equal(dlqRecords[0].alertDispatched, true);

      const metrics = getWebhookTelemetryMetrics();
      assert.equal(metrics.dlqDepth, 1);
      assert.equal(metrics.healthStatus, 'unhealthy', 'DLQ presence must set health status to unhealthy');

      console.log('  ✔ Poison pill routed to SHOPIFY_ORDERS_DLQ and acknowledged from active queue');
      console.log(`  ✔ Automated Discord alert dispatched to ${mockEnv.OPS_ALERT_WEBHOOK_URL}`);
      console.log(`  ✔ Pipeline health updated to: ${colors.red}${metrics.healthStatus}${colors.reset} (DLQ depth: ${metrics.dlqDepth})`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // Test 5: Operational Endpoints & Health Diagnostic Probes
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}5. Diagnostic Telemetry API & Health Probe Integration:${colors.reset}`);
  {
    // 5a. GET /api/webhooks/shopify
    const getReq = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
      method: 'GET',
    });
    const getRes = await webhookGetHandler(getReq);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('x-webhook-dlq-depth'), '1');
    assert.equal(getRes.headers.get('x-webhook-idempotency-rate'), '50');

    const getData = await getRes.json();
    assert.equal(getData.ok, true);
    assert.equal(getData.service, 'shopify-webhook-pipeline');
    assert.equal(getData.metrics.dlqDepth, 1);
    console.log('  ✔ GET /api/webhooks/shopify returned real-time pipeline telemetry');

    // 5b. Health Check Probe with DLQ accumulation
    const { payload, httpStatus } = await performHealthCheck();
    assert.equal(httpStatus, 503, 'Health check should return 503 when DLQ messages exist');
    assert.equal(payload.status, 'unhealthy');
    assert.ok(payload.probes.webhook, 'Health payload must include webhook probe');
    assert.equal(payload.probes.webhook?.status, 'unhealthy');
    assert.ok(payload.probes.webhook?.error?.includes('DLQ accumulation detected'));
    assert.ok(payload.webhookTelemetry, 'Payload must include webhookTelemetry metrics');
    console.log(`  ✔ /api/health correctly detected DLQ backpressure and reported HTTP 503 unhealthy`);

    // 5c. Recover health after clearing DLQ
    clearWebhookTelemetry();
    const recovered = await performHealthCheck();
    assert.equal(recovered.httpStatus, 200, 'Health check should recover to 200 when DLQ is clear');
    assert.equal(recovered.payload.probes.webhook?.status, 'healthy');
    console.log('  ✔ /api/health restored to HTTP 200 healthy when DLQ is cleared');
  }

  console.log(`\n${colors.bold}${colors.green}✔ All Webhook Queue Telemetry & DLQ Monitor verification checks passed!${colors.reset}\n`);
}

verifyWebhookTelemetry().catch((err) => {
  console.error(`\n${colors.bold}${colors.red}❌ Verification Failed:${colors.reset}`, err);
  process.exit(1);
});
