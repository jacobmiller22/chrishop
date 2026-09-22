/**
 * ChrisShop Metrics, Visualizations & Alerting Catalog Engine
 *
 * Story 4.15 (#167): Metrics, Visualizations & Alerting Catalog Definition
 *
 * Establishes formal specifications for:
 * 1. Engineering Operational Metrics (Edge, D1, KV, Sentry, Better Stack, WAF)
 * 2. Creator & Business Drop Performance KPIs (Live concurrency, conversion funnel, inventory velocity, GMV)
 * 3. Optimal Visual Chart Types & Dashboard Layouts
 * 4. Two-Tiered Alerting Thresholds (Warning vs Critical) & Escalation Channels
 */

export type PersonaType = 'engineering' | 'creator';

export type MetricSubsystem =
  | 'edge-performance'
  | 'data-storage'
  | 'reliability'
  | 'security'
  | 'traffic'
  | 'funnel'
  | 'inventory'
  | 'revenue';

export type VisualWidgetType =
  | 'stat_card'
  | 'time_series'
  | 'gauge'
  | 'funnel_bar'
  | 'log_table'
  | 'donut_chart';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertThreshold {
  severity: AlertSeverity;
  operator: '>' | '>=' | '<' | '<=' | '==';
  thresholdValue: number;
  durationMinutes: number;
  channel: 'discord-dev-alerts' | 'discord-store-orders' | 'pagerduty' | 'better-stack';
  message: string;
}

export interface MetricDefinition {
  id: string;
  name: string;
  persona: PersonaType;
  subsystem: MetricSubsystem;
  formula: string;
  sourceSignal: string;
  unit: 'rps' | 'ms' | 'percent' | 'count' | 'usd' | 'units_per_min' | 'seconds';
  refreshCadenceSeconds: number;
  recommendedWidget: VisualWidgetType;
  description: string;
  thresholds: AlertThreshold[];
}

/**
 * Engineering Operational Metrics Catalog
 */
