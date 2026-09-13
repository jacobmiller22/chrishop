import { NextRequest, NextResponse } from 'next/server';
import {
  processOrderEvent,
  verifyShopifyWebhookHmac,
  type OrderConsumerEnv,
} from '../../../../lib/order-consumer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/shopify
 *
 * Edge Ingestion Endpoint for Shopify Order Lifecycle Events (orders/create, orders/paid).
 * Ensures fast acknowledgement (< 100ms) by enqueueing verified payloads to SHOPIFY_ORDERS_QUEUE
 * or dispatching out-of-band so notification dispatch failures never fail the edge HTTP response.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // 1. Extract raw stream as text BEFORE any JSON parsing (preserves HMAC integrity)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body' },
      { status: 400 }
    );
  }

  // 2. Cryptographic HMAC-SHA256 Verification
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (secret && !verifyShopifyWebhookHmac(rawBody, hmacHeader, secret)) {
    console.warn('[ShopifyWebhook:Unauthorized] HMAC signature verification failed');
    return NextResponse.json(
      { error: 'Unauthorized: Invalid webhook signature' },
      { status: 401 }
    );
  }

  // 3. Parse Webhook Payload & Headers
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const topic = req.headers.get('x-shopify-topic') || (payload.topic as string) || 'orders/create';
  const webhookId = req.headers.get('x-shopify-webhook-id') || (payload.id as string | number);

  // 4. Resolve Runtime Queue & Environment
  const cloudflareEnv: OrderConsumerEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM,
    MERCHANT_ALERT_EMAIL: process.env.MERCHANT_ALERT_EMAIL,
    OPS_ALERT_WEBHOOK_URL: process.env.OPS_ALERT_WEBHOOK_URL,
    SHOPIFY_ORDERS_QUEUE: (globalThis as Record<string, unknown>).SHOPIFY_ORDERS_QUEUE as OrderConsumerEnv['SHOPIFY_ORDERS_QUEUE'],
    SHOPIFY_ORDERS_DLQ: (globalThis as Record<string, unknown>).SHOPIFY_ORDERS_DLQ as OrderConsumerEnv['SHOPIFY_ORDERS_DLQ'],
  };

  let queued = false;

  // 5. Asynchronous Offloading: Queue or Isolated Background Execution
  if (cloudflareEnv.SHOPIFY_ORDERS_QUEUE && typeof cloudflareEnv.SHOPIFY_ORDERS_QUEUE.send === 'function') {
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

  // 6. Fast Acknowledgement (HTTP 200 OK returned immediately)
  return NextResponse.json(
    {
      received: true,
      queued,
      topic,
      webhookId,
      durationMs,
    },
    {
      status: 200,
      headers: {
        'x-response-time-ms': String(durationMs),
      },
    }
  );
}
