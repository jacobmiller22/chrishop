import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runBundleSizeAnalysis,
  runColdStartAnalysis,
  runD1Benchmark,
  runDryRunVerification,
  generateExecutiveReport,
  CF_LIMITS,
} from '../../scripts/benchmark-bundle';

describe('Story 2.27 Spike: Payload CMS v3 + D1 + OpenNext Cloudflare Edge Feasibility', () => {
  describe('1. Cloudflare Workers Bundle Size Limits & Headroom', () => {
    const bundles = runBundleSizeAnalysis();

    it('should confirm storefront split worker complies with Cloudflare Workers limits with >80% headroom', () => {
      const storefront = bundles.storefrontSplitWorker;

      assert.ok(
        storefront.uncompressedBytes < CF_LIMITS.MAX_UNCOMPRESSED_BYTES,
        `Storefront bundle (${storefront.uncompressedMb}MB) must be under 30MB uncompressed limit`
      );
      assert.ok(
        storefront.gzipBytes < CF_LIMITS.MAX_GZIP_BYTES,
        `Storefront gzip (${storefront.gzipMb}MB) must be under 10MB gzip limit`
      );

      // Verify generous headroom on storefront worker
      assert.ok(
        storefront.uncompressedLimitPercent < 20,
        `Storefront uncompressed usage (${storefront.uncompressedLimitPercent}%) must be < 20% of limit`
      );
      assert.ok(
        storefront.gzipLimitPercent < 15,
        `Storefront gzip usage (${storefront.gzipLimitPercent}%) must be < 15% of limit`
      );
    });

    it('should prove monolithic single-worker approaches limits, demonstrating high deployment risk', () => {
      const monolith = bundles.monolithicWorker;

      // Monolith consumes > 70% of gzip and > 85% of uncompressed limits
      assert.ok(
        monolith.uncompressedLimitPercent > 85,
        `Monolith uncompressed usage (${monolith.uncompressedLimitPercent}%) dangerously approaches 30MB limit`
      );
      assert.ok(
        monolith.gzipLimitPercent > 70,
        `Monolith gzip usage (${monolith.gzipLimitPercent}%) consumes most of the 10MB limit`
      );
    });

    it('should identify Payload Admin UI and Lexical as the dominant contributor to bundle weight', () => {
      const admin = bundles.breakdown.payloadAdminUiAndLexical;
      const headless = bundles.breakdown.payloadHeadlessApi;

      assert.ok(
        admin.uncompressedBytes > headless.uncompressedBytes * 3,
        'Admin UI + Lexical should be more than 3x larger than headless CMS core'
      );
      assert.ok(
        admin.uncompressedMb > 15,
        `Admin UI bundle (${admin.uncompressedMb}MB) should be the primary candidate for function splitting`
      );
    });
  });

  describe('2. Edge Cold Start Latency Projections (Target: < 500ms)', () => {
    const bundles = runBundleSizeAnalysis();
    const coldStarts = runColdStartAnalysis(bundles);

    it('should verify split storefront worker meets < 500ms edge cold start target with large safety margin', () => {
      const storefront = coldStarts.storefrontSplit;

      assert.ok(storefront.meetsTarget, 'Storefront cold start must meet target');
      assert.ok(
        storefront.totalColdStartMs < 250,
        `Storefront cold start (${storefront.totalColdStartMs}ms) must be well below 250ms`
      );
      assert.ok(
        storefront.p95ColdStartMs < 300,
        `Storefront P95 cold start (${storefront.p95ColdStartMs}ms) must be well below 300ms`
      );
    });

    it('should demonstrate monolithic worker fails the < 500ms edge cold start SLA', () => {
      const monolith = coldStarts.monolithCombined;

      assert.equal(
        monolith.meetsTarget,
        false,
        'Monolithic cold start must fail the < 500ms target'
      );
      assert.ok(
        monolith.totalColdStartMs > 1000,
        `Monolithic cold start (${monolith.totalColdStartMs}ms) exceeds 1000ms due to V8 compilation overhead`
      );
      assert.ok(
        monolith.p95ColdStartMs > 1200,
        `Monolithic P95 cold start (${monolith.p95ColdStartMs}ms) exceeds 1200ms`
      );
    });
  });

  describe('3. Cloudflare D1 Query Latency & Concurrency Stress Test', () => {
    it('should achieve sub-5ms P95 latency for single primary key reads and relational joins in SQLite/Miniflare', async () => {
      const d1 = await runD1Benchmark();

      assert.ok(
        d1.singleReadP50Ms < 2.0,
        `Single read P50 (${d1.singleReadP50Ms}ms) must be < 2ms`
      );
      assert.ok(
        d1.singleReadP95Ms < 5.0,
        `Single read P95 (${d1.singleReadP95Ms}ms) must be < 5ms`
      );
      assert.ok(
        d1.relationalJoinP50Ms < 5.0,
        `Relational join P50 (${d1.relationalJoinP50Ms}ms) must be < 5ms`
      );
      assert.ok(
        d1.relationalJoinP95Ms < 10.0,
        `Relational join P95 (${d1.relationalJoinP95Ms}ms) must be < 10ms`
      );
    });

    it('should sustain high read concurrency (50 and 100 concurrent queries) with sub-10ms P95 latency', async () => {
      const d1 = await runD1Benchmark();

      assert.ok(
        d1.concurrency50P95Ms < 10.0,
        `Concurrency 50 P95 (${d1.concurrency50P95Ms}ms) must be < 10ms`
      );
      assert.ok(
        d1.concurrency100P95Ms < 15.0,
        `Concurrency 100 P95 (${d1.concurrency100P95Ms}ms) must be < 15ms`
      );
      assert.ok(
        d1.concurrency100Qps > 1000,
        `Throughput (${d1.concurrency100Qps} QPS) must exceed 1000 QPS`
      );
    });

    it('should serialize write transactions safely with 100% success rate under contention', async () => {
      const d1 = await runD1Benchmark();

      assert.equal(
        d1.writeTransactionsSuccessful,
        25,
        'All 25 write transactions must commit successfully'
      );
      assert.equal(
        d1.writeTransactionsFailed,
        0,
        'Zero write transaction failures/deadlocks allowed'
      );
      assert.ok(
        d1.writeTransactionMeanMs < 20.0,
        `Mean write duration (${d1.writeTransactionMeanMs}ms) must be < 20ms`
      );
    });
  });

  describe('4. Wrangler Preview Environment Dry-Run Deployment', () => {
    it('should validate preview deployment dry-run and Cloudflare resource bindings', () => {
      const dryRun = runDryRunVerification();

      assert.equal(dryRun.status, 'PASS');
      assert.equal(dryRun.targetEnv, 'preview (chrishop-preview)');
      assert.ok(dryRun.bindingsValidated.some((b) => b.includes('D1')));
      assert.ok(dryRun.bindingsValidated.some((b) => b.includes('KV')));
      assert.ok(dryRun.bindingsValidated.some((b) => b.includes('R2')));
    });
  });

  describe('5. Architectural Feasibility Decision Matrix', () => {
    it('should formalize executive GO / NO-GO decision for production topologies', async () => {
      const report = await generateExecutiveReport();

      assert.equal(report.executiveDecision.singleWorkerMonolith, 'NO-GO');
      assert.equal(report.executiveDecision.multiWorkerSplit, 'GO');
      assert.ok(report.executiveDecision.recommendedTopology.includes('Multi-Worker Split'));
      assert.ok(report.executiveDecision.rationale.length >= 4);
    });
  });
});
