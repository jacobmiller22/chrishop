import { NextRequest, NextResponse } from 'next/server';
import {
  recordFunnelEvent,
  validateFunnelEvent,
  getFunnelConversionMetrics,
  getFunnelEvents,
  type FunnelEventInput,
  type FunnelEvent,
} from '../../../../lib/funnel-telemetry';
import {
  extractTraceHeaders,
  runWithTraceContext,
  withTraceHeaders,
} from '../../../../lib/tracing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telemetry/funnel
 *
 * Edge Ingestion Endpoint for Storefront Conversion Funnel Telemetry.
 * Ingests single or batch events, binds edge correlation IDs, validates schema,
 * and streams to Workers Analytics Engine and edge log sinks.
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
          { error: 'Failed to read request payload' },
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

      // Support either a single event or a batch: { events: [...] } or [...]
      const eventInputs: FunnelEventInput[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.events)
          ? parsed.events
          : [parsed];

      const recordedEvents: FunnelEvent[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < eventInputs.length; i++) {
        const input = eventInputs[i];
        if (!input || typeof input !== 'object') {
          validationErrors.push(`Event at index ${i} is not a valid object`);
          continue;
        }

        // Attach ambient edge correlation if not present
        if (!input.correlation_id) {
          input.correlation_id = trace.requestId;
        }

        // Validate
        const validation = validateFunnelEvent({
          ...input,
          timestamp: input.timestamp || Date.now(),
        });

        if (!validation.valid) {
          validationErrors.push(`Event ${i} (${input.event_name || 'unknown'}): ${validation.errors.join('; ')}`);
          continue;
        }

        // Record event
        const recorded = recordFunnelEvent(input);
        recordedEvents.push(recorded);
      }

      if (recordedEvents.length === 0 && validationErrors.length > 0) {
        const res = NextResponse.json(
          {
            error: 'All events failed validation',
            details: validationErrors,
          },
          { status: 422, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const res = NextResponse.json(
        {
          ok: true,
          processed: recordedEvents.length,
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
        { error: err?.message || 'Internal error processing funnel telemetry' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
      return withTraceHeaders(res, trace);
    }
  });
}

/**
 * GET /api/telemetry/funnel
 *
 * Exposes real-time conversion rates and drop-off metrics for operations and diagnostics.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const trace = extractTraceHeaders(req);

  return runWithTraceContext(trace, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const drop_id = searchParams.get('drop_id') || undefined;
      const sinceParam = searchParams.get('since');
      const since = sinceParam ? Number(sinceParam) : undefined;

      const metrics = getFunnelConversionMetrics({ drop_id, since });
      const recentEvents = getFunnelEvents({ drop_id, since }).slice(-50);

      const res = NextResponse.json(
        {
          ok: true,
          metrics,
          recentEventsCount: recentEvents.length,
          recentEvents,
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
        { error: err?.message || 'Failed to fetch conversion metrics' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
      return withTraceHeaders(res, trace);
    }
  });
}
