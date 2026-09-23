import { NextResponse } from 'next/server';
import { performHealthCheck } from '../../../lib/health-monitoring';
import { extractTraceHeaders, withTraceHeaders } from '../../../lib/tracing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Cloudflare Workers Edge Health Check & Dependency Monitor (Story 4.2).
 * Verifies edge worker runtime health, D1 database connectivity (SELECT 1),
 * KV cache access (read/write probe), R2 bucket binding, and Shopify Storefront reachability.
 *
 * Returns HTTP 200 (healthy) or HTTP 503 (unhealthy) with detailed probe metrics.
 */
export async function GET(request: Request): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: Request): Promise<NextResponse> {
  const trace = extractTraceHeaders(request);

  // Support simulated outage for testing and on-call drills (Story 4.7)
  const url = request ? new URL(request.url) : null;
  const simulateParam = url?.searchParams.get('simulate');
  const simulateHeader = request?.headers.get('x-simulate-health-status');

  if (
    simulateParam === '500' ||
    simulateParam === 'downtime' ||
    simulateParam === 'unhealthy' ||
    simulateHeader === '500'
  ) {
    const errorPayload = {
      status: 'unhealthy',
      service: 'chrishop-edge-worker',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
      durationMs: 5,
      simulated: true,
      error: 'Simulated downtime drill (Story 4.7 / Better Stack Uptime Monitoring)',
      probes: {
        d1: { status: 'unhealthy', error: 'Simulated D1 connection timeout' },
        kv: { status: 'healthy' },
        shopify: { status: 'healthy' },
        r2: { status: 'healthy' },
      },
    };

    const res = NextResponse.json(errorPayload, {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-simulated-outage': 'true',
      },
    });
    return withTraceHeaders(res, trace);
  }

  const { payload, httpStatus } = await performHealthCheck();

  const d1Telemetry = payload.d1Telemetry;
  const res = NextResponse.json(payload, {
    status: httpStatus,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-response-time-ms': String(payload.durationMs),
      'x-chrishop-commit-sha': payload.commitSha || 'dev-local',
      ...(d1Telemetry
        ? {
            'x-d1-query-count': String(d1Telemetry.totalQueries),
            'x-d1-slow-queries': String(d1Telemetry.slowQueries),
            'x-d1-avg-latency-ms': String(d1Telemetry.avgDurationMs),
          }
        : {}),
      ...(payload.webhookTelemetry
        ? {
            'x-webhook-dlq-depth': String(payload.webhookTelemetry.dlqDepth),
            'x-webhook-idempotency-rate': String(payload.webhookTelemetry.idempotencyHitRate),
            'x-webhook-queue-lag-ms': String(payload.webhookTelemetry.averageQueueLagMs),
          }
        : {}),
    },
  });
  return withTraceHeaders(res, trace);
}
