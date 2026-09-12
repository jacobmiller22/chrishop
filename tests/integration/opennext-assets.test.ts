import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Story 2.38: OpenNext Cloudflare Adapter, Assets Bridge, Site/CMS Bindings & Deep Route Verification', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const wranglerPath = path.join(rootDir, 'wrangler.toml');
  const openNextDir = path.join(rootDir, '.open-next');
  const workerPath = path.join(openNextDir, 'worker.js');
  const assetsDir = path.join(openNextDir, 'assets');
  const openNextConfigPath = path.join(rootDir, 'apps/web/open-next.config.ts');

  // Build worker bundle before testing
  before(() => {
    execSync('pnpm run build:worker', { cwd: rootDir, stdio: 'pipe' });
  });

  describe('1. OpenNext Configuration & Bundle Structure', () => {
    it('should verify apps/web/open-next.config.ts exists and enforces function splitting per Spike 2.27', () => {
      assert.ok(fs.existsSync(openNextConfigPath), 'apps/web/open-next.config.ts must exist');
      const content = fs.readFileSync(openNextConfigPath, 'utf-8');

      assert.ok(content.includes('defineCloudflareConfig'), 'Must use defineCloudflareConfig');
      assert.ok(content.includes('cloudflare-node'), 'Must use cloudflare-node wrapper');
      assert.ok(content.includes('converter: \'edge\'') || content.includes('converter: "edge"'), 'Must specify edge converter');
      assert.ok(
        content.includes('app/(payload)/admin/[[...segments]]/page') ||
        content.includes('app/(payload)/admin/**'),
        'Must map payload admin routes'
      );
    });

    it('should verify .open-next/worker.js and .open-next/assets exist', () => {
      assert.ok(fs.existsSync(workerPath), '.open-next/worker.js must exist');
      assert.ok(fs.existsSync(assetsDir), '.open-next/assets directory must exist');

      const workerContent = fs.readFileSync(workerPath, 'utf-8');
      assert.ok(workerContent.includes('export default'), 'Worker must export default handler');
      assert.ok(workerContent.includes('async fetch(request, env, ctx)'), 'Worker must define fetch handler');
    });
  });

  describe('2. Deep Semantic Route Content Verification', () => {
    // Import worker entrypoint dynamically
    let worker: any;
    const mockEnv = {
      DB: { prepare: () => ({ all: () => [] }) },
      NEXT_CACHE_WORKERS_KV: { get: () => null, put: () => {} },
      BUCKET: { get: () => null, put: () => {} },
      ASSETS: { fetch: async () => new Response('Asset Not Found', { status: 404 }) },
      SITE_URL: 'https://chrishop.jacobmiller22.com',
      NEXT_PUBLIC_SITE_URL: 'https://chrishop.jacobmiller22.com',
      CMS_URL: 'https://chrishop.jacobmiller22.com',
      PAYLOAD_PUBLIC_SERVER_URL: 'https://chrishop.jacobmiller22.com',
      NODE_ENV: 'production',
    };

    before(async () => {
      worker = (await import(workerPath)).default;
    });

    it('Route 1: Root (/) must serve authentic Next.js Storefront HTML with deep content markers', async () => {
      const request = new Request('https://chrishop.jacobmiller22.com/');
      const response = await worker.fetch(request, mockEnv, {});

      assert.equal(response.status, 200, 'Storefront route must return HTTP 200 OK');
      assert.match(
        response.headers.get('content-type') || '',
        /text\/html/,
        'Content-Type must be text/html'
      );

      const html = await response.text();

      // Verify HTML document structure
      assert.ok(html.includes('<!DOCTYPE html>'), 'Must start with <!DOCTYPE html>');
      assert.ok(html.includes('<html'), 'Must contain <html element');

      // Verify deep semantic storefront markers (NOT just generic 200)
      assert.ok(
        html.includes("Chris's Shop") || html.includes('Chris&#x27;s Shop'),
        'Must contain Chris\'s Shop branding'
      );
      assert.ok(
        html.includes('Exclusive Art & Limited Drops') ||
        html.includes('Exclusive Art &amp; Limited Drops') ||
        html.includes('Exclusive Art & Physical Collectibles') ||
        html.includes('Exclusive Art &amp; Physical Collectibles'),
        'Must contain storefront headline/title'
      );
      assert.ok(
        html.includes('Next Drop Live Now'),
        'Must contain "Next Drop Live Now" badge'
      );
      assert.ok(
        html.includes('Explore All Drops'),
        'Must contain "Explore All Drops" button'
      );
      assert.ok(
        html.includes('Cart') || html.includes('🛒'),
        'Must contain cart indicator'
      );
      assert.ok(
        html.includes('Shop Catalog'),
        'Must contain "Shop Catalog" navigation item'
      );
    });

    it('Route 2: Backend API (/api/health) must probe and confirm all 6 bindings active', async () => {
      const request = new Request('https://chrishop.jacobmiller22.com/api/health');
      const response = await worker.fetch(request, mockEnv, {});

      assert.equal(response.status, 200, 'Health check must return HTTP 200 OK');
      assert.match(
        response.headers.get('content-type') || '',
        /application\/json/,
        'Content-Type must be application/json'
      );

      const body = await response.json();

      // Deep verification of health status payload
      assert.equal(body.status, 'healthy');
      assert.equal(body.service, '@chrishop/web');
      assert.equal(body.runtime, 'cloudflare-workers');
      assert.ok(body.timestamp, 'Timestamp must be present');
      assert.ok(!isNaN(new Date(body.timestamp).getTime()), 'Timestamp must be valid ISO date');

      // Deep verification of all 6 bindings
      assert.ok(body.bindings, 'bindings object must be present');
      assert.equal(body.bindings.d1, true, 'd1 (DB) binding must be confirmed online');
      assert.equal(body.bindings.kv, true, 'kv (NEXT_CACHE_WORKERS_KV) binding must be confirmed online');
      assert.equal(body.bindings.r2, true, 'r2 (BUCKET) binding must be confirmed online');
      assert.equal(body.bindings.assets, true, 'assets (ASSETS) binding must be confirmed online');
      assert.equal(body.bindings.site, true, 'site (SITE_URL) binding must be confirmed online');
      assert.equal(body.bindings.cms, true, 'cms (CMS_URL) binding must be confirmed online');
    });

    it('Route 2b: Worker API (/api/products) must return structured backend API response', async () => {
      const request = new Request('https://chrishop.jacobmiller22.com/api/products');
      const response = await worker.fetch(request, mockEnv, {});

      assert.equal(response.status, 200, 'API route must return HTTP 200');
      assert.match(response.headers.get('content-type') || '', /application\/json/);

      const body = await response.json();
      assert.equal(body.service, '@chrishop/web');
      assert.equal(body.runtime, 'cloudflare-workers');
      assert.equal(body.endpoint, '/api/products');
      assert.equal(body.status, 'online');
    });

    it('Route 3: Admin (/admin) must serve Payload CMS v3 Administrative Panel with deep markers', async () => {
      const request = new Request('https://chrishop.jacobmiller22.com/admin');
      const response = await worker.fetch(request, mockEnv, {});

      assert.equal(response.status, 200, 'Admin route must return HTTP 200 OK');
      assert.match(
        response.headers.get('content-type') || '',
        /text\/html/,
        'Content-Type must be text/html'
      );

      const html = await response.text();

      // Deep verification of Payload CMS administrative markers (NOT just 200 OK)
      assert.ok(html.includes('<!DOCTYPE html>'), 'Must start with <!DOCTYPE html>');
      assert.ok(html.includes('Payload Admin'), 'Must contain Payload Admin title');
      assert.ok(
        html.includes('Payload CMS') || html.includes('payload-admin'),
        'Must contain Payload CMS admin markers'
      );
      assert.ok(
        html.includes('Administrative Dashboard'),
        'Must contain Administrative Dashboard heading'
      );
      assert.ok(
        html.includes('Products') && html.includes('Categories') && html.includes('Media'),
        'Must contain Payload content collection links'
      );
      assert.ok(
        html.includes('Cloudflare D1') || html.includes('v3.'),
        'Must reference Payload CMS version or D1 database'
      );
      assert.ok(
        html.includes('__PAYLOAD_ADMIN_LOADED__'),
        'Must include Payload admin script initialization hook'
      );
    });

    it('Route 4: Static assets bridge must delegate to env.ASSETS', async () => {
      let assetFetched = false;
      const customEnv = {
        ...mockEnv,
        ASSETS: {
          fetch: async (req: Request) => {
            assetFetched = true;
            return new Response('body { background: #000; }', {
              status: 200,
              headers: { 'content-type': 'text/css' },
            });
          },
        },
      };

      const request = new Request('https://chrishop.jacobmiller22.com/_next/static/css/test.css');
      const response = await worker.fetch(request, customEnv, {});

      assert.equal(assetFetched, true, 'env.ASSETS.fetch must have been invoked');
      assert.equal(response.status, 200, 'Asset response must be 200 OK');
      assert.match(response.headers.get('content-type') || '', /text\/css/);
    });

    it('Route 5: Unmatched paths must return Next.js styled 404 page', async () => {
      const request = new Request('https://chrishop.jacobmiller22.com/non-existent-page-xyz');
      const response = await worker.fetch(request, mockEnv, {});

      assert.equal(response.status, 404, 'Must return HTTP 404');
      assert.match(response.headers.get('content-type') || '', /text\/html/);

      const html = await response.text();
      assert.ok(html.includes('404'), 'Must contain 404 status');
      assert.ok(
        html.includes('This page could not be found') || html.includes('Page Not Found'),
        'Must contain not found message'
      );
    });
  });

  describe('3. Wrangler 2-Tier Universal SSL & Assets Configuration', () => {
    it('should verify wrangler.toml declares 2-tier subdomains and assets across all environments', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');

      // Top-level / Production
      assert.ok(
        content.includes('assets = { directory = ".open-next/assets", binding = "ASSETS" }'),
        'Top-level must declare assets binding'
      );
      assert.ok(
        content.includes('pattern = "chrishop.jacobmiller22.com/*"'),
        'Production must route chrishop.jacobmiller22.com'
      );
      assert.ok(
        content.includes('SITE_URL = "https://chrishop.jacobmiller22.com"'),
        'Production must define SITE_URL'
      );
      assert.ok(
        content.includes('CMS_URL = "https://chrishop.jacobmiller22.com"'),
        'Production must define CMS_URL'
      );

      // Staging: MUST use 2-tier subdomains
      assert.ok(
        content.includes('pattern = "staging-chrishop.jacobmiller22.com/*"'),
        'Staging must route staging-chrishop.jacobmiller22.com (2-tier)'
      );
      assert.ok(
        content.includes('pattern = "staging-shop.jacobmiller22.com/*"'),
        'Staging must route staging-shop.jacobmiller22.com (2-tier)'
      );
      assert.ok(
        !content.includes('pattern = "staging.chrishop.jacobmiller22.com/*"'),
        'Prohibited 3-tier domain staging.chrishop.jacobmiller22.com must not be present'
      );
      assert.ok(
        !content.includes('pattern = "staging.shop.jacobmiller22.com/*"'),
        'Prohibited 3-tier domain staging.shop.jacobmiller22.com must not be present'
      );

      // Preview: 2-tier wildcard
      assert.ok(
        content.includes('pattern = "pr-*-chrishop.jacobmiller22.com/*"'),
        'Preview must route pr-*-chrishop.jacobmiller22.com (2-tier)'
      );
    });

    it('should successfully execute wrangler deploy --dry-run across environments', () => {
      const output = execSync('pnpm exec wrangler deploy --dry-run --env preview', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(
        output.includes('--dry-run: exiting now') || output.includes('Total Upload'),
        'Wrangler deploy dry-run must succeed'
      );
    });
  });
});
