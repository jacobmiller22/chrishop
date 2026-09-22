/**
 * ChrisShop Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 *
 * Story 4.27 (#332): Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 *
 * Provides:
 * 1. Transparent timing instrumentation for Cloudflare D1 queries (all, get, first, run, exec).
 * 2. Slow query detection (>50ms default threshold) with structured diagnostic warning logs and Sentry breadcrumbs.
 * 3. Read/write query categorization (SELECT vs mutations).
 * 4. Aggregate telemetry (total, slow, min, max, avg, p95 percentiles) and per-request trace aggregation.
 * 5. Diagnostic exports consumed by edge health checks (/api/health) and observability pipelines.
 */

import type { D1DatabaseLike } from './catalog';
import { getCurrentTraceContext } from './tracing';

export const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 50;

export type SlowQueryListener = (record: SlowQueryRecord) => void;
const slowQueryListeners: SlowQueryListener[] = [];

/**
 * Registers a listener callback invoked whenever a query exceeds the slow query threshold.
 * Returns an unregister function.
 */
export function onSlowQuery(listener: SlowQueryListener): () => void {
  slowQueryListeners.push(listener);
  return () => {
    const idx = slowQueryListeners.indexOf(listener);
    if (idx !== -1) slowQueryListeners.splice(idx, 1);
  };
}

/**
 * Dispatches breadcrumb to Sentry without static imports to prevent require-in-the-middle bundling errors in OpenNext.
 */
function dispatchSentryBreadcrumb(record: SlowQueryRecord): void {
  try {
    const g = globalThis as any;
    if (g.Sentry && typeof g.Sentry.addBreadcrumb === 'function') {
      g.Sentry.addBreadcrumb({
        category: 'd1.slow_query',
        message: `D1 query exceeded ${record.thresholdMs}ms latency threshold (${record.durationMs}ms)`,
        level: 'warning',
        data: {
          sql: record.sql,
          durationMs: record.durationMs,
          thresholdMs: record.thresholdMs,
          operation: record.operation,
          requestId: record.requestId,
          cfRay: record.cfRay,
        },
      });
    }
  } catch {
    // Non-fatal breadcrumb dispatch failure
  }
}

let activeSlowQueryThresholdMs =
  typeof process !== 'undefined' && process.env.D1_SLOW_QUERY_THRESHOLD_MS
    ? Number.parseInt(process.env.D1_SLOW_QUERY_THRESHOLD_MS, 10) || DEFAULT_SLOW_QUERY_THRESHOLD_MS
    : DEFAULT_SLOW_QUERY_THRESHOLD_MS;

export function getSlowQueryThreshold(): number {
  return activeSlowQueryThresholdMs;
}

export function setSlowQueryThreshold(thresholdMs: number): void {
  activeSlowQueryThresholdMs = thresholdMs > 0 ? thresholdMs : DEFAULT_SLOW_QUERY_THRESHOLD_MS;
}

export interface SlowQueryRecord {
  sql: string;
  durationMs: number;
  thresholdMs: number;
  operation: 'all' | 'get' | 'first' | 'run' | 'exec';
  timestamp: string;
  requestId?: string;
  cfRay?: string;
  error?: string;
}

export interface RequestD1Metrics {
  requestId: string;
  totalQueries: number;
  readQueries: number;
  writeQueries: number;
  slowQueries: number;
  totalDurationMs: number;
  queries: Array<{
    sql: string;
    durationMs: number;
    operation: string;
    isSlow: boolean;
  }>;
}

export interface D1TelemetryMetrics {
  totalQueries: number;
  readQueries: number;
  writeQueries: number;
  slowQueries: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p95DurationMs: number;
  activeThresholdMs: number;
  recentSlowQueries: SlowQueryRecord[];
}

// Global rolling telemetry state
let totalQueries = 0;
let readQueries = 0;
let writeQueries = 0;
let slowQueries = 0;
let totalDurationMs = 0;
let minDurationMs = Number.POSITIVE_INFINITY;
let maxDurationMs = 0;

// Rolling window of recent durations for accurate percentile calculation (max 1000 samples)
const durationSamples: number[] = [];
const MAX_SAMPLES = 1000;

