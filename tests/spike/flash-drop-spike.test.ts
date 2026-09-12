import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  simulateFlashDrop,
  runFullFlashDropBenchmark,
  ConcurrencySimulationResult,
} from '../../scripts/simulate-flash-drop';

describe('Story 3.12 Spike: Flash Drop Edge Concurrency Defense & Traffic Threshold Profiling', () => {
  describe('1. Empirical Concurrency Simulations (50, 100, 250, 500 Virtual Buyers)', () => {
    it('should confirm defended flash drop maintains p95 latency well under 200ms across all concurrency tiers', async () => {
      for (const concurrency of [50, 100, 250, 500]) {
        const result: ConcurrencySimulationResult = await simulateFlashDrop(concurrency, {
          defenseEnabled: true,
        });

        assert.equal(result.concurrency, concurrency);
        assert.equal(result.totalRequests, concurrency);
        assert.equal(result.successfulRequests, concurrency);
        assert.equal(result.rateLimitedRequests, 0, 'Zero 429 rate limits allowed when Buyer-IP is forwarded');

        // Acceptance Criteria 4: p95 latency must remain under 200ms
        assert.ok(
          result.latenciesMs.p95 < 200,
          `p95 latency (${result.latenciesMs.p95}ms) at ${concurrency} concurrency must be < 200ms`
        );
      }
    });

    it('should verify SingleFlight collapses 500 simultaneous cache misses into 1 upstream D1 query', async () => {
      const result = await simulateFlashDrop(500, { defenseEnabled: true });

      // Acceptance Criteria 3: Simultaneous cache misses collapse into a single upstream fetch via SingleFlight
      assert.equal(
        result.d1QueriesExecuted,
        1,
        '500 simultaneous product requests must collapse into exactly 1 D1 query'
      );
      assert.equal(result.singleFlightCoalescedCount, 499);
      assert.ok(
        result.coalesceRatioPercent >= 99.0,
        `Coalesce ratio (${result.coalesceRatioPercent}%) must be >= 99%`
      );
    });

    it('should prove baseline undefended traffic triggers Shopify 429s when concurrency exceeds ~80', async () => {
      // 50 concurrency: fits within Shopify burst bucket (80)
      const res50 = await simulateFlashDrop(50, { defenseEnabled: false });
      assert.equal(res50.rateLimitedRequests, 0);

      // 100 concurrency without Buyer-IP: exceeds 80 burst bucket on shared IP
      const res100 = await simulateFlashDrop(100, { defenseEnabled: false });
      assert.ok(
        res100.rateLimitedRequests > 0,
        'Undefended traffic over 80 concurrency on shared IP must encounter HTTP 429 rate limiting'
      );

      // 250 concurrency without Buyer-IP: severe rate limiting
      const res250 = await simulateFlashDrop(250, { defenseEnabled: false });
      assert.ok(res250.rateLimitedRequests >= 150);

      // 500 concurrency without Buyer-IP: catastrophic rate limiting (>400 dropped requests)
      const res500 = await simulateFlashDrop(500, { defenseEnabled: false });
      assert.ok(res500.rateLimitedRequests >= 400);
      assert.equal(res500.d1QueriesExecuted, 500, 'Undefended traffic hammers D1 with 500 direct queries');
    });
  });

  describe('2. Comprehensive Benchmark Suite & Published Analysis Report', () => {
    it('should execute full benchmark matrix and verify report metrics', async () => {
      const report = await runFullFlashDropBenchmark();

      assert.equal(report.concurrencyLevels.length, 4);
      assert.equal(report.thresholds.p95LatencyThresholdUnder200ms, true);
      assert.ok(report.thresholds.shopifyGlobalRateLimitConcurrency <= 100);
      assert.ok(report.thresholds.edgeCacheSWRRecommendation.includes('SingleFlight'));
    });

    it('should verify published FLASH_DROP_PERFORMANCE_SPIKE.md documentation exists and is complete', () => {
      const reportPath = path.resolve(process.cwd(), 'docs/analysis/FLASH_DROP_PERFORMANCE_SPIKE.md');
      assert.ok(fs.existsSync(reportPath), 'docs/analysis/FLASH_DROP_PERFORMANCE_SPIKE.md must exist');

      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(content.includes('DOC-ARCH-2026-SPIKE-3.12'));
      assert.ok(content.includes('Story 3.12 (#185)'));
      assert.ok(content.includes('SingleFlight'));
      assert.ok(content.includes('Shopify-Storefront-Buyer-IP'));
      assert.ok(content.includes('public, s-maxage=10, stale-while-revalidate=50'));
      assert.ok(content.includes('Cloudflare Turnstile'));
    });
  });
});
