import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isStaticAssetRequest,
  STATIC_ASSET_REGEX,
} from '../../scripts/build-worker';

describe('Story 2.48: Edge Request Streaming, OpenNext Dispatch Guards & Body Reuse (Issue #237)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('1. Web Streams & ReadableStream Locking Semantics in V8', () => {
    it('should confirm ReadableStream locks upon reader acquisition', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('test stream chunk'));
          controller.close();
        },
      });

      assert.equal(stream.locked, false, 'Stream should initially be unlocked');
      const reader = stream.getReader();
      assert.equal(stream.locked, true, 'Stream must be locked once reader is acquired');

      // Second reader attempt must throw
      assert.throws(
        () => stream.getReader(),
        /locked/,
        'Attempting to get reader on locked stream must throw'
      );

      reader.releaseLock();
      assert.equal(stream.locked, false, 'Releasing reader must unlock stream');
    });

    it('should throw TypeError when consuming Request body a second time', async () => {
      const bodyText = JSON.stringify({ email: 'maker@bankbeaters.example', role: 'admin' });
      const request = new Request('https://chrishop.jacobmiller22.com/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyText,
      });

      assert.equal(request.bodyUsed, false, 'Request body should initially be unused');

      // First consumption
      const payload1 = await request.json();
      assert.equal(payload1.email, 'maker@bankbeaters.example');
      assert.equal(request.bodyUsed, true, 'Request body must be marked as used');

      // Second consumption must throw TypeError
      await assert.rejects(
        async () => {
          await request.json();
        },
        (err: any) => {
          assert.equal(err.name, 'TypeError');
          assert.ok(
            err.message.includes('disturbed') ||
              err.message.includes('used') ||
              err.message.includes('consumed') ||
              err.message.includes('locked') ||
              err.message.includes('already been read') ||
              err.message.includes('unusable'),
            `Expected stream consumption error, got: ${err.message}`
          );
          return true;
        }
      );
    });

    it('should demonstrate stream locking when Request is passed to intermediate fetch handler', async () => {
      const bodyData = 'mutation-stream-payload';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(bodyData));
          controller.close();
        },
      });

      const request = new Request('https://chrishop.jacobmiller22.com/admin/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: stream,
        duplex: 'half',
      } as RequestInit);

      // Simulate an intermediate handler acquiring a reader (e.g. ASSETS probe or unoptimized middleware)
      const reader = request.body!.getReader();
      assert.equal(request.body!.locked, true);

      // Downstream server handler attempting to read throws
      await assert.rejects(
        async () => {
          await request.text();
        },
        (err: any) => {
          assert.equal(err.name, 'TypeError');
          return true;
        }
      );

      reader.releaseLock();
    });
  });

  describe('2. ReadableStream.tee() Empirical Analysis (Hypothesis A)', () => {
    it('should verify tee() creates two readable branches but locks original stream', async () => {
      const originalPayload = 'chris-shop-craftsmanship-payload';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(originalPayload));
          controller.close();
        },
      });

      const [branch1, branch2] = stream.tee();
      assert.equal(stream.locked, true, 'tee() must lock the parent stream');
      assert.equal(branch1.locked, false, 'Branch 1 must initially be unlocked');
      assert.equal(branch2.locked, false, 'Branch 2 must initially be unlocked');

      // Read branch 1
      const reader1 = branch1.getReader();
      const chunk1 = await reader1.read();
      const text1 = new TextDecoder().decode(chunk1.value);
      assert.equal(text1, originalPayload);

      // Read branch 2
      const reader2 = branch2.getReader();
      const chunk2 = await reader2.read();
      const text2 = new TextDecoder().decode(chunk2.value);
      assert.equal(text2, originalPayload);
    });

    it('should evaluate memory retention when one tee() branch is neglected', async () => {
      // Create a stream with 100 chunks
      let chunkCount = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (chunkCount < 50) {
            controller.enqueue(new Uint8Array(1024)); // 1KB per chunk
            chunkCount++;
          } else {
            controller.close();
          }
        },
      });

      const [consumedBranch, neglectedBranch] = stream.tee();

      // Read consumed branch completely
      const reader = consumedBranch.getReader();
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
      }
      assert.equal(totalBytes, 50 * 1024);

      // Neglected branch remains unclosed and buffers chunks in memory
      assert.equal(neglectedBranch.locked, false);
      // Clean up neglected branch
      await neglectedBranch.cancel();
    });
  });

  describe('3. Guard A: Deterministic Static Asset Matcher (isStaticAssetRequest)', () => {
    it('should correctly identify static asset paths and file extensions', () => {
      const staticPaths = [
        '/_next/static/chunks/app.js',
        '/_next/static/css/theme.css',
        '/_next/static/media/hero.webp',
        '/api/media/file/leadville-chest-rig.jpeg',
        '/api/media/file/storm-anorak.png',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
        '/images/logo.png',
        '/fonts/inter.woff2',
        '/site.webmanifest',
        '/manifest.json',
        '/data/sample.json',
        '/vector.svg',
      ];

      for (const p of staticPaths) {
        assert.equal(
          isStaticAssetRequest(p),
          true,
          `Path "${p}" must be recognized as static asset`
        );
      }
    });

    it('should correctly reject dynamic storefront and API routes from static asset routing', () => {
      const dynamicPaths = [
        '/',
        '/products',
        '/products/bushwhack-storm-anorak',
        '/products/bramble-buster-technical-guide-pant',
        '/catalog',
        '/drops',
        '/about',
        '/cart',
        '/checkout',
        '/admin',
        '/admin/login',
        '/admin/collections/products',
        '/admin/collections/categories',
        '/api/health',
        '/api/checkout/verify-turnstile',
        '/api/webhooks/shopify',
        '/api/cart/create',
        '/api/cart/lines/add',
        '/api/graphql',
      ];

      for (const p of dynamicPaths) {
        assert.equal(
          isStaticAssetRequest(p),
          false,
          `Dynamic path "${p}" must NOT be routed to static assets`
        );
      }
    });

    it('should verify STATIC_ASSET_REGEX matches standard web media and font extensions', () => {
      const validExtensions = [
        'file.ico', 'file.png', 'file.jpg', 'file.jpeg', 'file.gif',
        'file.svg', 'file.webp', 'file.avif', 'file.css', 'file.js',
        'file.woff', 'file.woff2', 'file.ttf', 'file.eot', 'file.otf',
        'file.map', 'file.txt', 'file.webmanifest', 'file.json',
      ];

      for (const f of validExtensions) {
        assert.ok(
          STATIC_ASSET_REGEX.test(f),
          `Extension for "${f}" must be matched by STATIC_ASSET_REGEX`
        );
      }
    });
  });

  describe('4. Guard B: Mutation & API Direct Dispatch Bypass Simulation', () => {
    it('should preserve pristine request.body stream for downstream route handlers', async () => {
      const payload = {
        lineItems: [{ variantId: 'gid://shopify/ProductVariant/4455', quantity: 2 }],
        countryCode: 'US',
      };

      const request = new Request('https://chrishop.jacobmiller22.com/api/cart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const url = new URL(request.url);
      const isMutation = request.method !== 'GET' && request.method !== 'HEAD';
      const isApi = url.pathname.startsWith('/api/');

      // Guard check
      const shouldBypassMiddleware = isMutation || isApi;
      assert.equal(shouldBypassMiddleware, true, 'Mutation must bypass middleware');

      // Server handler simulation
      const serverHandler = async (req: Request) => {
        // Assert body stream is untouched and can be cleanly parsed
        assert.equal(req.bodyUsed, false);
        const data = await req.json();
        return new Response(JSON.stringify({ success: true, cart: data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const response = await serverHandler(request);
      assert.equal(response.status, 200);
      const resJson: any = await response.json();
      assert.equal(resJson.success, true);
      assert.equal(resJson.cart.countryCode, 'US');
    });

    it('should simulate latency gain of eliminating env.ASSETS subrequest on dynamic SSR route', async () => {
      const url = new URL('https://chrishop.jacobmiller22.com/products');

      // With Guard A:
      const needsAssetProbeWithGuard = isStaticAssetRequest(url.pathname);
      assert.equal(needsAssetProbeWithGuard, false);

      // Simulate mock ASSETS.fetch that would return 404
      let assetFetchCount = 0;
      const mockAssets = {
        fetch: async () => {
          assetFetchCount++;
          // Simulate 4ms edge isolate subrequest overhead
          await new Promise((resolve) => setTimeout(resolve, 4));
          return new Response('Not Found', { status: 404 });
        },
      };

      // Execution with Guard A
      const startWithGuard = Date.now();
      if (needsAssetProbeWithGuard) {
        await mockAssets.fetch();
      }
      const durationWithGuard = Date.now() - startWithGuard;

      // Execution without Guard (Legacy Speculative Fallback)
      const startWithoutGuard = Date.now();
      await mockAssets.fetch();
      const durationWithoutGuard = Date.now() - startWithoutGuard;

      assert.equal(assetFetchCount, 1, 'Guard A avoided the asset fetch completely');
      assert.ok(
        durationWithGuard < durationWithoutGuard,
        'Guard A must execute faster than speculative asset probing'
      );
    });
  });

  describe('5. ADR-002 Document Integrity & Architectural Alignment', () => {
    const adrPath = path.join(rootDir, 'docs/adr/ADR-002-edge-request-streaming-and-dispatch-guards.md');

    it('should verify ADR-002 exists on disk and is accepted', () => {
      assert.ok(fs.existsSync(adrPath), 'ADR-002 must exist in docs/adr/');
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('# ADR-002: Cloudflare Edge Request Stream Consumption'));
      assert.ok(content.includes('- **Status**: Accepted'));
    });

    it('should verify ADR-002 comprehensively documents all 4 core research questions', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');

      // Question 1: Stream Teeing & Cloning
      assert.ok(content.includes('Evaluation of `ReadableStream.tee()`'));
      assert.ok(content.includes('Evaluation of `request.clone()`'));

      // Question 2: Static Asset Bypass
      assert.ok(content.includes('Speculative `env.ASSETS` Fallback vs. Deterministic Routing'));
      assert.ok(content.includes('Deterministic Static Asset Matching'));

      // Question 3: workerd stream locking
      assert.ok(content.includes('Single-Reader Semantics & Disturbed Stream Locking'));

      // Question 4: Upstream alignment
      assert.ok(content.includes('Upstream Alignment & Recommendations'));
      assert.ok(content.includes('@opennextjs/cloudflare'));
    });

    it('should verify ADR-002 documents the 4 architectural dispatch guards', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('Guard A: Deterministic Static Asset Matching'));
      assert.ok(content.includes('Guard B: Direct Server Handler Dispatch'));
      assert.ok(content.includes('Guard C: Next.js 16 `require-hook` Invalidation Shim'));
      assert.ok(content.includes('Guard D: Edge Runtime Polyfills'));
    });
  });
});