export const ENGINEERING_METRICS: MetricDefinition[] = [
  // ==========================================================================
  // Edge Performance
  // ==========================================================================
  {
    id: 'eng.edge_rps',
    name: 'Edge Requests Per Second (Throughput)',
    persona: 'engineering',
    subsystem: 'edge-performance',
    formula: 'sum(rate(cloudflare_worker_requests_count[1m]))',
    sourceSignal: 'Cloudflare Workers Analytics GraphQL API',
    unit: 'rps',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'time_series',
    description: 'Total request ingress rate across all edge PoPs.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 2000,
        durationMinutes: 1,
        channel: 'discord-dev-alerts',
        message: 'Edge ingress surging > 2,000 RPS (Potential unmitigated traffic flood)',
      },
    ],
  },
  {
    id: 'eng.http_5xx_rate',
    name: 'Edge HTTP 5xx Error Rate',
    persona: 'engineering',
    subsystem: 'edge-performance',
    formula: '(sum(rate(http_status_5xx[1m])) / sum(rate(http_requests_total[1m]))) * 100',
    sourceSignal: 'Cloudflare Edge Logs / Worker Unhandled Exceptions',
    unit: 'percent',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'stat_card',
    description: 'Percentage of edge requests returning 500, 502, 503, or 504 status codes.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>=',
        thresholdValue: 0.5,
        durationMinutes: 2,
        channel: 'discord-dev-alerts',
        message: 'Edge 5xx error rate elevated >= 0.5% for 2 minutes',
      },
      {
        severity: 'critical',
        operator: '>=',
        thresholdValue: 1.0,
        durationMinutes: 1,
        channel: 'pagerduty',
        message: 'CRITICAL: Edge 5xx error rate >= 1.0% — Immediate drop degradation',
      },
    ],
  },
  {
    id: 'eng.edge_latency_p95',
    name: 'Edge Response Latency (p95)',
    persona: 'engineering',
    subsystem: 'edge-performance',
    formula: 'histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket[1m])) by (le))',
    sourceSignal: 'Cloudflare Workers Execution Timing',
    unit: 'ms',
    refreshCadenceSeconds: 15,
    recommendedWidget: 'time_series',
    description: '95th percentile wall-clock response duration for storefront shoppers.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 300,
        durationMinutes: 2,
        channel: 'discord-dev-alerts',
        message: 'Edge p95 latency > 300ms (SLA target: < 200ms)',
      },
      {
        severity: 'critical',
        operator: '>',
        thresholdValue: 1000,
        durationMinutes: 1,
        channel: 'pagerduty',
        message: 'CRITICAL: Edge p95 latency > 1,000ms — Severe performance degradation',
      },
    ],
  },
  {
    id: 'eng.edge_latency_p99',
    name: 'Edge Response Latency (p99)',
    persona: 'engineering',
    subsystem: 'edge-performance',
    formula: 'histogram_quantile(0.99, sum(rate(http_request_duration_ms_bucket[1m])) by (le))',
    sourceSignal: 'Cloudflare Workers Execution Timing',
    unit: 'ms',
    refreshCadenceSeconds: 15,
    recommendedWidget: 'time_series',
    description: '99th percentile tail response duration.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 1500,
        durationMinutes: 2,
        channel: 'discord-dev-alerts',
        message: 'Edge p99 latency > 1,500ms for 2 minutes',
      },
      {
        severity: 'critical',
        operator: '>',
        thresholdValue: 5000,
        durationMinutes: 1,
        channel: 'pagerduty',
        message: 'CRITICAL: Edge p99 latency > 5,000ms — Tail requests timing out',
      },
    ],
  },
  {
    id: 'eng.worker_cpu_time',
    name: 'Cloudflare Worker Isolate CPU Time',
    persona: 'engineering',
    subsystem: 'edge-performance',
    formula: 'avg(cloudflare_worker_cpu_time_ms)',
    sourceSignal: 'Cloudflare Workers Runtime Watchdog',
    unit: 'ms',
    refreshCadenceSeconds: 15,
    recommendedWidget: 'gauge',
    description: 'Average CPU execution duration per request isolate (Max quota: 50ms).',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 35,
        durationMinutes: 2,
        channel: 'discord-dev-alerts',
        message: 'Worker CPU execution > 35ms (70% of 50ms limit)',
      },
      {
        severity: 'critical',
        operator: '>',
        thresholdValue: 45,
        durationMinutes: 1,
        channel: 'pagerduty',
        message: 'CRITICAL: Worker CPU execution > 45ms (Imminent isolate termination)',
      },
    ],
  },

  // ==========================================================================
  // Data & Storage Health
  // ==========================================================================
  {
    id: 'eng.d1_query_latency_avg',
    name: 'D1 Statement Execution Latency (Average)',
    persona: 'engineering',
    subsystem: 'data-storage',
    formula: 'avg(d1_statement_duration_ms)',
    sourceSignal: 'Catalog Data Access Layer (catalog.ts)',
    unit: 'ms',
    refreshCadenceSeconds: 15,
    recommendedWidget: 'time_series',
    description: 'Average execution duration of prepared SQL queries against Cloudflare D1.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 25,
        durationMinutes: 3,
        channel: 'discord-dev-alerts',
        message: 'Average D1 query duration > 25ms (Investigate unindexed reads)',
      },
    ],
  },
  {
    id: 'eng.d1_slow_query_rate',
    name: 'D1 Slow Query Rate (> 50ms)',
    persona: 'engineering',
    subsystem: 'data-storage',
    formula: '(count(d1_queries where duration_ms > 50) / count(d1_queries_total)) * 100',
    sourceSignal: 'Catalog Query Interceptor / Health Diagnostics',
    unit: 'percent',
    refreshCadenceSeconds: 30,
    recommendedWidget: 'stat_card',
    description: 'Percentage of database queries exceeding the 50ms performance threshold.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>=',
        thresholdValue: 2.0,
        durationMinutes: 2,
        channel: 'discord-dev-alerts',
        message: 'D1 slow query rate >= 2.0% of all catalog operations',
      },
    ],
  },
  {
    id: 'eng.kv_cache_hit_ratio',
    name: 'Workers KV Cache Hit Ratio',
    persona: 'engineering',
    subsystem: 'data-storage',
    formula: '(sum(kv_cache_hits) / (sum(kv_cache_hits) + sum(kv_cache_misses))) * 100',
    sourceSignal: 'Workers KV Read Engine / HTTP Headers',
    unit: 'percent',
    refreshCadenceSeconds: 30,
    recommendedWidget: 'gauge',
    description: 'Percentage of requests served directly from Workers KV edge cache.',
    thresholds: [
      {
        severity: 'warning',
        operator: '<',
        thresholdValue: 70,
        durationMinutes: 3,
        channel: 'discord-dev-alerts',
        message: 'KV cache hit ratio < 70% (Potential origin cache stampede)',
      },
    ],
  },

  // ==========================================================================
  // Reliability
  // ==========================================================================
  {
    id: 'eng.sentry_unresolved_errors',
    name: 'Sentry Unresolved Error Volume',
    persona: 'engineering',
    subsystem: 'reliability',
    formula: 'count(sentry_issues where status = "unresolved")',
    sourceSignal: 'Sentry Next.js & Edge SDK (apps/web/src/lib/sentry.ts)',
    unit: 'count',
    refreshCadenceSeconds: 30,
    recommendedWidget: 'stat_card',
    description: 'Total active unhandled exceptions across client and edge runtimes.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 5,
        durationMinutes: 5,
        channel: 'discord-dev-alerts',
        message: 'Sentry reports > 5 new unresolved error groups',
      },
    ],
  },
  {
    id: 'eng.better_stack_probe_latency',
    name: 'Better Stack Synthetic Probe Latency (/api/health)',
    persona: 'engineering',
    subsystem: 'reliability',
    formula: 'better_stack_probe_response_time_ms',
    sourceSignal: 'Better Stack External Synthetic Poller (60s Cadence)',
    unit: 'ms',
    refreshCadenceSeconds: 60,
    recommendedWidget: 'time_series',
    description: 'External synthetic probe roundtrip latency checking edge and bindings.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 800,
        durationMinutes: 2,
        channel: 'discord-dev-alerts',
        message: 'External health probe response time > 800ms',
      },
      {
        severity: 'critical',
        operator: '>',
        thresholdValue: 2000,
        durationMinutes: 2,
        channel: 'pagerduty',
        message: 'CRITICAL: External health probe > 2,000ms or 503 Service Unavailable',
      },
    ],
  },

  // ==========================================================================
  // Security & Bot Defense
  // ==========================================================================
  {
    id: 'eng.waf_block_rate',
    name: 'Cloudflare WAF Block Rate',
    persona: 'engineering',
    subsystem: 'security',
    formula: 'sum(rate(cloudflare_waf_blocks_count[1m]))',
    sourceSignal: 'Cloudflare Managed & Custom Rulesets (security.tf)',
    unit: 'rps',
    refreshCadenceSeconds: 15,
    recommendedWidget: 'time_series',
    description: 'Rate of malicious or automated requests blocked by Cloudflare Edge WAF.',
    thresholds: [
      {
        severity: 'warning',
        operator: '>',
        thresholdValue: 100,
        durationMinutes: 1,
        channel: 'discord-dev-alerts',
        message: 'WAF block rate surged > 100 req/sec (Active scraping or attack)',
      },
    ],
  },
  {
    id: 'eng.turnstile_pass_ratio',
    name: 'Turnstile Challenge Pass Ratio',
    persona: 'engineering',
    subsystem: 'security',
    formula: '(sum(turnstile_verifications_success) / sum(turnstile_verifications_total)) * 100',
    sourceSignal: 'Turnstile Verification Route (turnstile.ts)',
    unit: 'percent',
    refreshCadenceSeconds: 30,
    recommendedWidget: 'gauge',
    description: 'Pass percentage of Cloudflare Turnstile bot challenges before add-to-cart.',
    thresholds: [
      {
        severity: 'warning',
        operator: '<',
        thresholdValue: 60,
        durationMinutes: 3,
        channel: 'discord-dev-alerts',
        message: 'Turnstile pass ratio < 60% (High bot volume attempting cart reservations)',
      },
    ],
  },
];

