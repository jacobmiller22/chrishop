/**
 * ChrisShop Shopify Webhook Queue Telemetry & Retry Backpressure Monitor
 *
 * Story 4.29 (#334): Shopify Webhook Queue Telemetry & Retry Backpressure Monitor
 *
 * Provides:
 * 1. Detailed webhook ingestion timing instrumentation (HMAC verification, JSON parsing,
 *    KV idempotency lookup, queue enqueue duration) and Server-Timing header generation.
 * 2. Idempotency hit/miss ratios, queue enqueue tracking, and batch processing duration telemetry.
 * 3. Queue processing lag calculations (message arrival -> processing start).
 * 4. Automated Discord alerting when messages land in SHOPIFY_ORDERS_DLQ.
 * 5. Workers Analytics Engine sink integration (WEBHOOK_ANALYTICS).
 * 6. Webhook pipeline health assessment for /api/health probes.
 */

import { getCurrentTraceContext } from './tracing';

export interface WebhookIngestionTimings {
  hmacMs: number;
  parseMs: number;
  idempotencyMs: number;
  queueMs: number;
  totalMs: number;
}

export interface WebhookIngestionRecord {
  webhookId: string;
  topic: string;
  idempotencyStatus: 'hit' | 'miss';
  queued: boolean;
  timings: WebhookIngestionTimings;
  correlationId: string;
  timestamp: number;
}

export interface QueueBatchProcessingRecord {
  batchId: string;
  batchSize: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
  durationMs: number;
  avgQueueLagMs: number;
  timestamp: number;
}

export interface DlqArrivalRecord {
  originalMessageId: string;
  payload?: any;
  error: string;
  attempts: number;
  failedAt: string;
  alertDispatched: boolean;
  timestamp: number;
}

