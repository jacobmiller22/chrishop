/**
 * ChrisShop Telemetry & Observability Gap Audit Inventory & Validation Engine
 *
 * Story 4.14 (#166): Telemetry & Observability Gap Audit
 *
 * Catalogs all available metrics, logs, events, traces, and alert triggers across:
 * 1. Edge Runtime (Cloudflare Workers)
 * 2. Storefront App & CMS (Next.js App Router & Payload CMS v3)
 * 3. Data Tier (Cloudflare D1 SQLite)
 * 4. Storage Tier (Workers KV & Cloudflare R2)
 * 5. Third-Party Integrations (Shopify Storefront/Admin, Resend, Discord)
 * 6. Webhook Ingestion & Background Queues (Shopify Orders Queue, DLQ, Idempotency)
 *
 * Formalizes identified observability gaps and links them to discrete follow-up issues:
 * - Story 4.25 (#330): Distributed Tracing & Edge Correlation ID Propagation
 * - Story 4.26 (#331): Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline
 * - Story 4.27 (#332): Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 * - Story 4.28 (#333): Drop Day Conversion Funnel Instrumentation & Step Telemetry
 * - Story 4.29 (#334): Shopify Webhook Queue Telemetry & Retry Backpressure Monitor
 */

export type SystemTier =
  | 'edge-runtime'
  | 'storefront-app'
  | 'data-tier'
  | 'storage-tier'
  | 'third-party-integrations'
  | 'webhook-pipeline';

export type SignalType = 'metric' | 'log' | 'trace' | 'event' | 'alert' | 'security';

export type TelemetryState = 'active' | 'partial' | 'missing';

export type TelemetryCriticality = 'critical' | 'high' | 'medium' | 'low';

export interface TelemetrySignal {
  id: string;
  name: string;
  tier: SystemTier;
  type: SignalType;
  source: string;
  destination: string;
  state: TelemetryState;
  criticality: TelemetryCriticality;
  description: string;
  retentionOrCadence?: string;
  gapDetails?: string;
  followUpIssue?: {
    id: number;
    title: string;
  };
}

export interface TelemetryGap {
  id: string;
  title: string;
  tier: SystemTier;
  criticality: TelemetryCriticality;
  impact: string;
  remediation: string;
  followUpIssueId: number;
}

export const TELEMETRY_TIERS: Record<SystemTier, { name: string; description: string }> = {
  'edge-runtime': {
    name: 'Cloudflare Edge Runtime',
    description: 'Cloudflare Workers edge execution, HTTP headers, CPU timing, and edge crash interception.',
  },
  'storefront-app': {
    name: 'Storefront App & Payload CMS',
    description: 'Next.js App Router SSR/RSC rendering, client-side browser performance, and Payload CMS mutations.',
  },
  'data-tier': {
    name: 'Cloudflare D1 SQLite Data Tier',
    description: 'SQL query execution, D1 statement latencies, prepared statements, and backup checkpoints.',
  },
  'storage-tier': {
    name: 'Workers KV & R2 Storage Tier',
    description: 'High-speed edge KV caching, cache hit/miss rates, and Cloudflare R2 media egress.',
  },
  'third-party-integrations': {
    name: 'Shopify & Third-Party APIs',
    description: 'Shopify Storefront GraphQL requests, rate-limiting leaky buckets, Resend emails, and Discord alerts.',
  },
  'webhook-pipeline': {
    name: 'Shopify Webhook Ingestion & Queue Pipeline',
    description: 'Raw stream HMAC verification, Workers KV idempotency gate, Cloudflare Queue, and DLQ backpressure.',
  },
};

/**
 * Master catalog of audited telemetry points across ChrisShop.
 */
