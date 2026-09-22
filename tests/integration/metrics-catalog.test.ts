import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ENGINEERING_METRICS,
  CREATOR_METRICS,
  ALL_METRIC_DEFINITIONS,
  validateMetricsCatalog,
  type VisualWidgetType,
} from '../../apps/web/src/lib/metrics-catalog';
import { verifyMetricsCatalog } from '../../scripts/verify-metrics-catalog';

describe('Story 4.15: Metrics, Visualizations & Alerting Catalog Specification Suite', () => {
  // ==========================================================================
  // 1. Master Metrics Catalog Schema & Validation
  // ==========================================================================
  describe('1. Master Metrics Catalog Validation', () => {
    it('should validate the catalog without errors and define >= 20 total metrics', () => {
      const result = validateMetricsCatalog();
      assert.equal(result.valid, true, `Catalog validation failed: ${result.errors.join(', ')}`);
      assert.ok(result.totalMetrics >= 20, `Expected >= 20 metrics, got ${result.totalMetrics}`);
    });

    it('should clearly partition metrics between Engineering and Creator personas', () => {
      const result = validateMetricsCatalog();
      assert.ok(result.engineeringCount >= 10, 'Must have >= 10 Engineering operational metrics');
      assert.ok(result.creatorCount >= 10, 'Must have >= 10 Creator business KPI metrics');
      assert.equal(result.engineeringCount + result.creatorCount, result.totalMetrics);
    });

    it('should ensure every metric has a valid calculation formula and source signal', () => {
      for (const m of ALL_METRIC_DEFINITIONS) {
        assert.ok(m.formula && m.formula.length > 5, `Metric ${m.id} missing calculation formula`);
        assert.ok(m.sourceSignal && m.sourceSignal.length > 5, `Metric ${m.id} missing source signal`);
        assert.ok(m.refreshCadenceSeconds > 0, `Metric ${m.id} must have positive refresh cadence`);
      }
    });
  });

  // ==========================================================================
  // 2. Engineering Operational Metrics Catalog
  // ==========================================================================
  describe('2. Engineering Operational Metrics', () => {
    it('should include all required edge performance metrics', () => {
      const ids = ENGINEERING_METRICS.map((m) => m.id);
      assert.ok(ids.includes('eng.edge_rps'), 'Must include Edge Requests/sec');
      assert.ok(ids.includes('eng.http_5xx_rate'), 'Must include HTTP 5xx error rate');
      assert.ok(ids.includes('eng.edge_latency_p95'), 'Must include p95 latency');
      assert.ok(ids.includes('eng.edge_latency_p99'), 'Must include p99 latency');
      assert.ok(ids.includes('eng.worker_cpu_time'), 'Must include Worker CPU time');
    });

    it('should include database and storage health metrics', () => {
      const ids = ENGINEERING_METRICS.map((m) => m.id);
      assert.ok(ids.includes('eng.d1_query_latency_avg'), 'Must include D1 query latency');
      assert.ok(ids.includes('eng.d1_slow_query_rate'), 'Must include D1 slow query rate');
      assert.ok(ids.includes('eng.kv_cache_hit_ratio'), 'Must include KV cache hit ratio');
    });

    it('should include application reliability and security metrics', () => {
      const ids = ENGINEERING_METRICS.map((m) => m.id);
      assert.ok(ids.includes('eng.sentry_unresolved_errors'), 'Must include Sentry errors');
      assert.ok(ids.includes('eng.better_stack_probe_latency'), 'Must include Better Stack probe');
      assert.ok(ids.includes('eng.waf_block_rate'), 'Must include WAF block rate');
      assert.ok(ids.includes('eng.turnstile_pass_ratio'), 'Must include Turnstile pass ratio');
    });
  });

  // ==========================================================================
  // 3. Creator Business & Drop Performance Metrics
  // ==========================================================================
  describe('3. Creator Business & Drop Performance Metrics', () => {
    it('should include live traffic and conversion funnel metrics', () => {
      const ids = CREATOR_METRICS.map((m) => m.id);
      assert.ok(ids.includes('biz.concurrent_visitors'), 'Must include real-time visitors');
      assert.ok(ids.includes('biz.countdown_views_per_min'), 'Must include countdown impressions');
      assert.ok(ids.includes('biz.funnel_cart_velocity'), 'Must include cart velocity');
      assert.ok(ids.includes('biz.checkout_handshake_failures'), 'Must include checkout failures');
      assert.ok(ids.includes('biz.conversion_rate'), 'Must include overall conversion rate');
    });

    it('should include inventory velocity and revenue milestone metrics', () => {
      const ids = CREATOR_METRICS.map((m) => m.id);
      assert.ok(ids.includes('biz.inventory_burn_down_rate'), 'Must include burn-down rate');
      assert.ok(ids.includes('biz.projected_sell_out_time'), 'Must include projected sell-out time');
      assert.ok(ids.includes('biz.inventory_remaining_percent'), 'Must include inventory remaining %');
      assert.ok(ids.includes('biz.gross_merchandise_value'), 'Must include GMV');
      assert.ok(ids.includes('biz.average_order_value'), 'Must include AOV');
      assert.ok(ids.includes('biz.total_completed_orders'), 'Must include total completed orders');
    });
  });

  // ==========================================================================
  // 4. Alerting Thresholds & Escalation Hierarchy
  // ==========================================================================
  describe('4. Alerting Thresholds & Escalation Hierarchy', () => {
    it('should define critical P1 alerting rules for showstopping conditions', () => {
      const criticals = ALL_METRIC_DEFINITIONS.flatMap((m) =>
        m.thresholds.filter((t) => t.severity === 'critical')
      );
      assert.ok(criticals.length >= 4, 'Must have at least 4 critical alerting thresholds');

      // Check specific critical triggers
      const errorRateCrit = ENGINEERING_METRICS.find((m) => m.id === 'eng.http_5xx_rate')?.thresholds.find(
        (t) => t.severity === 'critical'
      );
      assert.ok(errorRateCrit, 'HTTP 5xx rate must have a critical threshold');
      assert.equal(errorRateCrit.channel, 'pagerduty');
      assert.equal(errorRateCrit.thresholdValue, 1.0);

      const checkoutCrit = CREATOR_METRICS.find((m) => m.id === 'biz.checkout_handshake_failures')?.thresholds.find(
        (t) => t.severity === 'critical'
      );
      assert.ok(checkoutCrit, 'Checkout handshake failures must have a critical threshold');
      assert.equal(checkoutCrit.channel, 'pagerduty');
      assert.equal(checkoutCrit.thresholdValue, 0);
    });

    it('should route warning alerts to discord-dev-alerts and milestones to discord-store-orders', () => {
      const warnings = ALL_METRIC_DEFINITIONS.flatMap((m) =>
        m.thresholds.filter((t) => t.severity === 'warning')
      );
      for (const w of warnings) {
        assert.equal(w.channel, 'discord-dev-alerts');
      }

      const milestones = ALL_METRIC_DEFINITIONS.flatMap((m) =>
        m.thresholds.filter((t) => t.severity === 'info')
      );
      for (const info of milestones) {
        assert.equal(info.channel, 'discord-store-orders');
      }
    });
  });

  // ==========================================================================
  // 5. Visual Widget Taxonomy Compliance
  // ==========================================================================
  describe('5. Visual Widget Taxonomy', () => {
    it('should use appropriate visual widgets for distinct metric archetypes', () => {
      const validWidgets: VisualWidgetType[] = [
        'stat_card',
        'time_series',
        'gauge',
        'funnel_bar',
        'log_table',
        'donut_chart',
      ];

      for (const m of ALL_METRIC_DEFINITIONS) {
        assert.ok(
          validWidgets.includes(m.recommendedWidget),
          `Metric ${m.id} has invalid widget type: ${m.recommendedWidget}`
        );
      }

      // Check specific widget mappings
      const gmv = CREATOR_METRICS.find((m) => m.id === 'biz.gross_merchandise_value');
      assert.equal(gmv?.recommendedWidget, 'stat_card', 'GMV must be stat_card');

      const latency = ENGINEERING_METRICS.find((m) => m.id === 'eng.edge_latency_p95');
      assert.equal(latency?.recommendedWidget, 'time_series', 'Latency must be time_series');

      const cpu = ENGINEERING_METRICS.find((m) => m.id === 'eng.worker_cpu_time');
      assert.equal(cpu?.recommendedWidget, 'gauge', 'Worker CPU must be gauge');

      const funnel = CREATOR_METRICS.find((m) => m.id === 'biz.conversion_rate');
      assert.equal(funnel?.recommendedWidget, 'funnel_bar', 'Conversion rate must be funnel_bar');
    });
  });

  // ==========================================================================
  // 6. Documentation Completeness
  // ==========================================================================
  describe('6. Catalog Documentation Verification', () => {
    const docPath = path.resolve(__dirname, '../../docs/analysis/METRICS_VISUALS_AND_ALERTS_CATALOG.md');

    it('should maintain comprehensive specification in docs/analysis/METRICS_VISUALS_AND_ALERTS_CATALOG.md', () => {
      assert.ok(fs.existsSync(docPath), 'Specification document must exist');
      const stats = fs.statSync(docPath);
      assert.ok(stats.size > 5000, 'Specification document must be comprehensive (> 5KB)');
    });

    it('should contain both Engineering and Creator dashboard mockups and required sections', () => {
      const content = fs.readFileSync(docPath, 'utf-8');
      const requiredSections = [
        'Executive Summary & Persona Architecture',
        'Engineering & Operations Dashboard Specification',
        'Creator & Business Drop Performance Dashboard Specification',
        'Visual Widget & Chart Selection Taxonomy',
        'Unified Alerting Rules & Escalation Matrix',
        'Continuous Verification & Tooling',
      ];

      for (const section of requiredSections) {
        assert.ok(content.includes(section), `Missing section in document: ${section}`);
      }

      assert.ok(content.includes('CHRISSHOP ENGINEERING & OPERATIONS MONITOR'), 'Must include Jacob engineering view');
      assert.ok(content.includes('CHRISSHOP CREATOR & DROP LIVE MONITOR'), 'Must include Chris creator view');
      assert.ok(content.includes('PagerDuty'), 'Must document PagerDuty escalation');
      assert.ok(content.includes('#dev-alerts'), 'Must document #dev-alerts');
      assert.ok(content.includes('#store-orders'), 'Must document #store-orders');
    });
  });

  // ==========================================================================
  // 7. Verification CLI Execution
  // ==========================================================================
  describe('7. Verification CLI Runner', () => {
    it('should successfully run verifyMetricsCatalog() returning true', async () => {
      const passed = await verifyMetricsCatalog();
      assert.equal(passed, true, 'verifyMetricsCatalog must return true');
    });
  });
});