/**
 * Creator & Business Drop Performance Metrics Catalog
 */
export const CREATOR_METRICS: MetricDefinition[] = [
  // ==========================================================================
  // Live Traffic & Engagement
  // ==========================================================================
  {
    id: 'biz.concurrent_visitors',
    name: 'Real-Time Active Visitors',
    persona: 'creator',
    subsystem: 'traffic',
    formula: 'count(distinct client_ip where timestamp > now() - 5m)',
    sourceSignal: 'Edge Access Logs / Analytics Engine',
    unit: 'count',
    refreshCadenceSeconds: 5,
    recommendedWidget: 'stat_card',
    description: 'Total unique shoppers browsing ChrisShop within the last 5 minutes.',
    thresholds: [
      {
        severity: 'info',
        operator: '>=',
        thresholdValue: 1000,
        durationMinutes: 0,
        channel: 'discord-store-orders',
        message: '🎉 Traffic Milestone: 1,000+ Concurrent Shoppers Live on Storefront!',
      },
    ],
  },
  {
    id: 'biz.countdown_views_per_min',
    name: 'Drop Countdown Impressions / Minute',
    persona: 'creator',
    subsystem: 'traffic',
    formula: 'sum(rate(drop_countdown_views[1m]))',
    sourceSignal: 'DropCountdownBlock Component Telemetry',
    unit: 'rps',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'time_series',
    description: 'Shoppers actively watching the pre-drop countdown timer.',
    thresholds: [],
  },

  // ==========================================================================
  // Conversion Funnel
  // ==========================================================================
  {
    id: 'biz.funnel_cart_velocity',
    name: 'Cart Creation Velocity (Carts / Min)',
    persona: 'creator',
    subsystem: 'funnel',
    formula: 'sum(rate(cart_create_success[1m])) * 60',
    sourceSignal: 'Shopify Storefront Cart API (/api/cart/create)',
    unit: 'units_per_min',
    refreshCadenceSeconds: 5,
    recommendedWidget: 'time_series',
    description: 'Number of successful cart reservations created per minute.',
    thresholds: [
      {
        severity: 'info',
        operator: '>=',
        thresholdValue: 50,
        durationMinutes: 0,
        channel: 'discord-store-orders',
        message: '⚡ High Cart Velocity: > 50 carts created per minute!',
      },
    ],
  },
  {
    id: 'biz.checkout_handshake_failures',
    name: 'Checkout Handshake Failures',
    persona: 'creator',
    subsystem: 'funnel',
    formula: 'sum(cart_create_errors) + sum(checkout_redirect_failures)',
    sourceSignal: 'Storefront Checkout Redirect Route',
    unit: 'count',
    refreshCadenceSeconds: 5,
    recommendedWidget: 'stat_card',
    description: 'Failed checkout redirection attempts or broken buyer handshakes.',
    thresholds: [
      {
        severity: 'critical',
        operator: '>',
        thresholdValue: 0,
        durationMinutes: 0,
        channel: 'pagerduty',
        message: 'CRITICAL: Shopper checkout redirect failed — Cart checkout link broken!',
      },
    ],
  },
  {
    id: 'biz.conversion_rate',
    name: 'Overall Drop Conversion Rate',
    persona: 'creator',
    subsystem: 'funnel',
    formula: '(count(orders_paid) / count(distinct_product_viewers)) * 100',
    sourceSignal: 'Order Consumer & Product View Events',
    unit: 'percent',
    refreshCadenceSeconds: 30,
    recommendedWidget: 'funnel_bar',
    description: 'Percentage of product viewers who successfully complete order payment.',
    thresholds: [],
  },

  // ==========================================================================
  // Inventory Velocity
  // ==========================================================================
  {
    id: 'biz.inventory_burn_down_rate',
    name: 'Inventory Burn-Down Rate (Units / Min)',
    persona: 'creator',
    subsystem: 'inventory',
    formula: 'sum(rate(inventory_depleted_units[1m])) * 60',
    sourceSignal: 'Shopify Inventory Webhooks & Order Events',
    unit: 'units_per_min',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'time_series',
    description: 'Pace at which drop inventory is selling out in real time.',
    thresholds: [],
  },
  {
    id: 'biz.projected_sell_out_time',
    name: 'Projected Drop Sell-Out Time',
    persona: 'creator',
    subsystem: 'inventory',
    formula: 'current_remaining_stock / (burn_down_rate_per_min || 1)',
    sourceSignal: 'Inventory Burn-Down Calculator',
    unit: 'seconds',
    refreshCadenceSeconds: 15,
    recommendedWidget: 'stat_card',
    description: 'Estimated minutes remaining until limited edition drop reaches zero inventory.',
    thresholds: [
      {
        severity: 'info',
        operator: '<=',
        thresholdValue: 300, // 5 minutes
        durationMinutes: 0,
        channel: 'discord-store-orders',
        message: '🔥 Sell-Out Imminent: Drop projected to completely sell out in < 5 minutes!',
      },
    ],
  },
  {
    id: 'biz.inventory_remaining_percent',
    name: 'Drop Inventory Remaining (%)',
    persona: 'creator',
    subsystem: 'inventory',
    formula: '(sum(current_stock) / sum(initial_drop_batch_size)) * 100',
    sourceSignal: 'Catalog Variations Table & Shopify Live Stock',
    unit: 'percent',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'gauge',
    description: 'Percentage of total drop edition units remaining in stock.',
    thresholds: [
      {
        severity: 'info',
        operator: '<=',
        thresholdValue: 10,
        durationMinutes: 0,
        channel: 'discord-store-orders',
        message: '⚠️ Low Stock Alert: Only 10% of batch inventory remaining!',
      },
    ],
  },

  // ==========================================================================
  // Revenue & Milestones
  // ==========================================================================
  {
    id: 'biz.gross_merchandise_value',
    name: 'Gross Merchandise Value (GMV)',
    persona: 'creator',
    subsystem: 'revenue',
    formula: 'sum(order_total_price_usd)',
    sourceSignal: 'Shopify Order Lifecycle Webhooks (orders/paid)',
    unit: 'usd',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'stat_card',
    description: 'Total revenue generated during the active drop release.',
    thresholds: [
      {
        severity: 'info',
        operator: '>=',
        thresholdValue: 10000,
        durationMinutes: 0,
        channel: 'discord-store-orders',
        message: '🏆 Revenue Milestone Reached: $10,000 GMV crossed!',
      },
      {
        severity: 'info',
        operator: '>=',
        thresholdValue: 50000,
        durationMinutes: 0,
        channel: 'discord-store-orders',
        message: '🚀 Major Revenue Milestone: $50,000 GMV crossed!',
      },
    ],
  },
  {
    id: 'biz.average_order_value',
    name: 'Average Order Value (AOV)',
    persona: 'creator',
    subsystem: 'revenue',
    formula: 'sum(order_total_price_usd) / count(orders_total)',
    sourceSignal: 'Order Consumer Aggregator',
    unit: 'usd',
    refreshCadenceSeconds: 30,
    recommendedWidget: 'stat_card',
    description: 'Average dollar amount per completed shopper transaction.',
    thresholds: [],
  },
  {
    id: 'biz.total_completed_orders',
    name: 'Total Completed Orders',
    persona: 'creator',
    subsystem: 'revenue',
    formula: 'count(orders_paid)',
    sourceSignal: 'Shopify Webhooks / SHOPIFY_ORDERS_QUEUE',
    unit: 'count',
    refreshCadenceSeconds: 10,
    recommendedWidget: 'stat_card',
    description: 'Total successful transactions processed and enqueued for workshop fulfillment.',
    thresholds: [],
  },
];

