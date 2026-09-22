import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import {
  runDropSurgeSimulation,
  calculatePercentiles,
} from '../load/drop-surge';
import {
  ShopifyStorefrontClient,
  shopify,
} from '../../apps/web/src/lib/shopify';
import { defaultShopifyMock } from '../../apps/web/src/lib/shopify-mock';
import { POST as cartCreatePost } from '../../apps/web/src/app/api/cart/create/route';

describe('Story 4.10: Drop Day High-Concurrency Load Testing & Rate Limiting Simulation Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const runbookPath = path.join(rootDir, 'docs/runbooks/DROP_DAY_RESILIENCE.md');
  const loadScriptPath = path.join(rootDir, 'tests/load/drop-surge.ts');
  const packageJsonPath = path.join(rootDir, 'package.json');

  beforeEach(() => {
    defaultShopifyMock.reset();
  });

  describe('1. Concurrency Simulation Harness Execution (100+ Virtual Buyers)', () => {
    it('should execute 4-phase drop surge simulation for 120 concurrent buyers and satisfy SLA gates', async () => {
      const report = await runDropSurgeSimulation({
        virtualUsers: 120,
        cartBurstUsers: 80,
        verbose: false,
      });

      assert.equal(report.virtualUsers, 120);
      assert.equal(report.cartBurstUsers, 80);
      assert.ok(report.totalRequests >= 320, 'Must record requests across all 4 phases');
      assert.equal(report.passed, true, `Simulation failed: ${report.failureReasons.join(', ')}`);

      // Acceptance Criteria 2: p95 latency for edge catalog browsing remains under 150ms
      assert.ok(
        report.catalogP95 < 150,
        `Catalog p95 latency (${report.catalogP95}ms) must remain below 150ms SLA`
      );

      // Acceptance Criteria 4: Edge error rate remains below 0.1%
      assert.ok(
        report.overallErrorRate <= 0.1,
        `Overall error rate (${report.overallErrorRate}%) must remain below 0.10%`
      );

      // Verify phase breakdowns
      assert.ok(report.phases.phaseA.successfulRequests >= 120);
      assert.ok(report.phases.phaseB.successfulRequests >= 120);
      assert.ok(report.phases.phaseC.successfulRequests >= 76);
      assert.ok(report.phases.phaseD.successfulRequests >= 76);

      // Verify D1 query shielding & edge cache ratio
      assert.ok(
        report.edgeCacheHitRatio >= 90,
        `Edge cache hit ratio (${report.edgeCacheHitRatio}%) must shield D1 queries`
      );
      assert.ok(report.estimatedD1QueriesShielded > 200);
    });

    it('should accurately calculate latency percentiles (min, max, avg, p50, p90, p95, p99)', () => {
      const sample = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = calculatePercentiles(sample);

      assert.equal(stats.min, 10);
      assert.equal(stats.max, 100);
      assert.equal(stats.avg, 55);
      assert.equal(stats.p50, 50);
      assert.equal(stats.p90, 90);
      assert.equal(stats.p95, 100);
      assert.equal(stats.p99, 100);
    });
  });

  describe('2. Shopify Storefront API Rate Limit & Backoff Handling', () => {
    it('should calculate exponential backoff delay with jitter', () => {
      const client = new ShopifyStorefrontClient({ baseDelayMs: 100 });

      // Attempt 1: 100 * 2^0 = 100 + [0, 50] jitter
      const delay1 = client.calculateBackoffDelay(1);
      assert.ok(delay1 >= 100 && delay1 <= 150);

      // Attempt 2: 100 * 2^1 = 200 + [0, 50] jitter
      const delay2 = client.calculateBackoffDelay(2);
      assert.ok(delay2 >= 200 && delay2 <= 250);

      // Attempt 3: 100 * 2^2 = 400 + [0, 50] jitter
      const delay3 = client.calculateBackoffDelay(3);
      assert.ok(delay3 >= 400 && delay3 <= 450);

      // Explicit Retry-After header takes precedence
      const delayRetryAfter = client.calculateBackoffDelay(1, 2);
      assert.ok(delayRetryAfter >= 2000 && delayRetryAfter <= 2050);
    });

    it('should retry on simulated GraphQL THROTTLED errors and recover within maxRetries', async () => {
      const client = new ShopifyStorefrontClient({
        baseDelayMs: 10,
        maxRetries: 3,
        useMock: true,
      });

      // Configure mock to throttle first 2 requests then succeed
      defaultShopifyMock.simulateRateLimit(2, { errorType: 'THROTTLED' });

      const res = await client.createCart('gid://shopify/ProductVariant/101', 1, '198.51.100.1');

      assert.ok(res.data?.cartCreate?.cart?.id, 'Must return created cart after successful retry');
      assert.equal(
        defaultShopifyMock.getThrottledRequestsCount(),
        2,
        'Must have absorbed 2 throttled requests before recovering'
      );
    });

    it('should retry on simulated HTTP 429 Too Many Requests and recover', async () => {
      const client = new ShopifyStorefrontClient({
        baseDelayMs: 10,
        maxRetries: 3,
        useMock: true,
      });

      // Configure mock to throw 429 for 1 request then succeed
      defaultShopifyMock.simulateRateLimit(1, { errorType: '429', retryAfterSec: 0.01 });

      const res = await client.createCart('gid://shopify/ProductVariant/101', 1, '198.51.100.2');

      assert.ok(res.data?.cartCreate?.cart?.id);
      assert.equal(defaultShopifyMock.getThrottledRequestsCount(), 1);
    });

    it('should throw rate limit exceeded error when throttling exceeds maxRetries', async () => {
      const client = new ShopifyStorefrontClient({
        baseDelayMs: 10,
        maxRetries: 2,
        useMock: true,
      });

      // Throttle 5 consecutive requests (exceeds maxRetries=2)
      defaultShopifyMock.simulateRateLimit(5, { errorType: 'THROTTLED' });

      await assert.rejects(
        async () => {
          await client.createCart('gid://shopify/ProductVariant/101', 1, '198.51.100.3');
        },
        /rate limit exceeded after 2 retries/i
      );
    });
  });

  describe('3. Human-Friendly Error Translation on Edge Cart Endpoints', () => {
    it('should return human-friendly 400 error when limited-edition inventory is out of stock', async () => {
      const variantId = 'gid://shopify/ProductVariant/sold-out-101';
      defaultShopifyMock.simulateOutOfStock(variantId);

      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.10',
        },
        body: JSON.stringify({
          variantId,
          quantity: 1,
        }),
      });

      const res = await cartCreatePost(req);
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.ok(body.error.includes('out of stock or reserved'));
      assert.equal(body.code, 'OUT_OF_STOCK');
    });

    it('should return human-friendly 429 error with Retry-After when rate limit is exceeded', async () => {
      defaultShopifyMock.simulateRateLimit(10, { errorType: 'THROTTLED' });

      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.20',
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/101',
          quantity: 1,
        }),
      });

      const res = await cartCreatePost(req);
      assert.equal(res.status, 429);
      assert.equal(res.headers.get('Retry-After'), '2');

      const body = await res.json();
      assert.ok(body.error.includes('Drop traffic is surging'));
      assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
    });
  });

  describe('4. CI/CD Script & Documentation Verification', () => {
    it('should verify test:load script is defined in package.json', () => {
      assert.ok(fs.existsSync(packageJsonPath), 'package.json must exist');
      const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      assert.ok(content.scripts?.['test:load'], 'package.json must define "test:load"');
      assert.ok(content.scripts['test:load'].includes('tests/load/drop-surge.ts'));
    });

    it('should verify docs/runbooks/DROP_DAY_RESILIENCE.md documents all 5 defense layers and war room checklists', () => {
      assert.ok(fs.existsSync(runbookPath), 'DROP_DAY_RESILIENCE.md must exist');
      const content = fs.readFileSync(runbookPath, 'utf-8');

      assert.ok(content.includes('Drop Day High-Concurrency'), 'Must document drop day concurrency');
      assert.ok(content.includes('Multi-Layer Edge Defense'), 'Must document defense architecture');
      assert.ok(content.includes('Cloudflare Turnstile'), 'Must document Turnstile layer');
      assert.ok(content.includes('s-maxage=10'), 'Must document Edge cache header');
      assert.ok(content.includes('Shopify-Storefront-Buyer-IP'), 'Must document buyer IP forwarding');
      assert.ok(content.includes('Leaky Bucket Exponential Backoff'), 'Must document leaky bucket backoff');
      assert.ok(content.includes('War Room Checklist'), 'Must include war room checklist');
      assert.ok(content.includes('p95'), 'Must specify p95 latency gate');
    });
  });
});
