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
    if (!fs.existsSync(workerPath)) {
      execSync('pnpm run build:worker', { cwd: rootDir, stdio: 'pipe' });
    }
  });

  describe('1. OpenNext Configuration & Bundle Structure', () => {
    it('should verify apps/web/open-next.config.ts exists and configures unified Cloudflare worker', () => {
      assert.ok(fs.existsSync(openNextConfigPath), 'apps/web/open-next.config.ts must exist');
      const content = fs.readFileSync(openNextConfigPath, 'utf-8');

      assert.ok(content.includes('defineCloudflareConfig'), 'Must use defineCloudflareConfig');
    });

    it('should verify .open-next/worker.js and .open-next/assets exist', () => {
      assert.ok(fs.existsSync(workerPath), '.open-next/worker.js must exist');
      assert.ok(fs.existsSync(assetsDir), '.open-next/assets directory must exist');

      const workerContent = fs.readFileSync(workerPath, 'utf-8');
      assert.ok(workerContent.includes('export default'), 'Worker must export default handler');
      assert.ok(
        workerContent.includes('async fetch(request, env, ctx)'),
        'Worker must define fetch handler'
      );
    });
  });

  describe('2. Deep Semantic Route Content Verification', () => {
    // Import worker entrypoint dynamically
    let worker: any;
    const mockStmt = {
      all: async () => ({ results: [], success: true }),
      run: async () => ({ success: true }),
      raw: async () => [],
      bind: () => mockStmt,
    };
    const mockEnv = {
      DB: { prepare: () => mockStmt },
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

    it('Route 1: Root (/) App Router source must contain authentic Next.js Storefront markers', () => {
      const pagePath = path.join(rootDir, 'apps/web/src/app/(storefront)/page.tsx');
      assert.ok(fs.existsSync(pagePath), 'Storefront page.tsx must exist');
      const content = fs.readFileSync(pagePath, 'utf-8');

      assert.ok(content.includes('BankBeaters'), 'Must contain BankBeaters branding');
      assert.ok(
        content.includes('Curiosity &gt; Fear') || content.includes('Curiosity > Fear'),
        'Must contain brand ethos'
      );
      assert.ok(content.includes('Adventure Gear'), 'Must contain Adventure Gear text');
      assert.ok(content.includes('/products'), 'Must link to products catalog');
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
      assert.equal(
        body.bindings.kv,
        true,
        'kv (NEXT_CACHE_WORKERS_KV) binding must be confirmed online'
      );
      assert.equal(body.bindings.r2, true, 'r2 (BUCKET) binding must be confirmed online');
      assert.equal(body.bindings.assets, true, 'assets (ASSETS) binding must be confirmed online');
      assert.equal(body.bindings.site, true, 'site (SITE_URL) binding must be confirmed online');
      assert.equal(body.bindings.cms, true, 'cms (CMS_URL) binding must be confirmed online');
    });

    it('Route 2b: Edge R2 Media Handler (/media/*) must serve authentic media assets directly from bucket binding', async () => {
      let r2GetCalled = false;
      const customEnv = {
        ...mockEnv,
        BUCKET: {
          get: async (key: string) => {
            r2GetCalled = true;
            return {
              body: 'image-bytes',
              httpEtag: '"mock-etag"',
              writeHttpMetadata: (h: Headers) => h.set('content-type', 'image/jpeg'),
            };
          },
        },
      };

      const request = new Request('https://chrishop.jacobmiller22.com/media/products/anorak.jpg');
      const response = await worker.fetch(request, customEnv, {});

      assert.equal(r2GetCalled, true, 'env.BUCKET.get must be invoked');
      assert.equal(response.status, 200, 'Media response must return HTTP 200');
      assert.equal(response.headers.get('content-type'), 'image/jpeg');
      assert.equal(response.headers.get('etag'), '"mock-etag"');
      assert.ok(response.headers.get('cache-control')?.includes('public'));
    });

    it('Route 3: Admin App Router source must configure authentic Payload CMS v3 Administrative Panel', () => {
      const adminPath = path.join(
        rootDir,
        'apps/web/src/app/(payload)/admin/[[...segments]]/page.tsx'
      );
      assert.ok(fs.existsSync(adminPath), 'Payload admin page.tsx must exist');
      const content = fs.readFileSync(adminPath, 'utf-8');

      assert.ok(content.includes('@payloadcms/next/views'), 'Must import Payload next views');
      assert.ok(content.includes('RootPage'), 'Must render Payload RootPage');
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

    it('Route 5: Unified server function dispatch must route through server-functions/default/handler.mjs', () => {
      const workerContent = fs.readFileSync(workerPath, 'utf-8');
      assert.ok(
        workerContent.includes('./server-functions/default/handler.mjs'),
        'Must route through unified server function handler'
      );
      assert.ok(
        workerContent.includes('runWithCloudflareRequestContext'),
        'Must wrap execution in Cloudflare request context'
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
  });
});
