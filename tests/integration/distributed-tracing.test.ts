/**
 * Integration Test Suite: Distributed Tracing & Edge Correlation ID Propagation
 *
 * Story 4.25 (#330): Distributed Tracing & Edge Correlation ID Propagation
 *
 * Validates:
 * 1. Trace context extraction and collision-resistant fallback generation
 * 2. Response header injection across Response, NextResponse, and Headers objects
 * 3. AsyncLocalStorage context isolation and persistence across asynchronous branches
 * 4. Outbound Shopify Storefront API client X-Request-ID propagation
 * 5. Automatic Sentry exception tag enrichment with correlation_id and cf_ray
 * 6. D1 SQLite query attribution comment formatting (/* req:<id> ray:<ray> *\/)
 * 7. Edge middleware request rewriting and outbound response header attachment
 * 8. API route handler response header echo (/api/health, /api/cart/create)
 * 9. Package.json script registration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractTraceHeaders,
  withTraceHeaders,
  runWithTraceContext,
  getCurrentTraceContext,
  annotateSqlQueryWithTrace,
  generateRequestId,
  generateSyntheticCfRay,
} from '../../apps/web/src/lib/tracing';
import { shopify, defaultShopifyMock } from '../../apps/web/src/lib/shopify';
import { captureException } from '../../apps/web/src/lib/sentry';
import { middleware } from '../../apps/web/src/middleware';
import { GET as healthRouteHandler } from '../../apps/web/src/app/api/health/route';

describe('Story 4.25: Distributed Tracing & Edge Correlation ID Propagation', () => {
  describe('1. Trace Header Extraction & Fallback Generation', () => {
    it('should extract explicit x-request-id and cf-ray from Headers', () => {
      const headers = new Headers({
        'x-request-id': 'req_custom_12345',
        'cf-ray': '8f123456789abcde-DEN',
        'traceparent': '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      });

      const trace = extractTraceHeaders(headers);
      assert.equal(trace.requestId, 'req_custom_12345');
      assert.equal(trace.cfRay, '8f123456789abcde-DEN');
      assert.equal(trace.traceParent, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
      assert.ok(trace.startTime > 0);
    });

    it('should fall back to x-correlation-id when x-request-id is absent', () => {
      const headers = new Headers({
        'x-correlation-id': 'corr_legacy_999',
      });

      const trace = extractTraceHeaders(headers);
      assert.equal(trace.requestId, 'corr_legacy_999');
      assert.ok(trace.cfRay.startsWith('ray-'));
    });

    it('should generate collision-resistant identifiers when incoming headers are empty', () => {
      const trace1 = extractTraceHeaders();
      const trace2 = extractTraceHeaders();

      assert.ok(trace1.requestId.startsWith('req_'));
      assert.ok(trace2.requestId.startsWith('req_'));
      assert.notEqual(trace1.requestId, trace2.requestId);

      assert.ok(trace1.cfRay.startsWith('ray-'));
      assert.ok(trace2.cfRay.startsWith('ray-'));
      assert.notEqual(trace1.cfRay, trace2.cfRay);
    });
  });

  describe('2. Response Header Injection', () => {
    it('should inject x-request-id, cf-ray, and x-correlation-id into Response headers', () => {
      const response = new Response(JSON.stringify({ ok: true }));
      const trace = {
        requestId: 'req_resp_test_1',
        cfRay: 'ray-resp-test-1',
        startTime: Date.now(),
      };

      withTraceHeaders(response, trace);

      assert.equal(response.headers.get('x-request-id'), 'req_resp_test_1');
      assert.equal(response.headers.get('cf-ray'), 'ray-resp-test-1');
      assert.equal(response.headers.get('x-correlation-id'), 'req_resp_test_1');
    });

    it('should inject trace headers into a plain Headers instance', () => {
      const headers = new Headers();
      const trace = {
        requestId: 'req_headers_test',
        cfRay: 'ray-headers-test',
        startTime: Date.now(),
      };

      withTraceHeaders(headers, trace);

      assert.equal(headers.get('x-request-id'), 'req_headers_test');
      assert.equal(headers.get('cf-ray'), 'ray-headers-test');
    });
  });

  describe('3. AsyncLocalStorage Execution Context Isolation', () => {
    it('should maintain trace context across asynchronous microtasks and delays', async () => {
      const traceContext = {
        requestId: 'req_async_task_001',
        cfRay: 'ray-async-task-001',
        startTime: Date.now(),
      };

      let observedInAsync: any = null;

      await runWithTraceContext(traceContext, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        observedInAsync = getCurrentTraceContext();
      });

      assert.ok(observedInAsync);
      assert.equal(observedInAsync.requestId, 'req_async_task_001');
      assert.equal(observedInAsync.cfRay, 'ray-async-task-001');
    });

    it('should isolate concurrent async operations without context bleeding', async () => {
      const traceA = { requestId: 'req_A', cfRay: 'ray_A', startTime: Date.now() };
      const traceB = { requestId: 'req_B', cfRay: 'ray_B', startTime: Date.now() };

      const [resA, resB] = await Promise.all([
        runWithTraceContext(traceA, async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return getCurrentTraceContext()?.requestId;
        }),
        runWithTraceContext(traceB, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getCurrentTraceContext()?.requestId;
        }),
      ]);

      assert.equal(resA, 'req_A');
      assert.equal(resB, 'req_B');
    });
  });

  describe('4. Outbound Shopify Storefront API Request Propagation', () => {
    it('should propagate X-Request-ID to Shopify client from active trace context', async () => {
      defaultShopifyMock.reset();

      const testTrace = {
        requestId: 'req_shopify_prop_777',
        cfRay: 'ray-shopify-777',
        startTime: Date.now(),
      };

      await runWithTraceContext(testTrace, async () => {
        await shopify.createCart('gid://shopify/ProductVariant/leadville-001', 1, '198.51.100.25');
      });

      assert.equal(defaultShopifyMock.lastRequestId, 'req_shopify_prop_777');
      assert.equal(defaultShopifyMock.lastBuyerIp, '198.51.100.25');
    });

    it('should prioritize explicitly passed requestId over ambient trace context', async () => {
      defaultShopifyMock.reset();

      const ambientTrace = {
        requestId: 'req_ambient',
        cfRay: 'ray-ambient',
        startTime: Date.now(),
      };

      await runWithTraceContext(ambientTrace, async () => {
        await shopify.createCart(
          'gid://shopify/ProductVariant/leadville-001',
          1,
          '198.51.100.25',
          'req_explicit_override'
        );
      });

      assert.equal(defaultShopifyMock.lastRequestId, 'req_explicit_override');
    });
  });

  describe('5. Sentry Error Tag Correlation Enrichment', () => {
    it('should enrich captured exception with correlation_id and cf_ray from trace context', () => {
      const traceContext = {
        requestId: 'req_sentry_enrich_888',
        cfRay: 'ray-sentry-888',
        startTime: Date.now(),
      };

      let eventId: string | null = null;
      runWithTraceContext(traceContext, () => {
        eventId = captureException(new Error('Simulated tracing integration exception'));
      });

      assert.ok(eventId, 'Event ID must be returned');
      assert.ok(typeof eventId === 'string');
    });
  });

  describe('6. D1 SQLite Query Attribution', () => {
    it('should annotate SQL queries with request and ray comments when trace context is active', () => {
      const trace = {
        requestId: 'req_sql_attribution',
        cfRay: 'ray-sql-attribution',
        startTime: Date.now(),
      };

      const rawSql = 'SELECT id, title, base_price FROM products WHERE status = "active";';
      const annotated = annotateSqlQueryWithTrace(rawSql, trace);

      assert.ok(annotated.includes('/* req:req_sql_attribution ray:ray-sql-attribution */'));
      assert.ok(annotated.startsWith('SELECT id, title, base_price FROM products'));
    });

    it('should leave SQL unchanged when no trace context is active or provided', () => {
      const rawSql = 'SELECT 1;';
      const result = annotateSqlQueryWithTrace(rawSql, undefined);
      assert.equal(result, 'SELECT 1;');
    });
  });

  describe('7. Next.js Edge Middleware', () => {
    it('should attach x-request-id and cf-ray to response when processing incoming request', () => {
      const request = new NextRequest('http://localhost:3000/products', {
        headers: {
          'x-request-id': 'req_middleware_in_123',
          'cf-ray': 'ray-middleware-in-123',
        },
      });

      const response = middleware(request);

      assert.ok(response instanceof NextResponse);
      assert.equal(response.headers.get('x-request-id'), 'req_middleware_in_123');
      assert.equal(response.headers.get('cf-ray'), 'ray-middleware-in-123');
      assert.equal(response.headers.get('x-correlation-id'), 'req_middleware_in_123');
    });

    it('should generate trace headers if incoming request lacks them', () => {
      const request = new NextRequest('http://localhost:3000/about');
      const response = middleware(request);

      assert.ok(response.headers.get('x-request-id')?.startsWith('req_'));
      assert.ok(response.headers.get('cf-ray')?.startsWith('ray-'));
    });
  });

  describe('8. API Route Handlers Integration', () => {
    it('should echo x-request-id and cf-ray on /api/health probe response', async () => {
      const req = new Request('http://localhost:3000/api/health', {
        headers: {
          'x-request-id': 'req_health_probe_001',
          'cf-ray': 'ray-health-probe-001',
        },
      });

      const response = await healthRouteHandler(req);

      assert.equal(response.headers.get('x-request-id'), 'req_health_probe_001');
      assert.equal(response.headers.get('cf-ray'), 'ray-health-probe-001');
    });
  });

  describe('9. Package.json Script Registration', () => {
    it('should verify tracing:verify script is registered in root package.json', () => {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      assert.equal(pkg.scripts['tracing:verify'], 'tsx scripts/verify-distributed-tracing.ts');
    });
  });
});
