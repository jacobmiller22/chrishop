/**
 * ChrisShop Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline
 *
 * Story 4.26 (#331): Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline
 *
 * Provides:
 * 1. Standardized Core Web Vitals schema (LCP, INP, CLS, FCP, TTFB)
 * 2. Official Google threshold classifications (good, needs-improvement, poor)
 * 3. Network and device capability attribution (effectiveType, downlink, rtt, deviceMemory, hardwareConcurrency)
 * 4. Rolling in-memory aggregation with p75, p90, p95 percentiles
 * 5. Workers Analytics Engine sink integration (VITALS_ANALYTICS binding)
 * 6. Structured edge logging for Cloudflare Logpush and Sentry performance breadcrumbs
 */

import { getCurrentTraceContext } from './tracing';

export type VitalMetricName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB' | 'FID';

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface VitalThresholdConfig {
  goodMax: number;
  needsImprovementMax: number;
  unit: 'ms' | 'score';
}

/**
 * Official Google Core Web Vitals assessment thresholds (75th percentile targets)
 */
export const WEB_VITALS_THRESHOLDS: Record<VitalMetricName, VitalThresholdConfig> = {
  LCP: { goodMax: 2500, needsImprovementMax: 4000, unit: 'ms' },
  INP: { goodMax: 200, needsImprovementMax: 500, unit: 'ms' },
  CLS: { goodMax: 0.1, needsImprovementMax: 0.25, unit: 'score' },
  FCP: { goodMax: 1800, needsImprovementMax: 3000, unit: 'ms' },
  TTFB: { goodMax: 800, needsImprovementMax: 1800, unit: 'ms' },
  FID: { goodMax: 100, needsImprovementMax: 300, unit: 'ms' },
};

export interface VitalDeviceContext {
  connectionType?: string;
  downlink?: number;
  rtt?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  userAgent?: string;
  viewport?: string;
}

export interface VitalBeaconRecord {
  id: string;
  name: VitalMetricName | string;
  value: number;
  delta?: number;
  rating: VitalRating;
  navigationType?: string;
  path: string;
  correlation_id: string;
  timestamp: number;
  device?: VitalDeviceContext;
}

export type VitalBeaconInput = Omit<VitalBeaconRecord, 'rating' | 'correlation_id' | 'timestamp'> & {
  rating?: VitalRating;
  correlation_id?: string;
  timestamp?: number;
};

export interface MetricDistribution {
  count: number;
  min: number;
  max: number;
  avg: number;
  p75: number;
  p90: number;
  p95: number;
  ratings: {
    good: number;
    needsImprovement: number;
    poor: number;
    goodPct: number;
    needsImprovementPct: number;
    poorPct: number;
  };
  googleAssessment: 'PASSING' | 'NEEDS_IMPROVEMENT' | 'FAILING';
}

export interface VitalsSummary {
  totalBeacons: number;
  timeWindow: {
    firstTimestamp: number | null;
    lastTimestamp: number | null;
  };
  metrics: Record<string, MetricDistribution>;
}

export type VitalBeaconListener = (record: VitalBeaconRecord) => void;

const vitalsListeners: VitalBeaconListener[] = [];
const VITALS_BUFFER_MAX_SIZE = 2500;
const vitalsBuffer: VitalBeaconRecord[] = [];

/**
 * Classifies a raw Web Vital measurement into Google's rating categories:
 * 'good', 'needs-improvement', or 'poor'.
 */
export function classifyVitalRating(name: string, value: number): VitalRating {
  const metric = name.toUpperCase() as VitalMetricName;
  const config = WEB_VITALS_THRESHOLDS[metric];

  if (!config) {
    return 'good';
  }

  if (value <= config.goodMax) {
    return 'good';
  }
  if (value <= config.needsImprovementMax) {
    return 'needs-improvement';
  }
  return 'poor';
}

/**
 * Validates that an incoming payload adheres to the Web Vitals beacon schema.
 */
