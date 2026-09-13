import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  simulateJourney,
  calculateMonthlyCostModel,
  evaluateConcurrencyThresholds,
  STOREFRONT_CHECKOUT_JOURNEY,
  SCREEN_TOUR_VISUAL_JOURNEY,
  ARCHITECTURES,
} from '../../scripts/benchmark-browser-services';

describe('Story 4.19 Architectural Spike: Cloudflare Browser Services vs. GitHub Actions CI', () => {
  describe('1. Empirical Benchmark & Latency Simulations', () => {
    it('should confirm local GHA native runner has minimal wire latency for intra-VM localhost testing', () => {
      const ghaResult = simulateJourney(STOREFRONT_CHECKOUT_JOURNEY, ARCHITECTURES['gha-native'], 'local');
      const cfResult = simulateJourney(STOREFRONT_CHECKOUT_JOURNEY, ARCHITECTURES['cf-browser-cdp'], 'local');

      // Assert intra-process command latency in GHA is sub-second across 60 commands
      assert.ok(
        ghaResult.wireTimeSeconds < 0.1,
        `GHA local wire time (${ghaResult.wireTimeSeconds}s) must be < 0.1s for 60 commands`
      );

      // Assert Cloudflare CDP incurs measurable WAN latency (> 2.0s for 60 commands)
      assert.ok(
        cfResult.wireTimeSeconds >= 2.0,
        `Cloudflare CDP wire time (${cfResult.wireTimeSeconds}s) should reflect WAN roundtrips`
      );

      // Assert CF requires tunnel setup overhead for local dev server
      assert.ok(
        cfResult.setupTimeSeconds > ARCHITECTURES['cf-browser-cdp'].tunnelSetupSeconds,
        'Cloudflare Browser Rendering setup must include tunnel startup time when targeting localhost'
      );
    });

    it('should demonstrate Cloudflare Browser Rendering achieves > 2x speedup on deployed preview URLs', () => {
      const ghaTour = simulateJourney(SCREEN_TOUR_VISUAL_JOURNEY, ARCHITECTURES['gha-native'], 'deployed-preview');
      const cfTour = simulateJourney(SCREEN_TOUR_VISUAL_JOURNEY, ARCHITECTURES['cf-browser-cdp'], 'deployed-preview');

      // Assert CF cold start is ~2.5s vs GHA ~18s
      assert.equal(cfTour.setupTimeSeconds, 2.5);
      assert.equal(ghaTour.setupTimeSeconds, 18.0);

      // Assert CF total duration is significantly faster than GHA when targeting deployed previews
      assert.ok(
        cfTour.totalDurationSeconds < ghaTour.totalDurationSeconds * 0.6,
        `Cloudflare preview tour (${cfTour.totalDurationSeconds}s) must be > 40% faster than GHA (${ghaTour.totalDurationSeconds}s)`
      );
    });
  });

  describe('2. Concurrency & Cost Model Verification', () => {
    it('should flag concurrency contention when parallel PR volume exceeds Cloudflare account limits', () => {
      // 2 concurrent PRs: within limit of 4
      const lowTraffic = evaluateConcurrencyThresholds(2);
      assert.equal(lowTraffic.cfQueued, false);

      // 6 concurrent PRs: exceeds limit of 4
      const surgeTraffic = evaluateConcurrencyThresholds(6);
      assert.equal(surgeTraffic.cfQueued, true);
      assert.equal(surgeTraffic.ghaQueued, false, 'GitHub Actions can handle 6 concurrent jobs without queuing');
      assert.ok(surgeTraffic.recommendation.includes('exceed Cloudflare account limit'));
    });

    it('should confirm Hybrid Tiered Architecture provides the optimal balance of cost and agility', () => {
      const model = calculateMonthlyCostModel(250);

      assert.equal(model.recommendedArchitecture, 'hybrid-tiered');
      assert.ok(model.ghaCostUsd < model.cfBrowserCostUsd, 'Native GHA compute minutes cost less than dedicated CF browser session minutes');
      assert.ok(model.hybridCostUsd < model.cfBrowserCostUsd, 'Hybrid architecture costs less than pure Cloudflare Browser CDP');
    });
  });

  describe('3. Multi-Browser Engine Coverage', () => {
    it('should verify that GitHub Actions supports WebKit (Safari engine) while Cloudflare is Chromium-only', () => {
      assert.equal(ARCHITECTURES['gha-native'].multiBrowserSupport.webkit, true);
      assert.equal(ARCHITECTURES['gha-native'].multiBrowserSupport.firefox, true);
      assert.equal(ARCHITECTURES['gha-native'].multiBrowserSupport.chromium, true);

      assert.equal(ARCHITECTURES['cf-browser-cdp'].multiBrowserSupport.webkit, false);
      assert.equal(ARCHITECTURES['cf-browser-cdp'].multiBrowserSupport.firefox, false);
      assert.equal(ARCHITECTURES['cf-browser-cdp'].multiBrowserSupport.chromium, true);
    });
  });

  describe('4. Architectural Decision Record (ADR) Integrity Check', () => {
    it('should verify that the published ADR document exists and contains all required sections', () => {
      const adrPath = path.resolve(__dirname, '../../docs/analysis/CLOUDFLARE_BROWSER_SERVICES_EVALUATION.md');
      assert.ok(fs.existsSync(adrPath), 'ADR document must exist at docs/analysis/CLOUDFLARE_BROWSER_SERVICES_EVALUATION.md');

      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('# Architectural Decision Record: Cloudflare Browser Services'));
      assert.ok(content.includes('ACCEPTED (HYBRID TIERED ARCHITECTURE RECOMMENDED)'));
      assert.ok(content.includes('Story Reference'));
      assert.ok(content.includes('Story 4.19'));
      assert.ok(content.includes('Option C: Hybrid Tiered Testing Architecture'));
      assert.ok(content.includes('Story 4.20: GitHub Actions Playwright UI & Integration Test Suite Pipeline ([#209]'));
      assert.ok(content.includes('Story 4.21: Cloudflare Browser Rendering Ephemeral Preview Smoke & Screen Tour Harness ([#210]'));
      assert.ok(content.includes('Kitesurf'));
      assert.ok(content.includes('connectOverCDP'));
    });
  });
});
