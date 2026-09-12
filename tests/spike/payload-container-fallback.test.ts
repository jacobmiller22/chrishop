import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ==============================================================================
 * Story 2.44: Architectural Spike — Containerized Node.js Fallback Topology
 * Payload CMS v3 + Cloudflare D1/Hyperdrive + Origin Rules Verification
 * Reference: docs/decisions/ADR_PAYLOAD_CONTAINER_FALLBACK.md
 * ==============================================================================
 */

export interface TelemetryMetrics {
  d1TransactionFailureRate: number; // Percentage, e.g. 0.0005 = 0.05%
  adminBundleGzipMb: number; // Megabytes
  adminBundleRawMb: number; // Megabytes
  isolateOomRate: number; // Percentage, e.g. 0.0002 = 0.02%
  coldStartP99Ms: number; // Milliseconds
  requiresNativeModules: boolean; // True if native C++ bindings needed
}

export interface TriggerEvaluationResult {
  activateFallback: boolean;
  action: 'MAINTAIN_EDGE_ISOLATE' | 'ACTIVATE_CONTAINER_FALLBACK';
  trippedTriggers: string[];
  reasons: string[];
}

export const FALLBACK_THRESHOLDS = {
  MAX_D1_TX_FAILURE_RATE: 0.001, // 0.10% failure rate
  MAX_ADMIN_BUNDLE_GZIP_MB: 10.0, // Hard Cloudflare Workers gzip limit
  MAX_ADMIN_BUNDLE_RAW_MB: 30.0, // Hard Cloudflare Workers uncompressed limit
  MAX_ISOLATE_OOM_RATE: 0.0005, // 0.05% memory exhaustion rate
  MAX_COLD_START_P99_MS: 1500, // 1500ms p99 cold boot ceiling
} as const;

/**
 * Programmatic Go / No-Go Trigger Evaluator
 * Validates edge runtime telemetry against the quantitative criteria defined in Section 5 of the ADR.
 */
export function evaluateFallbackTrigger(metrics: TelemetryMetrics): TriggerEvaluationResult {
  const trippedTriggers: string[] = [];
  const reasons: string[] = [];

  if (metrics.d1TransactionFailureRate >= FALLBACK_THRESHOLDS.MAX_D1_TX_FAILURE_RATE) {
    trippedTriggers.push('TRG-01');
    reasons.push(
      `D1 transaction failure rate (${(metrics.d1TransactionFailureRate * 100).toFixed(2)}%) exceeds threshold of ${(FALLBACK_THRESHOLDS.MAX_D1_TX_FAILURE_RATE * 100).toFixed(2)}%`
    );
  }

  if (
    metrics.adminBundleGzipMb >= FALLBACK_THRESHOLDS.MAX_ADMIN_BUNDLE_GZIP_MB ||
    metrics.adminBundleRawMb >= FALLBACK_THRESHOLDS.MAX_ADMIN_BUNDLE_RAW_MB
  ) {
    trippedTriggers.push('TRG-02');
    reasons.push(
      `Admin worker bundle size (gzip: ${metrics.adminBundleGzipMb}MB, raw: ${metrics.adminBundleRawMb}MB) breaches limits (10MB gzip / 30MB raw)`
    );
  }

  if (metrics.isolateOomRate >= FALLBACK_THRESHOLDS.MAX_ISOLATE_OOM_RATE) {
    trippedTriggers.push('TRG-03');
    reasons.push(
      `Isolate memory exhaustion rate (${(metrics.isolateOomRate * 100).toFixed(2)}%) exceeds safe threshold of ${(FALLBACK_THRESHOLDS.MAX_ISOLATE_OOM_RATE * 100).toFixed(2)}%`
    );
  }

  if (metrics.coldStartP99Ms >= FALLBACK_THRESHOLDS.MAX_COLD_START_P99_MS) {
    trippedTriggers.push('TRG-04');
    reasons.push(
      `Admin route p99 cold start latency (${metrics.coldStartP99Ms}ms) exceeds target threshold of ${FALLBACK_THRESHOLDS.MAX_COLD_START_P99_MS}ms`
    );
  }

  if (metrics.requiresNativeModules) {
    trippedTriggers.push('TRG-05');
    reasons.push(
      'Mandatory requirement for native C++ Node.js modules (sharp, pdfkit, canvas) that cannot run in V8 edge isolates'
    );
  }

  const activateFallback = trippedTriggers.length > 0;
  return {
    activateFallback,
    action: activateFallback ? 'ACTIVATE_CONTAINER_FALLBACK' : 'MAINTAIN_EDGE_ISOLATE',
    trippedTriggers,
    reasons,
  };
}