export function validateVitalPayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Beacon payload must be a non-null object'] };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.name !== 'string' || !p.name.trim()) {
    errors.push('Missing or invalid metric name');
  }

  if (typeof p.value !== 'number' || isNaN(p.value) || p.value < 0) {
    errors.push(`Invalid metric value: ${String(p.value)}`);
  }

  if (p.path !== undefined && typeof p.path !== 'string') {
    errors.push('Path must be a string');
  }

  if (p.rating !== undefined) {
    const validRatings: VitalRating[] = ['good', 'needs-improvement', 'poor'];
    if (!validRatings.includes(p.rating as VitalRating)) {
      errors.push(`Invalid rating: "${String(p.rating)}". Expected one of: ${validRatings.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Registers an observer callback for emitted Web Vital beacons.
 * Returns an unregister function.
 */
export function onVitalBeacon(listener: VitalBeaconListener): () => void {
  vitalsListeners.push(listener);
  return () => {
    const idx = vitalsListeners.indexOf(listener);
    if (idx !== -1) vitalsListeners.splice(idx, 1);
  };
}

/**
 * Dispatches a metric to Cloudflare Workers Analytics Engine if bound.
 */
export function writeToVitalsAnalyticsEngine(
  record: VitalBeaconRecord,
  env?: Record<string, any>
): boolean {
  try {
    const g = globalThis as Record<string, any>;
    const analyticsEngine =
      env?.VITALS_ANALYTICS ||
      env?.ANALYTICS_ENGINE ||
      g.VITALS_ANALYTICS ||
      g.ANALYTICS_ENGINE;

    if (analyticsEngine && typeof analyticsEngine.writeDataPoint === 'function') {
      analyticsEngine.writeDataPoint({
        blobs: [
          record.name,
          record.rating,
          record.path,
          record.device?.connectionType || 'unknown',
          record.correlation_id,
          record.navigationType || 'navigate',
        ],
        doubles: [
          record.value,
          record.timestamp,
          record.device?.deviceMemory || 0,
          record.device?.rtt || 0,
          record.device?.downlink || 0,
        ],
        indexes: [record.name, record.rating],
      });
      return true;
    }
  } catch (err) {
    console.error('[WebVitals:AnalyticsEngineError]', err);
  }
  return false;
}

/**
 * Emits a structured log line for Cloudflare Logpush.
 */
function logStructuredVitalBeacon(record: VitalBeaconRecord): void {
  try {
    const line = JSON.stringify({
      telemetry: 'web_vitals',
      metric: record.name,
      value: record.value,
      rating: record.rating,
      path: record.path,
      correlationId: record.correlation_id,
      timestamp: record.timestamp,
      device: record.device,
    });
    console.log(`[WebVitals:Beacon] ${line}`);
  } catch {
    // Non-fatal logging error
  }
}

/**
 * Dispatches breadcrumb to Sentry without static imports to prevent require-in-the-middle errors in OpenNext.
 */
function dispatchSentryBreadcrumb(record: VitalBeaconRecord): void {
  try {
    const g = globalThis as any;
    if (g.Sentry && typeof g.Sentry.addBreadcrumb === 'function') {
      g.Sentry.addBreadcrumb({
        category: 'vitals.rum',
        message: `Web Vital ${record.name}: ${record.value} (${record.rating}) on ${record.path}`,
        level: record.rating === 'poor' ? 'warning' : 'info',
        data: {
          name: record.name,
          value: record.value,
          rating: record.rating,
          path: record.path,
          correlationId: record.correlation_id,
          connectionType: record.device?.connectionType,
        },
      });
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Ingests a Web Vital measurement, applies automatic rating classification and ambient trace correlation.
 */
export function recordVitalBeacon(
  input: VitalBeaconInput,
  env?: Record<string, any>
): VitalBeaconRecord {
  const trace = getCurrentTraceContext();
  const correlation_id =
    input.correlation_id ||
    trace?.requestId ||
    `vit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const rating = input.rating || classifyVitalRating(input.name, input.value);
  const timestamp = input.timestamp || Date.now();
  const id = input.id || `v-${Math.random().toString(36).substring(2, 9)}`;

  const record: VitalBeaconRecord = {
    id,
    name: input.name.toUpperCase(),
    value: Math.round(input.value * 1000) / 1000,
    delta: input.delta,
    rating,
    navigationType: input.navigationType,
    path: input.path || '/',
    correlation_id,
    timestamp,
    device: input.device,
  };

  // 1. Ring Buffer Ingestion
  if (vitalsBuffer.length >= VITALS_BUFFER_MAX_SIZE) {
    vitalsBuffer.shift();
  }
  vitalsBuffer.push(record);

  // 2. Structured Cloudflare Edge Log
  logStructuredVitalBeacon(record);

  // 3. Workers Analytics Engine Pipeline Sink
  writeToVitalsAnalyticsEngine(record, env);

  // 4. Sentry Breadcrumb
  dispatchSentryBreadcrumb(record);

  // 5. Notify registered event listeners
  for (const listener of vitalsListeners) {
    try {
      listener(record);
    } catch (err) {
      console.error('[WebVitals:ListenerError]', err);
    }
  }

  return record;
}

/**
 * Retrieves recorded vitals from the in-memory buffer.
 */
export function getVitalBeacons(filter?: {
  name?: string;
  path?: string;
  rating?: VitalRating;
  since?: number;
}): VitalBeaconRecord[] {
  return vitalsBuffer.filter((b) => {
    if (filter?.name && b.name.toUpperCase() !== filter.name.toUpperCase()) return false;
    if (filter?.path && b.path !== filter.path) return false;
    if (filter?.rating && b.rating !== filter.rating) return false;
    if (filter?.since !== undefined && b.timestamp < filter.since) return false;
    return true;
  });
}

/**
 * Clears the in-memory buffer (primarily for test isolation).
 */
export function clearVitalsBuffer(): void {
  vitalsBuffer.length = 0;
}

/**
 * Computes exact percentile values using nearest-rank interpolation.
 */
function calculatePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1)
  );
  return sortedValues[idx];
}

