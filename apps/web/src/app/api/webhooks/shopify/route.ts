import { NextRequest, NextResponse } from 'next/server';
import {
  processOrderEvent,
  type OrderConsumerEnv,
} from '../../../../lib/order-consumer';
import {
  checkAndSetIdempotency,
  verifyShopifyWebhookHmacSubtle,
} from '../../../../lib/shopify-webhook';
import {
  extractTraceHeaders,
  runWithTraceContext,
  withTraceHeaders,
} from '../../../../lib/tracing';
import { recordFunnelEvent } from '../../../../lib/funnel-telemetry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/shopify
 *
 * Edge Ingestion Endpoint for Shopify Order Lifecycle Events (orders/create, orders/paid).
 * Preserves raw request stream for cryptographic HMAC-SHA256 signature verification,
 * enforces an idempotency gate (SET order_webhook:<id> EX 86400 NX) to prevent duplicate
 * processing or alert spamming, and returns HTTP 200 OK fast (< 500ms).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const trace = extractTraceHeaders(req);

  return runWithTraceContext(trace, async () => {
    // 1. Extract raw stream as text BEFORE any JSON parsing (preserves HMAC integrity)
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      const res = NextResponse.json(
        { error: 'Failed to read request body' },
        { status: 400 }
      );
      return withTraceHeaders(res, trace);
    }

    // 2. Cryptographic HMAC-SHA256 Verification via Web Crypto API (crypto.subtle)
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (secret) {
      const isValidHmac = await verifyShopifyWebhookHmacSubtle(rawBody, hmacHeader, secret);
      if (!isValidHmac) {
        console.warn('[ShopifyWebhook:Unauthorized] HMAC signature verification failed');
        const res = NextResponse.json(
          { error: 'Unauthorized: Invalid webhook signature' },
          { status: 401 }
        );
        return withTraceHeaders(res, trace);
      }
    }

    // 3. Parse Webhook Payload & Headers
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      const res = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      return withTraceHeaders(res, trace);
    }

    const topic = req.headers.get('x-shopify-topic') || (payload.topic as string) || 'orders/create';
    const webhookId =
      req.headers.get('x-shopify-webhook-id') ||
      (payload.id as string | number) ||
      `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 4. Idempotency Gate (order_webhook:<id> with 24h TTL)
    const kv =
      (globalThis as Record<string, unknown>).NEXT_CACHE_WORKERS_KV ||
      (globalThis as Record<string, unknown>).KV;

    const { isDuplicate } = await checkAndSetIdempotency(String(webhookId), kv);
    if (isDuplicate) {
      const durationMs = Date.now() - startTime;
      const res = NextResponse.json(
        {
          received: true,
          deduplicated: true,
          topic,
          webhookId: String(webhookId),
          durationMs,
          message: 'Webhook event already processed (idempotency key matched)',
        },
        {
          status: 200,
          headers: {
            'x-response-time-ms': String(durationMs),
            'x-idempotency-status': 'hit',
          },
        }
      );
      return withTraceHeaders(res, trace);
    }

    // 5. Stage 6: Shopify Order Paid / Completed Funnel Telemetry (order_completed)
    if (topic === 'orders/paid' || topic === 'orders/create') {
      try {
        const lineItems = (payload.line_items as any[]) || [];
        const firstLine = lineItems[0];
        recordFunnelEvent({
          event_name: 'order_completed',
          drop_id: 'bankbeaters-leadville',
          product_id: firstLine?.product_id ? String(firstLine.product_id) : String(payload.id || webhookId),
          variant_id: firstLine?.variant_id ? String(firstLine.variant_id) : undefined,
          correlation_id: trace.requestId || String(webhookId),
          outcome: 'success',
          metadata: {
            webhookId: String(webhookId),
            topic,
            orderId: payload.id,
            orderNumber: payload.order_number,
            totalPrice: payload.total_price,
            currency: payload.currency,
          },
        });
      } catch {
        // Non-blocking telemetry error
      }
    }

    // 6. Resolve Runtime Queue & Environment
    const cloudflareEnv: OrderConsumerEnv = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM,
      MERCHANT_ALERT_EMAIL: process.env.MERCHANT_ALERT_EMAIL,
      OPS_ALERT_WEBHOOK_URL:
        process.env.DISCORD_WEBHOOK_STORE_ORDERS ||
        process.env.DISCORD_WEBHOOK_ORDERS ||
        process.env.DISCORD_WEBHOOK_URL ||
        process.env.OPS_ALERT_WEBHOOK_URL,
      SHOPIFY_ORDERS_QUEUE: (globalThis as Record<string, unknown>).SHOPIFY_ORDERS_QUEUE as OrderConsumerEnv['SHOPIFY_ORDERS_QUEUE'],
      SHOPIFY_ORDERS_DLQ: (globalThis as Record<string, unknown>).SHOPIFY_ORDERS_DLQ as OrderConsumerEnv['SHOPIFY_ORDERS_DLQ'],
      NEXT_CACHE_WORKERS_KV: kv,
    };

    let queued = false;

    // 6. Asynchronous Offloading: Queue or Isolated Background Execution
    if (
      cloudflareEnv.SHOPIFY_ORDERS_QUEUE &&
      typeof cloudflareEnv.SHOPIFY_ORDERS_QUEUE.send === 'function'
    ) {
      try {
        await cloudflareEnv.SHOPIFY_ORDERS_QUEUE.send({
          topic,
          order: payload,
          eventId: String(webhookId),
          timestamp: new Date().toISOString(),
        });
        queued = true;
      } catch (queueErr) {
        console.error('[ShopifyWebhook:QueueError] Failed to enqueue to SHOPIFY_ORDERS_QUEUE:', queueErr);
        // Fallback to isolated background execution
        void processOrderEvent(
          { topic, order: payload as any, eventId: String(webhookId) },
          cloudflareEnv
        ).catch((err) => {
          console.error('[ShopifyWebhook:BackgroundFallbackError]', err);
        });
      }
    } else {
      // Direct or local development mode: dispatch out-of-band without blocking edge response
      void processOrderEvent(
        { topic, order: payload as any, eventId: String(webhookId) },
        cloudflareEnv
      ).catch((err) => {
        console.error('[ShopifyWebhook:DirectAsyncError]', err);
      });
    }

    const durationMs = Date.now() - startTime;

    // 7. Fast Acknowledgement (HTTP 200 OK returned immediately)
    const res = NextResponse.json(
      {
        received: true,
        queued,
        topic,
        webhookId: String(webhookId),
        durationMs,
      },
      {
        status: 200,
        headers: {
          'x-response-time-ms': String(durationMs),
          'x-idempotency-status': 'miss',
        },
      }
    );
    return withTraceHeaders(res, trace);
  });
}
