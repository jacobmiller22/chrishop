/**
 * Integration Test Suite: Cloudflare Browser Rendering Ephemeral Preview Smoke
 *
 * Story 4.21 (#210): Cloudflare Browser Rendering Ephemeral Preview Smoke & Screen Tour Harness
 *
 * Validates:
 * 1. CDP WebSocket URL generation and parameter handling
 * 2. Cloudflare Access Zero Trust Service Token header compilation
 * 3. Markdown summary formatting and metric calculations
 * 4. CI/CD workflow integration in .github/workflows/preview-deploy.yml
 * 5. CLI script existence and package.json registration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCloudflareCdpUrl,
  buildBrowserHeaders,
  formatSmokeSummaryMarkdown,
  type SmokeScreenResult,
} from '../../apps/web/src/lib/browser-rendering';

describe('Story 4.21: Cloudflare Browser Rendering Ephemeral Preview Smoke Suite', () => {
  describe('CDP URL Construction & Parameters', () => {
    it('should construct valid Cloudflare CDP WebSocket URL with custom keepAlive', () => {
      const url = buildCloudflareCdpUrl('account-abc-123', 300000);
      assert.equal(
        url,
        'wss://api.cloudflare.com/client/v4/accounts/account-abc-123/browser-rendering/devtools/browser?keep_alive=300000'
      );
    });

    it('should default keepAlive to 600,000ms (10 minutes)', () => {
      const url = buildCloudflareCdpUrl('account-xyz');
      assert.equal(
        url,
        'wss://api.cloudflare.com/client/v4/accounts/account-xyz/browser-rendering/devtools/browser?keep_alive=600000'
      );
    });
  });

  describe('Cloudflare Access & Authentication Headers', () => {
    it('should inject Bearer token and Cloudflare Access service credentials', () => {
      const headers = buildBrowserHeaders({
        apiToken: 'cf-secret-token',
        cfAccessClientId: 'client-id-001',
        cfAccessClientSecret: 'client-secret-999',
      });

      assert.equal(headers['Authorization'], 'Bearer cf-secret-token');
      assert.equal(headers['CF-Access-Client-Id'], 'client-id-001');
      assert.equal(headers['CF-Access-Client-Secret'], 'client-secret-999');
    });

    it('should return empty headers when no credentials provided', () => {
      const headers = buildBrowserHeaders({});
      assert.deepEqual(headers, {});
    });

    it('should omit Cloudflare Access headers if only one credential is provided', () => {
      const headers = buildBrowserHeaders({
        cfAccessClientId: 'client-id-001',
      });
      assert.equal(headers['CF-Access-Client-Id'], undefined);
      assert.equal(headers['CF-Access-Client-Secret'], undefined);
    });
  });

  describe('Markdown Summary Formatter', () => {
    it('should format a clean markdown summary table with metrics and details', () => {
      const screens: SmokeScreenResult[] = [
        {
          name: 'Storefront Home',
          route: '/',
          status: 200,
          passed: true,
          durationMs: 340,
          details: 'Hero loaded',
          metrics: { lcpMs: 410, domReadyMs: 250 },
        },
        {
          name: 'Payload Admin Portal',
          route: '/admin',
          status: 200,
          passed: true,
          durationMs: 480,
          details: 'Admin view initialized',
          metrics: { lcpMs: 550, domReadyMs: 390 },
        },
        {
          name: 'Edge Health Synthetic Probe',
          route: '/api/health',
          status: 200,
          passed: true,
          durationMs: 65,
          details: 'Edge bindings healthy',
          metrics: { lcpMs: 65, domReadyMs: 50 },
        },
      ];

      const md = formatSmokeSummaryMarkdown(
        'https://pr-210-chrishop.jacobmiller22.com',
        'remote_cdp',
        screens,
        885,
        true
      );

      assert.ok(md.includes('### ✔ Ephemeral Preview Smoke & Screen Tour (**PASSED**)'));
      assert.ok(md.includes('https://pr-210-chrishop.jacobmiller22.com'));
      assert.ok(md.includes('remote_cdp'));
      assert.ok(md.includes('Screens Verified**: 3/3'));
      assert.ok(md.includes('| ✔ PASS | **Storefront Home** (`/`) | HTTP 200 | 340ms | 410ms | Hero loaded |'));
      assert.ok(md.includes('| ✔ PASS | **Payload Admin Portal** (`/admin`) | HTTP 200 | 480ms | 550ms | Admin view initialized |'));
      assert.ok(md.includes('| ✔ PASS | **Edge Health Synthetic Probe** (`/api/health`) | HTTP 200 | 65ms | 65ms | Edge bindings healthy |'));
    });

    it('should correctly report failure badge when any screen fails', () => {
      const screens: SmokeScreenResult[] = [
        {
          name: 'Storefront Home',
          route: '/',
          status: 500,
          passed: false,
          durationMs: 200,
          details: 'Internal Server Error',
        },
      ];

      const md = formatSmokeSummaryMarkdown(
        'https://pr-broken.jacobmiller22.com',
        'local_fallback',
        screens,
        200,
        false
      );

      assert.ok(md.includes('### ✖ Ephemeral Preview Smoke & Screen Tour (**FAILED**)'));
      assert.ok(md.includes('| ✖ FAIL | **Storefront Home** (`/`) | HTTP 500 | 200ms | - | Internal Server Error |'));
    });
  });

  describe('GitHub Actions Workflow Integration', () => {
    it('should verify preview-deploy.yml includes Cloudflare Browser Rendering smoke test step', () => {
      const wfPath = path.resolve(__dirname, '../../.github/workflows/preview-deploy.yml');
      assert.ok(fs.existsSync(wfPath), `Workflow file must exist at ${wfPath}`);

      const content = fs.readFileSync(wfPath, 'utf8');
      assert.ok(content.includes('Run Cloudflare Browser Rendering Ephemeral Preview Smoke'));
      assert.ok(content.includes('pnpm run test:preview-smoke --url "${PREVIEW_URL}"'));
      assert.ok(content.includes('CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}'));
      assert.ok(content.includes('CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}'));
      assert.ok(content.includes('Browser Rendering Smoke'));
    });
  });

  describe('Script & Package.json Registration', () => {
    it('should register test:preview-smoke and preview:verify in package.json', () => {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      assert.ok(pkg.scripts['test:preview-smoke']);
      assert.equal(pkg.scripts['test:preview-smoke'], 'tsx scripts/preview-smoke-test.ts');

      assert.ok(pkg.scripts['preview:verify']);
      assert.equal(pkg.scripts['preview:verify'], 'tsx scripts/verify-preview-smoke.ts');
    });

    it('should ensure scripts/preview-smoke-test.ts exists and is executable', () => {
      const scriptPath = path.resolve(__dirname, '../../scripts/preview-smoke-test.ts');
      assert.ok(fs.existsSync(scriptPath));

      const stats = fs.statSync(scriptPath);
      // Check executable bit
      assert.ok((stats.mode & 0o111) !== 0, 'Script must be executable');
    });
  });
});
