import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUDITED_TELEMETRY_SIGNALS,
  TELEMETRY_GAPS,
  TELEMETRY_TIERS,
  validateTelemetryAuditCatalog,
  type SystemTier,
} from '../../apps/web/src/lib/telemetry-audit';
import { verifyTelemetryAudit } from '../../scripts/verify-telemetry-audit';

describe('Story 4.14: Telemetry & Observability Gap Audit Integration Suite', () => {
  // ==========================================================================
  // 1. Master Telemetry Signal Catalog & Schema
  // ==========================================================================
  describe('1. Master Telemetry Signal Catalog', () => {
    it('should validate the catalog without errors and catalog >= 25 signals', () => {
      const result = validateTelemetryAuditCatalog();
      assert.equal(result.valid, true, `Catalog validation failed: ${result.errors.join(', ')}`);
      assert.ok(
        result.totalSignals >= 25,
        `Expected >= 25 signals, found ${result.totalSignals}`
      );
    });

    it('should cover all 6 system tiers with at least 3 signals each', () => {
      const requiredTiers: SystemTier[] = [
        'edge-runtime',
        'storefront-app',
        'data-tier',
        'storage-tier',
        'third-party-integrations',
        'webhook-pipeline',
      ];

      const result = validateTelemetryAuditCatalog();
      for (const tier of requiredTiers) {
        const count = result.tierCoverage[tier] || 0;
        assert.ok(
          count >= 3,
          `Tier "${tier}" must have at least 3 signals, got ${count}`
        );
      }
    });

    it('should correctly partition signals into active, partial, and missing states', () => {
      const result = validateTelemetryAuditCatalog();
      assert.ok(result.activeCount >= 10, 'Must have at least 10 active signals in production code');
      assert.ok(result.partialCount >= 3, 'Must identify partial signals');
      assert.ok(result.missingCount >= 5, 'Must identify at least 5 missing signals (gaps)');
      assert.equal(
        result.activeCount + result.partialCount + result.missingCount,
        result.totalSignals
      );
    });

    it('should require follow-up issue linkage for all missing signals', () => {
      const missingSignals = AUDITED_TELEMETRY_SIGNALS.filter((s) => s.state === 'missing');
      for (const signal of missingSignals) {
        assert.ok(
          signal.followUpIssue && signal.followUpIssue.id > 0,
          `Missing signal "${signal.id}" must link to a valid followUpIssue`
        );
      }
    });
  });

  // ==========================================================================
  // 2. High-Priority Gaps & GitHub Follow-Up Issues
  // ==========================================================================
  describe('2. Observability Gap Triage & Follow-Up Issues', () => {
    it('should catalog the 5 critical observability gaps', () => {
      assert.equal(TELEMETRY_GAPS.length, 5, 'Must catalog exactly 5 prioritized gap items');

      const gapIds = TELEMETRY_GAPS.map((g) => g.id);
      assert.ok(gapIds.includes('GAP-001'), 'Must include Distributed Tracing gap');
      assert.ok(gapIds.includes('GAP-002'), 'Must include RUM & Core Web Vitals gap');
      assert.ok(gapIds.includes('GAP-003'), 'Must include D1 Query Latency gap');
      assert.ok(gapIds.includes('GAP-004'), 'Must include Drop Conversion Funnel gap');
      assert.ok(gapIds.includes('GAP-005'), 'Must include Webhook Queue Backpressure gap');
    });

    it('should link gaps to valid GitHub issues #330 through #334', () => {
      const linkedIssues = TELEMETRY_GAPS.map((g) => g.followUpIssueId);
      assert.ok(linkedIssues.includes(330), 'Must link to Issue #330 (Distributed Tracing)');
      assert.ok(linkedIssues.includes(331), 'Must link to Issue #331 (Core Web Vitals RUM)');
      assert.ok(linkedIssues.includes(332), 'Must link to Issue #332 (D1 Statement Latency)');
      assert.ok(linkedIssues.includes(333), 'Must link to Issue #333 (Drop Conversion Funnel)');
      assert.ok(linkedIssues.includes(334), 'Must link to Issue #334 (Webhook Queue Backpressure)');
    });

    it('should specify impact and concrete remediation for every gap', () => {
      for (const gap of TELEMETRY_GAPS) {
        assert.ok(gap.impact.length >= 20, `Gap ${gap.id} must define operational impact`);
        assert.ok(gap.remediation.length >= 20, `Gap ${gap.id} must define remediation plan`);
        assert.ok(
          ['critical', 'high'].includes(gap.criticality),
          `Gap ${gap.id} must have high or critical severity`
        );
      }
    });
  });

  // ==========================================================================
  // 3. Documentation Completeness & Structure
  // ==========================================================================
  describe('3. Telemetry Audit Documentation', () => {
    const docPath = path.resolve(__dirname, '../../docs/analysis/TELEMETRY_DATA_POINTS_AND_GAPS.md');
    const pointerPath = path.resolve(__dirname, '../../docs/observability/TELEMETRY_GAP_AUDIT.md');

    it('should maintain comprehensive audit report at docs/analysis/TELEMETRY_DATA_POINTS_AND_GAPS.md', () => {
      assert.ok(fs.existsSync(docPath), 'Audit document must exist');
      const stats = fs.statSync(docPath);
      assert.ok(stats.size > 5000, 'Audit document must be comprehensive (> 5KB)');
    });

    it('should maintain cross-reference pointer at docs/observability/TELEMETRY_GAP_AUDIT.md', () => {
      assert.ok(fs.existsSync(pointerPath), 'Pointer document must exist');
      const content = fs.readFileSync(pointerPath, 'utf-8');
      assert.ok(content.includes('TELEMETRY_DATA_POINTS_AND_GAPS.md'));
    });

    it('should contain all required audit sections and issue hyperlinks', () => {
      const content = fs.readFileSync(docPath, 'utf-8');
      const requiredSections = [
        'Executive Summary & Audit Objectives',
        'Observability Topology Architecture',
        'Comprehensive Telemetry Audit Matrix',
        'In-Depth Observability Gap Analysis',
        'Shovel-Ready Follow-Up Action Matrix',
        'Continuous Verification & Audit Automation',
      ];

      for (const section of requiredSections) {
        assert.ok(content.includes(section), `Document missing section: ${section}`);
      }

      // Check for follow-up issue hyperlinks
      assert.ok(content.includes('github.com/jacobmiller22/chrishop/issues/330'));
      assert.ok(content.includes('github.com/jacobmiller22/chrishop/issues/331'));
      assert.ok(content.includes('github.com/jacobmiller22/chrishop/issues/332'));
      assert.ok(content.includes('github.com/jacobmiller22/chrishop/issues/333'));
      assert.ok(content.includes('github.com/jacobmiller22/chrishop/issues/334'));
    });

    it('should embed valid Mermaid architecture flowchart', () => {
      const content = fs.readFileSync(docPath, 'utf-8');
      assert.ok(content.includes('```mermaid'));
      assert.ok(content.includes('flowchart TD'));
      assert.ok(content.includes('subgraph ClientBrowser'));
      assert.ok(content.includes('subgraph EdgeTier'));
      assert.ok(content.includes('subgraph DataAndStorage'));
      assert.ok(content.includes('subgraph ShopifyIntegration'));
      assert.ok(content.includes('subgraph WebhookQueue'));
    });
  });

  // ==========================================================================
  // 4. Codebase Telemetry Hooks Alignment
  // ==========================================================================
  describe('4. Codebase Telemetry Hooks Alignment', () => {
    it('should verify health monitoring probe signals in apps/web/src/lib/health-monitoring.ts', () => {
      const filePath = path.resolve(__dirname, '../../apps/web/src/lib/health-monitoring.ts');
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('performHealthCheck'));
      assert.ok(content.includes('SELECT 1 as healthy'));
      assert.ok(content.includes('__health_check__'));
      assert.ok(content.includes('dispatchHealthAlert'));
    });

    it('should verify Sentry error tracking engine in apps/web/src/lib/sentry.ts', () => {
      const filePath = path.resolve(__dirname, '../../apps/web/src/lib/sentry.ts');
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('captureException'));
      assert.ok(content.includes('isSentryConfigured'));
      assert.ok(content.includes('dispatchSentryAlertToDiscord'));
    });

    it('should verify Better Stack uptime configuration in apps/web/src/lib/better-stack.ts', () => {
      const filePath = path.resolve(__dirname, '../../apps/web/src/lib/better-stack.ts');
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('getProductionMonitorConfig'));
      assert.ok(content.includes('DEFAULT_CHECK_FREQUENCY_SECONDS'));
      assert.ok(content.includes('"status":"healthy"'));
    });

    it('should verify Edge Timeout interception in apps/web/src/lib/edge-timeout.ts', () => {
      const filePath = path.resolve(__dirname, '../../apps/web/src/lib/edge-timeout.ts');
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('generateTimeoutJsonResponse'));
      assert.ok(content.includes('cf-ray'));
      assert.ok(content.includes('DEFAULT_EDGE_TIMEOUT_MS'));
    });

    it('should verify Shopify Webhook HMAC Subtle & Idempotency in order pipeline', () => {
      const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/webhooks/shopify/route.ts');
      const consumerPath = path.resolve(__dirname, '../../apps/web/src/lib/order-consumer.ts');
      assert.ok(fs.existsSync(routePath));
      assert.ok(fs.existsSync(consumerPath));

      const routeContent = fs.readFileSync(routePath, 'utf-8');
      assert.ok(routeContent.includes('checkAndSetIdempotency'));
      assert.ok(routeContent.includes('x-response-time-ms'));

      const consumerContent = fs.readFileSync(consumerPath, 'utf-8');
      assert.ok(consumerContent.includes('verifyShopifyWebhookHmacSubtle'));
    });
  });

  // ==========================================================================
  // 5. Automated Verification Tool Execution
  // ==========================================================================
  describe('5. Automated Verification CLI', () => {
    it('should successfully run verifyTelemetryAudit() returning true', async () => {
      const passed = await verifyTelemetryAudit();
      assert.equal(passed, true, 'verifyTelemetryAudit must return true');
    });
  });
});