export interface WebhookPipelineTelemetryMetrics {
  totalReceived: number;
  idempotencyHits: number;
  idempotencyMisses: number;
  idempotencyHitRate: number;
  enqueuedCount: number;
  directProcessedCount: number;
  queueFailures: number;
  batchesProcessed: number;
  messagesProcessed: number;
  messagesSucceeded: number;
  messagesRetried: number;
  messagesDeadLettered: number;
  dlqDepth: number;
  averageQueueLagMs: number;
  averageBatchDurationMs: number;
  lastIngestionTimestamp: number | null;
  lastBatchTimestamp: number | null;
  lastDlqTimestamp: number | null;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export type WebhookTelemetryListener = (event: {
  type: 'ingestion' | 'batch_processed' | 'dlq_arrival';
  data: WebhookIngestionRecord | QueueBatchProcessingRecord | DlqArrivalRecord;
}) => void;

// In-memory rolling ring buffers (isolated per worker lifecycle)
const INGESTION_BUFFER_LIMIT = 1000;
const BATCH_BUFFER_LIMIT = 1000;
const DLQ_BUFFER_LIMIT = 500;

const ingestionBuffer: WebhookIngestionRecord[] = [];
const batchBuffer: QueueBatchProcessingRecord[] = [];
const dlqBuffer: DlqArrivalRecord[] = [];
const telemetryListeners: WebhookTelemetryListener[] = [];

/**
 * Generates W3C Server-Timing header formatted string from ingestion timings.
 */
export function formatServerTimingHeader(timings: WebhookIngestionTimings): string {
  return [
    `hmac;dur=${timings.hmacMs.toFixed(2)}`,
    `parse;dur=${timings.parseMs.toFixed(2)}`,
    `idem;dur=${timings.idempotencyMs.toFixed(2)}`,
    `queue;dur=${timings.queueMs.toFixed(2)}`,
    `total;dur=${timings.totalMs.toFixed(2)}`,
  ].join(', ');
}

/**
 * Registers an observer callback for webhook telemetry events.
 */
export function onWebhookTelemetryEvent(listener: WebhookTelemetryListener): () => void {
  telemetryListeners.push(listener);
  return () => {
    const idx = telemetryListeners.indexOf(listener);
    if (idx !== -1) telemetryListeners.splice(idx, 1);
  };
}

/**
 * Notifies all registered listeners.
 */
function emitTelemetryEvent(
  type: 'ingestion' | 'batch_processed' | 'dlq_arrival',
  data: any
): void {
  for (const listener of telemetryListeners) {
    try {
      listener({ type, data });
    } catch (err) {
      console.error('[WebhookTelemetry:ListenerError]', err);
    }
  }
}

/**
 * Writes webhook event to Cloudflare Workers Analytics Engine if bound.
 */
export function writeToWebhookAnalyticsEngine(
  record: {
    type: 'ingestion' | 'batch' | 'dlq';
    key: string;
    status: string;
    durationMs: number;
    lagMs?: number;
    correlationId?: string;
  },
  env?: Record<string, any>
): boolean {
  try {
    const g = globalThis as Record<string, any>;
    const analyticsEngine =
      env?.WEBHOOK_ANALYTICS ||
      env?.ANALYTICS_ENGINE ||
      g.WEBHOOK_ANALYTICS ||
      g.ANALYTICS_ENGINE;

    if (analyticsEngine && typeof analyticsEngine.writeDataPoint === 'function') {
      analyticsEngine.writeDataPoint({
        blobs: [
          record.type,
          record.key,
          record.status,
          record.correlationId || 'unknown',
        ],
        doubles: [
          record.durationMs,
          record.lagMs || 0,
          Date.now(),
        ],
        indexes: [record.type, record.status],
      });
      return true;
    }
  } catch (err) {
    console.error('[WebhookTelemetry:AnalyticsEngineError]', err);
  }
  return false;
}

/**
 * Records an incoming webhook ingestion measurement.
 */
export function recordWebhookIngestion(
  input: Omit<WebhookIngestionRecord, 'timestamp'> & { timestamp?: number },
  env?: Record<string, any>
): WebhookIngestionRecord {
  const timestamp = input.timestamp || Date.now();
  const trace = getCurrentTraceContext();
  const correlationId = input.correlationId || trace?.requestId || `wh-${timestamp}`;

  const record: WebhookIngestionRecord = {
    webhookId: input.webhookId,
    topic: input.topic,
    idempotencyStatus: input.idempotencyStatus,
    queued: input.queued,
    timings: input.timings,
    correlationId,
    timestamp,
  };

  if (ingestionBuffer.length >= INGESTION_BUFFER_LIMIT) {
    ingestionBuffer.shift();
  }
  ingestionBuffer.push(record);

  // Structured Log
  try {
    const logData = JSON.stringify({
      telemetry: 'webhook_ingestion',
      webhookId: record.webhookId,
      topic: record.topic,
      idempotency: record.idempotencyStatus,
      queued: record.queued,
      timings: record.timings,
      correlationId: record.correlationId,
      timestamp: record.timestamp,
    });
    console.log(`[WebhookTelemetry:Ingestion] ${logData}`);
  } catch {
    // Non-fatal logging failure
  }

  // Analytics Engine Sink
  writeToWebhookAnalyticsEngine(
    {
      type: 'ingestion',
      key: record.topic,
      status: record.idempotencyStatus,
      durationMs: record.timings.totalMs,
      correlationId: record.correlationId,
    },
    env
  );

  emitTelemetryEvent('ingestion', record);
  return record;
}

/**
 * Records queue batch processing outcome and queue latency metrics.
 */
export function recordQueueBatchProcessing(
  input: Omit<QueueBatchProcessingRecord, 'batchId' | 'timestamp'> & {
    batchId?: string;
    timestamp?: number;
  },
  env?: Record<string, any>
): QueueBatchProcessingRecord {
  const timestamp = input.timestamp || Date.now();
  const batchId =
    input.batchId || `batch-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

  const record: QueueBatchProcessingRecord = {
    batchId,
    batchSize: input.batchSize,
    succeeded: input.succeeded,
    retried: input.retried,
    deadLettered: input.deadLettered,
    durationMs: input.durationMs,
    avgQueueLagMs: input.avgQueueLagMs,
    timestamp,
  };

  if (batchBuffer.length >= BATCH_BUFFER_LIMIT) {
    batchBuffer.shift();
  }
  batchBuffer.push(record);

  // Structured Log
  try {
    const logData = JSON.stringify({
      telemetry: 'webhook_queue_batch',
      batchId: record.batchId,
      batchSize: record.batchSize,
      succeeded: record.succeeded,
      retried: record.retried,
      deadLettered: record.deadLettered,
      durationMs: record.durationMs,
      avgLagMs: record.avgQueueLagMs,
      timestamp: record.timestamp,
    });
    console.log(`[WebhookTelemetry:BatchProcessed] ${logData}`);
  } catch {
    // Non-fatal
  }

  writeToWebhookAnalyticsEngine(
    {
      type: 'batch',
      key: batchId,
      status: record.deadLettered > 0 ? 'dlq_present' : record.retried > 0 ? 'retries_present' : 'clean',
      durationMs: record.durationMs,
      lagMs: record.avgQueueLagMs,
    },
    env
  );

  emitTelemetryEvent('batch_processed', record);
  return record;
}

/**
 * Records an arrival of a poison pill message in the Dead-Letter Queue (DLQ).
 */
export function recordDlqArrival(
  input: Omit<DlqArrivalRecord, 'timestamp'> & { timestamp?: number },
  env?: Record<string, any>
): DlqArrivalRecord {
  const timestamp = input.timestamp || Date.now();

  const record: DlqArrivalRecord = {
    originalMessageId: input.originalMessageId,
    payload: input.payload,
    error: input.error,
    attempts: input.attempts,
    failedAt: input.failedAt,
    alertDispatched: input.alertDispatched,
    timestamp,
  };

  if (dlqBuffer.length >= DLQ_BUFFER_LIMIT) {
    dlqBuffer.shift();
  }
  dlqBuffer.push(record);

  writeToWebhookAnalyticsEngine(
    {
      type: 'dlq',
      key: input.originalMessageId,
      status: 'poison_pill',
      durationMs: 0,
    },
    env
  );

  emitTelemetryEvent('dlq_arrival', record);
  return record;
}

/**
 * Dispatches an automated high-priority alert to Discord #dev-alerts or ops webhook
 * when an unprocessable message reaches SHOPIFY_ORDERS_DLQ.
 */
export async function dispatchDlqAlert(
  details: {
    originalMessageId: string;
    payload?: any;
    error: string;
    attempts: number;
    failedAt?: string;
  },
  webhookUrl?: string
): Promise<boolean> {
  const targetUrl =
    webhookUrl ||
    process.env.DISCORD_WEBHOOK_STORE_ORDERS ||
    process.env.DISCORD_WEBHOOK_ALERTS ||
    process.env.DISCORD_WEBHOOK_DEV_ALERTS ||
    process.env.OPS_ALERT_WEBHOOK_URL;

  const failedAt = details.failedAt || new Date().toISOString();
  const orderId =
    details.payload?.id ||
    details.payload?.order?.id ||
    details.payload?.order_id ||
    'unknown';
  const orderNumber =
    details.payload?.order_number ||
    details.payload?.order?.order_number ||
    orderId;
  const topic = details.payload?.topic || 'orders/create';

  const line = JSON.stringify({
    telemetry: 'webhook_dlq_alert',
    messageId: details.originalMessageId,
    orderId,
    attempts: details.attempts,
    error: details.error,
    failedAt,
  });
  console.error(`[WebhookTelemetry:DLQAlert] ${line}`);

  if (!targetUrl) {
    return false;
  }

  const payload = {
    content: `🚨 **[CRITICAL DLQ ALERT] Shopify Order Webhook Routed to Dead-Letter Queue (DLQ)**\n**Message ID**: \`${details.originalMessageId}\`\n**Order**: \`#${orderNumber}\` (${orderId})\n**Topic**: \`${topic}\`\n**Attempts**: \`${details.attempts}\`\n**Error**: \`${details.error}\`\n**Failed At**: \`${failedAt}\`\n\n👉 *Action Required: Inspect Cloudflare Queues SHOPIFY_ORDERS_DLQ and Sentry*`,
    embeds: [
      {
        title: 'Shopify Webhook Dead-Letter Queue Poison Pill',
        color: 0xef4444,
        fields: [
          { name: 'Message ID', value: String(details.originalMessageId), inline: true },
          { name: 'Order Number', value: String(orderNumber), inline: true },
          { name: 'Attempts', value: `${details.attempts}`, inline: true },
          { name: 'Topic', value: String(topic), inline: true },
          { name: 'Error', value: String(details.error).slice(0, 1024), inline: false },
          { name: 'Failed At', value: failedAt, inline: false },
        ],
        timestamp: failedAt,
      },
    ],
  };

