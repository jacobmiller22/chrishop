/**
 * ChrisShop Integration Test Suite: Drop Day Conversion Funnel Instrumentation & Step Telemetry
 *
 * Story 4.28 (#333): Drop Day Conversion Funnel Instrumentation & Step Telemetry
 *
 * Validates:
 * 1. Standardized 6-stage funnel event schema validation and rejection of malformed data.
 * 2. Sequential funnel progression tracking (countdown_view -> product_view -> add_to_cart_attempt -> cart_create_result -> checkout_redirect -> order_completed).
 * 3. Cart creation outcome disambiguation (success, rate_limited, out_of_stock).
 * 4. Conversion rate and bottleneck metrics arithmetic (conversion %, drop-off %, stockout %, rate limit backpressure %).
 * 5. Workers Analytics Engine sink dispatching (CONVERSION_ANALYTICS).
 * 6. Edge Ingestion Route Handlers (/api/telemetry/funnel POST & GET).
 * 7. In-flight cart creation route telemetry integration (/api/cart/create).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  recordFunnelEvent,
  validateFunnelEvent,
  getFunnelEvents,
  clearFunnelEvents,
  calculateFunnelMetrics,
  getFunnelConversionMetrics,
  writeToWorkersAnalyticsEngine,
  onFunnelEvent,
  type FunnelEvent,
} from '../../apps/web/src/lib/funnel-telemetry';
import { POST as funnelPostHandler, GET as funnelGetHandler } from '../../apps/web/src/app/api/telemetry/funnel/route';
import { POST as cartCreateRouteHandler } from '../../apps/web/src/app/api/cart/create/route';
import { shopify } from '../../apps/web/src/lib/shopify';
import { defaultShopifyMock } from '../../apps/web/src/lib/shopify-mock';

describe('Story 4.28: Drop Day Conversion Funnel Instrumentation & Step Telemetry', () => {
  beforeEach(() => {
    clearFunnelEvents();
    defaultShopifyMock.reset();
  });

  describe('1. Schema Validation & Guardrail Rules', () => {
    it('should validate conforming events with all required fields', () => {
      const validEvent: FunnelEvent = {
        event_name: 'product_view',
        step_index: 2,
        drop_id: 'leadville-01',
        product_id: 'rig-v1',
        variant_id: 'var-camo',
        correlation_id: 'trace-abc-123',
        session_id: 'ses-456',
        timestamp: Date.now(),
        metadata: { price: 295 },
      };

      const result = validateFunnelEvent(validEvent);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should reject malformed events with descriptive error messages', () => {
      const malformedEvent = {
        event_name: 'unrecognized_stage',
        drop_id: '',
        product_id: '',
        correlation_id: '',
        timestamp: -50,
        step_index: 99,
      };

      const result = validateFunnelEvent(malformedEvent);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('event_name')));
      assert.ok(result.errors.some((e) => e.includes('drop_id')));
      assert.ok(result.errors.some((e) => e.includes('product_id')));
      assert.ok(result.errors.some((e) => e.includes('correlation_id')));
      assert.ok(result.errors.some((e) => e.includes('timestamp')));
      assert.ok(result.errors.some((e) => e.includes('step_index')));
    });
  });

  describe('2. Full 6-Stage Drop Progression Sequence', () => {
    it('should assign sequential step indices (1 to 6) across the funnel lifecycle', () => {
      const sessionId = 'ses_shopper_flow_1';
      const dropId = 'drop_leadville_alpha';
      const productId = 'prod_alpine_rig';

      const s1 = recordFunnelEvent({
        event_name: 'countdown_view',
        drop_id: dropId,
        product_id: productId,
        session_id: sessionId,
      });
      assert.equal(s1.step_index, 1);

      const s2 = recordFunnelEvent({
        event_name: 'product_view',
        drop_id: dropId,
        product_id: productId,
        session_id: sessionId,
      });
      assert.equal(s2.step_index, 2);

      const s3 = recordFunnelEvent({
        event_name: 'add_to_cart_attempt',
        drop_id: dropId,
        product_id: productId,
        session_id: sessionId,
      });
      assert.equal(s3.step_index, 3);

      const s4 = recordFunnelEvent({
        event_name: 'cart_create_result',
        outcome: 'cart_create_success',
        drop_id: dropId,
        product_id: productId,
        session_id: sessionId,
      });
      assert.equal(s4.step_index, 4);

      const s5 = recordFunnelEvent({
        event_name: 'checkout_redirect',
        drop_id: dropId,
        product_id: productId,
        session_id: sessionId,
      });
      assert.equal(s5.step_index, 5);

      const s6 = recordFunnelEvent({
        event_name: 'order_completed',
        outcome: 'success',
        drop_id: dropId,
        product_id: productId,
        session_id: sessionId,
      });
      assert.equal(s6.step_index, 6);

      const events = getFunnelEvents({ session_id: sessionId });
      assert.equal(events.length, 6);
      assert.deepEqual(
        events.map((e) => e.step_index),
        [1, 2, 3, 4, 5, 6]
      );
    });

    it('should dispatch events to registered listeners', () => {
      const listenerEvents: FunnelEvent[] = [];
      const unregister = onFunnelEvent((ev) => listenerEvents.push(ev));

      recordFunnelEvent({
        event_name: 'countdown_view',
        drop_id: 'listener_drop',
        product_id: 'p1',
      });
      recordFunnelEvent({
        event_name: 'product_view',
        drop_id: 'listener_drop',
        product_id: 'p1',
      });

      unregister();

      recordFunnelEvent({
        event_name: 'add_to_cart_attempt',
        drop_id: 'listener_drop',
        product_id: 'p1',
      });

      assert.equal(listenerEvents.length, 2);
    });
  });

  describe('3. Cart Creation Outcome Disambiguation', () => {
    it('should accurately partition outcomes into success, rate_limited, and out_of_stock', () => {
      const dropId = 'drop_stress_test';

      // 5 successes
      for (let i = 0; i < 5; i++) {
        recordFunnelEvent({
          event_name: 'cart_create_result',
          outcome: 'cart_create_success',
          drop_id: dropId,
          product_id: 'prod_1',
        });
      }

      // 3 rate limited
      for (let i = 0; i < 3; i++) {
        recordFunnelEvent({
          event_name: 'cart_create_result',
          outcome: 'rate_limited',
          drop_id: dropId,
          product_id: 'prod_1',
        });
      }

      // 2 out of stock
      for (let i = 0; i < 2; i++) {
        recordFunnelEvent({
          event_name: 'cart_create_result',
          outcome: 'out_of_stock',
          drop_id: dropId,
          product_id: 'prod_1',
        });
      }

      const metrics = getFunnelConversionMetrics({ drop_id: dropId });
      assert.equal(metrics.counts.cart_create_success, 5);
      assert.equal(metrics.counts.rate_limited, 3);
      assert.equal(metrics.counts.out_of_stock, 2);

      // Total creations = 10
      assert.equal(metrics.bottlenecks.cartRateLimitPct, 30); // 3/10
      assert.equal(metrics.bottlenecks.cartOutOfStockPct, 20); // 2/10
    });
  });

  describe('4. Conversion Rate & Bottleneck Arithmetic', () => {
    it('should compute exact stage-by-stage and overall conversion rates', () => {
      const events: FunnelEvent[] = [];

      // 200 countdown impressions
      for (let i = 0; i < 200; i++) {
        events.push({ event_name: 'countdown_view', step_index: 1, drop_id: 'drop_bench', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 + i });
      }

      // 100 PDP views (50% countdown -> product)
      for (let i = 0; i < 100; i++) {
        events.push({ event_name: 'product_view', step_index: 2, drop_id: 'drop_bench', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 + i });
      }

      // 50 Add to cart attempts (50% product -> attempt)
      for (let i = 0; i < 50; i++) {
        events.push({ event_name: 'add_to_cart_attempt', step_index: 3, drop_id: 'drop_bench', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 + i });
      }

      // 40 Successful carts (80% attempt -> success)
      for (let i = 0; i < 40; i++) {
        events.push({ event_name: 'cart_create_result', outcome: 'cart_create_success', step_index: 4, drop_id: 'drop_bench', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 + i });
      }

      // 30 Checkout redirects (75% cart -> checkout, 25% cart abandonment)
      for (let i = 0; i < 30; i++) {
        events.push({ event_name: 'checkout_redirect', step_index: 5, drop_id: 'drop_bench', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 + i });
      }

      // 24 Orders completed (80% checkout -> order, 20% checkout abandonment)
      for (let i = 0; i < 24; i++) {
        events.push({ event_name: 'order_completed', step_index: 6, drop_id: 'drop_bench', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 + i });
      }

      const summary = calculateFunnelMetrics(events);

      assert.equal(summary.conversionRates.countdownToProductPct, 50);
      assert.equal(summary.conversionRates.productToCartAttemptPct, 50);
      assert.equal(summary.conversionRates.cartAttemptToSuccessPct, 80);
      assert.equal(summary.conversionRates.cartSuccessToCheckoutPct, 75);
      assert.equal(summary.conversionRates.checkoutToOrderPaidPct, 80);
      assert.equal(summary.conversionRates.overallConversionPct, 12); // 24 / 200 = 12%

      assert.equal(summary.bottlenecks.cartAbandonmentPct, 25); // (40 - 30) / 40
      assert.equal(summary.bottlenecks.checkoutAbandonmentPct, 20); // (30 - 24) / 30
    });
  });

  describe('5. Workers Analytics Engine Pipeline Sink', () => {
    it('should format and write data point when Analytics Engine binding is provided', () => {
      const writtenPoints: any[] = [];
      const mockEnv = {
        CONVERSION_ANALYTICS: {
          writeDataPoint(point: any) {
            writtenPoints.push(point);
          },
        },
      };

      const event: FunnelEvent = {
        event_name: 'cart_create_result',
        outcome: 'cart_create_success',
        step_index: 4,
        drop_id: 'cf-drop-leadville',
        product_id: 'rig-v2',
        variant_id: 'gid://shopify/ProductVariant/99',
        correlation_id: 'trace-req-888',
        session_id: 'ses-999',
        timestamp: 1726500000000,
        metadata: { price: 340, quantity: 2 },
      };

      const result = writeToWorkersAnalyticsEngine(event, mockEnv);
      assert.equal(result, true);
      assert.equal(writtenPoints.length, 1);

      const point = writtenPoints[0];
      assert.deepEqual(point.blobs, [
        'cart_create_result',
        'cf-drop-leadville',
        'rig-v2',
        'gid://shopify/ProductVariant/99',
        'cart_create_success',
        'trace-req-888',
        'ses-999',
      ]);
      assert.equal(point.doubles[0], 1726500000000);
      assert.equal(point.doubles[1], 4);
      assert.equal(point.doubles[2], 340);
      assert.equal(point.doubles[3], 2);
      assert.deepEqual(point.indexes, ['cart_create_result', 'cf-drop-leadville']);
    });
  });

  describe('6. Edge Ingestion Route Handlers (/api/telemetry/funnel)', () => {
    it('should ingest valid events via POST and return 200 with trace correlation headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry/funnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'req-test-route-1',
        },
        body: JSON.stringify({
          event_name: 'countdown_view',
          drop_id: 'edge-test-drop',
          product_id: 'alpine-rig',
        }),
      });

      const res = await funnelPostHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.processed, 1);
      assert.equal(res.headers.get('x-request-id'), 'req-test-route-1');

      const events = getFunnelEvents({ drop_id: 'edge-test-drop' });
      assert.equal(events.length, 1);
      assert.equal(events[0].correlation_id, 'req-test-route-1');
    });

    it('should reject requests with invalid payloads returning 422 Unprocessable Entity', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry/funnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name: 'invalid_type',
        }),
      });

      const res = await funnelPostHandler(req);
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.ok(data.error);
      assert.ok(Array.isArray(data.details));
    });

    it('should serve real-time funnel conversion metrics via GET', async () => {
      recordFunnelEvent({
        event_name: 'countdown_view',
        drop_id: 'get_test_drop',
        product_id: 'p1',
      });
      recordFunnelEvent({
        event_name: 'product_view',
        drop_id: 'get_test_drop',
        product_id: 'p1',
      });

      const req = new NextRequest('http://localhost:3000/api/telemetry/funnel?drop_id=get_test_drop');
      const res = await funnelGetHandler(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.metrics.counts.countdown_view, 1);
      assert.equal(data.metrics.counts.product_view, 1);
      assert.equal(data.recentEventsCount, 2);
    });
  });

  describe('7. In-Flight Cart Creation Telemetry Integration (/api/cart/create)', () => {
    it('should emit cart_create_result with cart_create_success outcome upon successful cart creation', async () => {
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'cart-test-req-1',
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/12345',
          quantity: 1,
          dropId: 'cart-drop-1',
          productId: 'leadville-pack',
          sessionId: 'ses-cart-1',
        }),
      });

      const res = await cartCreateRouteHandler(req);
      assert.equal(res.status, 200);

      const events = getFunnelEvents({ drop_id: 'cart-drop-1' });
      assert.equal(events.length, 1);
      assert.equal(events[0].event_name, 'cart_create_result');
      assert.equal(events[0].outcome, 'cart_create_success');
      assert.equal(events[0].correlation_id, 'cart-test-req-1');
      assert.equal(events[0].session_id, 'ses-cart-1');
    });

    it('should emit cart_create_result with rate_limited outcome when Shopify API throttles', async () => {
      const origRetries = shopify.maxRetries;
      const origDelay = shopify.baseDelayMs;
      shopify.maxRetries = 0;
      shopify.baseDelayMs = 0;
      defaultShopifyMock.simulateRateLimit(1, { retryAfterSec: 0, errorType: '429' });

      try {
        const req = new NextRequest('http://localhost:3000/api/cart/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'cart-throttle-req',
          },
          body: JSON.stringify({
            variantId: 'gid://shopify/ProductVariant/12345',
            quantity: 1,
            dropId: 'cart-drop-throttled',
          }),
        });

        const res = await cartCreateRouteHandler(req);
        assert.equal(res.status, 429);

        const events = getFunnelEvents({ drop_id: 'cart-drop-throttled' });
        assert.equal(events.length, 1);
        assert.equal(events[0].event_name, 'cart_create_result');
        assert.equal(events[0].outcome, 'rate_limited');
        assert.equal(events[0].correlation_id, 'cart-throttle-req');
      } finally {
        shopify.maxRetries = origRetries;
        shopify.baseDelayMs = origDelay;
      }
    });

    it('should emit cart_create_result with out_of_stock outcome when userErrors indicate item is sold out', async () => {
      defaultShopifyMock.simulateOutOfStock('gid://shopify/ProductVariant/sold-out-123');

      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'cart-oos-req',
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/sold-out-123',
          quantity: 1,
          dropId: 'cart-drop-oos',
        }),
      });

      const res = await cartCreateRouteHandler(req);
      assert.equal(res.status, 400);

      const events = getFunnelEvents({ drop_id: 'cart-drop-oos' });
      assert.equal(events.length, 1);
      assert.equal(events[0].event_name, 'cart_create_result');
      assert.equal(events[0].outcome, 'out_of_stock');
      assert.equal(events[0].correlation_id, 'cart-oos-req');
    });
  });
});