// Recent slow query ring buffer (max 50)
const recentSlowQueries: SlowQueryRecord[] = [];
const MAX_SLOW_RECORDS = 50;

// Per-request metrics ring buffer (max 500 requests)
const requestMetricsMap = new Map<string, RequestD1Metrics>();
const MAX_TRACKED_REQUESTS = 500;

/**
 * Categorizes a SQL statement as 'read' or 'write'.
 */
export function categorizeSqlQuery(sql: string): 'read' | 'write' {
  // Strip comments, quotes, and whitespace
  const sanitized = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim()
    .toUpperCase();

  if (
    sanitized.startsWith('SELECT') ||
    sanitized.startsWith('PRAGMA') ||
    sanitized.startsWith('EXPLAIN')
  ) {
    return 'read';
  }
  return 'write';
}

/**
 * Records an individual D1 query execution and updates metrics and alert pipelines.
 */
export function recordD1Execution(
  sql: string,
  durationMs: number,
  operation: 'all' | 'get' | 'first' | 'run' | 'exec',
  error?: unknown
): void {
  const roundedDuration = Math.round(durationMs * 100) / 100;
  totalQueries++;
  totalDurationMs += roundedDuration;

  if (roundedDuration < minDurationMs) {
    minDurationMs = roundedDuration;
  }
  if (roundedDuration > maxDurationMs) {
    maxDurationMs = roundedDuration;
  }

  const queryType = categorizeSqlQuery(sql);
  if (queryType === 'read') {
    readQueries++;
  } else {
    writeQueries++;
  }

  // Record duration sample for p95 calculation
  durationSamples.push(roundedDuration);
  if (durationSamples.length > MAX_SAMPLES) {
    durationSamples.shift();
  }

  const isSlow = roundedDuration > activeSlowQueryThresholdMs;
  const trace = getCurrentTraceContext();
  const requestId = trace?.requestId;
  const cfRay = trace?.cfRay;

  if (isSlow) {
    slowQueries++;
    const slowRecord: SlowQueryRecord = {
      sql,
      durationMs: roundedDuration,
      thresholdMs: activeSlowQueryThresholdMs,
      operation,
      timestamp: new Date().toISOString(),
      requestId,
      cfRay,
      error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
    };

    recentSlowQueries.unshift(slowRecord);
    if (recentSlowQueries.length > MAX_SLOW_RECORDS) {
      recentSlowQueries.pop();
    }

    // Structured diagnostic warning log
    console.warn(
      `[D1:SlowQuery] SQL: "${sql.trim()}" | Duration: ${roundedDuration}ms | Threshold: ${activeSlowQueryThresholdMs}ms | Req: ${requestId || 'none'} | Ray: ${cfRay || 'none'}`
    );

    // Sentry diagnostic breadcrumb & listener notifications
    dispatchSentryBreadcrumb(slowRecord);
    for (const listener of slowQueryListeners) {
      try {
        listener(slowRecord);
      } catch (listenerErr) {
        console.error('[D1:SlowQueryListenerError]', listenerErr);
      }
    }
  }

  // Update per-request aggregation
  if (requestId) {
    let reqMetrics = requestMetricsMap.get(requestId);
    if (!reqMetrics) {
      if (requestMetricsMap.size >= MAX_TRACKED_REQUESTS) {
        // Evict oldest request
        const oldestKey = requestMetricsMap.keys().next().value;
        if (oldestKey) requestMetricsMap.delete(oldestKey);
      }
      reqMetrics = {
        requestId,
        totalQueries: 0,
        readQueries: 0,
        writeQueries: 0,
        slowQueries: 0,
        totalDurationMs: 0,
        queries: [],
      };
      requestMetricsMap.set(requestId, reqMetrics);
    }

    reqMetrics.totalQueries++;
    reqMetrics.totalDurationMs = Math.round((reqMetrics.totalDurationMs + roundedDuration) * 100) / 100;
    if (queryType === 'read') {
      reqMetrics.readQueries++;
    } else {
      reqMetrics.writeQueries++;
    }
    if (isSlow) {
      reqMetrics.slowQueries++;
    }
    if (reqMetrics.queries.length < 50) {
      reqMetrics.queries.push({
        sql,
        durationMs: roundedDuration,
        operation,
        isSlow,
      });
    }
  }
}