export const AUDITED_TELEMETRY_SIGNALS: TelemetrySignal[] = [
  // ==========================================================================
  // 1. Edge Runtime (Cloudflare Workers)
  // ==========================================================================
  {
    id: 'edge.request_volume',
    name: 'Edge Request Volume & HTTP Status Codes',
    tier: 'edge-runtime',
    type: 'metric',
    source: 'Cloudflare Edge Gateway / Workers Analytics',
    destination: 'Cloudflare Dashboard / Cloudflare GraphQL Analytics API',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: 'Real-time (30-day retention in Cloudflare)',
    description: 'Total request ingress, 2xx/3xx/4xx/5xx status code breakdown, and request rate per minute.',
  },
  {
    id: 'edge.worker_cpu_time',
    name: 'Worker CPU Execution Time & Wall-Clock Duration',
    tier: 'edge-runtime',
    type: 'metric',
    source: 'Cloudflare Workers Runtime',
    destination: 'Cloudflare Metrics Dashboard',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: 'Per-request metrics / 1-minute aggregation',
    description: 'CPU time consumed per isolate execution against the 50ms free / standard plan CPU limit.',
  },
  {
    id: 'edge.ray_id',
    name: 'Cloudflare Ray ID (CF-Ray)',
    tier: 'edge-runtime',
    type: 'trace',
    source: 'Cloudflare Ingress Proxy Header',
    destination: 'Edge Timeout Handler / Sentry',
    state: 'partial',
    criticality: 'critical',
    gapDetails: 'CF-Ray is parsed by edge-timeout.ts during 504 errors, but is NOT systematically propagated across internal D1 queries, Shopify client calls, or regular API responses.',
    followUpIssue: {
      id: 330,
      title: 'Story 4.25: Distributed Tracing & Edge Correlation ID Propagation',
    },
    description: 'Cloudflare unique edge trace identifier generated for each incoming HTTP request.',
  },
  {
    id: 'edge.timeout_interception',
    name: 'Edge Timeout Event & Branded 504 Interception',
    tier: 'edge-runtime',
    type: 'event',
    source: 'apps/web/src/lib/edge-timeout.ts',
    destination: 'HTTP Response Headers (x-chrishop-edge-timeout) / Console',
    state: 'active',
    criticality: 'high',
    retentionOrCadence: 'Instantaneous on timeout event (>25s wall-clock)',
    description: 'Interception of hanging upstream requests prior to Cloudflare isolate watchdog termination.',
  },
  {
    id: 'edge.health_synthetic_probe',
    name: 'Edge Health Synthetic Probes (/api/health)',
    tier: 'edge-runtime',
    type: 'metric',
    source: 'apps/web/src/lib/health-monitoring.ts',
    destination: 'Better Stack Uptime / Discord #dev-alerts',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: '60-second polling cadence from US, EU, AS regions',
    description: 'Synthetic health checks actively probing D1 (SELECT 1), KV read/write, R2 list, and Shopify Storefront.',
  },
  {
    id: 'edge.waf_turnstile_events',
    name: 'WAF Rule Triggers & Turnstile Bot Mitigation',
    tier: 'edge-runtime',
    type: 'event',
    source: 'Cloudflare WAF Engine & apps/web/src/lib/turnstile.ts',
    destination: 'Cloudflare Security Events Log / Server Console',
    state: 'active',
    criticality: 'high',
    retentionOrCadence: 'Real-time on bot/rate-limit encounter',
    description: 'Challenge and block actions triggered by Managed WAF, Rate Limiting (30 req/min), or Turnstile token verification.',
  },

  // ==========================================================================
  // 2. Storefront App & CMS (Next.js & Payload CMS)
  // ==========================================================================
  {
    id: 'storefront.sentry_exceptions',
    name: 'Unhandled Exceptions & Error Tracking',
    tier: 'storefront-app',
    type: 'alert',
    source: 'apps/web/src/lib/sentry.ts / @sentry/nextjs',
    destination: 'Sentry.io Dashboard / Discord #dev-alerts',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: 'Instantaneous (30-day retention in Sentry)',
    description: 'Captures runtime exceptions across browser client, Node.js, and Cloudflare Worker environments.',
  },
  {
    id: 'storefront.core_web_vitals',
    name: 'Client Real-User Monitoring (RUM) & Core Web Vitals',
    tier: 'storefront-app',
    type: 'metric',
    source: 'Browser Web Vitals API (next/web-vitals & WebVitalsReporter)',
    destination: 'Workers Analytics Engine (VITALS_ANALYTICS) / Edge Ingestion API (/api/telemetry/vitals)',
    state: 'active',
    criticality: 'high',
    retentionOrCadence: 'Non-blocking beacon on Web Vitals emission / Logpush & Analytics Engine retention',
    followUpIssue: {
      id: 331,
      title: 'Story 4.26: Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline',
    },
    description: 'Real shopper browser experience metrics tracking visual stability and interaction latency.',
  },
  {
    id: 'storefront.drop_conversion_funnel',
    name: 'Drop Day Conversion Funnel Step Telemetry',
    tier: 'storefront-app',
    type: 'event',
    source: 'Storefront UI Components (DropCountdown, PDP, Cart Drawer, Checkout, Webhooks)',
    destination: 'Workers Analytics Engine (CONVERSION_ANALYTICS) / Edge Ingestion API (/api/telemetry/funnel)',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: 'Real-time on each funnel step transition',
    followUpIssue: {
      id: 333,
      title: 'Story 4.28: Drop Day Conversion Funnel Instrumentation & Step Telemetry',
    },
    description: 'Conversion funnel analytics measuring drop participant conversion velocity and step drop-off.',
  },
  {
    id: 'storefront.payload_cms_audit',
    name: 'Payload CMS Admin Audit Logs & Mutations',
    tier: 'storefront-app',
    type: 'log',
    source: 'Payload CMS v3 Collection Hooks & Auth',
    destination: 'D1 SQLite payload_preferences / payload_migrations / Console',
    state: 'active',
    criticality: 'medium',
    retentionOrCadence: 'On document create/update/delete',
    description: 'Records administrative user actions, content versioning, and catalog mutations.',
  },
  {
    id: 'storefront.payload_2fa_events',
    name: 'Admin RBAC & 2FA Authentication Events',
    tier: 'storefront-app',
    type: 'event',
    source: 'apps/web/src/lib/payload-2fa.ts',
    destination: 'Application Logs / Security Audit Trail',
    state: 'active',
    criticality: 'high',
    retentionOrCadence: 'On login and 2FA verification attempt',
    description: 'Tracks TOTP 2FA verification attempts, backup code redemptions, and administrative role assignments.',
  },

  // ==========================================================================
  // 3. Data Tier (Cloudflare D1 SQLite)
  // ==========================================================================
  {
    id: 'd1.query_execution_latency',
    name: 'D1 Statement Execution Latency (p50, p95, p99)',
    tier: 'data-tier',
    type: 'metric',
    source: 'Cloudflare D1 SQLite Binding (apps/web/src/lib/catalog.ts)',
    destination: 'None (Uninstrumented)',
    state: 'missing',
    criticality: 'critical',
    gapDetails: 'Catalog database wrapper executes raw D1 statements without recording execution timing in milliseconds or calculating percentiles.',
    followUpIssue: {
      id: 332,
      title: 'Story 4.27: Cloudflare D1 Statement Execution Latency & Slow Query Telemetry',
    },
    description: 'Measures statement-level latency for SELECT, INSERT, UPDATE, and DELETE operations.',
  },
  {
    id: 'd1.slow_query_alerts',
    name: 'D1 Slow Query Warnings (> 50ms)',
    tier: 'data-tier',
    type: 'alert',
    source: 'Data Access Layer',
    destination: 'None (Uninstrumented)',
    state: 'missing',
    criticality: 'high',
    gapDetails: 'No threshold-based warnings triggered when un-indexed queries or N+1 statement patterns exceed 50ms.',
    followUpIssue: {
      id: 332,
      title: 'Story 4.27: Cloudflare D1 Statement Execution Latency & Slow Query Telemetry',
    },
    description: 'Diagnostic alerts identifying slow SQL queries before they degrade flash drop throughput.',
  },
  {
    id: 'd1.read_write_volume',
    name: 'D1 Storage Row Read / Write Volume',
    tier: 'data-tier',
    type: 'metric',
    source: 'Cloudflare D1 Engine',
    destination: 'Cloudflare D1 Dashboard Analytics',
    state: 'active',
    criticality: 'medium',
    retentionOrCadence: 'Aggregated hourly / daily by Cloudflare',
    description: 'Total rows read and written across production and staging D1 databases.',
  },
  {
    id: 'd1.singleflight_coalescing',
    name: 'SingleFlight Query Coalescing Telemetry',
    tier: 'data-tier',
    type: 'metric',
    source: 'apps/web/src/lib/singleflight.ts',
    destination: 'Unit / Integration Test Metrics / In-Memory State',
    state: 'partial',
    criticality: 'high',
    gapDetails: 'SingleFlight provides in-memory deduplication during drop rushes, but does not emit telemetry counters for coalesced vs executed reads.',
    description: 'Tracks in-flight query deduplication preventing database thundering herds.',
  },
  {
    id: 'd1.migration_version_state',
    name: 'D1 Database Migration State & Checkpoints',
    tier: 'data-tier',
    type: 'log',
    source: 'scripts/d1-migrate.ts / d1_migrations table',
    destination: 'Console Output / D1 System Tables',
    state: 'active',
    criticality: 'high',
    retentionOrCadence: 'On deployment / CI migration run',
    description: 'Tracks applied schema migrations and database revision parity across environments.',
  },

  // ==========================================================================
  // 4. Storage Tier (Workers KV & Cloudflare R2)
  // ==========================================================================
  {
    id: 'kv.cache_hit_miss_ratio',
    name: 'Workers KV Cache Hit / Miss Ratio',
    tier: 'storage-tier',
    type: 'metric',
    source: 'Cloudflare Workers KV Engine',
    destination: 'Cloudflare Analytics / Response Headers (x-idempotency-status)',
    state: 'partial',
    criticality: 'high',
    gapDetails: 'Cache status is reported per-request in webhook headers, but aggregated cache hit/miss ratio across catalog routes is not exported.',
    description: 'Hit and miss percentages for catalog cache and webhook idempotency checks.',
  },
  {
    id: 'kv.idempotency_keys',
    name: 'KV Idempotency Key Expirations & Collisions',
    tier: 'storage-tier',
    type: 'event',
    source: 'apps/web/src/lib/shopify-webhook.ts',
    destination: 'Webhook JSON Response / Application Logs',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: '24-hour TTL per order event',
    description: 'Guarantees single processing of duplicate order webhook events from Shopify.',
  },
  {
    id: 'r2.media_request_volume',
    name: 'R2 Media Request Volume & Egress Bandwidth',
    tier: 'storage-tier',
    type: 'metric',
    source: 'Cloudflare R2 Object Storage Analytics',
    destination: 'Cloudflare Dashboard Analytics',
    state: 'active',
    criticality: 'medium',
    retentionOrCadence: 'Daily / Monthly aggregation in Cloudflare',
    description: 'Tracks image and asset downloads, storage volume, and zero-cost egress transfer.',
  },
  {
    id: 'r2.image_resizing_cache',
    name: 'Cloudflare Images & Resizing Transformations',
    tier: 'storage-tier',
    type: 'metric',
    source: 'Cloudflare Image Resizing Engine (/cdn-cgi/image/)',
    destination: 'Cloudflare Edge CDN Headers (cf-cache-status)',
    state: 'active',
    criticality: 'medium',
    retentionOrCadence: 'Cache-Control 1-year immutable for static media',
    description: 'Caches responsive WebP/AVIF media variants at the edge.',
  },

  // ==========================================================================
  // 5. Third-Party Integrations (Shopify, Resend, Discord)
  // ==========================================================================
  {
    id: 'shopify.graphql_request_duration',
    name: 'Shopify Storefront GraphQL Latency & Timing',
    tier: 'third-party-integrations',
    type: 'metric',
    source: 'apps/web/src/lib/shopify.ts',
    destination: 'None (Uninstrumented)',
    state: 'missing',
    criticality: 'high',
    gapDetails: 'The Shopify client does not record GraphQL request duration, p95 execution latency, or upstream timeout frequency.',
    followUpIssue: {
      id: 330,
      title: 'Story 4.25: Distributed Tracing & Edge Correlation ID Propagation',
    },
    description: 'Latency of outbound GraphQL calls to Shopify Headless Storefront API.',
  },
  {
    id: 'shopify.graphql_rate_limit_points',
    name: 'Shopify GraphQL Cost & Leaky Bucket Point Consumption',
    tier: 'third-party-integrations',
    type: 'metric',
    source: 'Shopify GraphQL Response Extensions (extensions.cost)',
    destination: 'None (Uninstrumented)',
    state: 'missing',
    criticality: 'critical',
    gapDetails: 'GraphQL cost points (requestedQueryCost, actualQueryCost, throttleStatus.currentlyAvailable) are dropped rather than monitored.',
    followUpIssue: {
      id: 330,
      title: 'Story 4.25: Distributed Tracing & Edge Correlation ID Propagation',
    },
    description: 'Shopify Storefront API rate-limit point consumption and available credit pool.',
  },
  {
    id: 'shopify.rate_limit_retries',
    name: 'Shopify 429 Throttle & Exponential Backoff Retries',
    tier: 'third-party-integrations',
    type: 'event',
    source: 'apps/web/src/lib/shopify.ts (calculateBackoffDelay)',
    destination: 'Console Warnings / Throw on Max Retries',
    state: 'partial',
    criticality: 'high',
    gapDetails: 'Client retries throttled requests with jittered exponential backoff, but intermediate retries are not emitted as structured metrics.',
    description: 'Tracks backoff attempts when Shopify throttles buyer requests.',
  },
  {
    id: 'notifications.resend_dispatch',
    name: 'Resend Transactional Email Delivery Status',
    tier: 'third-party-integrations',
    type: 'event',
    source: 'packages/notifications (ResendNotificationProvider)',
    destination: 'Resend Dashboard / Application Logs',
    state: 'active',
    criticality: 'medium',
    retentionOrCadence: 'On order receipt or fulfillment dispatch',
    description: 'Records email sending success, message ID, and delivery failure reasons.',
  },
  {
    id: 'notifications.discord_alerts',
    name: 'Discord Ops & Alert Dispatch Latency',
    tier: 'third-party-integrations',
    type: 'event',
    source: 'apps/web/src/lib/health-monitoring.ts / sentry.ts / better-stack.ts',
    destination: 'Discord Webhook Channels (#dev-alerts, #store-orders)',
    state: 'active',
    criticality: 'high',
    retentionOrCadence: 'Instantaneous on incident or order event',
    description: 'Out-of-band rich webhook dispatches notifying on-call engineers of system degradation.',
  },

  // ==========================================================================
  // 6. Webhook Ingestion & Background Queues
  // ==========================================================================
  {
    id: 'webhook.ingestion_latency',
    name: 'Webhook Ingestion Duration & Response Time',
    tier: 'webhook-pipeline',
    type: 'metric',
    source: 'apps/web/src/app/api/webhooks/shopify/route.ts',
    destination: 'Response Header (x-response-time-ms) / Ingestion JSON',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: 'Every incoming webhook (SLA < 500ms)',
    description: 'Measures total wall-clock duration to verify HMAC, check idempotency, and enqueue payload.',
  },
  {
    id: 'webhook.hmac_verification_failures',
    name: 'HMAC Cryptographic Verification Rejections',
    tier: 'webhook-pipeline',
    type: 'security',
    source: 'apps/web/src/lib/order-consumer.ts (verifyShopifyWebhookHmacSubtle)',
    destination: 'Security Logs (HTTP 401 Unauthorized)',
    state: 'active',
    criticality: 'critical',
    retentionOrCadence: 'Real-time on invalid signature',
    description: 'Flags spoofed or corrupted webhook requests from non-Shopify sources.',
  },
  {
    id: 'webhook.queue_backpressure',
    name: 'Cloudflare Queue Depth & Batch Processing Lag',
    tier: 'webhook-pipeline',
    type: 'metric',
    source: 'Cloudflare Queue SHOPIFY_ORDERS_QUEUE',
    destination: 'Cloudflare Queues Dashboard',
    state: 'partial',
    criticality: 'high',
    gapDetails: 'Queue depth is visible in Cloudflare dashboard, but consumer processing lag and retry backpressure are not monitored or alerted upon.',
    followUpIssue: {
      id: 334,
      title: 'Story 4.29: Shopify Webhook Queue Telemetry & Retry Backpressure Monitor',
    },
    description: 'Measures queue message backlog and processing latency during high-volume drops.',
  },
  {
    id: 'webhook.dlq_dead_letter_accumulation',
    name: 'Dead-Letter Queue (DLQ) Message Accumulation',
    tier: 'webhook-pipeline',
    type: 'alert',
    source: 'Cloudflare Queue SHOPIFY_ORDERS_DLQ',
    destination: 'None (Uninstrumented automated alert)',
    state: 'missing',
    criticality: 'critical',
    gapDetails: 'When a webhook message exhausts max_retries and lands in SHOPIFY_ORDERS_DLQ, no automated Discord alert or paging incident is dispatched.',
    followUpIssue: {
      id: 334,
      title: 'Story 4.29: Shopify Webhook Queue Telemetry & Retry Backpressure Monitor',
    },
    description: 'Immediate alerting when unprocessable order events fail permanently into DLQ.',
  },
];

