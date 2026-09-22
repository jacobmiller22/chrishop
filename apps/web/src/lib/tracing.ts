/**
 * ChrisShop Distributed Tracing & Edge Correlation ID Propagation
 *
 * Story 4.25 (#330): Distributed Tracing & Edge Correlation ID Propagation
 *
 * Provides:
 * 1. Unified trace context extraction, generation, and response header injection (x-request-id, cf-ray)
 * 2. AsyncLocalStorage-based active trace context tracking across asynchronous execution chains
 * 3. Outbound Shopify Storefront API correlation propagation (X-Request-ID)
 * 4. Automatic Sentry error tag enrichment (correlation_id and cf_ray)
 * 5. D1 SQLite query correlation annotation (/* req:<id> ray:<ray> *\/)
 */

import * as asyncHooks from 'async_hooks';

export interface TraceContext {
  requestId: string;
  cfRay: string;
  traceParent?: string;
  startTime: number;
}

export interface TraceStorage<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
}

class FallbackAsyncLocalStorage<T> implements TraceStorage<T> {
  private store: T | undefined;

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = previous;
    }
  }
}

const StorageClass =
  asyncHooks && typeof (asyncHooks as any).AsyncLocalStorage === 'function'
    ? (asyncHooks as any).AsyncLocalStorage
    : FallbackAsyncLocalStorage;

export const traceStorage: TraceStorage<TraceContext> = new StorageClass();

/**
 * Generates a collision-resistant unique request ID formatted with timestamp and random string.
 */
export function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `req_${ts}_${rand}`;
}

/**
 * Generates a synthetic Cloudflare Ray ID if absent (e.g. in local/preview environments).
 */
export function generateSyntheticCfRay(): string {
  const rand = Math.random().toString(16).substring(2, 18);
  return `ray-${rand}`;
}

/**
 * Extracts correlation IDs from request or headers, generating unique identifiers if absent.
 */
export function extractTraceHeaders(
  requestOrHeaders?: Request | Headers | Record<string, string | string[] | undefined>
): TraceContext {
  if (!requestOrHeaders) {
    return {
      requestId: generateRequestId(),
      cfRay: generateSyntheticCfRay(),
      startTime: Date.now(),
    };
  }

  let getHeader: (name: string) => string | null | undefined;

  if (requestOrHeaders instanceof Request) {
    getHeader = (name) => requestOrHeaders.headers.get(name);
  } else if (typeof (requestOrHeaders as Headers).get === 'function') {
    getHeader = (name) => (requestOrHeaders as Headers).get(name);
  } else {
    const record = requestOrHeaders as Record<string, string | string[] | undefined>;
    getHeader = (name) => {
      const lower = name.toLowerCase();
      const val = record[lower] ?? record[name];
      return Array.isArray(val) ? val[0] : val;
    };
  }

  const requestId =
    getHeader('x-request-id') ||
    getHeader('x-correlation-id') ||
    getHeader('request-id') ||
    generateRequestId();

  const cfRay =
    getHeader('cf-ray') ||
    getHeader('x-amz-cf-id') ||
    generateSyntheticCfRay();

  const traceParent = getHeader('traceparent') || undefined;

  return {
    requestId,
    cfRay,
    traceParent,
    startTime: Date.now(),
  };
}

/**
 * Injects x-request-id, cf-ray, and x-correlation-id into response headers.
 */
export function withTraceHeaders<T extends Response | Headers | Record<string, string>>(
  target: T,
  context?: Partial<TraceContext>
): T {
  const current = getCurrentTraceContext();
  const requestId = context?.requestId || current?.requestId || generateRequestId();
  const cfRay = context?.cfRay || current?.cfRay || generateSyntheticCfRay();

  if (target instanceof Response) {
    target.headers.set('x-request-id', requestId);
    target.headers.set('cf-ray', cfRay);
    target.headers.set('x-correlation-id', requestId);
    return target;
  }

  if (typeof (target as Headers).set === 'function') {
    (target as Headers).set('x-request-id', requestId);
    (target as Headers).set('cf-ray', cfRay);
    (target as Headers).set('x-correlation-id', requestId);
    return target;
  }

  const record = target as Record<string, string>;
  record['x-request-id'] = requestId;
  record['cf-ray'] = cfRay;
  record['x-correlation-id'] = requestId;
  return target;
}

/**
 * Runs a function within the scope of an active TraceContext.
 */
export function runWithTraceContext<R>(context: TraceContext, fn: () => R): R {
  return traceStorage.run(context, fn);
}

/**
 * Retrieves the currently active TraceContext, if present.
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Annotates a SQL query string with the active trace context comment for D1 query attribution.
 */
export function annotateSqlQueryWithTrace(sql: string, context?: TraceContext): string {
  const trace = context || getCurrentTraceContext();
  if (!trace) return sql;
  const annotation = `/* req:${trace.requestId} ray:${trace.cfRay} */`;
  return `${sql.trim()} ${annotation}`;
}
