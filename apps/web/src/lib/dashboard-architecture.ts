/**
 * ChrisShop Dashboard Architecture Evaluation Engine
 *
 * Story 4.16 (#168): Dashboard Architecture Spike — SaaS vs In-House vs Hybrid
 *
 * Formalizes evaluation models, cost simulations, persona fitness scores,
 * and architectural specifications for ChrisShop telemetry visualization.
 */

import {
  ENGINEERING_METRICS,
  CREATOR_METRICS,
  type PersonaType,
} from './metrics-catalog';

export type PlatformId =
  | 'datadog'
  | 'grafana_cloud'
  | 'better_stack'
  | 'cloudflare_native'
  | 'custom_in_house'
  | 'hybrid_recommended';

export type OperationalBurdenLevel = 'low' | 'medium' | 'high' | 'prohibitive';

export interface PlatformCostModel {
  baseMonthlyCostUsd: number;
  costPerMillionRequestsUsd: number;
  costPerGbLogsUsd: number;
  costPerHostOrSeatUsd: number;
  egressCostPerGbUsd: number;
  freeTierRetentionDays: number;
  freeTierMonthlyLimitRequests: number;
}

export interface PlatformEvaluation {
  id: PlatformId;
  name: string;
  category: 'saas_full' | 'saas_specialized' | 'cloud_native' | 'in_house' | 'hybrid';
  description: string;
  setupTimeHours: number;
  operationalBurden: OperationalBurdenLevel;
  dataIngestionLatencyMs: number;
  costModel: PlatformCostModel;
  personaFitnessJacob: number; // 1 - 10 scale
  personaFitnessChris: number; // 1 - 10 scale
  accessControlModel: string;
  supportedDataSources: string[];
  pros: string[];
  cons: string[];
  recommendationStatus: 'rejected' | 'evaluated' | 'recommended';
}

export interface PersonaRequirement {
  persona: PersonaType;
  primaryUser: string;
  authMethod: string;
  keyGoals: string[];
  requiredRefreshFrequencySeconds: number;
  preferredVisualStyles: string[];
  sensitiveDataExposure: 'full_technical' | 'creator_business_only';
}

export interface HybridLayerSpecification {
  layer: 'creator_drop_room' | 'jacob_edge_ops' | 'synthetic_heartbeat';
  targetAudience: 'Chris' | 'Jacob' | 'Autonomous Ops';
  hostLocation: string;
  authentication: string;
  dataSources: string[];
  metricIds: string[];
  latencyTargetMs: number;
  monthlyCostUsd: number;
  keyComponents: string[];
}

export interface ArchitectureSpikeSummary {
  winningPlatform: PlatformId;
  justification: string;
  evaluatedPlatforms: PlatformEvaluation[];
  hybridLayers: HybridLayerSpecification[];
  costComparison: {
    lowVolumeMonthlyCostUsd: Record<PlatformId, number>;
    highVolumeDropSpikeCostUsd: Record<PlatformId, number>; // 1,000,000 reqs + 20 GB logs
  };
  metricsCoverage: {
    engineeringTotal: number;
    engineeringMapped: number;
    creatorTotal: number;
    creatorMapped: number;
  };
}

/**
 * Persona Specifications for ChrisShop Dashboard
 */
export const PERSONA_REQUIREMENTS: Record<PersonaType, PersonaRequirement> = {
  engineering: {
    persona: 'engineering',
    primaryUser: 'Jacob Miller (Lead Architect & Platform Ops)',
    authMethod: 'Cloudflare Access Zero Trust (Google OAuth / Hardware Key) & Payload SuperAdmin RBAC',
    keyGoals: [
      'Real-time edge RPS, 5xx error spikes, and worker CPU time',
      'D1 SQL statement duration and slow query identification',
      'Workers KV cache hit/miss ratio during high traffic',
      'Turnstile challenge failure rate and WAF rate-limit triggers',
      'Immediate drill-down to Sentry trace IDs and edge logs',
    ],
    requiredRefreshFrequencySeconds: 5,
    preferredVisualStyles: ['time_series', 'gauge', 'log_table'],
    sensitiveDataExposure: 'full_technical',
  },
  creator: {
    persona: 'creator',
    primaryUser: 'Chris (Content Creator & Brand Owner)',
    authMethod: 'Payload CMS Custom Admin Role (`creator` RBAC role)',
    keyGoals: [
      'Live concurrent visitors watching drop countdown',
      'Cart additions velocity and checkout redirect success',
      'Real-time inventory burn-down per variant/size',
      'Total GMV and average order value (AOV)',
      'Celebratory order milestones without technical jargon',
    ],
    requiredRefreshFrequencySeconds: 2,
    preferredVisualStyles: ['stat_card', 'gauge', 'funnel_bar'],
    sensitiveDataExposure: 'creator_business_only',
  },
};

