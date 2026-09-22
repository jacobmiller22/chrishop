/**
 * ChrisShop Incident Response & On-Call Paging Engine
 *
 * Story 4.17 (#169): Incident Response & On-Call Paging Spike
 *
 * Establishes:
 * 1. P0 (Critical), P1 (High), and P2 (Warning) Incident Severity Hierarchy
 * 2. Automated evaluation of telemetry signals against paging thresholds
 * 3. Multi-channel escalation dispatch (Voice call, SMS, Mobile Push, Discord)
 * 4. PagerDuty, Better Stack On-Call, and Discord notification formatters
 * 5. Simulation drills for operational drills and verification
 */

export type IncidentSeverity = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_WARNING';

export type NotificationChannel =
  | 'voice_call'
  | 'sms'
  | 'urgent_push'
  | 'discord_emergency'
  | 'discord_dev_alerts';

export interface AlertCondition {
  id: string;
  name: string;
  severity: IncidentSeverity;
  metricSource: string;
  thresholdExpression: string;
  evaluationWindowMinutes: number;
  channels: NotificationChannel[];
  autoEscalateMinutes?: number;
  remedyAction: string;
}

export interface TelemetrySignalSnapshot {
  edge5xxRatePercent: number; // e.g. 2.5%
  apiHealthFailingConsecutiveCycles: number; // e.g. 2
  shopifyCheckoutFailures: number; // e.g. 4
  d1ErrorsCount: number; // e.g. 6
  edgeLatencyP99Ms: number; // e.g. 2500
  webhookQueueBacklog: number; // e.g. 65
  wafBlockRatePercent: number; // e.g. 25%
  sentryUnresolvedErrors: number; // e.g. 8
  kvCacheHitRatioPercent: number; // e.g. 65%
}

export interface IncidentEvaluationResult {
  triggeredSeverity: IncidentSeverity | null;
  triggeredAlerts: AlertCondition[];
  channelsToNotify: NotificationChannel[];
  primaryEscalationRoute: string;
  suggestedMitigation: string;
}

export interface PagingPayload {
  incidentId: string;
  title: string;
  severity: IncidentSeverity;
  channels: NotificationChannel[];
  voiceScript: string;
  smsMessage: string;
  discordPayload: {
    content: string;
    embedTitle: string;
    embedColor: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
  };
}

/**
 * Canonical P0, P1, and P2 Alerting Rules for ChrisShop
 */