/**
 * Key identified telemetry gaps with impact analysis and follow-up issue linkage.
 */
export const TELEMETRY_GAPS: TelemetryGap[] = [
  {
    id: 'GAP-001',
    title: 'Missing Distributed Trace Context & Correlation ID Propagation',
    tier: 'edge-runtime',
    criticality: 'critical',
    impact: 'Engineering cannot correlate a specific customer error on the storefront with corresponding D1 database queries, Shopify Storefront API calls, or Sentry error traces.',
    remediation: 'Propagate x-request-id and cf-ray across all edge middleware, Next.js server components, outbound Shopify requests, and Sentry exception contexts.',
    followUpIssueId: 330,
  },
  {
    id: 'GAP-002',
    title: 'Lack of Real User Monitoring (RUM) & Core Web Vitals Beaconing',
    tier: 'storefront-app',
    criticality: 'high',
    impact: 'Drop-day mobile shopper experience degradation (e.g. layout shifts, Turnstile interaction delays, font loading pauses) is completely invisible to operations.',
    remediation: 'Implement useReportWebVitals sending non-blocking beacons (LCP, INP, CLS, TTFB) to /api/telemetry/vitals using navigator.sendBeacon.',
    followUpIssueId: 331,
  },
  {
    id: 'GAP-003',
    title: 'Uninstrumented D1 Statement Execution Latency & Slow Query Warning',
    tier: 'data-tier',
    criticality: 'critical',
    impact: 'Slow queries, schema index regressions, or N+1 queries during flash drops go unnoticed until edge timeouts (504s) occur.',
    remediation: 'Wrap D1 client with execution timer, log slow queries (>50ms), and expose p50/p95/p99 query latencies in diagnostic endpoints.',
    followUpIssueId: 332,
  },
  {
    id: 'GAP-004',
    title: 'Missing Drop Day Conversion Funnel Step Telemetry',
    tier: 'storefront-app',
    criticality: 'critical',
    impact: 'The business has no real-time telemetry on customer progression from Drop Countdown -> PDP -> Cart Reservation -> Checkout -> Order Paid.',
    remediation: 'Instrument funnel transition events with unified schema and pipe to Workers Analytics Engine or real-time event sink.',
    followUpIssueId: 333,
  },
  {
    id: 'GAP-005',
    title: 'Untracked Webhook Retry Backpressure & DLQ Accumulation Alerting',
    tier: 'webhook-pipeline',
    criticality: 'critical',
    impact: 'Failed order webhooks accumulating in the Dead-Letter Queue (DLQ) do not trigger proactive paging alerts, risking delayed order fulfillment.',
    remediation: 'Add ingestion timing metrics, DLQ depth alarms, and automatic Discord alert dispatch on any DLQ message arrival.',
    followUpIssueId: 334,
  },
];

