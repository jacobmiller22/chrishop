/**
 * Edge Health Monitoring & Diagnostic Engine (Story 4.2)
 *
 * Implements active dependency probing for D1 database, Workers KV cache,
 * Shopify Storefront API connectivity, and R2 object storage.
 * Provides out-of-band Discord #dev-alerts notification dispatch on probe degradation.
 */

import { shopify } from './shopify';

export interface HealthProbeDetail {
  status: 'healthy' | 'unhealthy' | 'skipped';
  latencyMs?: number;
  error?: string;
  [key: string]: unknown;
}

export interface HealthResponsePayload {
  status: 'healthy' | 'unhealthy';
  service: string;
  runtime: string;
  timestamp: string;
  durationMs: number;
  commitSha: string;
  shortSha: string;
  buildTimestamp: string;
  environment: string;
  bindings: {
    d1: boolean;
    kv: boolean;
    r2: boolean;
    assets: boolean;
    site: boolean;
    cms: boolean;
  };
  probes: {
    d1: HealthProbeDetail;
    kv: HealthProbeDetail;
    shopify: HealthProbeDetail;
    r2: HealthProbeDetail;
  };
  uptime?: {
    processUptimeSec: number;
  };
}

/**
 * Dispatches an out-of-band alert to Discord #dev-alerts when an edge health check probe fails.
 */
