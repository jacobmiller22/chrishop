#!/usr/bin/env tsx
/**
 * ChrisShop Conversion Funnel Telemetry Verification Script
 *
 * Story 4.28 (#333): Drop Day Conversion Funnel Instrumentation & Step Telemetry
 *
 * Validates:
 * 1. Standardized 6-stage funnel schema validation and rejection of malformed events.
 * 2. Complete funnel progression lifecycle (countdown_view -> product_view -> add_to_cart_attempt -> cart_create_result -> checkout_redirect -> order_completed).
 * 3. Cart creation outcome disambiguation (success, rate_limited, out_of_stock).
 * 4. Conversion rate and bottleneck drop-off calculations.
 * 5. Cloudflare Workers Analytics Engine sink dispatching.
 * 6. Edge telemetry ingestion API (POST and GET /api/telemetry/funnel).
 *
 * Usage:
 *   pnpm run funnel:verify
 *   tsx scripts/verify-conversion-funnel.ts
 */

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
} from '../apps/web/src/lib/funnel-telemetry';
import { POST as funnelPostHandler, GET as funnelGetHandler } from '../apps/web/src/app/api/telemetry/funnel/route';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function verifyConversionFunnel() {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   ⚡ ChrisShop Conversion Funnel Telemetry Verification        ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  clearFunnelEvents();

  // --------------------------------------------------------------------------
  // Test 1: Standardized Schema Validation & Rejection
  // --------------------------------------------------------------------------
  console.log(`${colors.bold}1. Schema Validation & Guardrail Rules:${colors.reset}`);
  {
    const invalidEvent = {
      event_name: 'invalid_stage_name',
      drop_id: '',
      timestamp: -100,
    };
    const invalidResult = validateFunnelEvent(invalidEvent);
    assert.equal(invalidResult.valid, false, 'Should reject invalid event schema');
    assert.ok(invalidResult.errors.length >= 3, 'Should list multiple validation errors');
    console.log(`  ✔ Malformed events rejected with descriptive errors (${invalidResult.errors.length} caught)`);

    const validEvent: FunnelEvent = {
      event_name: 'countdown_view',
      step_index: 1,
      drop_id: 'bankbeaters-v1',
      product_id: 'alpine-chest-rig',
      correlation_id: 'trace-12345',
      timestamp: Date.now(),
    };
    const validResult = validateFunnelEvent(validEvent);
    assert.equal(validResult.valid, true, 'Should accept valid event schema');
    assert.equal(validResult.errors.length, 0);
    console.log('  ✔ Valid event successfully conforms to standardized schema');
  }

  // --------------------------------------------------------------------------
  // Test 2: Full 6-Stage Drop Progression Lifecycle
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}2. Full 6-Stage Funnel Progression Lifecycle:${colors.reset}`);
  {
    clearFunnelEvents();
    const observedEvents: FunnelEvent[] = [];
    const unsubscribe = onFunnelEvent((ev) => observedEvents.push(ev));

    const sessionId = 'ses_shopper_001';
    const dropId = 'bankbeaters-leadville';
    const productId = 'alpine-rig-gen3';

    // Step 1: Countdown Impression
    const e1 = recordFunnelEvent({
      event_name: 'countdown_view',
      drop_id: dropId,
      product_id: productId,
      session_id: sessionId,
      metadata: { targetDate: '2026-10-01T00:00:00Z' },
    });
    assert.equal(e1.step_index, 1);

    // Step 2: PDP View
    const e2 = recordFunnelEvent({
      event_name: 'product_view',
      drop_id: dropId,
      product_id: productId,
      session_id: sessionId,
      metadata: { price: 285 },
    });
    assert.equal(e2.step_index, 2);

    // Step 3: Add to Cart Attempt
    const e3 = recordFunnelEvent({
      event_name: 'add_to_cart_attempt',
      drop_id: dropId,
      product_id: productId,
      variant_id: 'var_rig_camo',
      session_id: sessionId,
    });
    assert.equal(e3.step_index, 3);

    // Step 4: Cart Create Result (Success)
    const e4 = recordFunnelEvent({
      event_name: 'cart_create_result',
      outcome: 'cart_create_success',
      drop_id: dropId,
      product_id: productId,
      variant_id: 'var_rig_camo',
      session_id: sessionId,
      metadata: { cartId: 'gid://shopify/Cart/123' },
    });
    assert.equal(e4.step_index, 4);

    // Step 5: Checkout Redirection
    const e5 = recordFunnelEvent({
      event_name: 'checkout_redirect',
      drop_id: dropId,
      product_id: productId,
      variant_id: 'var_rig_camo',
      session_id: sessionId,
      metadata: { checkoutUrl: 'https://shop.chrishop.com/c/123' },
    });
    assert.equal(e5.step_index, 5);

    // Step 6: Order Paid
    const e6 = recordFunnelEvent({
      event_name: 'order_completed',
      outcome: 'success',
      drop_id: dropId,
      product_id: productId,
      variant_id: 'var_rig_camo',
      metadata: { orderId: 'ord_9876', totalPrice: 285 },
    });
    assert.equal(e6.step_index, 6);

    unsubscribe();

    assert.equal(observedEvents.length, 6, 'Should observe all 6 lifecycle events via listeners');
    assert.equal(getFunnelEvents({ session_id: sessionId }).length, 5, 'Should filter 5 events for session');
    console.log('  ✔ All 6 funnel stages dispatched and verified in sequential order (1 -> 6)');
  }

  // --------------------------------------------------------------------------
  // Test 3: Cart Creation Outcome Disambiguation (Success, Throttled, OOS)
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}3. Cart Creation Outcome Disambiguation:${colors.reset}`);
  {
    clearFunnelEvents();

    recordFunnelEvent({
      event_name: 'cart_create_result',
      outcome: 'cart_create_success',
      drop_id: 'drop_a',
      product_id: 'item_1',
    });
    recordFunnelEvent({
      event_name: 'cart_create_result',
      outcome: 'rate_limited',
      drop_id: 'drop_a',
      product_id: 'item_1',
    });
    recordFunnelEvent({
      event_name: 'cart_create_result',
      outcome: 'out_of_stock',
      drop_id: 'drop_a',
      product_id: 'item_1',
    });

    const metrics = getFunnelConversionMetrics({ drop_id: 'drop_a' });
    assert.equal(metrics.counts.cart_create_success, 1);
    assert.equal(metrics.counts.rate_limited, 1);
    assert.equal(metrics.counts.out_of_stock, 1);
    assert.equal(metrics.bottlenecks.cartRateLimitPct, 33.33);
    assert.equal(metrics.bottlenecks.cartOutOfStockPct, 33.33);
    console.log('  ✔ Cart outcomes cleanly separated: success, rate_limited (429), and out_of_stock');
  }

  // --------------------------------------------------------------------------
  // Test 4: Conversion Rate Arithmetic & Bottleneck Analysis
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}4. Funnel Conversion Arithmetic & Drop-off Rates:${colors.reset}`);
  {
    clearFunnelEvents();
    // Simulate:
    // 100 countdown views
    // 80 PDP views (80% countdownToProductPct)
    // 40 Add to cart attempts (50% productToCartAttemptPct)
    // 30 Cart success + 6 throttled + 4 out of stock (75% success rate out of attempts)
    // 24 Checkout redirects (80% cartSuccessToCheckoutPct, 20% cart abandonment)
    // 18 Orders paid (75% checkoutToOrderPaidPct, 25% checkout abandonment)

    const events: FunnelEvent[] = [];
    for (let i = 0; i < 100; i++) events.push({ event_name: 'countdown_view', step_index: 1, drop_id: 'sim', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1000 });
    for (let i = 0; i < 80; i++) events.push({ event_name: 'product_view', step_index: 2, drop_id: 'sim', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1010 });
    for (let i = 0; i < 40; i++) events.push({ event_name: 'add_to_cart_attempt', step_index: 3, drop_id: 'sim', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1020 });
    for (let i = 0; i < 30; i++) events.push({ event_name: 'cart_create_result', outcome: 'cart_create_success', step_index: 4, drop_id: 'sim', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1030 });
    for (let i = 0; i < 6; i++) events.push({ event_name: 'cart_create_result', outcome: 'rate_limited', step_index: 4, drop_id: 'sim', product_id: 'p', correlation_id: `c-rate-${i}`, timestamp: 1030 });
    for (let i = 0; i < 4; i++) events.push({ event_name: 'cart_create_result', outcome: 'out_of_stock', step_index: 4, drop_id: 'sim', product_id: 'p', correlation_id: `c-oos-${i}`, timestamp: 1030 });
    for (let i = 0; i < 24; i++) events.push({ event_name: 'checkout_redirect', step_index: 5, drop_id: 'sim', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1040 });
    for (let i = 0; i < 18; i++) events.push({ event_name: 'order_completed', step_index: 6, drop_id: 'sim', product_id: 'p', correlation_id: `c-${i}`, timestamp: 1050 });

    const summary = calculateFunnelMetrics(events);

    assert.equal(summary.conversionRates.countdownToProductPct, 80);
    assert.equal(summary.conversionRates.productToCartAttemptPct, 50);
    assert.equal(summary.conversionRates.cartAttemptToSuccessPct, 75);
    assert.equal(summary.conversionRates.cartSuccessToCheckoutPct, 80);
    assert.equal(summary.conversionRates.checkoutToOrderPaidPct, 75);
    assert.equal(summary.conversionRates.overallConversionPct, 18);

    assert.equal(summary.bottlenecks.cartRateLimitPct, 15); // 6 / 40
    assert.equal(summary.bottlenecks.cartOutOfStockPct, 10); // 4 / 40
    assert.equal(summary.bottlenecks.cartAbandonmentPct, 20); // (30 - 24) / 30 = 20%
    assert.equal(summary.bottlenecks.checkoutAbandonmentPct, 25); // (24 - 18) / 24 = 25%

    console.log(`  ✔ Countdown ➔ Product: ${summary.conversionRates.countdownToProductPct}%`);
    console.log(`  ✔ Product ➔ Cart Attempt: ${summary.conversionRates.productToCartAttemptPct}%`);
    console.log(`  ✔ Cart Success Rate: ${summary.conversionRates.cartAttemptToSuccessPct}%`);
    console.log(`  ✔ Cart ➔ Checkout Redirect: ${summary.conversionRates.cartSuccessToCheckoutPct}%`);
    console.log(`  ✔ Checkout ➔ Order Paid: ${summary.conversionRates.checkoutToOrderPaidPct}%`);
    console.log(`  ✔ Overall Conversion Rate: ${summary.conversionRates.overallConversionPct}%`);
    console.log(`  ✔ Bottlenecks: RateLimited=${summary.bottlenecks.cartRateLimitPct}%, OOS=${summary.bottlenecks.cartOutOfStockPct}%, CartAbandonment=${summary.bottlenecks.cartAbandonmentPct}%`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Workers Analytics Engine Pipeline Sink Dispatch
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}5. Workers Analytics Engine Pipeline Sink:${colors.reset}`);
  {
    const recordedPoints: any[] = [];
    const mockEnv = {
      CONVERSION_ANALYTICS: {
        writeDataPoint(dp: any) {
          recordedPoints.push(dp);
        },
      },
    };

    const event: FunnelEvent = {
      event_name: 'product_view',
      step_index: 2,
      drop_id: 'bankbeaters-v1',
      product_id: 'chest-rig-01',
      variant_id: 'camo-var',
      correlation_id: 'req-abc-999',
      session_id: 'ses-123',
      timestamp: 1726000000000,
      metadata: { price: 295, quantity: 1 },
    };

    const written = writeToWorkersAnalyticsEngine(event, mockEnv);
    assert.equal(written, true, 'Should return true when Analytics Engine binding handles event');
    assert.equal(recordedPoints.length, 1);
    assert.equal(recordedPoints[0].blobs[0], 'product_view');
    assert.equal(recordedPoints[0].blobs[1], 'bankbeaters-v1');
    assert.equal(recordedPoints[0].doubles[2], 295);
    console.log('  ✔ writeDataPoint called with expected blobs, doubles, and indexes');
  }

  // --------------------------------------------------------------------------
  // Test 6: Edge Route Handlers (POST & GET /api/telemetry/funnel)
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}6. Edge Ingestion & Metrics Endpoint Handlers:${colors.reset}`);
  {
    clearFunnelEvents();

    // 1. POST single event
    const postReq = new NextRequest('http://localhost:3000/api/telemetry/funnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'req-edge-test-1',
      },
      body: JSON.stringify({
        event_name: 'countdown_view',
        drop_id: 'edge-drop',
        product_id: 'leadville-pack',
      }),
    });

    const postRes = await funnelPostHandler(postReq);
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.ok, true);
    assert.equal(postData.processed, 1);
    assert.equal(postRes.headers.get('x-request-id'), 'req-edge-test-1');
    console.log('  ✔ POST /api/telemetry/funnel successfully ingested event and echoed trace header');

    // 2. POST batch of events
    const batchReq = new NextRequest('http://localhost:3000/api/telemetry/funnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'req-edge-batch-2',
      },
      body: JSON.stringify({
        events: [
          { event_name: 'product_view', drop_id: 'edge-drop', product_id: 'leadville-pack' },
          { event_name: 'add_to_cart_attempt', drop_id: 'edge-drop', product_id: 'leadville-pack' },
        ],
      }),
    });

    const batchRes = await funnelPostHandler(batchReq);
    assert.equal(batchRes.status, 200);
    const batchData = await batchRes.json();
    assert.equal(batchData.processed, 2);
    console.log('  ✔ POST /api/telemetry/funnel successfully ingested batch of 2 events');

    // 3. GET real-time conversion metrics
    const getReq = new NextRequest('http://localhost:3000/api/telemetry/funnel?drop_id=edge-drop');
    const getRes = await funnelGetHandler(getReq);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.ok, true);
    assert.equal(getData.metrics.counts.countdown_view, 1);
    assert.equal(getData.metrics.counts.product_view, 1);
    assert.equal(getData.metrics.counts.add_to_cart_attempt, 1);
    assert.equal(getData.recentEventsCount, 3);
    console.log('  ✔ GET /api/telemetry/funnel exposed real-time conversion metrics and event stream');
  }

  console.log(`\n${colors.bold}${colors.green}✔ ALL CONVERSION FUNNEL TELEMETRY GATES PASSED!${colors.reset}\n`);
  return true;
}

if (process.argv[1]?.endsWith('verify-conversion-funnel.ts')) {
  verifyConversionFunnel().catch((err) => {
    console.error(`\n${colors.red}✖ Conversion Funnel Verification Failed:${colors.reset}`, err);
    process.exit(1);
  });
}
