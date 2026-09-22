import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_EDGE_TIMEOUT_MS,
  FAST_FAIL_EDGE_TIMEOUT_MS,
  isApiOrJsonRequest,
  generateTimeoutJsonResponse,
  generateBranded504Html,
  generateTimeoutHtmlResponse,
  executeWithEdgeTimeout,
} from '../../apps/web/src/lib/edge-timeout';
import { isStaticAssetRequest } from '../../scripts/build-worker';

describe('Story 4.24: Graceful Edge Timeout Interception & Branded Customer-Facing 504 Fallback', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const errorPagesDir = path.join(rootDir, 'infra/cloudflare/error-pages');
  const terraformModuleDir = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack');

  // ==========================================================================
  // 1. Dual-Mode Request Classification
  // ==========================================================================
  describe('1. Request Route & Header Classification (isApiOrJsonRequest)', () => {
    it('should classify /api/* routes as API requests', () => {
      const req1 = new Request('https://chrishop.com/api/products');
      assert.equal(isApiOrJsonRequest(req1, new URL(req1.url)), true);

      const req2 = new Request('https://chrishop.com/api/health');
      assert.equal(isApiOrJsonRequest(req2, new URL(req2.url)), true);

      const req3 = new Request('https://chrishop.com/api/checkout/session');
      assert.equal(isApiOrJsonRequest(req3, new URL(req3.url)), true);
    });

    it('should classify requests with Accept: application/json as API requests', () => {
      const req = new Request('https://chrishop.com/products/bank-beater', {
        headers: { Accept: 'application/json' },
      });
      assert.equal(isApiOrJsonRequest(req, new URL(req.url)), true);
    });

    it('should classify requests with Content-Type: application/json as API requests', () => {
      const req = new Request('https://chrishop.com/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(isApiOrJsonRequest(req, new URL(req.url)), true);
    });

    it('should classify HTML navigation requests as Web/Document requests', () => {
      const req = new Request('https://chrishop.com/products', {
        headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      });
      assert.equal(isApiOrJsonRequest(req, new URL(req.url)), false);

      const reqHome = new Request('https://chrishop.com/');
      assert.equal(isApiOrJsonRequest(reqHome, new URL(reqHome.url)), false);
    });
  });

  // ==========================================================================
  // 2. Preemptive Edge Timeout Execution & AbortSignal Propagation
  // ==========================================================================
  describe('2. Preemptive Edge Timeout Execution & AbortSignal Interception', () => {
    it('should intercept a hanging API request and return standardized 504 JSON', async () => {
      const req = new Request('https://chrishop.com/api/orders', {
        headers: { 'cf-ray': 'test-ray-api-123' },
      });
      const env = { EDGE_TIMEOUT_MS: '30' };
      const ctx = { waitUntil: () => {} };

      let abortSignaled = false;
      const response = await executeWithEdgeTimeout(
        req,
        env,
        ctx,
        async (signal) => {
          signal.addEventListener('abort', () => {
            abortSignaled = true;
          });
          // Artificial stall simulating degraded upstream
          await new Promise((resolve) => setTimeout(resolve, 150));
          return new Response('Stalled finished', { status: 200 });
        },
        { timeoutMs: 30 }
      );

      assert.equal(response.status, 504);
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal(response.headers.get('x-chrishop-edge-timeout'), 'true');
      assert.equal(response.headers.get('cf-ray'), 'test-ray-api-123');
      assert.equal(abortSignaled, true, 'Downstream AbortSignal must be triggered on timeout');

      const body = await response.json();
      assert.equal(body.error, 'Gateway Timeout');
      assert.equal(body.code, 'ERR_EDGE_TIMEOUT');
      assert.equal(body.message, 'The request took longer than expected to complete. Please retry.');
      assert.equal(body.rayId, 'test-ray-api-123');
      assert.ok(typeof body.timestamp === 'string' && body.timestamp.length > 0);
    });

    it('should intercept a hanging Web document request and return branded 504 HTML', async () => {
      const req = new Request('https://chrishop.com/drops/bank-beater-v1', {
        headers: {
          Accept: 'text/html',
          'cf-ray': 'test-ray-html-456',
        },
      });
      const env = {};
      const ctx = { waitUntil: () => {} };

      let abortReason: any = null;
      const response = await executeWithEdgeTimeout(
        req,
        env,
        ctx,
        async (signal) => {
          signal.addEventListener('abort', () => {
            abortReason = signal.reason;
          });
          await new Promise((resolve) => setTimeout(resolve, 150));
          return new Response('<html>Finished</html>', { status: 200 });
        },
        { timeoutMs: 25 }
      );

      assert.equal(response.status, 504);
      assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(response.headers.get('x-chrishop-edge-timeout'), 'true');
      assert.equal(response.headers.get('cf-ray'), 'test-ray-html-456');
      assert.ok(abortReason instanceof Error);
      assert.match(abortReason.message, /timeout threshold/i);

      const html = await response.text();
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('504 · Gateway Timeout'));
      assert.ok(html.includes('High Demand on the Mountain'));
      assert.ok(html.includes('test-ray-html-456'));
      assert.ok(html.includes('retryWithJitter'));
      assert.ok(html.includes('Retry Request'));
      assert.ok(html.includes('https://status.chrishop.com'));
      assert.ok(html.includes('mailto:support@chrishop.com'));
    });

    it('should allow fast operations to complete normally without interception', async () => {
      const req = new Request('https://chrishop.com/api/fast');
      const env = { EDGE_TIMEOUT_MS: '2000' };
      const ctx = { waitUntil: () => {} };

      const response = await executeWithEdgeTimeout(
        req,
        env,
        ctx,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
        { timeoutMs: 2000 }
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-chrishop-edge-timeout'), null);
      const data = await response.json();
      assert.equal(data.ok, true);
    });

    it('should forward upstream handler errors when no timeout occurs', async () => {
      const req = new Request('https://chrishop.com/api/failing');
      const env = {};
      const ctx = { waitUntil: () => {} };

      await assert.rejects(
        async () => {
          await executeWithEdgeTimeout(
            req,
            env,
            ctx,
            async () => {
              throw new Error('Database connection reset');
            },
            { timeoutMs: 1000 }
          );
        },
        /Database connection reset/
      );
    });
  });

  // ==========================================================================
  // 3. Cloudflare Custom Error Pages (Static Templates)
  // ==========================================================================
  describe('3. Cloudflare Custom Error Pages (Zone-Level IaC Templates)', () => {
    const error500Path = path.join(errorPagesDir, '500-errors.html');
    const error1000Path = path.join(errorPagesDir, '1000-errors.html');

    it('should verify 500-errors.html satisfies Cloudflare and ChrisShop requirements', () => {
      assert.ok(fs.existsSync(error500Path), '500-errors.html must exist');
      const content = fs.readFileSync(error500Path, 'utf-8');
      const stats = fs.statSync(error500Path);

      // Cloudflare mandatory constraints
      assert.ok(stats.size > 100, 'Error page must be greater than 100 bytes');
      assert.ok(stats.size < 1.5 * 1024 * 1024, 'Error page must be smaller than 1.5 MB');
      assert.ok(content.includes('::RAY_ID::'), 'Must contain mandatory Cloudflare ::RAY_ID:: token');
      assert.ok(content.includes('::CLIENT_IP::'), 'Must contain ::CLIENT_IP:: token');
      assert.ok(content.includes('::GEO::'), 'Must contain ::GEO:: token');

      // ChrisShop branding constraints
      assert.ok(content.includes('ChrisShop BankBeaters'), 'Must feature ChrisShop branding');
      assert.ok(content.includes('retryWithJitter'), 'Must include interactive retry logic');
      assert.ok(content.includes('https://status.chrishop.com'), 'Must link to status page');
    });

    it('should verify 1000-errors.html satisfies Cloudflare Error 1102 & edge limits', () => {
      assert.ok(fs.existsSync(error1000Path), '1000-errors.html must exist');
      const content = fs.readFileSync(error1000Path, 'utf-8');
      const stats = fs.statSync(error1000Path);

      // Cloudflare mandatory constraints
      assert.ok(stats.size > 100, 'Error page must be greater than 100 bytes');
      assert.ok(stats.size < 1.5 * 1024 * 1024, 'Error page must be smaller than 1.5 MB');
      assert.ok(content.includes('::RAY_ID::'), 'Must contain mandatory Cloudflare ::RAY_ID:: token');
      assert.ok(content.includes('::CLIENT_IP::'), 'Must contain ::CLIENT_IP:: token');
      assert.ok(content.includes('::GEO::'), 'Must contain ::GEO:: token');

      // Edge compute / resource limit constraints
      assert.ok(content.includes('Error 1000 Series'), 'Must identify Error 1000 series / 1102');
      assert.ok(content.includes('Edge Compute Threshold Reached'), 'Must clearly explain compute limit');
      assert.ok(content.includes('retryWithJitter'), 'Must include interactive retry logic');
    });

    it('should ensure static asset router recognizes /error-pages/* paths', () => {
      assert.equal(isStaticAssetRequest('/error-pages/500-errors.html'), true);
      assert.equal(isStaticAssetRequest('/error-pages/1000-errors.html'), true);
    });
  });

  // ==========================================================================
  // 4. Terraform Cloudflare Stack Custom Pages IaC
  // ==========================================================================
  describe('4. Terraform Cloudflare Stack Custom Pages Configuration', () => {
    const customPagesTfPath = path.join(terraformModuleDir, 'custom_pages.tf');
    const variablesTfPath = path.join(terraformModuleDir, 'variables.tf');

    it('should define cloudflare_custom_pages for 500-series and 1000-series errors', () => {
      assert.ok(fs.existsSync(customPagesTfPath), 'custom_pages.tf must exist');
      const tfContent = fs.readFileSync(customPagesTfPath, 'utf-8');

      assert.ok(
        tfContent.includes('resource "cloudflare_custom_pages" "errors_500"'),
        'Must define cloudflare_custom_pages.errors_500'
      );
      assert.ok(
        tfContent.includes('type    = "500_errors"'),
        'errors_500 must target type 500_errors'
      );

      assert.ok(
        tfContent.includes('resource "cloudflare_custom_pages" "errors_1000"'),
        'Must define cloudflare_custom_pages.errors_1000'
      );
      assert.ok(
        tfContent.includes('type    = "1000_errors"'),
        'errors_1000 must target type 1000_errors'
      );

      assert.ok(
        tfContent.includes('state   = "customized"'),
        'Must declare state customized'
      );
    });

    it('should define custom error page configuration variables', () => {
      const varsContent = fs.readFileSync(variablesTfPath, 'utf-8');
      assert.ok(
        varsContent.includes('variable "enable_custom_error_pages"'),
        'Must declare enable_custom_error_pages variable'
      );
      assert.ok(
        varsContent.includes('variable "custom_page_500_url"'),
        'Must declare custom_page_500_url variable'
      );
      assert.ok(
        varsContent.includes('variable "custom_page_1000_url"'),
        'Must declare custom_page_1000_url variable'
      );
    });
  });

  // ==========================================================================
  // 5. Build Script & Worker Bundle Integration
  // ==========================================================================
  describe('5. Build Script & Worker Bundle Integration', () => {
    it('should verify build-worker.ts imports executeWithEdgeTimeout and syncs error pages', () => {
      const buildWorkerPath = path.join(rootDir, 'scripts/build-worker.ts');
      const buildContent = fs.readFileSync(buildWorkerPath, 'utf-8');

      assert.ok(
        buildContent.includes('executeWithEdgeTimeout'),
        'build-worker.ts must integrate executeWithEdgeTimeout'
      );
      assert.ok(
        buildContent.includes('infra/cloudflare/error-pages'),
        'build-worker.ts must synchronize error-pages assets'
      );
      assert.ok(
        buildContent.includes('/error-pages/'),
        'build-worker.ts must recognize /error-pages/ in isStaticAssetRequest'
      );
    });

    it('should verify wrangler.toml declares EDGE_TIMEOUT_MS variable', () => {
      const wranglerPath = path.join(rootDir, 'wrangler.toml');
      const wranglerContent = fs.readFileSync(wranglerPath, 'utf-8');

      assert.ok(
        wranglerContent.includes('EDGE_TIMEOUT_MS = "25000"'),
        'wrangler.toml must configure EDGE_TIMEOUT_MS = "25000"'
      );
    });
  });
});