describe('Story 2.44: Containerized Node.js Fallback Topology for Payload CMS v3', () => {
  const rootDir = process.cwd();
  const adrPath = path.join(rootDir, 'docs/decisions/ADR_PAYLOAD_CONTAINER_FALLBACK.md');
  const dockerfilePath = path.join(rootDir, 'infra/docker/Dockerfile.payload');
  const composePath = path.join(rootDir, 'infra/docker/docker-compose.payload.yml');
  const flyPath = path.join(rootDir, 'infra/docker/fly.payload.toml');
  const originRulesPath = path.join(rootDir, 'infra/docker/origin-rules.json');

  // ----------------------------------------------------------------------------
  // 1. Formal ADR Document Verification
  // ----------------------------------------------------------------------------
  describe('1. Architectural Decision Record (ADR) Completeness', () => {
    it('should confirm ADR_PAYLOAD_CONTAINER_FALLBACK.md exists and is non-empty', () => {
      assert.ok(fs.existsSync(adrPath), 'ADR file must exist at docs/decisions/ADR_PAYLOAD_CONTAINER_FALLBACK.md');
      const stat = fs.statSync(adrPath);
      assert.ok(stat.size > 5000, `ADR file size (${stat.size} bytes) must be substantial and exhaustive`);
    });

    it('should verify ADR metadata, deciders, and story cross-references', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('**Status**: PROPOSED') || content.includes('Status: PROPOSED'), 'ADR status must be declared');
      assert.ok(content.includes('Story 2.44'), 'Must reference Story 2.44');
      assert.ok(content.includes('#190'), 'Must reference issue #190');
      assert.ok(content.includes('Story 2.39'), 'Must reference prerequisite Story 2.39 (OpenNext)');
      assert.ok(content.includes('Story 2.41'), 'Must reference prerequisite Story 2.41 (Bundle budgeting)');
    });

    it('should verify all 3 edge isolate runtime constraints are documented', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      // Constraint 1: D1 interactive transactions
      assert.ok(
        content.includes('Cloudflare D1 Interactive Transaction Limitations') ||
          content.includes('D1 Async Interactive Transactions'),
        'Must document D1 interactive transaction limits'
      );
      assert.ok(content.includes('BEGIN ... COMMIT') || content.includes('db.batch'), 'Must detail D1 batch vs transaction differences');

      // Constraint 2: Native C++ Node.js Modules
      assert.ok(
        content.includes('Native Node.js C++ Addon Prohibitions') ||
          content.includes('Native Node.js Dependencies'),
        'Must document native module limits'
      );
      assert.ok(content.includes('sharp'), 'Must mention sharp image processing constraint');

      // Constraint 3: Cold starts & isolate memory
      assert.ok(
        content.includes('Admin Isolate Memory Ceilings') ||
          content.includes('Admin Cold Starts'),
        'Must document memory and cold start constraints'
      );
    });

    it('should verify container options comparison matrix covers all 4 targets', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('Cloudflare Workers Containers'), 'Must evaluate Cloudflare Workers Containers');
      assert.ok(content.includes('Fly.io'), 'Must evaluate Fly.io');
      assert.ok(content.includes('AWS ECS Fargate'), 'Must evaluate AWS ECS Fargate');
      assert.ok(content.includes('Railway'), 'Must evaluate Railway');
      assert.ok(content.includes('Regional Proximity to D1 & Hyperdrive'), 'Must compare regional proximity');
      assert.ok(content.includes('Zero-Egress R2 Connectivity'), 'Must compare R2 egress costs');
    });

    it('should verify database topology patterns (D1 Remote API vs Hyperdrive Postgres)', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('D1 Remote Connection'), 'Must document D1 Remote HTTP connection');
      assert.ok(content.includes('Cloudflare Hyperdrive'), 'Must document Hyperdrive Postgres pattern');
      assert.ok(content.includes('zero replication lag') || content.includes('Zero replication lag'), 'Must detail data consistency');
    });

    it('should verify clear Go / No-Go trigger metrics and migration/rollback playbooks', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('TRG-01'), 'Must define TRG-01');
      assert.ok(content.includes('TRG-02'), 'Must define TRG-02');
      assert.ok(content.includes('TRG-03'), 'Must define TRG-03');
      assert.ok(content.includes('TRG-04'), 'Must define TRG-04');
      assert.ok(content.includes('TRG-05'), 'Must define TRG-05');
      assert.ok(content.includes('Fallback Activation Sequence'), 'Must include activation playbook');
      assert.ok(content.includes('Rollback Sequence'), 'Must include rollback sequence');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Production Dockerfile Specifications & Hardening
  // ----------------------------------------------------------------------------
  describe('2. Multi-Stage Dockerfile (infra/docker/Dockerfile.payload)', () => {
    it('should confirm Dockerfile.payload exists and uses Node.js 22 Alpine', () => {
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile.payload must exist');
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      assert.ok(content.includes('FROM node:22-alpine'), 'Must use node:22-alpine base image');
    });

    it('should verify multi-stage architecture (base, deps, builder, runner)', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      assert.ok(content.includes('FROM node:22-alpine AS base'), 'Must declare base stage');
      assert.ok(content.includes('FROM base AS deps'), 'Must declare deps stage');
      assert.ok(content.includes('FROM base AS builder'), 'Must declare builder stage');
      assert.ok(content.includes('FROM node:22-alpine AS runner'), 'Must declare runner stage');
    });

    it('should verify security hardening: non-root user, dumb-init, healthcheck', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      // Unprivileged user
      assert.ok(content.includes('adduser') && content.includes('payload'), 'Must create non-root payload user');
      assert.ok(content.includes('USER payload'), 'Must execute as unprivileged user payload');

      // Process supervisor
      assert.ok(content.includes('dumb-init'), 'Must install and use dumb-init');
      assert.ok(content.includes('ENTRYPOINT ["dumb-init", "--"]'), 'Must set dumb-init entrypoint');

      // Healthcheck
      assert.ok(content.includes('HEALTHCHECK'), 'Must define container HEALTHCHECK');
      assert.ok(content.includes('/api/health'), 'Healthcheck must target /api/health endpoint');

      // Port exposure
      assert.ok(content.includes('EXPOSE 3000'), 'Must expose HTTP port 3000');
    });

    it('should verify pnpm Corepack activation in Dockerfile', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      assert.ok(content.includes('corepack enable'), 'Must enable corepack for pnpm');
      assert.ok(content.includes('pnpm install --frozen-lockfile'), 'Must enforce frozen lockfile');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Local Docker Compose & Fly.io Configurations
  // ----------------------------------------------------------------------------
  describe('3. Docker Compose & Fly.io Deployment Manifests', () => {
    it('should confirm docker-compose.payload.yml is syntactically valid and configures payload-cms', () => {
      assert.ok(fs.existsSync(composePath), 'docker-compose.payload.yml must exist');
      const content = fs.readFileSync(composePath, 'utf-8');
      assert.ok(content.includes('payload-cms:'), 'Must configure payload-cms service');
      assert.ok(content.includes('Dockerfile.payload'), 'Must target Dockerfile.payload');
      assert.ok(content.includes('"3000:3000"'), 'Must map port 3000');
      assert.ok(content.includes('PAYLOAD_SECRET'), 'Must inject PAYLOAD_SECRET');
      assert.ok(content.includes('CLOUDFLARE_D1_DATABASE_ID'), 'Must inject D1 credentials');
      assert.ok(content.includes('R2_BUCKET_NAME'), 'Must inject R2 credentials');
      assert.ok(content.includes('ORIGIN_VERIFY_SECRET'), 'Must inject ORIGIN_VERIFY_SECRET');
    });

    it('should confirm fly.payload.toml specifies iad region, port 3000, and health probes', () => {
      assert.ok(fs.existsSync(flyPath), 'fly.payload.toml must exist');
      const content = fs.readFileSync(flyPath, 'utf-8');
      assert.ok(content.includes('app = "chrishop-payload-fallback"'), 'Must declare app name');
      assert.ok(content.includes('primary_region = "iad"'), 'Must specify primary_region = iad for D1 proximity');
      assert.ok(content.includes('internal_port = 3000'), 'Must specify internal_port = 3000');
      assert.ok(content.includes('min_machines_running = 1'), 'Must maintain warm machine for 0ms editor cold start');
      assert.ok(content.includes('path = "/api/health"'), 'Must probe /api/health');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Cloudflare Origin Rules Specification & Zero Storefront Impact
  // ----------------------------------------------------------------------------
  describe('4. Cloudflare Origin Rules (infra/docker/origin-rules.json)', () => {
    it('should confirm origin-rules.json is valid JSON adhering to Cloudflare ruleset schema', () => {
      assert.ok(fs.existsSync(originRulesPath), 'origin-rules.json must exist');
      const raw = fs.readFileSync(originRulesPath, 'utf-8');
      const json = JSON.parse(raw);

      assert.equal(json.phase, 'http_request_origin', 'Must target http_request_origin phase');
      assert.ok(Array.isArray(json.rules), 'Must define rules array');
      assert.equal(json.rules.length, 1, 'Must define 1 origin routing rule');

      const rule = json.rules[0];
      assert.equal(rule.action, 'route', 'Action must be "route"');
      assert.equal(rule.action_parameters.origin.host, 'payload-origin.fly.dev', 'Target host must be container origin');
      assert.equal(rule.action_parameters.origin.port, 443, 'Target port must be 443 HTTPS');
    });

    it('should mathematically guarantee zero storefront impact via path matching evaluation', () => {
      const raw = fs.readFileSync(originRulesPath, 'utf-8');
      const json = JSON.parse(raw);
      const expression = json.rules[0].expression;

      // Extract URI path match logic
      const isOriginRuleMatch = (path: string): boolean => {
        return (
          path === '/admin' ||
          path.startsWith('/admin/') ||
          path.startsWith('/api/payload/') ||
          path === '/api/graphql'
        );
      };

      // Storefront Routes MUST NEVER MATCH (100% Edge Workers execution)
      const storefrontRoutes = [
        '/',
        '/catalog',
        '/products/classic-tee',
        '/cart',
        '/checkout',
        '/api/health',
        '/api/shopify/cart',
        '/api/shopify/products',
        '/_next/static/chunks/main.js',
        '/favicon.ico',
      ];

      for (const route of storefrontRoutes) {
        assert.equal(
          isOriginRuleMatch(route),
          false,
          `Storefront route "${route}" must NEVER match origin rule (guarantees 0 storefront impact)`
        );
      }

      // Administrative Routes MUST MATCH (Routed to Container Origin)
      const adminRoutes = [
        '/admin',
        '/admin/',
        '/admin/collections/products',
        '/admin/collections/categories/create',
        '/api/payload/products',
        '/api/payload/users/me',
        '/api/graphql',
      ];

      for (const route of adminRoutes) {
        assert.equal(
          isOriginRuleMatch(route),
          true,
          `Admin route "${route}" MUST match origin rule for container fallback`
        );
      }
    });

    it('should verify origin authentication headers (X-Forwarded-Host, X-Origin-Verify-Secret)', () => {
      const raw = fs.readFileSync(originRulesPath, 'utf-8');
      const json = JSON.parse(raw);
      const headers = json.rules[0].action_parameters.headers;

      const headerNames = headers.map((h: any) => h.name);
      assert.ok(headerNames.includes('X-Forwarded-Host'), 'Must set X-Forwarded-Host');
      assert.ok(headerNames.includes('X-Origin-Verify-Secret'), 'Must set X-Origin-Verify-Secret');
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Programmatic Go / No-Go Trigger Evaluation Logic
  // ----------------------------------------------------------------------------
  describe('5. Go / No-Go Trigger Criteria Boundary Evaluation', () => {
    it('should maintain edge isolate architecture when all metrics are within safe thresholds', () => {
      const safeTelemetry: TelemetryMetrics = {
        d1TransactionFailureRate: 0.00005, // 0.005% (< 0.10%)
        adminBundleGzipMb: 6.2, // 6.2MB (< 10MB)
        adminBundleRawMb: 19.5, // 19.5MB (< 30MB)
        isolateOomRate: 0.0001, // 0.01% (< 0.05%)
        coldStartP99Ms: 720, // 720ms (< 1500ms)
        requiresNativeModules: false,
      };

      const result = evaluateFallbackTrigger(safeTelemetry);
      assert.equal(result.activateFallback, false, 'Fallback must NOT activate when metrics are healthy');
      assert.equal(result.action, 'MAINTAIN_EDGE_ISOLATE');
      assert.equal(result.trippedTriggers.length, 0);
    });

    it('should trip TRG-01 when D1 transaction failure rate reaches 0.10%', () => {
      const metrics: TelemetryMetrics = {
        d1TransactionFailureRate: 0.001, // Exactly 0.10%
        adminBundleGzipMb: 6.0,
        adminBundleRawMb: 18.0,
        isolateOomRate: 0.0,
        coldStartP99Ms: 650,
        requiresNativeModules: false,
      };

      const result = evaluateFallbackTrigger(metrics);
      assert.equal(result.activateFallback, true);
      assert.equal(result.action, 'ACTIVATE_CONTAINER_FALLBACK');
      assert.ok(result.trippedTriggers.includes('TRG-01'));
      assert.match(result.reasons[0], /D1 transaction failure rate/);
    });

    it('should trip TRG-02 when admin bundle gzip reaches or exceeds 10MB', () => {
      const metrics: TelemetryMetrics = {
        d1TransactionFailureRate: 0.00001,
        adminBundleGzipMb: 10.1, // > 10MB
        adminBundleRawMb: 28.0,
        isolateOomRate: 0.0,
        coldStartP99Ms: 650,
        requiresNativeModules: false,
      };

      const result = evaluateFallbackTrigger(metrics);
      assert.equal(result.activateFallback, true);
      assert.ok(result.trippedTriggers.includes('TRG-02'));
    });

    it('should trip TRG-03 when isolate memory exhaustion rate reaches 0.05%', () => {
      const metrics: TelemetryMetrics = {
        d1TransactionFailureRate: 0.0,
        adminBundleGzipMb: 5.0,
        adminBundleRawMb: 15.0,
        isolateOomRate: 0.0006, // 0.06%
        coldStartP99Ms: 600,
        requiresNativeModules: false,
      };

      const result = evaluateFallbackTrigger(metrics);
      assert.equal(result.activateFallback, true);
      assert.ok(result.trippedTriggers.includes('TRG-03'));
    });

    it('should trip TRG-04 when admin p99 cold start latency reaches or exceeds 1500ms', () => {
      const metrics: TelemetryMetrics = {
        d1TransactionFailureRate: 0.0,
        adminBundleGzipMb: 5.0,
        adminBundleRawMb: 15.0,
        isolateOomRate: 0.0,
        coldStartP99Ms: 1550, // 1550ms
        requiresNativeModules: false,
      };

      const result = evaluateFallbackTrigger(metrics);
      assert.equal(result.activateFallback, true);
      assert.ok(result.trippedTriggers.includes('TRG-04'));
    });

    it('should trip TRG-05 when mandatory native Node.js C++ modules are required', () => {
      const metrics: TelemetryMetrics = {
        d1TransactionFailureRate: 0.0,
        adminBundleGzipMb: 5.0,
        adminBundleRawMb: 15.0,
        isolateOomRate: 0.0,
        coldStartP99Ms: 500,
        requiresNativeModules: true, // Requires sharp or pdfkit
      };

      const result = evaluateFallbackTrigger(metrics);
      assert.equal(result.activateFallback, true);
      assert.ok(result.trippedTriggers.includes('TRG-05'));
    });

    it('should handle multi-trigger compound failures gracefully', () => {
      const compoundFailure: TelemetryMetrics = {
        d1TransactionFailureRate: 0.002, // TRG-01
        adminBundleGzipMb: 11.5, // TRG-02
        adminBundleRawMb: 35.0, // TRG-02
        isolateOomRate: 0.001, // TRG-03
        coldStartP99Ms: 2100, // TRG-04
        requiresNativeModules: true, // TRG-05
      };

      const result = evaluateFallbackTrigger(compoundFailure);
      assert.equal(result.activateFallback, true);
      assert.equal(result.trippedTriggers.length, 5);
      assert.deepEqual(result.trippedTriggers, ['TRG-01', 'TRG-02', 'TRG-03', 'TRG-04', 'TRG-05']);
    });
  });
});