/**
 * Validates the integrity of the telemetry audit catalog.
 */
export function validateTelemetryAuditCatalog(): {
  valid: boolean;
  totalSignals: number;
  activeCount: number;
  partialCount: number;
  missingCount: number;
  tierCoverage: Record<SystemTier, number>;
  errors: string[];
} {
  const errors: string[] = [];
  const tierCoverage: Record<SystemTier, number> = {
    'edge-runtime': 0,
    'storefront-app': 0,
    'data-tier': 0,
    'storage-tier': 0,
    'third-party-integrations': 0,
    'webhook-pipeline': 0,
  };

  let activeCount = 0;
  let partialCount = 0;
  let missingCount = 0;

  const seenIds = new Set<string>();

  for (const signal of AUDITED_TELEMETRY_SIGNALS) {
    if (seenIds.has(signal.id)) {
      errors.push(`Duplicate signal ID: "${signal.id}"`);
    }
    seenIds.add(signal.id);

    if (!signal.name || signal.name.trim().length === 0) {
      errors.push(`Signal "${signal.id}" is missing a name`);
    }
    if (!signal.tier || !TELEMETRY_TIERS[signal.tier]) {
      errors.push(`Signal "${signal.id}" has invalid tier: "${signal.tier}"`);
    } else {
      tierCoverage[signal.tier]++;
    }

    if (signal.state === 'active') activeCount++;
    else if (signal.state === 'partial') partialCount++;
    else if (signal.state === 'missing') missingCount++;

    if (signal.state === 'missing' && !signal.followUpIssue) {
      errors.push(`Missing signal "${signal.id}" must link to a followUpIssue`);
    }
  }

  // Ensure every system tier has at least 3 audited signals
  for (const [tier, count] of Object.entries(tierCoverage)) {
    if (count < 3) {
      errors.push(`Tier "${tier}" has insufficient signals (${count} < 3)`);
    }
  }

  // Ensure all GAPs link to valid follow-up issue IDs
  for (const gap of TELEMETRY_GAPS) {
    if (!gap.followUpIssueId || gap.followUpIssueId <= 0) {
      errors.push(`Gap "${gap.id}" is missing a valid followUpIssueId`);
    }
  }

  return {
    valid: errors.length === 0,
    totalSignals: AUDITED_TELEMETRY_SIGNALS.length,
    activeCount,
    partialCount,
    missingCount,
    tierCoverage,
    errors,
  };
}