/**
 * Comprehensive Benchmarking Database of Evaluated Platforms
 */
export const PLATFORM_EVALUATIONS: Record<PlatformId, PlatformEvaluation> = {
  datadog: {
    id: 'datadog',
    name: 'Datadog APM & Log Management',
    category: 'saas_full',
    description: 'Enterprise observability suite with Cloudflare Logpush integration and custom dashboarding.',
    setupTimeHours: 24,
    operationalBurden: 'high',
    dataIngestionLatencyMs: 3000,
    costModel: {
      baseMonthlyCostUsd: 15,
      costPerMillionRequestsUsd: 1.70,
      costPerGbLogsUsd: 2.50,
      costPerHostOrSeatUsd: 15,
      egressCostPerGbUsd: 0.09,
      freeTierRetentionDays: 1,
      freeTierMonthlyLimitRequests: 10000,
    },
    personaFitnessJacob: 9,
    personaFitnessChris: 2,
    accessControlModel: 'SaaS SAML/SSO with per-seat billing ($15/user/mo)',
    supportedDataSources: ['Cloudflare Logpush', 'Sentry Webhooks', 'Shopify Webhooks'],
    pros: [
      'Industry-standard APM and edge correlation tracing',
      'Massive library of pre-built integrations',
      'Powerful anomaly detection and machine learning alerts',
    ],
    cons: [
      'Extremely expensive surge pricing during YouTube drop spikes',
      'UI is heavily complex and intimidating for a creator like Chris',
      'Requires separate credentials outside the ChrisShop store ecosystem',
      'High recurring base commitment ($15-23/seat/mo)',
    ],
    recommendationStatus: 'rejected',
  },

  grafana_cloud: {
    id: 'grafana_cloud',
    name: 'Grafana Cloud (Prometheus + Loki + Cloudflare Integration)',
    category: 'saas_full',
    description: 'Hosted Grafana stack with Loki log aggregation and Cloudflare GraphQL exporter.',
    setupTimeHours: 16,
    operationalBurden: 'medium',
    dataIngestionLatencyMs: 2500,
    costModel: {
      baseMonthlyCostUsd: 0,
      costPerMillionRequestsUsd: 0.50,
      costPerGbLogsUsd: 0.50,
      costPerHostOrSeatUsd: 8,
      egressCostPerGbUsd: 0.00,
      freeTierRetentionDays: 14,
      freeTierMonthlyLimitRequests: 50000,
    },
    personaFitnessJacob: 9,
    personaFitnessChris: 3,
    accessControlModel: 'Grafana Cloud Org RBAC (3 free users, $8/user/mo thereafter)',
    supportedDataSources: ['Cloudflare GraphQL API', 'Vector Log Stream', 'Sentry API'],
    pros: [
      'Generous free tier (10k metric series, 50 GB logs, 3 users)',
      'Highly flexible panel design and PromQL/LogQL querying',
      'Native Cloudflare dashboard templates available',
    ],
    cons: [
      'Requires maintaining external Prometheus/Loki exporters for D1 queries',
      'Cannot natively embed seamlessly into Payload CMS admin layout',
      'Chris would find PromQL panels confusing and overly dense',
    ],
    recommendationStatus: 'evaluated',
  },

  better_stack: {
    id: 'better_stack',
    name: 'Better Stack (Uptime + Better Stack Logs & Telemetry)',
    category: 'saas_specialized',
    description: 'Modern developer-friendly uptime monitoring and vector-based log streaming.',
    setupTimeHours: 6,
    operationalBurden: 'low',
    dataIngestionLatencyMs: 1200,
    costModel: {
      baseMonthlyCostUsd: 0,
      costPerMillionRequestsUsd: 0.25,
      costPerGbLogsUsd: 0.25,
      costPerHostOrSeatUsd: 0,
      egressCostPerGbUsd: 0.00,
      freeTierRetentionDays: 3,
      freeTierMonthlyLimitRequests: 100000,
    },
    personaFitnessJacob: 8,
    personaFitnessChris: 4,
    accessControlModel: 'Better Stack Team Access & Public Status Page',
    supportedDataSources: ['HTTP Synthetic Probes (/api/health)', 'Cloudflare Logpush (Vector/JSON)'],
    pros: [
      'Already successfully integrated for ChrisShop external heartbeat (#66)',
      'Ultra-fast setup with clean incident escalation to Discord/mobile push',
      'Built-in beautiful public status page for shoppers',
    ],
    cons: [
      'No native concept of commerce KPIs (inventory burn-down, Shopify AOV)',
      'Free tier log retention is restricted to 3 days',
      'Cannot execute custom SQL queries against Cloudflare D1',
    ],
    recommendationStatus: 'evaluated',
  },

  cloudflare_native: {
    id: 'cloudflare_native',
    name: 'Cloudflare Native Observability (Workers Analytics Engine + GraphQL)',
    category: 'cloud_native',
    description: 'Built-in edge telemetry using Workers Analytics Engine, D1 Metrics, and GraphQL Analytics API.',
    setupTimeHours: 8,
    operationalBurden: 'low',
    dataIngestionLatencyMs: 800,
    costModel: {
      baseMonthlyCostUsd: 5,
      costPerMillionRequestsUsd: 0.02,
      costPerGbLogsUsd: 0.00,
      costPerHostOrSeatUsd: 0,
      egressCostPerGbUsd: 0.00,
      freeTierRetentionDays: 30,
      freeTierMonthlyLimitRequests: 1000000,
    },
    personaFitnessJacob: 9,
    personaFitnessChris: 5,
    accessControlModel: 'Cloudflare Zero Trust Access & Cloudflare Dashboard Roles',
    supportedDataSources: ['Workers Runtime Metrics', 'D1 Analytics', 'KV Metrics', 'WAF Analytics Engine'],
    pros: [
      'Zero external data egress — telemetry stays within Cloudflare network',
      'Near-instant data availability at edge (<800ms)',
      'Virtually immune to surge pricing during 100k+ drop events',
    ],
    cons: [
      'Cloudflare Dashboard UI is separated from ChrisShop Payload CMS admin',
      'Chris cannot view live inventory burn-down or Shopify orders here',
    ],
    recommendationStatus: 'evaluated',
  },

  custom_in_house: {
    id: 'custom_in_house',
    name: 'Custom In-House Dashboard (Payload CMS v3 Admin + /ops Portal)',
    category: 'in_house',
    description: 'Custom React / Server Component dashboard embedded in Payload CMS `/admin` and Next.js `/ops`.',
    setupTimeHours: 18,
    operationalBurden: 'medium',
    dataIngestionLatencyMs: 50,
    costModel: {
      baseMonthlyCostUsd: 0,
      costPerMillionRequestsUsd: 0.00,
      costPerGbLogsUsd: 0.00,
      costPerHostOrSeatUsd: 0,
      egressCostPerGbUsd: 0.00,
      freeTierRetentionDays: 90,
      freeTierMonthlyLimitRequests: 10000000,
    },
    personaFitnessJacob: 8,
    personaFitnessChris: 10,
    accessControlModel: 'Payload CMS RBAC (`admin`, `creator`) + Cloudflare Access Zero Trust for `/ops`',
    supportedDataSources: ['D1 Database Queries', 'Workers KV State', 'Shopify Storefront API', 'Local Server Actions'],
    pros: [
      'Zero recurring SaaS subscription costs ($0/mo)',
      'Direct, frictionless UX for Chris inside the existing admin interface',
      'Perfect custom widgets: live inventory burn-down, countdown sync, GMV milestones',
      'Sub-50ms query latency querying D1 and Workers KV directly on edge',
    ],
    cons: [
      'Requires engineering maintenance of UI components and charts',
      'If Cloudflare Workers edge crashes completely, in-house dashboard also goes down',
    ],
    recommendationStatus: 'evaluated',
  },

  hybrid_recommended: {
    id: 'hybrid_recommended',
    name: 'Hybrid Architecture (In-House Drop Room + Cloudflare Edge Ops + Better Stack Heartbeat)',
    category: 'hybrid',
    description:
      'Tri-layer architecture combining Custom Payload CMS Drop Room for Chris, Cloudflare Native /ops for Jacob, and Better Stack external synthetic heartbeat.',
    setupTimeHours: 14,
    operationalBurden: 'low',
    dataIngestionLatencyMs: 50,
    costModel: {
      baseMonthlyCostUsd: 0,
      costPerMillionRequestsUsd: 0.02,
      costPerGbLogsUsd: 0.00,
      costPerHostOrSeatUsd: 0,
      egressCostPerGbUsd: 0.00,
      freeTierRetentionDays: 90,
      freeTierMonthlyLimitRequests: 5000000,
    },
    personaFitnessJacob: 10,
    personaFitnessChris: 10,
    accessControlModel:
      'Chris in Payload CMS `/admin/drop-room` (Payload RBAC) + Jacob in `/ops` (Cloudflare Access Zero Trust) + Better Stack external probe',
    supportedDataSources: [
      'Cloudflare Analytics Engine',
      'Cloudflare GraphQL API',
      'D1 SQL Queries',
      'Workers KV',
      'Shopify Admin API',
      'Better Stack Uptime Probe',
      'Sentry Error Pipeline',
    ],
    pros: [
      'Total separation of concerns: Chris gets a joyous creator view; Jacob gets low-level edge telemetry',
      'Negligible cost: $0 SaaS recurring fees, 100% resilient to drop traffic spikes',
      'High availability: External Better Stack probe alerts Jacob even if the edge runtime is down',
      'Zero data egress fees and zero third-party data privacy leakage',
    ],
    cons: [
      'Requires initial setup of two UI surfaces (Payload CMS custom view + Next.js /ops route)',
    ],
    recommendationStatus: 'recommended',
  },
};

