import { NextRequest, NextResponse } from 'next/server';
import {
  recordVitalBeacon,
  validateVitalPayload,
  getVitalsSummary,
  getVitalBeacons,
  type VitalBeaconInput,
  type VitalBeaconRecord,
} from '../../../../lib/vitals-telemetry';
import {
  extractTraceHeaders,
  runWithTraceContext,
  withTraceHeaders,
} from '../../../../lib/tracing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telemetry/vitals
 *
 * Edge Ingestion Endpoint for Real User Monitoring (RUM) & Core Web Vitals.
 * Accepts single beacon payloads or batch arrays from WebVitalsReporter,
 * applies ambient trace correlation (x-request-id / cf-ray), validates
 * schema, and writes to Workers Analytics Engine & structured edge logs.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const trace = extractTraceHeaders(req);

  return runWithTraceContext(trace, async () => {
    try {
      let rawText = '';
      try {
        rawText = await req.text();
      } catch {
        const res = NextResponse.json(
          { error: 'Failed to read vitals payload' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      if (!rawText.trim()) {
        const res = NextResponse.json(
          { error: 'Empty payload' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const res = NextResponse.json(
          { error: 'Invalid JSON payload' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const inputs: VitalBeaconInput[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.beacons)
          ? parsed.beacons
          : [parsed];

      const recorded: VitalBeaconRecord[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        if (!input || typeof input !== 'object') {
          validationErrors.push(`Beacon at index ${i} is not an object`);
          continue;
        }

        if (!input.correlation_id) {
          input.correlation_id = trace.requestId;
        }

        const validation = validateVitalPayload(input);
        if (!validation.valid) {
          validationErrors.push(`Beacon ${i} (${input.name || 'unknown'}): ${validation.errors.join('; ')}`);
          continue;
        }

        const record = recordVitalBeacon(input);
        recorded.push(record);
      }

      if (recorded.length === 0 && validationErrors.length > 0) {
        const res = NextResponse.json(
          {
            error: 'All vitals beacons failed validation',
            details: validationErrors,
          },
          { status: 422, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const res = NextResponse.json(
        {
          ok: true,
          processed: recorded.length,
          errors: validationErrors.length > 0 ? validationErrors : undefined,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Type': 'application/json',
          },
        }
      );
      return withTraceHeaders(res, trace);
    } catch (err: any) {
      const res = NextResponse.json(
        { error: err?.message || 'Internal error processing vitals telemetry' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
      return withTraceHeaders(res, trace);
    }
  });
}

/**
 * GET /api/telemetry/vitals
 *
 * Exposes real-time Core Web Vitals statistics (p75, p90, p95 percentiles,
 * Google threshold health, sample counts) for operational observability.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const trace = extractTraceHeaders(req);

  return runWithTraceContext(trace, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const name = searchParams.get('name') || undefined;
      const path = searchParams.get('path') || undefined;
      const sinceParam = searchParams.get('since');
      const since = sinceParam ? Number(sinceParam) : undefined;

      const summary = getVitalsSummary({ name, path, since });
      const recentBeacons = getVitalBeacons({ name, path, since }).slice(-50);

      const res = NextResponse.json(
        {
          ok: true,
          summary,
          recentCount: recentBeacons.length,
          recentBeacons,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Type': 'application/json',
          },
        }
      );
      return withTraceHeaders(res, trace);
    } catch (err: any) {
      const res = NextResponse.json(
        { error: err?.message || 'Failed to fetch vitals summary' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
      return withTraceHeaders(res, trace);
    }
  });
}