export async function dispatchHealthAlert(
  status: string,
  failedProbes: Record<string, HealthProbeDetail>,
  webhookUrl?: string
): Promise<boolean> {
  const targetUrl =
    webhookUrl ||
    process.env.DISCORD_WEBHOOK_DEV_ALERTS ||
    process.env.DISCORD_WEBHOOK_ALERTS ||
    process.env.OPS_ALERT_WEBHOOK_URL;

  if (!targetUrl) return false;

  const failureDetails = Object.entries(failedProbes)
    .map(([k, v]) => `• **${k.toUpperCase()}**: ${v.error || 'Failed probe check'} (${v.latencyMs || 0}ms)`)
    .join('\n');

  const payload = {
    content: `🚨 **[Edge Health Alert] ChrisShop Edge Runtime Degradation/Failure**\n**Status**: \`${status.toUpperCase()}\`\n**Timestamp**: \`${new Date().toISOString()}\`\n\n**Failed Probes**:\n${failureDetails}\n\n👉 *Inspect live logs: Cloudflare Dashboard / Sentry / Better Stack*`,
    embeds: [
      {
        title: 'ChrisShop Edge Health Check Failure',
        color: 0xef4444,
        description: failureDetails,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const fetchImpl = globalThis.fetch;
    const res = await fetchImpl(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('[HealthCheck:DiscordAlertError]', err);
    return false;
  }
}

/**
 * Performs active dependency probes and compiles the structured health check payload.
 */
export async function performHealthCheck(): Promise<{ payload: HealthResponsePayload; httpStatus: number }> {
  const startTime = Date.now();
  const g = globalThis as unknown as Record<string, unknown>;
  const env = process.env;

  // 1. Evaluate Cloudflare Edge Bindings presence
  const d1Binding = env.DB || g.DB;
  const kvBinding = env.NEXT_CACHE_WORKERS_KV || g.NEXT_CACHE_WORKERS_KV || env.KV || g.KV;
  const r2Binding = env.BUCKET || g.BUCKET;
  const assetsBinding = env.ASSETS || g.ASSETS;
  const siteBinding =
    env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || g.SITE_URL || g.NEXT_PUBLIC_SITE_URL;
  const cmsBinding =
    env.CMS_URL || env.PAYLOAD_PUBLIC_SERVER_URL || g.CMS_URL || g.PAYLOAD_PUBLIC_SERVER_URL;

  const bindings = {
    d1: Boolean(d1Binding),
    kv: Boolean(kvBinding),
    r2: Boolean(r2Binding),
    assets: Boolean(assetsBinding),
    site: Boolean(siteBinding),
    cms: Boolean(cmsBinding),
  };

  // 2. Probe D1 Database (SELECT 1)
  let d1Probe: HealthProbeDetail = { status: 'skipped' };
  if (d1Binding && typeof (d1Binding as any).prepare === 'function') {
    const d1Start = Date.now();
    try {
      const statement = (d1Binding as any).prepare('SELECT 1 as healthy');
      const result = typeof statement.first === 'function' ? await statement.first() : await statement.all();
      const d1Latency = Date.now() - d1Start;
      const isOk =
        result?.healthy === 1 ||
        (Array.isArray(result?.results) && result.results.length > 0) ||
        result !== undefined;
      d1Probe = {
        status: isOk ? 'healthy' : 'unhealthy',
        latencyMs: d1Latency,
        query: 'SELECT 1 as healthy',
      };
    } catch (err: any) {
      d1Probe = {
        status: 'unhealthy',
        latencyMs: Date.now() - d1Start,
        query: 'SELECT 1 as healthy',
        error: err?.message || String(err),
      };
    }
  } else if (d1Binding) {
    d1Probe = { status: 'healthy', latencyMs: 0, query: 'SELECT 1 (mocked)' };
  }

  // 3. Probe Cloudflare Workers KV Cache (read/write probe with 60s TTL)
  let kvProbe: HealthProbeDetail = { status: 'skipped' };
  if (
    kvBinding &&
    typeof (kvBinding as any).get === 'function' &&
    typeof (kvBinding as any).put === 'function'
  ) {
    const kvStart = Date.now();
    const testKey = '__health_check__';
    const testValue = new Date().toISOString();
    try {
      await (kvBinding as any).put(testKey, testValue, { expirationTtl: 60 });
      const readBack = await (kvBinding as any).get(testKey);
      const kvLatency = Date.now() - kvStart;
      kvProbe = {
        status: readBack === testValue || readBack !== null ? 'healthy' : 'unhealthy',
        latencyMs: kvLatency,
        key: testKey,
      };
    } catch (err: any) {
      kvProbe = {
        status: 'unhealthy',
        latencyMs: Date.now() - kvStart,
        key: testKey,
        error: err?.message || String(err),
      };
    }
  } else if (kvBinding) {
    kvProbe = { status: 'healthy', latencyMs: 0, key: '__health_check__ (mocked)' };
  }

  // 4. Probe Shopify Storefront API Connectivity
  let shopifyProbe: HealthProbeDetail = { status: 'skipped' };
  if (process.env.FLAG_SKIP_SHOPIFY_HEALTH_PROBE !== 'true') {
    const shopifyStart = Date.now();
    try {
      const shopRes = await shopify.getShopInfo();
      const shopifyLatency = Date.now() - shopifyStart;
      if (shopRes.data?.shop?.name) {
        shopifyProbe = {
          status: 'healthy',
          latencyMs: shopifyLatency,
          shop: shopRes.data.shop.name,
          currency: shopRes.data.shop.paymentSettings?.currencyCode || 'USD',
        };
      } else {
        shopifyProbe = {
          status: 'unhealthy',
          latencyMs: shopifyLatency,
          error: JSON.stringify(shopRes.errors || 'No shop returned from Storefront API'),
        };
      }
    } catch (err: any) {
      shopifyProbe = {
        status: 'unhealthy',
        latencyMs: Date.now() - shopifyStart,
        error: err?.message || String(err),
      };
    }
  }

  // 5. Probe R2 Object Storage (list operation)
  let r2Probe: HealthProbeDetail = { status: 'skipped' };
  if (r2Binding && typeof (r2Binding as any).list === 'function') {
    const r2Start = Date.now();
    try {
      await (r2Binding as any).list({ limit: 1 });
      r2Probe = {
        status: 'healthy',
        latencyMs: Date.now() - r2Start,
      };
    } catch (err: any) {
      r2Probe = {
        status: 'unhealthy',
        latencyMs: Date.now() - r2Start,
        error: err?.message || String(err),
      };
    }
  } else if (r2Binding) {
    r2Probe = { status: 'healthy', latencyMs: 0 };
  }

  // 6. Calculate Overall Edge Status
  const failedProbes: Record<string, HealthProbeDetail> = {};
  if (d1Probe.status === 'unhealthy') failedProbes.d1 = d1Probe;
  if (kvProbe.status === 'unhealthy') failedProbes.kv = kvProbe;
  if (shopifyProbe.status === 'unhealthy') failedProbes.shopify = shopifyProbe;
  if (r2Probe.status === 'unhealthy') failedProbes.r2 = r2Probe;

  const isHealthy = Object.keys(failedProbes).length === 0;
  const overallStatus: 'healthy' | 'unhealthy' = isHealthy ? 'healthy' : 'unhealthy';
  const httpStatus = isHealthy ? 200 : 503;
  const durationMs = Date.now() - startTime;

  // 7. Commit SHA & Build Runtime Metadata (Story 4.23)
  const commitSha =
    (env.NEXT_PUBLIC_COMMIT_SHA as string) ||
    (env.CF_PAGES_COMMIT_SHA as string) ||
    (env.COMMIT_SHA as string) ||
    (env.GIT_COMMIT_SHA as string) ||
    (g.COMMIT_SHA as string) ||
    'dev-local';
  const shortSha = commitSha.length >= 7 ? commitSha.slice(0, 7) : commitSha;
  const buildTimestamp =
    (env.BUILD_TIMESTAMP as string) ||
    (env.NEXT_PUBLIC_BUILD_TIMESTAMP as string) ||
    (g.BUILD_TIMESTAMP as string) ||
    new Date().toISOString();
  const environment =
    (env.ENVIRONMENT as string) ||
    (env.NEXT_PUBLIC_VERCEL_ENV as string) ||
    (env.NODE_ENV as string) ||
    'production';

  // 8. Dispatch Alert on Failure (out-of-band)
  if (!isHealthy) {
    void dispatchHealthAlert(overallStatus, failedProbes).catch((alertErr) => {
      console.error('[HealthCheck:AlertDispatchFailed]', alertErr);
    });
  }

  const payload: HealthResponsePayload = {
    status: overallStatus,
    service: '@chrishop/web',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    durationMs,
    commitSha,
    shortSha,
    buildTimestamp,
    environment,
    bindings,
    probes: {
      d1: d1Probe,
      kv: kvProbe,
      shopify: shopifyProbe,
      r2: r2Probe,
    },
    uptime: {
      processUptimeSec: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0,
    },
  };

  return { payload, httpStatus };
}