/**
 * Specifications for the 3 Layers in the Recommended Hybrid Architecture
 */
export const HYBRID_LAYER_SPECS: HybridLayerSpecification[] = [
  {
    layer: 'creator_drop_room',
    targetAudience: 'Chris',
    hostLocation: 'apps/web/src/app/(payload)/admin/drop-room',
    authentication: 'Payload CMS RBAC (Role: `creator` or `admin`)',
    dataSources: ['D1 Database (orders, inventory)', 'Workers KV (drop state)', 'Shopify API'],
    metricIds: [
      'biz.concurrent_visitors',
      'biz.countdown_views_per_min',
      'biz.funnel_cart_velocity',
      'biz.checkout_handshake_failures',
      'biz.conversion_rate',
      'biz.inventory_burn_down_rate',
      'biz.projected_sell_out_time',
      'biz.inventory_remaining_percent',
      'biz.gross_merchandise_value',
      'biz.average_order_value',
      'biz.total_completed_orders',
    ],
    latencyTargetMs: 100,
    monthlyCostUsd: 0,
    keyComponents: [
      'LiveVisitorCounterCard',
      'CountdownStatusGauge',
      'InventoryBurndownProgressBar',
      'DropRevenueTicker',
      'ConversionFunnelStepper',
    ],
  },
  {
    layer: 'jacob_edge_ops',
    targetAudience: 'Jacob',
    hostLocation: 'apps/web/src/app/(storefront)/ops',
    authentication: 'Cloudflare Access Zero Trust (Google OAuth / Jacob Email)',
    dataSources: [
      'Cloudflare GraphQL Analytics API',
      'Workers Analytics Engine',
      'D1 Query Duration Logs',
      'Workers KV Hit/Miss Telemetry',
      'Sentry REST API',
    ],
    metricIds: [
      'eng.edge_rps',
      'eng.http_5xx_rate',
      'eng.edge_latency_p95',
      'eng.edge_latency_p99',
      'eng.worker_cpu_time',
      'eng.d1_query_latency_avg',
      'eng.d1_slow_query_rate',
      'eng.kv_cache_hit_ratio',
      'eng.sentry_unresolved_errors',
      'eng.better_stack_probe_latency',
      'eng.waf_block_rate',
      'eng.turnstile_pass_ratio',
    ],
    latencyTargetMs: 250,
    monthlyCostUsd: 0,
    keyComponents: [
      'EdgeLatencyTimeSeriesChart',
      'HttpStatusDistributionBar',
      'D1QueryPerformanceTable',
      'SecurityFirewallGauge',
      'SentryExceptionStream',
    ],
  },
  {
    layer: 'synthetic_heartbeat',
    targetAudience: 'Autonomous Ops',
    hostLocation: 'Better Stack Cloud (External Probing from US-East, US-West, EU-Central)',
    authentication: 'Better Stack API Token & Status Page Secret',
    dataSources: ['HTTP GET /api/health (Bypass Cloudflare Access)'],
    metricIds: ['eng.better_stack_probe_latency', 'eng.http_5xx_rate'],
    latencyTargetMs: 1000,
    monthlyCostUsd: 0,
    keyComponents: [
      'Global 60s Synthetic Probes',
      'Discord #dev-alerts Webhook Forwarder',
      'PagerDuty / Mobile Push Escalator',
      'Public Status Page (status.chrishop.com)',
    ],
  },
];

