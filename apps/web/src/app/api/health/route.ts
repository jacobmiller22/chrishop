import { NextResponse } from 'next/server';
import { performHealthCheck } from '../../../lib/health-monitoring';

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
export async function GET(_request?: Request): Promise<NextResponse> {
  const { payload, httpStatus } = await performHealthCheck();

  return NextResponse.json(payload, {
    status: httpStatus,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-response-time-ms': String(payload.durationMs),
      'x-chrishop-commit-sha': payload.commitSha || 'dev-local',
    },
  });
}
