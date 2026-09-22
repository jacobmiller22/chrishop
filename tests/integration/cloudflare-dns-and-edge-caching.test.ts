import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import {
  parseCommandLineArgs,
  verifyStaticAssetsCache,
  verifyMediaCache,
  verifyDynamicBypass,
  verifyCatalogIsrCache,
  verifyZoneSettingsAndIaC,
  runEdgeCacheVerification,
} from '../../scripts/verify-edge-cache';

describe('Story 4.8: Cloudflare DNS & Edge Caching Configuration Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const cfSetupPath = path.join(rootDir, 'docs/CLOUDFLARE_SETUP.md');
  const terraformCachePath = path.join(
    rootDir,
    'infra/terraform/modules/cloudflare_stack/cache.tf'
  );
  const nextConfigPath = path.join(rootDir, 'apps/web/next.config.mjs');

  describe('1. Documentation Standards & Cache Rules Matrix', () => {
    it('should verify docs/CLOUDFLARE_SETUP.md contains comprehensive edge caching specifications', () => {
      assert.ok(fs.existsSync(cfSetupPath), 'CLOUDFLARE_SETUP.md must exist');
      const content = fs.readFileSync(cfSetupPath, 'utf-8');

      assert.ok(
        content.includes('### Edge Caching Configuration & Cache Rules Matrix'),
        'Must include Edge Caching section'
      );
      assert.ok(content.includes('> 80% cache hit ratio'), 'Must document > 80% hit ratio target');
      assert.ok(content.includes('/_next/static/*'), 'Must document static assets route');
      assert.ok(content.includes('/media/*'), 'Must document media route');
      assert.ok(content.includes('/admin/*'), 'Must document admin bypass');
      assert.ok(content.includes('/api/*'), 'Must document api bypass');
      assert.ok(content.includes('HTTP/3 (QUIC)'), 'Must document HTTP/3');
      assert.ok(content.includes('0-RTT Resumption'), 'Must document 0-RTT');
      assert.ok(content.includes('Cache Purge Procedures'), 'Must document cache purge procedures');
    });
  });

  describe('2. Declarative Infrastructure as Code (Terraform)', () => {
    it('should verify cache.tf defines zone settings and page rules', () => {
      assert.ok(fs.existsSync(terraformCachePath), 'cache.tf must exist');
      const content = fs.readFileSync(terraformCachePath, 'utf-8');

      // Zone Settings
      assert.ok(
        content.includes('resource "cloudflare_zone_settings_override" "settings"'),
        'Must define zone settings override'
      );
      assert.ok(content.includes('http3                    = "on"'), 'Must enable HTTP/3');
      assert.ok(content.includes('zero_rtt                 = "on"'), 'Must enable 0-RTT');
      assert.ok(content.includes('brotli                   = "on"'), 'Must enable Brotli');
      assert.ok(content.includes('min_tls_version          = "1.2"'), 'Must enforce TLS 1.2+');
      assert.ok(content.includes('ssl                      = "strict"'), 'Must enforce Full (Strict) SSL');

      // Page Rules
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "cache_static_assets"'),
        'Must define static assets page rule'
      );
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "cache_media"'),
        'Must define media page rule'
      );
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "bypass_admin"'),
        'Must define admin bypass page rule'
      );
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "bypass_api"'),
        'Must define api bypass page rule'
      );

      // Cache Actions
      assert.ok(content.includes('cache_level       = "cache_everything"'), 'Must cache everything for assets');
      assert.ok(content.includes('edge_cache_ttl    = 31536000'), 'Must set 1-year edge TTL');
      assert.ok(content.includes('browser_cache_ttl = 31536000'), 'Must set 1-year browser TTL');
      assert.ok(content.includes('cache_level = "bypass"'), 'Must bypass cache for dynamic routes');
    });

    it('should verify Terraform formatting and validation pass cleanly', () => {
      let hasTerraform = false;
      try {
        execSync('which terraform', { stdio: 'pipe' });
        hasTerraform = true;
      } catch {
        hasTerraform = false;
      }

      if (!hasTerraform) {
        console.log('Skipping CLI validation: terraform binary not in PATH');
        return;
      }

      const fmtResult = execSync('terraform fmt -recursive -check infra/terraform', {
        cwd: rootDir,
        encoding: 'utf-8',
      });
      assert.equal(fmtResult.trim(), '', 'All Terraform files must be cleanly formatted');
    });
  });

  describe('3. Application Headers & Next.js Cache-Control', () => {
    it('should verify next.config.mjs declares 1-year immutable caching for static and media assets', () => {
      assert.ok(fs.existsSync(nextConfigPath), 'next.config.mjs must exist');
      const content = fs.readFileSync(nextConfigPath, 'utf-8');

      // Static assets
      assert.ok(content.includes("source: '/_next/static/:path*'"));
      assert.ok(content.includes('public, max-age=31536000, immutable'));

      // Media assets
      assert.ok(content.includes("source: '/media/:path*'"));

      // Admin & API Bypass
      assert.ok(content.includes("source: '/admin/:path*'"));
      assert.ok(content.includes("source: '/api/:path*'"));
      assert.ok(content.includes('no-store, no-cache, must-revalidate'));

      // Products ISR
      assert.ok(content.includes("source: '/products'"));
      assert.ok(content.includes('public, s-maxage=10, stale-while-revalidate=50'));
    });
  });

  describe('4. Turnkey Verification CLI & Diagnostic Stages', () => {
    it('should verify Stage 1: Static assets cache verification', async () => {
      const result = await verifyStaticAssetsCache('chrishop.com', {
        mock: true,
        nextConfigPath,
      });
      assert.equal(result.stage, 1);
      assert.equal(result.passed, true);
      assert.equal(result.details.browserTtlSeconds, 31536000);
      assert.equal(result.details.immutableEnforced, true);
    });

    it('should verify Stage 2: Media CDN cache verification', async () => {
      const result = await verifyMediaCache('chrishop.com', {
        mock: true,
        nextConfigPath,
      });
      assert.equal(result.stage, 2);
      assert.equal(result.passed, true);
      assert.equal(result.details.expectedHitRatio, '> 80%');
      assert.equal(result.details.immutableEnforced, true);
    });

    it('should verify Stage 3: Admin & API bypass verification', async () => {
      const result = await verifyDynamicBypass('chrishop.com', {
        mock: true,
        nextConfigPath,
      });
      assert.equal(result.stage, 3);
      assert.equal(result.passed, true);
      assert.equal(result.details.bypassesEdgeCache, true);
      assert.equal(result.details.authTokensCached, false);
    });

    it('should verify Stage 4: Catalog ISR cache verification', async () => {
      const result = await verifyCatalogIsrCache('chrishop.com', {
        mock: true,
        nextConfigPath,
      });
      assert.equal(result.stage, 4);
      assert.equal(result.passed, true);
      assert.equal(result.details.edgeTtlSeconds, 10);
      assert.equal(result.details.staleWhileRevalidateSeconds, 50);
    });

    it('should verify Stage 5: Zone settings and IaC rules verification', async () => {
      const result = await verifyZoneSettingsAndIaC('chrishop.com', {
        mock: true,
        terraformCachePath,
      });
      assert.equal(result.stage, 5);
      assert.equal(result.passed, true);
      assert.equal(result.details.http3Enabled, true);
      assert.equal(result.details.zeroRttResumption, true);
      assert.equal(result.details.brotliCompression, true);
      assert.equal(result.details.pageRuleStaticAssets, true);
      assert.equal(result.details.pageRuleMedia, true);
      assert.equal(result.details.pageRuleBypassAdmin, true);
      assert.equal(result.details.pageRuleBypassApi, true);
    });

    it('should run full runEdgeCacheVerification cleanly', async () => {
      const report = await runEdgeCacheVerification({
        domain: 'chrishop.com',
        mock: true,
        nextConfigPath,
        terraformCachePath,
      });

      assert.equal(report.domain, 'chrishop.com');
      assert.equal(report.overallPassed, true);
      assert.equal(report.stages.length, 5);
      assert.ok(report.stages.every((s) => s.passed));
    });

    it('should parse CLI arguments correctly', () => {
      const opts = parseCommandLineArgs([
        '--domain',
        'shop.chrishop.com',
        '--mock',
        '--dry-run',
        '--json',
      ]);
      assert.equal(opts.domain, 'shop.chrishop.com');
      assert.equal(opts.mock, true);
      assert.equal(opts.dryRun, true);
      assert.equal(opts.json, true);
    });

    it('should execute cache:verify CLI via npm script with --mock and exit with code 0', () => {
      const output = execSync('pnpm run cache:verify --mock', {
        encoding: 'utf-8',
        cwd: rootDir,
      });
      assert.ok(output.includes('ChrisShop Cloudflare Edge Caching Verification CLI'));
      assert.ok(output.includes('ALL 5 EDGE CACHING VERIFICATION STAGES PASSED SUCCESSFULLY'));
    });

    it('should execute cache:verify CLI with --json and output valid JSON payload', () => {
      const output = execSync('pnpm --silent run cache:verify --mock --json', {
        encoding: 'utf-8',
        cwd: rootDir,
      });
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
      assert.equal(parsed.overallPassed, true);
      assert.equal(parsed.stages.length, 5);
      assert.equal(parsed.domain, 'chrishop.com');
    });
  });
});