/**
 * Calculates projected monthly cost for a platform under given request and log volume.
 */
export function calculateMonthlyCost(
  platformId: PlatformId,
  requestsMonthly: number,
  logsGbMonthly: number,
  seatsCount: number = 2
): number {
  const platform = PLATFORM_EVALUATIONS[platformId];
  if (!platform) {
    throw new Error(`Unknown platform: ${platformId}`);
  }

  const { costModel } = platform;
  const billableRequests = Math.max(0, requestsMonthly - costModel.freeTierMonthlyLimitRequests);
  const requestsMillions = billableRequests / 1_000_000;

  const cost =
    costModel.baseMonthlyCostUsd +
    requestsMillions * costModel.costPerMillionRequestsUsd +
    logsGbMonthly * costModel.costPerGbLogsUsd +
    seatsCount * costModel.costPerHostOrSeatUsd;

  return Math.round(cost * 100) / 100;
}

/**
 * Returns comprehensive architecture spike summary.
 */
export function getArchitectureSpikeSummary(): ArchitectureSpikeSummary {
  const lowReqs = 50_000;
  const lowLogs = 2;

  const spikeReqs = 1_000_000;
  const spikeLogs = 20;

  const platformKeys = Object.keys(PLATFORM_EVALUATIONS) as PlatformId[];

  const lowVolumeMonthlyCostUsd = {} as Record<PlatformId, number>;
  const highVolumeDropSpikeCostUsd = {} as Record<PlatformId, number>;

  for (const id of platformKeys) {
    lowVolumeMonthlyCostUsd[id] = calculateMonthlyCost(id, lowReqs, lowLogs, 2);
    highVolumeDropSpikeCostUsd[id] = calculateMonthlyCost(id, spikeReqs, spikeLogs, 2);
  }

  // Calculate metric mapping coverage
  const allHybridMetricIds = new Set<string>();
  for (const layer of HYBRID_LAYER_SPECS) {
    for (const mId of layer.metricIds) {
      allHybridMetricIds.add(mId);
    }
  }

  const engMetricsMapped = ENGINEERING_METRICS.filter((m) => allHybridMetricIds.has(m.id)).length;
  const creatorMetricsMapped = CREATOR_METRICS.filter((m) => allHybridMetricIds.has(m.id)).length;

  return {
    winningPlatform: 'hybrid_recommended',
    justification:
      'The Hybrid Architecture provides $0 incremental SaaS cost, protects against high-volume YouTube merch drop surge fees, cleanly separates Chris (creator drop room in Payload CMS) from Jacob (edge ops in Next.js /ops behind Zero Trust), and preserves external uptime verification via Better Stack.',
    evaluatedPlatforms: Object.values(PLATFORM_EVALUATIONS),
    hybridLayers: HYBRID_LAYER_SPECS,
    costComparison: {
      lowVolumeMonthlyCostUsd,
      highVolumeDropSpikeCostUsd,
    },
    metricsCoverage: {
      engineeringTotal: ENGINEERING_METRICS.length,
      engineeringMapped: engMetricsMapped,
      creatorTotal: CREATOR_METRICS.length,
      creatorMapped: creatorMetricsMapped,
    },
  };
}