/**
 * Combined catalog of all 24 metrics.
 */
export const ALL_METRIC_DEFINITIONS: MetricDefinition[] = [
  ...ENGINEERING_METRICS,
  ...CREATOR_METRICS,
];

/**
 * Validates the completeness and integrity of the metrics catalog.
 */
export function validateMetricsCatalog(): {
  valid: boolean;
  totalMetrics: number;
  engineeringCount: number;
  creatorCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  infoAlertCount: number;
  errors: string[];
} {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  let engineeringCount = 0;
  let creatorCount = 0;
  let criticalAlertCount = 0;
  let warningAlertCount = 0;
  let infoAlertCount = 0;

  for (const metric of ALL_METRIC_DEFINITIONS) {
    if (seenIds.has(metric.id)) {
      errors.push(`Duplicate metric ID: "${metric.id}"`);
    }
    seenIds.add(metric.id);

    if (!metric.name || metric.name.trim().length === 0) {
      errors.push(`Metric "${metric.id}" is missing a name`);
    }
    if (!metric.formula || metric.formula.trim().length === 0) {
      errors.push(`Metric "${metric.id}" is missing a formula`);
    }
    if (!metric.sourceSignal || metric.sourceSignal.trim().length === 0) {
      errors.push(`Metric "${metric.id}" is missing a sourceSignal`);
    }
    if (metric.refreshCadenceSeconds <= 0) {
      errors.push(`Metric "${metric.id}" has invalid refresh cadence (${metric.refreshCadenceSeconds}s)`);
    }

    if (metric.persona === 'engineering') engineeringCount++;
    else if (metric.persona === 'creator') creatorCount++;
    else errors.push(`Metric "${metric.id}" has invalid persona: "${metric.persona}"`);

    for (const threshold of metric.thresholds) {
      if (threshold.severity === 'critical') criticalAlertCount++;
      else if (threshold.severity === 'warning') warningAlertCount++;
      else if (threshold.severity === 'info') infoAlertCount++;

      if (!threshold.message || threshold.message.trim().length === 0) {
        errors.push(`Alert in metric "${metric.id}" has empty alert message`);
      }
    }
  }

  // Enforce minimum metrics count per persona
  if (engineeringCount < 10) {
    errors.push(`Insufficient engineering metrics (${engineeringCount} < 10)`);
  }
  if (creatorCount < 10) {
    errors.push(`Insufficient creator metrics (${creatorCount} < 10)`);
  }
  if (criticalAlertCount < 4) {
    errors.push(`Insufficient critical alerting rules (${criticalAlertCount} < 4)`);
  }

  return {
    valid: errors.length === 0,
    totalMetrics: ALL_METRIC_DEFINITIONS.length,
    engineeringCount,
    creatorCount,
    criticalAlertCount,
    warningAlertCount,
    infoAlertCount,
    errors,
  };
}