export const INCIDENT_ALERT_RULES: AlertCondition[] = [
  // ============================================================================
  // P0 / CRITICAL (Automated Voice Call & SMS Paging — Bypasses Do Not Disturb)
  // ============================================================================
  {
    id: 'p0.api_health_consecutive_failure',
    name: 'Edge Health Synthetic Probe Outage (/api/health)',
    severity: 'P0_CRITICAL',
    metricSource: 'Better Stack Global Probes (/api/health)',
    thresholdExpression: 'apiHealthFailingConsecutiveCycles >= 2',
    evaluationWindowMinutes: 2,
    channels: ['voice_call', 'sms', 'urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 5,
    remedyAction: 'Inspect Cloudflare edge deployments; trigger rollback.yml or inspect D1 database binding.',
  },
  {
    id: 'p0.edge_5xx_rate_spike',
    name: 'Edge HTTP 5xx Error Rate Surge (>= 2%)',
    severity: 'P0_CRITICAL',
    metricSource: 'Cloudflare Workers Analytics GraphQL / Edge Logs',
    thresholdExpression: 'edge5xxRatePercent >= 2.0',
    evaluationWindowMinutes: 2,
    channels: ['voice_call', 'sms', 'urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 5,
    remedyAction: 'Check Sentry error stream for unhandled worker runtime exceptions; execute immediate git rollback.',
  },
  {
    id: 'p0.checkout_creation_failures',
    name: 'Shopify Checkout Handshake Failures (> 3)',
    severity: 'P0_CRITICAL',
    metricSource: 'Storefront Cart API / checkout.create Mutation Telemetry',
    thresholdExpression: 'shopifyCheckoutFailures > 3',
    evaluationWindowMinutes: 2,
    channels: ['voice_call', 'sms', 'urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 5,
    remedyAction: 'Verify SHOPIFY_STOREFRONT_ACCESS_TOKEN and Shopify API rate limits; activate drop queue buffer.',
  },
  {
    id: 'p0.d1_database_connectivity_errors',
    name: 'Cloudflare D1 Database Errors (> 5/min)',
    severity: 'P0_CRITICAL',
    metricSource: 'D1 SQLite Client Telemetry / apps/web/src/lib/d1-client.ts',
    thresholdExpression: 'd1ErrorsCount > 5',
    evaluationWindowMinutes: 1,
    channels: ['voice_call', 'sms', 'urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 5,
    remedyAction: 'Verify D1 binding status and run d1:migrate check; failover to read-only cached catalog.',
  },

  // ============================================================================
  // P1 / HIGH (Urgent Push Notification + Discord Emergency @here Tag)
  // ============================================================================
  {
    id: 'p1.edge_latency_p99_degradation',
    name: 'Edge P99 Response Latency Degradation (> 2000ms)',
    severity: 'P1_HIGH',
    metricSource: 'Cloudflare Workers Analytics Engine (p99 latency)',
    thresholdExpression: 'edgeLatencyP99Ms > 2000',
    evaluationWindowMinutes: 5,
    channels: ['urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 15,
    remedyAction: 'Inspect D1 slow query log and verify KV edge cache hit ratio.',
  },
  {
    id: 'p1.shopify_webhook_queue_backlog',
    name: 'Shopify Webhook Queue Backlog (> 50 messages)',
    severity: 'P1_HIGH',
    metricSource: 'Cloudflare Queues / Shopify Webhook Router',
    thresholdExpression: 'webhookQueueBacklog > 50',
    evaluationWindowMinutes: 5,
    channels: ['urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 15,
    remedyAction: 'Inspect webhook consumer worker logs; check for D1 lock contention during batch inventory updates.',
  },
  {
    id: 'p1.waf_block_rate_surge',
    name: 'Cloudflare WAF Block Rate Surge (> 20% of traffic)',
    severity: 'P1_HIGH',
    metricSource: 'Cloudflare Security Events / WAF Analytics',
    thresholdExpression: 'wafBlockRatePercent > 20.0',
    evaluationWindowMinutes: 3,
    channels: ['urgent_push', 'discord_emergency'],
    autoEscalateMinutes: 15,
    remedyAction: 'Verify Turnstile pass rates; investigate distributed bot flood targeting /products or /checkout.',
  },

  // ============================================================================
  // P2 / WARNING (Passive Discord #dev-alerts Log)
  // ============================================================================
  {
    id: 'p2.sentry_unresolved_error_groups',
    name: 'Sentry Unhandled Exception Spike (> 5 groups)',
    severity: 'P2_WARNING',
    metricSource: 'Sentry Next.js / Edge SDK',
    thresholdExpression: 'sentryUnresolvedErrors > 5',
    evaluationWindowMinutes: 10,
    channels: ['discord_dev_alerts'],
    remedyAction: 'Review Sentry issue tracker, assign issue to active milestone, and patch in next release.',
  },
  {
    id: 'p2.kv_cache_hit_ratio_drop',
    name: 'Workers KV Cache Hit Ratio Depleted (< 70%)',
    severity: 'P2_WARNING',
    metricSource: 'Workers KV Analytics (kv.cache_hit_ratio)',
    thresholdExpression: 'kvCacheHitRatioPercent < 70.0',
    evaluationWindowMinutes: 5,
    channels: ['discord_dev_alerts'],
    remedyAction: 'Warm product catalog cache and check cache-control TTL headers.',
  },
];

/**
 * Evaluates current telemetry snapshot against canonical incident alert rules.
 */
export function evaluateTelemetrySnapshot(
  snapshot: TelemetrySignalSnapshot
): IncidentEvaluationResult {
  const triggeredAlerts: AlertCondition[] = [];

  for (const rule of INCIDENT_ALERT_RULES) {
    let triggered = false;

    switch (rule.id) {
      case 'p0.api_health_consecutive_failure':
        triggered = snapshot.apiHealthFailingConsecutiveCycles >= 2;
        break;
      case 'p0.edge_5xx_rate_spike':
        triggered = snapshot.edge5xxRatePercent >= 2.0;
        break;
      case 'p0.checkout_creation_failures':
        triggered = snapshot.shopifyCheckoutFailures > 3;
        break;
      case 'p0.d1_database_connectivity_errors':
        triggered = snapshot.d1ErrorsCount > 5;
        break;
      case 'p1.edge_latency_p99_degradation':
        triggered = snapshot.edgeLatencyP99Ms > 2000;
        break;
      case 'p1.shopify_webhook_queue_backlog':
        triggered = snapshot.webhookQueueBacklog > 50;
        break;
      case 'p1.waf_block_rate_surge':
        triggered = snapshot.wafBlockRatePercent > 20.0;
        break;
      case 'p2.sentry_unresolved_error_groups':
        triggered = snapshot.sentryUnresolvedErrors > 5;
        break;
      case 'p2.kv_cache_hit_ratio_drop':
        triggered = snapshot.kvCacheHitRatioPercent < 70.0;
        break;
      default:
        triggered = false;
    }

    if (triggered) {
      triggeredAlerts.push(rule);
    }
  }

  // Determine highest severity
  let highestSeverity: IncidentSeverity | null = null;
  if (triggeredAlerts.some((a) => a.severity === 'P0_CRITICAL')) {
    highestSeverity = 'P0_CRITICAL';
  } else if (triggeredAlerts.some((a) => a.severity === 'P1_HIGH')) {
    highestSeverity = 'P1_HIGH';
  } else if (triggeredAlerts.some((a) => a.severity === 'P2_WARNING')) {
    highestSeverity = 'P2_WARNING';
  }

  // Deduplicate notification channels
  const channelsSet = new Set<NotificationChannel>();
  for (const alert of triggeredAlerts) {
    for (const ch of alert.channels) {
      channelsSet.add(ch);
    }
  }

  let primaryRoute = 'None (Healthy)';
  if (highestSeverity === 'P0_CRITICAL') {
    primaryRoute = 'Better Stack On-Call (Automated Voice Call + SMS to Jacob Miller)';
  } else if (highestSeverity === 'P1_HIGH') {
    primaryRoute = 'Better Stack Push Notification + Discord Emergency @here';
  } else if (highestSeverity === 'P2_WARNING') {
    primaryRoute = 'Discord #dev-alerts (Passive Notification)';
  }

  const suggestedMitigation =
    triggeredAlerts.length > 0 ? triggeredAlerts[0].remedyAction : 'System nominal. No action required.';

  return {
    triggeredSeverity: highestSeverity,
    triggeredAlerts,
    channelsToNotify: Array.from(channelsSet),
    primaryEscalationRoute: primaryRoute,
    suggestedMitigation,
  };
}

/**
 * Compiles a rich multi-channel paging payload for an incident.
 */
export function compilePagingPayload(
  incidentId: string,
  alert: AlertCondition,
  snapshot: TelemetrySignalSnapshot
): PagingPayload {
  const isP0 = alert.severity === 'P0_CRITICAL';
  const isP1 = alert.severity === 'P1_HIGH';

  const severityLabel = isP0 ? 'P0 CRITICAL' : isP1 ? 'P1 HIGH' : 'P2 WARNING';
  const color = isP0 ? 0xff0033 : isP1 ? 0xffaa00 : 0x0099ff;

  const voiceScript = `Attention: ChrisShop Alert. Severity: ${severityLabel}. Incident: ${alert.name}. Immediate triage required. Please acknowledge in Better Stack or mobile app.`;
  const smsMessage = `🚨 [ChrisShop ${severityLabel}] ${alert.name}. Condition breached: ${alert.thresholdExpression}. Runbook: docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md`;

  const mention = isP0 ? '@everyone' : isP1 ? '@here' : '';
  const content = mention ? `${mention} **[ChrisShop ${severityLabel}]** ${alert.name}` : `**[ChrisShop ${severityLabel}]** ${alert.name}`;

  return {
    incidentId,
    title: `[${severityLabel}] ${alert.name}`,
    severity: alert.severity,
    channels: alert.channels,
    voiceScript,
    smsMessage,
    discordPayload: {
      content,
      embedTitle: `🚨 Incident Alert: ${alert.name}`,
      embedColor: color,
      fields: [
        { name: 'Incident ID', value: `\`${incidentId}\``, inline: true },
        { name: 'Severity', value: `**${severityLabel}**`, inline: true },
        { name: 'Signal Source', value: alert.metricSource, inline: false },
        { name: 'Threshold Condition', value: `\`${alert.thresholdExpression}\``, inline: true },
        { name: 'Evaluation Window', value: `${alert.evaluationWindowMinutes} minutes`, inline: true },
        {
          name: 'Observed Telemetry',
          value: `5xx: ${snapshot.edge5xxRatePercent}% | p99: ${snapshot.edgeLatencyP99Ms}ms | D1 Errors: ${snapshot.d1ErrorsCount} | Checkouts Failed: ${snapshot.shopifyCheckoutFailures}`,
          inline: false,
        },
        { name: 'Immediate Action / Runbook', value: alert.remedyAction, inline: false },
      ],
    },
  };
}
