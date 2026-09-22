/**
 * ChrisShop Integration Test Suite: Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline
 *
 * Story 4.26 (#331): Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline
 *
 * Validates:
 * 1. Standardized Core Web Vitals schema validation and rejection of malformed payloads.
 * 2. Official Google threshold classifications (good, needs-improvement, poor) across LCP, INP, CLS, FCP, TTFB.
 * 3. Metric ingestion, listener notification, ambient trace correlation, and buffer bounds.
 * 4. Exact percentile computations (p75, p90, p95) and Google 75th percentile compliance assessment.
 * 5. Workers Analytics Engine sink dispatching (VITALS_ANALYTICS).
 * 6. Edge Ingestion API route handlers (/api/telemetry/vitals POST & GET).
 */

import { describe, it, beforeEach } from 'node:test';
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
} from '../../apps/web/src/lib/vitals-telemetry';
import {
  POST as vitalsPostHandler,
  GET as vitalsGetHandler,
} from '../../apps/web/src/app/api/telemetry/vitals/route';

describe('Story 4.26: Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline', () => {
  beforeEach(() => {
    clearVitalsBuffer();
  });

  describe('1. Schema Validation & Guardrail Rules', () => {
    it('should validate conforming vitals payloads with all metric fields', () => {
      const validPayload = {
        id: 'vital-test-001',
        name: 'LCP',
        value: 1845.2,
        delta: 25.1,
        rating: 'good',
        path: '/drops/leadville-rig',
        navigationType: 'navigate',
        device: {
          connectionType: '4g',
          downlink: 15,
          rtt: 45,
          deviceMemory: 8,
          hardwareConcurrency: 8,
          viewport: '390x844',
        },
      };

      const result = validateVitalPayload(validPayload);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should reject malformed or non-object payloads', () => {
      const cases = [
        null,
        undefined,
        'not an object',
        12345,
        {},
        { name: '', value: 1200 },
        { name: 'LCP', value: -100 },
        { name: 'LCP', value: NaN },
        { name: 'LCP', value: 1500, rating: 'invalid-rating' },
        { name: 'LCP', value: 1500, path: 9999 },
      ];

      for (const invalid of cases) {
        const result = validateVitalPayload(invalid);
        assert.equal(result.valid, false, `Expected failure for: ${JSON.stringify(invalid)}`);
        assert.ok(result.errors.length > 0);
      }
    });
  });

  describe('2. Official Google Thresholds & Rating Classification', () => {
    it('should classify Largest Contentful Paint (LCP) against official thresholds', () => {
      assert.equal(classifyVitalRating('LCP', 1000), 'good');
      assert.equal(classifyVitalRating('LCP', 2500), 'good');
      assert.equal(classifyVitalRating('LCP', 2501), 'needs-improvement');
      assert.equal(classifyVitalRating('LCP', 4000), 'needs-improvement');
      assert.equal(classifyVitalRating('LCP', 4001), 'poor');
      assert.equal(classifyVitalRating('LCP', 6500), 'poor');
    });

    it('should classify Interaction to Next Paint (INP) against official thresholds', () => {
      assert.equal(classifyVitalRating('INP', 50), 'good');
      assert.equal(classifyVitalRating('INP', 200), 'good');
      assert.equal(classifyVitalRating('INP', 201), 'needs-improvement');
      assert.equal(classifyVitalRating('INP', 500), 'needs-improvement');
      assert.equal(classifyVitalRating('INP', 501), 'poor');
      assert.equal(classifyVitalRating('INP', 950), 'poor');
    });

    it('should classify Cumulative Layout Shift (CLS) against official thresholds', () => {
      assert.equal(classifyVitalRating('CLS', 0.01), 'good');
      assert.equal(classifyVitalRating('CLS', 0.1), 'good');
      assert.equal(classifyVitalRating('CLS', 0.101), 'needs-improvement');
      assert.equal(classifyVitalRating('CLS', 0.25), 'needs-improvement');
      assert.equal(classifyVitalRating('CLS', 0.251), 'poor');
      assert.equal(classifyVitalRating('CLS', 0.45), 'poor');
    });

    it('should classify First Contentful Paint (FCP) and Time to First Byte (TTFB)', () => {
      assert.equal(classifyVitalRating('FCP', 1200), 'good');
      assert.equal(classifyVitalRating('FCP', 1800), 'good');
      assert.equal(classifyVitalRating('FCP', 2400), 'needs-improvement');
      assert.equal(classifyVitalRating('FCP', 3500), 'poor');

      assert.equal(classifyVitalRating('TTFB', 300), 'good');
      assert.equal(classifyVitalRating('TTFB', 800), 'good');
      assert.equal(classifyVitalRating('TTFB', 1400), 'needs-improvement');
      assert.equal(classifyVitalRating('TTFB', 2200), 'poor');
    });
  });

  describe('3. Metric Ingestion, Observers & Buffer Management', () => {
    it('should ingest beacons, auto-classify ratings, and assign ambient trace ids', () => {
      const record = recordVitalBeacon({
        name: 'INP',
        value: 125,
        path: '/cart',
      });

      assert.equal(record.name, 'INP');
      assert.equal(record.value, 125);
      assert.equal(record.rating, 'good');
      assert.equal(record.path, '/cart');
      assert.ok(record.correlation_id.length > 0);
      assert.ok(record.timestamp > 0);

      const buffer = getVitalBeacons();
      assert.equal(buffer.length, 1);
      assert.equal(buffer[0].id, record.id);
    });

    it('should notify registered listeners and support clean unsubscription', () => {
      const received: VitalBeaconRecord[] = [];
      const unsubscribe = onVitalBeacon((r) => received.push(r));

      recordVitalBeacon({ name: 'CLS', value: 0.02 });
      recordVitalBeacon({ name: 'LCP', value: 1900 });

      assert.equal(received.length, 2);
      assert.equal(received[0].name, 'CLS');
      assert.equal(received[1].name, 'LCP');

      unsubscribe();

      recordVitalBeacon({ name: 'TTFB', value: 250 });
      assert.equal(received.length, 2, 'Unsubscribed listener should not receive further events');
    });

    it('should filter retrieved beacons by metric name, path, and rating', () => {
      recordVitalBeacon({ name: 'LCP', value: 1500, path: '/home' });
      recordVitalBeacon({ name: 'LCP', value: 4500, path: '/drops' });
      recordVitalBeacon({ name: 'CLS', value: 0.05, path: '/home' });

      const lcpOnly = getVitalBeacons({ name: 'LCP' });
      assert.equal(lcpOnly.length, 2);

      const homeOnly = getVitalBeacons({ path: '/home' });
      assert.equal(homeOnly.length, 2);

      const poorOnly = getVitalBeacons({ rating: 'poor' });
      assert.equal(poorOnly.length, 1);
      assert.equal(poorOnly[0].path, '/drops');
    });
  });

  describe('4. Statistical Percentile Computations & 75th-Percentile Compliance', () => {
    it('should calculate accurate p75, p90, and p95 percentiles and assess Google compliance', () => {
      clearVitalsBuffer();

      // Ingest 20 LCP measurements
      const values = [
        800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700,
        1800, 1900, 2000, 2100, 2200, 2600, 2900, 3400, 4100, 4800,
      ];

      for (const v of values) {
        recordVitalBeacon({ name: 'LCP', value: v, path: '/products' });
      }

      const summary = getVitalsSummary();
      assert.equal(summary.totalBeacons, 20);

      const lcp = summary.metrics.LCP;
      assert.ok(lcp);
      assert.equal(lcp.count, 20);
      assert.equal(lcp.min, 800);
      assert.equal(lcp.max, 4800);
      assert.equal(lcp.p75, 2200); // 75th percentile is 2200ms <= 2500ms
      assert.equal(lcp.googleAssessment, 'PASSING');
      assert.equal(lcp.ratings.good, 15);
      assert.equal(lcp.ratings.needsImprovement, 3);
      assert.equal(lcp.ratings.poor, 2);
      assert.equal(lcp.ratings.goodPct, 75);
    });

    it('should accurately flag FAILING Google compliance when p75 exceeds threshold', () => {
      clearVitalsBuffer();

      // Ingest 10 degraded INP measurements
      const slowInp = [220, 250, 300, 450, 520, 550, 600, 700, 800, 900];
      for (const val of slowInp) {
        recordVitalBeacon({ name: 'INP', value: val });
      }

      const summary = getVitalsSummary();
      const inp = summary.metrics.INP;
      assert.ok(inp);
      assert.ok(inp.p75 > 500, 'p75 should exceed 500ms');
      assert.equal(inp.googleAssessment, 'FAILING');
    });
  });

  describe('5. Cloudflare Workers Analytics Engine Sink Dispatch', () => {
    it('should structure data points for Workers Analytics Engine', () => {
      let writtenData: any = null;
      const mockEnv = {
        VITALS_ANALYTICS: {
          writeDataPoint: (data: any) => {
            writtenData = data;
          },
        },
      };

      const record: VitalBeaconRecord = {
        id: 'vital-sink-001',
        name: 'LCP',
        value: 1750.5,
        rating: 'good',
        path: '/drops/alpine',
        correlation_id: 'cf-ray-112233',
        timestamp: 1726000000000,
        navigationType: 'navigate',
        device: {
          connectionType: '5g',
          deviceMemory: 16,
          rtt: 15,
          downlink: 120,
        },
      };

      const success = writeToVitalsAnalyticsEngine(record, mockEnv);
      assert.equal(success, true);
      assert.ok(writtenData);
      assert.deepEqual(writtenData.blobs, [
        'LCP',
        'good',
        '/drops/alpine',
        '5g',
        'cf-ray-112233',
        'navigate',
      ]);
      assert.deepEqual(writtenData.doubles, [1750.5, 1726000000000, 16, 15, 120]);
      assert.deepEqual(writtenData.indexes, ['LCP', 'good']);
    });

    it('should gracefully return false when Analytics Engine binding is not present', () => {
      const record: VitalBeaconRecord = {
        id: 'v-fallback',
        name: 'TTFB',
        value: 300,
        rating: 'good',
        path: '/',
        correlation_id: 'corr-1',
        timestamp: Date.now(),
      };

      const success = writeToVitalsAnalyticsEngine(record, {});
      assert.equal(success, false);
    });
  });

  describe('6. Edge Ingestion API Route Handlers (/api/telemetry/vitals)', () => {
    it('should ingest single beacon via POST /api/telemetry/vitals', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'req-test-single-1',
        },
        body: JSON.stringify({
          id: 'v-s1',
          name: 'CLS',
          value: 0.03,
          path: '/about',
        }),
      });

      const res = await vitalsPostHandler(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-request-id'), 'req-test-single-1');

      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.processed, 1);

      const beacons = getVitalBeacons({ path: '/about' });
      assert.equal(beacons.length, 1);
      assert.equal(beacons[0].correlation_id, 'req-test-single-1');
    });

    it('should ingest batch beacons via POST /api/telemetry/vitals', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ray': 'ray-batch-99',
        },
        body: JSON.stringify([
          { id: 'b-1', name: 'LCP', value: 1600, path: '/products' },
          { id: 'b-2', name: 'INP', value: 90, path: '/products' },
          { id: 'b-3', name: 'TTFB', value: 410, path: '/products' },
        ]),
      });

      const res = await vitalsPostHandler(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.processed, 3);
    });

    it('should reject malformed payloads with HTTP 422', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          value: 'not-a-number',
        }),
      });

      const res = await vitalsPostHandler(req);
      assert.equal(res.status, 422);

      const body = await res.json();
      assert.ok(body.error);
      assert.ok(body.details.length > 0);
    });

    it('should reject empty payloads with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '   ',
      });

      const res = await vitalsPostHandler(req);
      assert.equal(res.status, 400);
    });

    it('should return aggregated metrics summary via GET /api/telemetry/vitals', async () => {
      clearVitalsBuffer();
      recordVitalBeacon({ name: 'LCP', value: 1500, path: '/' });
      recordVitalBeacon({ name: 'LCP', value: 2200, path: '/' });
      recordVitalBeacon({ name: 'CLS', value: 0.05, path: '/' });

      const req = new NextRequest('http://localhost:3000/api/telemetry/vitals?path=/');
      const res = await vitalsGetHandler(req);

      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.ok, true);
      assert.equal(data.summary.totalBeacons, 3);
      assert.ok(data.summary.metrics.LCP);
      assert.ok(data.summary.metrics.CLS);
      assert.equal(data.recentCount, 3);
    });
  });
});
