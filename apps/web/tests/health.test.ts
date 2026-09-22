import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/api/health/route';
import { dispatchHealthAlert } from '../src/lib/health-monitoring';
import { defaultShopifyMock } from '../src/lib/shopify-mock';
import { shopify } from '../src/lib/shopify';

describe('Story 4.2: Cloudflare Workers Health Checks & Edge Monitoring (/api/health)', () => {
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
  // 1. Baseline Edge Health Check
  // ==========================================================================
  describe('1. Baseline Health Check Payload & Headers', () => {
    it('should return HTTP 200 and healthy status payload with all required metrics', async () => {
      const response = await GET();
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.status, 'healthy');
      assert.equal(body.service, '@chrishop/web');
      assert.equal(body.runtime, 'cloudflare-workers');
      assert.ok(body.timestamp, 'Response must include timestamp');
      assert.ok(typeof body.durationMs === 'number', 'Response must include durationMs');
      assert.ok(body.bindings, 'Response must include bindings object');
      assert.ok(body.probes, 'Response must include probes object');

      // Security and Cache Headers
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(response.headers.get('x-response-time-ms'));
    });

    it('should report all 6 bindings active when configured in environment', async () => {
      process.env.DB = 'mock-d1-db';
      process.env.NEXT_CACHE_WORKERS_KV = 'mock-kv';
      process.env.BUCKET = 'mock-r2-bucket';
      process.env.ASSETS = 'mock-assets';
      process.env.SITE_URL = 'https://chrishop.jacobmiller22.com';
      process.env.CMS_URL = 'https://chrishop.jacobmiller22.com';

      const response = await GET();
      const body = await response.json();

      assert.equal(body.status, 'healthy');
      assert.equal(body.bindings.d1, true, 'd1 binding must be online');
      assert.equal(body.bindings.kv, true, 'kv binding must be online');
      assert.equal(body.bindings.r2, true, 'r2 binding must be online');
      assert.equal(body.bindings.assets, true, 'assets binding must be online');
      assert.equal(body.bindings.site, true, 'site binding must be online');
      assert.equal(body.bindings.cms, true, 'cms binding must be online');
    });
  });

  // ==========================================================================
  // 2. D1 Database Dependency Probe (SELECT 1)
  // ==========================================================================
  describe('2. D1 Database Active Probe (SELECT 1)', () => {
    it('should execute SELECT 1 probe against bound D1 database successfully', async () => {
      let executedSql = '';
      const mockD1 = {
        prepare: (query: string) => {
          executedSql = query;
          return {
            first: async () => ({ healthy: 1 }),
            all: async () => ({ results: [{ healthy: 1 }] }),
          };
        },
      };

      (globalThis as any).DB = mockD1;

      const response = await GET();
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.status, 'healthy');
      assert.equal(body.probes.d1.status, 'healthy');
      assert.equal(body.probes.d1.query, 'SELECT 1 as healthy');
      assert.ok(typeof body.probes.d1.latencyMs === 'number');
      assert.equal(executedSql, 'SELECT 1 as healthy');
    });

    it('should return HTTP 503 and unhealthy status when D1 probe throws', async () => {
      const failingD1 = {
        prepare: () => {
          throw new Error('D1 connection timeout');
        },
      };

      (globalThis as any).DB = failingD1;

      const response = await GET();
      assert.equal(response.status, 503, 'Failed critical dependency must return HTTP 503');

      const body = await response.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.probes.d1.status, 'unhealthy');
      assert.ok(body.probes.d1.error?.includes('D1 connection timeout'));
    });
  });

  // ==========================================================================
  // 3. Workers KV Cache Read/Write Probe
  // ==========================================================================
  describe('3. Cloudflare Workers KV Cache Probe', () => {
    it('should write and read back health check key in Workers KV successfully', async () => {
      const kvStore = new Map<string, string>();
      const mockKV = {
        get: async (key: string) => kvStore.get(key) || null,
        put: async (key: string, value: string, _options?: any) => {
          kvStore.set(key, value);
        },
      };

      (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;

      const response = await GET();
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.status, 'healthy');
      assert.equal(body.probes.kv.status, 'healthy');
      assert.equal(body.probes.kv.key, '__health_check__');
      assert.ok(typeof body.probes.kv.latencyMs === 'number');
      assert.ok(kvStore.has('__health_check__'));
    });

    it('should return HTTP 503 and unhealthy status when KV probe fails', async () => {
      const failingKV = {
        get: async () => {
          throw new Error('KV namespace unauthorized');
        },
        put: async () => {
          throw new Error('KV namespace unauthorized');
        },
      };

      (globalThis as any).NEXT_CACHE_WORKERS_KV = failingKV;

      const response = await GET();
      assert.equal(response.status, 503);

      const body = await response.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.probes.kv.status, 'unhealthy');
      assert.ok(body.probes.kv.error?.includes('KV namespace unauthorized'));
    });
  });

  // ==========================================================================
  // 4. Shopify Storefront API Reachability Probe
  // ==========================================================================
  describe('4. Shopify Storefront API Connectivity Probe', () => {
    it('should verify Shopify Storefront connectivity via getShopInfo', async () => {
      const response = await GET();
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.probes.shopify.status, 'healthy');
      assert.equal(body.probes.shopify.shop, 'ChrisShop Leadville Workshop');
      assert.equal(body.probes.shopify.currency, 'USD');
    });

    it('should return HTTP 503 when Shopify Storefront API returns an error', async () => {
      const originalGetShop = shopify.getShopInfo;
      (shopify as any).getShopInfo = async () => {
        return {
          data: null,
          errors: [{ message: 'Shopify Storefront API Rate Limit (HTTP 429)' }],
        };
      };

      try {
        const response = await GET();
        assert.equal(response.status, 503);

        const body = await response.json();
        assert.equal(body.status, 'unhealthy');
        assert.equal(body.probes.shopify.status, 'unhealthy');
        assert.ok(body.probes.shopify.error?.includes('Rate Limit'));
      } finally {
        (shopify as any).getShopInfo = originalGetShop;
      }
    });
  });

  // ==========================================================================
  // 5. Discord #dev-alerts Out-of-Band Notification Dispatch
  // ==========================================================================
  describe('5. Discord #dev-alerts Alert Dispatch', () => {
    it('should dispatch formatted alert to Discord webhook on probe failure', async () => {
      const dispatchedPayloads: any[] = [];
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async (url: any, init?: any) => {
        if (String(url).includes('discord.com/api/webhooks')) {
          dispatchedPayloads.push(JSON.parse(init?.body || '{}'));
          return new Response(null, { status: 204 });
        }
        return originalFetch(url, init);
      };

      try {
        const mockWebhookUrl = 'https://discord.com/api/webhooks/987654321/mock-dev-alerts';
        const failedProbes = {
          d1: { status: 'unhealthy' as const, error: 'Database locked (SQLITE_BUSY)', latencyMs: 250 },
        };

        const success = await dispatchHealthAlert('unhealthy', failedProbes, mockWebhookUrl);
        assert.equal(success, true);
        assert.equal(dispatchedPayloads.length, 1);

        const alert = dispatchedPayloads[0];
        assert.ok(alert.content.includes('[Edge Health Alert]'));
        assert.ok(alert.content.includes('UNHEALTHY'));
        assert.ok(alert.content.includes('SQLITE_BUSY'));
        assert.ok(alert.embeds?.[0]?.title?.includes('Health Check Failure'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should trigger alert dispatch automatically when /api/health fails', async () => {
      const dispatchedPayloads: any[] = [];
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async (url: any, init?: any) => {
        if (String(url).includes('discord.com/api/webhooks')) {
          dispatchedPayloads.push(JSON.parse(init?.body || '{}'));
          return new Response(null, { status: 204 });
        }
        return originalFetch(url, init);
      };

      try {
        process.env.DISCORD_WEBHOOK_DEV_ALERTS = 'https://discord.com/api/webhooks/999/dev-alerts';

        // Induce failure
        (globalThis as any).DB = {
          prepare: () => {
            throw new Error('Fatal database disk failure');
          },
        };

        const response = await GET();
        assert.equal(response.status, 503);

        // Allow microtask tick for async fire-and-forget dispatch
        await new Promise((resolve) => setTimeout(resolve, 30));

        assert.ok(dispatchedPayloads.length >= 1, 'Discord webhook must be called');
        assert.ok(dispatchedPayloads[0].content.includes('Fatal database disk failure'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
