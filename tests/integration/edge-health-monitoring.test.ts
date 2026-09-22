import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as healthRouteHandler } from '../../apps/web/src/app/api/health/route';
import { dispatchHealthAlert } from '../../apps/web/src/lib/health-monitoring';
import { defaultShopifyMock } from '../../apps/web/src/lib/shopify-mock';
import { shopify } from '../../apps/web/src/lib/shopify';

describe('Story 4.2: Cloudflare Workers Edge Health Checks & Synthetic Monitoring', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
    delete (globalThis as any).DB;
    delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
    delete (globalThis as any).BUCKET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyMock.reset();
    delete (globalThis as any).DB;
    delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
    delete (globalThis as any).BUCKET;
  });

  // ==========================================================================
  // 1. Fully Bound Edge Environment Verification
  // ==========================================================================
  describe('1. Fully Bound Edge Environment Simulation', () => {
    it('should report healthy edge status when all cloudflare bindings and probes succeed', async () => {
      // Mock D1
      (globalThis as any).DB = {
        prepare: (query: string) => ({
          first: async () => ({ healthy: 1 }),
          all: async () => ({ results: [{ healthy: 1 }] }),
        }),
      };

      // Mock KV
      const kvStore = new Map<string, string>();
      (globalThis as any).NEXT_CACHE_WORKERS_KV = {
        get: async (k: string) => kvStore.get(k) || null,
        put: async (k: string, v: string) => kvStore.set(k, v),
      };

      // Mock R2
      (globalThis as any).BUCKET = {
        list: async () => ({ objects: [], truncated: false }),
      };

      // Mock other environment vars
      process.env.ASSETS = 'mock-assets';
      process.env.SITE_URL = 'https://chrishop.jacobmiller22.com';
      process.env.CMS_URL = 'https://chrishop.jacobmiller22.com';

      const startTime = Date.now();
      const res = await healthRouteHandler(new NextRequest('https://chrishop.jacobmiller22.com/api/health'));
      const elapsed = Date.now() - startTime;

      assert.equal(res.status, 200);
      assert.ok(elapsed < 500, `Health check latency (${elapsed}ms) must be < 500ms`);

      const body = await res.json();
      assert.equal(body.status, 'healthy');
      assert.equal(body.runtime, 'cloudflare-workers');
      assert.equal(body.bindings.d1, true);
      assert.equal(body.bindings.kv, true);
      assert.equal(body.bindings.r2, true);
      assert.equal(body.probes.d1.status, 'healthy');
      assert.equal(body.probes.kv.status, 'healthy');
      assert.equal(body.probes.shopify.status, 'healthy');
      assert.equal(body.probes.r2.status, 'healthy');

      // Assert caching and security headers
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(res.headers.get('x-response-time-ms'));
      assert.ok(body.commitSha, 'Must return commitSha');
      assert.ok(body.shortSha, 'Must return shortSha');
      assert.equal(res.headers.get('x-chrishop-commit-sha'), body.commitSha);
    });
  });

  // ==========================================================================
  // 2. Failure Isolation & Status Codes
  // ==========================================================================
  describe('2. Failure Isolation & HTTP 503 Gating', () => {
    it('should return HTTP 503 and report unhealthy if D1 throws runtime query exception', async () => {
      (globalThis as any).DB = {
        prepare: () => {
          throw new Error('D1: SQLite database disk image is malformed');
        },
      };

      const res = await healthRouteHandler();
      assert.equal(res.status, 503);

      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.probes.d1.status, 'unhealthy');
      assert.ok(body.probes.d1.error?.includes('malformed'));
    });

    it('should return HTTP 503 and report unhealthy if KV cache fails write/read probe', async () => {
      (globalThis as any).NEXT_CACHE_WORKERS_KV = {
        get: async () => {
          throw new Error('KV: Rate limit exceeded or namespace inactive');
        },
        put: async () => {
          throw new Error('KV: Rate limit exceeded or namespace inactive');
        },
      };

      const res = await healthRouteHandler();
      assert.equal(res.status, 503);

      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.probes.kv.status, 'unhealthy');
      assert.ok(body.probes.kv.error?.includes('Rate limit exceeded'));
    });

    it('should return HTTP 503 and report unhealthy if R2 bucket throws error', async () => {
      (globalThis as any).BUCKET = {
        list: async () => {
          throw new Error('R2: Bucket not found (404)');
        },
      };

      const res = await healthRouteHandler();
      assert.equal(res.status, 503);

      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.probes.r2.status, 'unhealthy');
      assert.ok(body.probes.r2.error?.includes('Bucket not found'));
    });

    it('should aggregate multiple simultaneous probe failures in unhealthy response', async () => {
      (globalThis as any).DB = {
        prepare: () => {
          throw new Error('D1 unavailable');
        },
      };
      (globalThis as any).NEXT_CACHE_WORKERS_KV = {
        put: () => {
          throw new Error('KV unavailable');
        },
        get: () => null,
      };

      const res = await healthRouteHandler();
      assert.equal(res.status, 503);

      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.probes.d1.status, 'unhealthy');
      assert.equal(body.probes.kv.status, 'unhealthy');
    });
  });

  // ==========================================================================
  // 3. Discord dev-alerts Notification Dispatch
  // ==========================================================================
  describe('3. Automated Discord Alerting on Edge Degradation', () => {
    it('should dispatch alert to Discord when probe failure is detected', async () => {
      const capturedDispatches: any[] = [];
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async (url: any, init?: any) => {
        if (String(url).includes('discord.com/api/webhooks')) {
          capturedDispatches.push(JSON.parse(init?.body || '{}'));
          return new Response(null, { status: 204 });
        }
        return originalFetch(url, init);
      };

      try {
        process.env.DISCORD_WEBHOOK_DEV_ALERTS = 'https://discord.com/api/webhooks/mock-integration/dev-alerts';

        (globalThis as any).DB = {
          prepare: () => {
            throw new Error('Connection pool exhausted');
          },
        };

        const res = await healthRouteHandler();
        assert.equal(res.status, 503);

        // Allow microtask tick for async fire-and-forget dispatch
        await new Promise((r) => setTimeout(r, 40));

        assert.ok(capturedDispatches.length >= 1, 'Alert must be sent to Discord');
        const alert = capturedDispatches[0];
        assert.ok(alert.content.includes('[Edge Health Alert]'));
        assert.ok(alert.content.includes('Connection pool exhausted'));
        assert.equal(alert.embeds[0].color, 0xef4444);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