/**
 * Aggregates a list of vital records into distribution percentiles and Google threshold compliance.
 */
export function calculateVitalsSummary(records: VitalBeaconRecord[]): VitalsSummary {
  const grouped: Record<string, number[]> = {};
  const ratingsMap: Record<string, { good: number; needsImprovement: number; poor: number }> = {};

  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const r of records) {
    if (firstTs === null || r.timestamp < firstTs) firstTs = r.timestamp;
    if (lastTs === null || r.timestamp > lastTs) lastTs = r.timestamp;

    const metricName = r.name.toUpperCase();
    if (!grouped[metricName]) {
      grouped[metricName] = [];
      ratingsMap[metricName] = { good: 0, needsImprovement: 0, poor: 0 };
    }

    grouped[metricName].push(r.value);
    if (r.rating === 'good') {
      ratingsMap[metricName].good++;
    } else if (r.rating === 'needs-improvement') {
      ratingsMap[metricName].needsImprovement++;
    } else {
      ratingsMap[metricName].poor++;
    }
  }

  const metrics: Record<string, MetricDistribution> = {};

  const round2 = (n: number) => Math.round(n * 100) / 100;

  for (const [metricName, values] of Object.entries(grouped)) {
    values.sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = round2(sum / count);
    const p75 = round2(calculatePercentile(values, 75));
    const p90 = round2(calculatePercentile(values, 90));
    const p95 = round2(calculatePercentile(values, 95));

    const counts = ratingsMap[metricName];
    const goodPct = round2((counts.good / count) * 100);
    const needsImprovementPct = round2((counts.needsImprovement / count) * 100);
    const poorPct = round2((counts.poor / count) * 100);

    // Google assesses Core Web Vitals compliance at the 75th percentile
    const p75Rating = classifyVitalRating(metricName, p75);
    const googleAssessment =
      p75Rating === 'good'
        ? 'PASSING'
        : p75Rating === 'needs-improvement'
          ? 'NEEDS_IMPROVEMENT'
          : 'FAILING';

    metrics[metricName] = {
      count,
      min: round2(min),
      max: round2(max),
      avg,
      p75,
      p90,
      p95,
      ratings: {
        good: counts.good,
        needsImprovement: counts.needsImprovement,
        poor: counts.poor,
        goodPct,
        needsImprovementPct,
        poorPct,
      },
      googleAssessment,
    };
  }

  return {
    totalBeacons: records.length,
    timeWindow: {
      firstTimestamp: firstTs,
      lastTimestamp: lastTs,
    },
    metrics,
  };
}

/**
 * Returns summary metrics for the recorded vitals in the buffer.
 */
export function getVitalsSummary(filter?: {
  name?: string;
  path?: string;
  since?: number;
}): VitalsSummary {
  const records = getVitalBeacons(filter);
  return calculateVitalsSummary(records);
}
