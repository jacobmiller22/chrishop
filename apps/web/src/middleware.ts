import { NextResponse, type NextRequest } from 'next/server';
import { extractTraceHeaders, withTraceHeaders } from './lib/tracing';

/**
 * Next.js Edge Middleware: ChrisShop Distributed Tracing & Correlation Header Gateway
 *
 * Story 4.25 (#330): Distributed Tracing & Edge Correlation ID Propagation
 *
 * Intercepts all incoming requests across Storefront, Payload CMS, and Edge API endpoints,
 * ensuring that every request carries unified `x-request-id` and `cf-ray` correlation headers
 * both downstream to route handlers / server components and upstream on all client HTTP responses.
 */
export function middleware(request: NextRequest): NextResponse {
  const trace = extractTraceHeaders(request);

  // Propagate to downstream request headers (Server Components, API Routes)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', trace.requestId);
  requestHeaders.set('cf-ray', trace.cfRay);
  requestHeaders.set('x-correlation-id', trace.requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach to outbound client response headers (Acceptance Criteria 1)
  withTraceHeaders(response, trace);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