  try {
    const fetchImpl = globalThis.fetch;
    const res = await fetchImpl(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('[WebhookTelemetry:DiscordAlertError]', err);
    return false;
  }
}

/**
 * Computes aggregated webhook pipeline telemetry metrics across ingestion, batch processing, and DLQ.
 */
export function getWebhookTelemetryMetrics(): WebhookPipelineTelemetryMetrics {
  const totalReceived = ingestionBuffer.length;
  let idempotencyHits = 0;
  let idempotencyMisses = 0;
  let enqueuedCount = 0;
  let directProcessedCount = 0;

  let lastIngestionTimestamp: number | null = null;
  for (const item of ingestionBuffer) {
    if (item.idempotencyStatus === 'hit') {
      idempotencyHits++;
    } else {
      idempotencyMisses++;
    }

    if (item.queued) {
      enqueuedCount++;
    } else {
      directProcessedCount++;
    }

    if (lastIngestionTimestamp === null || item.timestamp > lastIngestionTimestamp) {
      lastIngestionTimestamp = item.timestamp;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const idempotencyHitRate = totalReceived > 0 ? round2((idempotencyHits / totalReceived) * 100) : 0;

  let messagesProcessed = 0;
  let messagesSucceeded = 0;
  let messagesRetried = 0;
  let messagesDeadLettered = 0;
  let totalLagMs = 0;
  let totalBatchDurationMs = 0;
  let lastBatchTimestamp: number | null = null;

  for (const b of batchBuffer) {
    messagesProcessed += b.batchSize;
    messagesSucceeded += b.succeeded;
    messagesRetried += b.retried;
    messagesDeadLettered += b.deadLettered;
    totalLagMs += b.avgQueueLagMs * b.batchSize;
    totalBatchDurationMs += b.durationMs;

    if (lastBatchTimestamp === null || b.timestamp > lastBatchTimestamp) {
      lastBatchTimestamp = b.timestamp;
    }
  }

  const batchesProcessed = batchBuffer.length;
  const averageQueueLagMs = messagesProcessed > 0 ? round2(totalLagMs / messagesProcessed) : 0;
  const averageBatchDurationMs =
    batchesProcessed > 0 ? round2(totalBatchDurationMs / batchesProcessed) : 0;

  const dlqDepth = dlqBuffer.length;
  let lastDlqTimestamp: number | null = null;
  if (dlqBuffer.length > 0) {
    lastDlqTimestamp = dlqBuffer[dlqBuffer.length - 1].timestamp;
  }

  // Health assessment:
  // - Unhealthy if messages are in DLQ
  // - Degraded if retry rate > 25% or average queue lag > 10,000ms
  // - Healthy otherwise
  let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const retryRate = messagesProcessed > 0 ? (messagesRetried / messagesProcessed) * 100 : 0;

  if (dlqDepth > 0) {
    healthStatus = 'unhealthy';
  } else if (retryRate > 25 || averageQueueLagMs > 10000) {
    healthStatus = 'degraded';
  }

  return {
    totalReceived,
    idempotencyHits,
    idempotencyMisses,
    idempotencyHitRate,
    enqueuedCount,
    directProcessedCount,
    queueFailures: 0,
    batchesProcessed,
    messagesProcessed,
    messagesSucceeded,
    messagesRetried,
    messagesDeadLettered,
    dlqDepth,
    averageQueueLagMs,
    averageBatchDurationMs,
    lastIngestionTimestamp,
    lastBatchTimestamp,
    lastDlqTimestamp,
    healthStatus,
  };
}

/**
 * Retrieves recorded DLQ items for inspection.
 */
export function getDlqRecords(): DlqArrivalRecord[] {
  return [...dlqBuffer];
}

/**
 * Retrieves recorded batch processing records.
 */
export function getBatchRecords(): QueueBatchProcessingRecord[] {
  return [...batchBuffer];
}

/**
 * Retrieves recorded ingestion records.
 */
export function getIngestionRecords(): WebhookIngestionRecord[] {
  return [...ingestionBuffer];
}

/**
 * Resets all buffers (primarily for test isolation).
 */
export function clearWebhookTelemetry(): void {
  ingestionBuffer.length = 0;
  batchBuffer.length = 0;
  dlqBuffer.length = 0;
}