/**
 * Calculates p95 latency from recorded duration samples.
 */
function calculateP95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

/**
 * Returns a complete snapshot of current D1 database telemetry.
 */
export function getD1TelemetryMetrics(): D1TelemetryMetrics {
  const avg = totalQueries > 0 ? Math.round((totalDurationMs / totalQueries) * 100) / 100 : 0;
  const p95 = calculateP95(durationSamples);

  return {
    totalQueries,
    readQueries,
    writeQueries,
    slowQueries,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    avgDurationMs: avg,
    minDurationMs: minDurationMs === Number.POSITIVE_INFINITY ? 0 : minDurationMs,
    maxDurationMs,
    p95DurationMs: p95,
    activeThresholdMs: activeSlowQueryThresholdMs,
    recentSlowQueries: [...recentSlowQueries],
  };
}

/**
 * Retrieves per-request D1 metrics for a given request ID or the ambient request context.
 */
export function getRequestD1Metrics(requestId?: string): RequestD1Metrics | null {
  const targetId = requestId || getCurrentTraceContext()?.requestId;
  if (!targetId) return null;
  const found = requestMetricsMap.get(targetId);
  return found ? JSON.parse(JSON.stringify(found)) : null;
}

/**
 * Resets all recorded D1 telemetry metrics (useful for test isolation).
 */
export function resetD1TelemetryMetrics(): void {
  totalQueries = 0;
  readQueries = 0;
  writeQueries = 0;
  slowQueries = 0;
  totalDurationMs = 0;
  minDurationMs = Number.POSITIVE_INFINITY;
  maxDurationMs = 0;
  durationSamples.length = 0;
  recentSlowQueries.length = 0;
  requestMetricsMap.clear();
}

const D1_TELEMETRY_WRAPPED = Symbol.for('__chrishop_d1_telemetry_wrapped__');

/**
 * Wraps a D1DatabaseLike instance with transparent statement execution latency tracking.
 */
export function withD1Telemetry(db: D1DatabaseLike): D1DatabaseLike {
  if (!db || (db as any)[D1_TELEMETRY_WRAPPED]) {
    return db;
  }

  const wrapper: D1DatabaseLike = {
    prepare(sql: string) {
      const origStmt = db.prepare(sql);

      function wrapStatement(stmt: any): any {
        return {
          bind: (...params: any[]) => {
            const bound = stmt.bind ? stmt.bind(...params) : stmt;
            return wrapStatement(bound);
          },
          all: async (...params: any[]) => {
            const start = performance.now();
            let err: unknown;
            try {
              return await stmt.all(...params);
            } catch (e) {
              err = e;
              throw e;
            } finally {
              const duration = performance.now() - start;
              recordD1Execution(sql, duration, 'all', err);
            }
          },
          get: async (...params: any[]) => {
            const start = performance.now();
            let err: unknown;
            try {
              return await stmt.get(...params);
            } catch (e) {
              err = e;
              throw e;
            } finally {
              const duration = performance.now() - start;
              recordD1Execution(sql, duration, 'get', err);
            }
          },
          first: async (...params: any[]) => {
            const start = performance.now();
            let err: unknown;
            try {
              if (typeof stmt.first === 'function') {
                return await stmt.first(...params);
              }
              return await stmt.get(...params);
            } catch (e) {
              err = e;
              throw e;
            } finally {
              const duration = performance.now() - start;
              recordD1Execution(sql, duration, 'first', err);
            }
          },
          run: async (...params: any[]) => {
            const start = performance.now();
            let err: unknown;
            try {
              return await stmt.run(...params);
            } catch (e) {
              err = e;
              throw e;
            } finally {
              const duration = performance.now() - start;
              recordD1Execution(sql, duration, 'run', err);
            }
          },
        };
      }

      return wrapStatement(origStmt);
    },
    exec: async (sql: string) => {
      const start = performance.now();
      let err: unknown;
      try {
        if (typeof db.exec === 'function') {
          return await db.exec(sql);
        }
      } catch (e) {
        err = e;
        throw e;
      } finally {
        const duration = performance.now() - start;
        recordD1Execution(sql, duration, 'exec', err);
      }
    },
  };

  (wrapper as any)[D1_TELEMETRY_WRAPPED] = true;
  return wrapper;
}
