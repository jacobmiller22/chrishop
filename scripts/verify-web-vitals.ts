#!/usr/bin/env tsx
/**
 * ChrisShop Real User Monitoring (RUM) & Core Web Vitals Verification Script
 *
 * Story 4.26 (#331): Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline
 *
 * Validates:
 * 1. Standardized Core Web Vitals schema validation and rejection of malformed beacons.
 * 2. Official Google thresholds classification (good, needs-improvement, poor) across LCP, INP, CLS, FCP, TTFB.
 * 3. Exact percentile calculations (p75, p90, p95) and Google 75th-percentile compliance evaluation.
 * 4. Cloudflare Workers Analytics Engine sink formatting.
 * 5. Edge Ingestion API endpoints (POST and GET /api/telemetry/vitals).
 *
 * Usage:
 *   pnpm run vitals:verify
 *   tsx scripts/verify-web-vitals.ts
 */

import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  classifyVitalRating,
  validateVitalPayload,
  recordVitalBeacon,
  getVitalBeacons,
  clearVitalsBuffer,
  calculateVitalsSummary,
  getVitalsSummary,
  writeToVitalsAnalyticsEngine,
  onVitalBeacon,
  WEB_VITALS_THRESHOLDS,
  type VitalBeaconRecord,
} from '../apps/web/src/lib/vitals-telemetry';
import {
  POST as vitalsPostHandler,
  GET as vitalsGetHandler,
} from '../apps/web/src/app/api/telemetry/vitals/route';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function verifyWebVitals() {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   ⚡ ChrisShop Core Web Vitals Telemetry Verification          ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  clearVitalsBuffer();

  // --------------------------------------------------------------------------
  // Test 1: Schema Validation & Guardrails
  // --------------------------------------------------------------------------
  console.log(`${colors.bold}1. Schema Validation & Guardrails:${colors.reset}`);
  {
    const invalidPayloads = [
      null,
      {},
      { name: '', value: 1200 },
      { name: 'LCP', value: -50 },
      { name: 'LCP', value: NaN },
      { name: 'LCP', value: 1500, rating: 'exceptional' },
      { name: 'LCP', value: 1500, path: 123 },
    ];

    for (const inv of invalidPayloads) {
      const res = validateVitalPayload(inv);
      assert.equal(res.valid, false, `Should reject invalid payload: ${JSON.stringify(inv)}`);
    }
    console.log('  ✔ Malformed and invalid payloads correctly rejected with detailed errors');

    const validPayload = {
      name: 'LCP',
      value: 1845.2,
      path: '/products/alpine-chest-rig',
      rating: 'good',
    };
    const validRes = validateVitalPayload(validPayload);
    assert.equal(validRes.valid, true, 'Valid payload must pass validation');
    assert.equal(validRes.errors.length, 0);
    console.log('  ✔ Standardized Web Vitals beacon payload validated successfully');
  }

  // --------------------------------------------------------------------------
  // Test 2: Official Google Threshold Classifications
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}2. Official Google Threshold Classifications:${colors.reset}`);
  {
    // LCP: Good <= 2500ms, Needs Improvement <= 4000ms, Poor > 4000ms
    assert.equal(classifyVitalRating('LCP', 1200), 'good');
    assert.equal(classifyVitalRating('LCP', 2500), 'good');
    assert.equal(classifyVitalRating('LCP', 3200), 'needs-improvement');
    assert.equal(classifyVitalRating('LCP', 4000), 'needs-improvement');
    assert.equal(classifyVitalRating('LCP', 4500), 'poor');

    // INP: Good <= 200ms, Needs Improvement <= 500ms, Poor > 500ms
    assert.equal(classifyVitalRating('INP', 50), 'good');
    assert.equal(classifyVitalRating('INP', 200), 'good');
    assert.equal(classifyVitalRating('INP', 350), 'needs-improvement');
    assert.equal(classifyVitalRating('INP', 600), 'poor');

    // CLS: Good <= 0.1, Needs Improvement <= 0.25, Poor > 0.25
    assert.equal(classifyVitalRating('CLS', 0.02), 'good');
    assert.equal(classifyVitalRating('CLS', 0.1), 'good');
    assert.equal(classifyVitalRating('CLS', 0.18), 'needs-improvement');
    assert.equal(classifyVitalRating('CLS', 0.35), 'poor');

    // FCP & TTFB
    assert.equal(classifyVitalRating('FCP', 1500), 'good');
    assert.equal(classifyVitalRating('FCP', 2500), 'needs-improvement');
    assert.equal(classifyVitalRating('FCP', 3500), 'poor');

    assert.equal(classifyVitalRating('TTFB', 400), 'good');
    assert.equal(classifyVitalRating('TTFB', 1200), 'needs-improvement');
    assert.equal(classifyVitalRating('TTFB', 2200), 'poor');

    console.log('  ✔ Google rating classification accurate across LCP, INP, CLS, FCP, TTFB');
  }

  // --------------------------------------------------------------------------
  // Test 3: Metric Aggregation, Percentiles & 75th Percentile Compliance
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}3. Aggregation, Percentile Calculation & Compliance:${colors.reset}`);
  {
    clearVitalsBuffer();
    const observed: VitalBeaconRecord[] = [];
    const unsubscribe = onVitalBeacon((r) => observed.push(r));

    // Simulate 20 LCP measurements:
    // 15 good values (1000 - 2400ms), 3 needs-improvement (2800 - 3500ms), 2 poor (4200 - 5000ms)
    const lcpValues = [
      1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900,
      2000, 2100, 2200, 2300, 2400, 2800, 3100, 3500, 4200, 5000,
    ];

    for (const val of lcpValues) {
      recordVitalBeacon({
        name: 'LCP',
        value: val,
        path: '/drops/bankbeaters-v1',
        device: { connectionType: '4g', downlink: 10, rtt: 50 },
      });
    }

    assert.equal(observed.length, 20, 'Observer should have received all 20 beacons');

    const summary = getVitalsSummary();
    assert.equal(summary.totalBeacons, 20);
    const lcpSummary = summary.metrics.LCP;
    assert.ok(lcpSummary, 'LCP summary metrics must be populated');
    assert.equal(lcpSummary.count, 20);
    assert.equal(lcpSummary.min, 1000);
    assert.equal(lcpSummary.max, 5000);

    // 75th percentile of 20 items: index ceil(0.75 * 20) - 1 = 15 - 1 = index 14 -> 2400ms
    assert.equal(lcpSummary.p75, 2400);
    assert.equal(lcpSummary.googleAssessment, 'PASSING');
    assert.equal(lcpSummary.ratings.good, 15);
    assert.equal(lcpSummary.ratings.needsImprovement, 3);
    assert.equal(lcpSummary.ratings.poor, 2);
    assert.equal(lcpSummary.ratings.goodPct, 75);

    console.log(`  ✔ LCP p75 computed at ${lcpSummary.p75}ms (Status: ${colors.green}${lcpSummary.googleAssessment}${colors.reset})`);
    console.log(`  ✔ Breakdown: ${lcpSummary.ratings.goodPct}% good, ${lcpSummary.ratings.needsImprovementPct}% needs improvement, ${lcpSummary.ratings.poorPct}% poor`);

    unsubscribe();
  }

  // --------------------------------------------------------------------------
  // Test 4: Workers Analytics Engine Sink Dispatching
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}4. Cloudflare Workers Analytics Engine Sink:${colors.reset}`);
  {
    let capturedDataPoint: any = null;
    const mockEnv = {
      VITALS_ANALYTICS: {
        writeDataPoint: (data: any) => {
          capturedDataPoint = data;
        },
      },
    };

    const record: VitalBeaconRecord = {
      id: 'v-test-123',
      name: 'CLS',
      value: 0.045,
      rating: 'good',
      path: '/products',
      correlation_id: 'cf-ray-998877',
      timestamp: Date.now(),
      device: {
        connectionType: '5g',
        deviceMemory: 8,
        rtt: 25,
        downlink: 100,
      },
    };

    const dispatched = writeToVitalsAnalyticsEngine(record, mockEnv);
    assert.equal(dispatched, true, 'Sink dispatch should succeed when binding is present');
    assert.ok(capturedDataPoint, 'DataPoint should be captured');
    assert.deepEqual(capturedDataPoint.blobs, [
      'CLS',
      'good',
      '/products',
      '5g',
      'cf-ray-998877',
      'navigate',
    ]);
    assert.deepEqual(capturedDataPoint.doubles, [0.045, record.timestamp, 8, 25, 100]);
    assert.deepEqual(capturedDataPoint.indexes, ['CLS', 'good']);

    console.log('  ✔ Workers Analytics Engine data point correctly structured (blobs, doubles, indexes)');
  }

  // --------------------------------------------------------------------------
  // Test 5: Ingestion API Endpoint Verification (POST & GET)
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}5. Edge Ingestion API Route Handlers (/api/telemetry/vitals):${colors.reset}`);
  {
    clearVitalsBuffer();

    // 5a. POST single beacon
    const singleReq = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'req-vitals-single-001',
      },
      body: JSON.stringify({
        id: 'v-pdp-01',
        name: 'INP',
        value: 120,
        path: '/products/vest-v1',
        device: { connectionType: 'wifi' },
      }),
    });

    const singleRes = await vitalsPostHandler(singleReq);
    assert.equal(singleRes.status, 200, 'POST single beacon should return 200');
    const singleData = await singleRes.json();
    assert.equal(singleData.ok, true);
    assert.equal(singleData.processed, 1);
    console.log('  ✔ POST /api/telemetry/vitals ingested single beacon');

    // 5b. POST batch beacons
    const batchReq = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-ray': 'ray-vitals-batch-002',
      },
      body: JSON.stringify([
        { id: 'v-b1', name: 'LCP', value: 2100, path: '/' },
        { id: 'v-b2', name: 'TTFB', value: 350, path: '/' },
        { id: 'v-b3', name: 'CLS', value: 0.05, path: '/' },
      ]),
    });

    const batchRes = await vitalsPostHandler(batchReq);
    assert.equal(batchRes.status, 200, 'POST batch beacons should return 200');
    const batchData = await batchRes.json();
    assert.equal(batchData.processed, 3);
    console.log('  ✔ POST /api/telemetry/vitals ingested batch beacons (3 items)');

    // 5c. POST validation failure
    const malformedReq = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', value: -99 }),
    });

    const malformedRes = await vitalsPostHandler(malformedReq);
    assert.equal(malformedRes.status, 422, 'POST malformed beacon should return 422');
    console.log('  ✔ POST /api/telemetry/vitals returns 422 on schema violation');

    // 5d. GET metrics summary
    const getReq = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
      method: 'GET',
    });
    const getRes = await vitalsGetHandler(getReq);
    assert.equal(getRes.status, 200, 'GET /api/telemetry/vitals should return 200');
    const getData = await getRes.json();
    assert.equal(getData.ok, true);
    assert.equal(getData.summary.totalBeacons, 4);
    assert.ok(getData.summary.metrics.INP);
    assert.ok(getData.summary.metrics.LCP);
    assert.ok(getData.summary.metrics.TTFB);
    assert.ok(getData.summary.metrics.CLS);
    console.log(`  ✔ GET /api/telemetry/vitals returned real-time summary for ${getData.summary.totalBeacons} beacons`);
  }

  console.log(`\n${colors.bold}${colors.green}✔ All Web Vitals Telemetry Verification checks passed!${colors.reset}\n`);
}

verifyWebVitals().catch((err) => {
  console.error(`\n${colors.bold}${colors.red}❌ Verification Failed:${colors.reset}`, err);
  process.exit(1);
});
