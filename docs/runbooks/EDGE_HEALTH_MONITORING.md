# Edge Health Checks & Synthetic Monitoring Runbook (`docs/runbooks/EDGE_HEALTH_MONITORING.md`)

This operational runbook documents the architecture, synthetic probe mechanics, HTTP status gating, alerting channels, and external uptime monitoring for the **ChrisShop** edge application at `/api/health`.

---

## 1. Architectural Overview

The `/api/health` endpoint runs on the Cloudflare Workers edge runtime (`workerd`). It performs active, multi-layer dependency probes across all edge resources and external commerce APIs before returning an aggregated health status.

### Endpoint Specifications
- **Route**: `GET /api/health`
- **Runtimes**: Cloudflare Workers (production & staging), Next.js local development
- **Latency SLA**: < 500ms
- **Caching**: `Cache-Control: no-store` (zero caching)
- **Security**: `X-Content-Type-Options: nosniff`

---

## 2. Active Dependency Probes

| Dependency | Probe Type | Probe Mechanics | Success Criteria | Failure Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare D1** | Active Query | `SELECT 1 as healthy` via `env.DB.prepare()` | Returns `{ healthy: 1 }` | Critical: returns HTTP 503 |
| **Workers KV** | Active Read/Write | Puts `__health_check__` with 60s TTL and reads back | Read matches written timestamp | Critical: returns HTTP 503 |
| **Shopify Storefront** | GraphQL Ping | Calls `shopify.getShopInfo()` | Returns store name & `currencyCode: USD` | Critical: returns HTTP 503 |
| **Cloudflare R2** | Bucket Ping | `env.BUCKET.list({ limit: 1 })` | Lists zero or more objects without error | Warning / degraded: returns HTTP 503 if bound |

---

## 3. Response Schemas & HTTP Status Gating

### Healthy Response (`HTTP 200 OK`)
When all bound dependencies pass their respective probes:
```json
{
  "status": "healthy",
  "service": "@chrishop/web",
  "runtime": "cloudflare-workers",
  "timestamp": "2026-09-22T11:20:00.000Z",
  "durationMs": 8,
  "bindings": {
    "d1": true,
    "kv": true,
    "r2": true,
    "assets": true,
    "site": true,
    "cms": true
  },
  "probes": {
    "d1": {
      "status": "healthy",
      "latencyMs": 2,
      "query": "SELECT 1 as healthy"
    },
    "kv": {
      "status": "healthy",
      "latencyMs": 3,
      "key": "__health_check__"
    },
    "shopify": {
      "status": "healthy",
      "latencyMs": 4,
      "shop": "ChrisShop Leadville Workshop",
      "currency": "USD"
    },
    "r2": {
      "status": "healthy",
      "latencyMs": 1
    }
  },
  "uptime": {
    "processUptimeSec": 3600
  }
}
```

### Unhealthy Response (`HTTP 503 Service Unavailable`)
If any probe throws or returns an error:
```json
{
  "status": "unhealthy",
  "service": "@chrishop/web",
  "runtime": "cloudflare-workers",
  "timestamp": "2026-09-22T11:20:05.000Z",
  "durationMs": 15,
  "bindings": {
    "d1": true,
    "kv": true,
    "r2": true,
    "assets": true,
    "site": true,
    "cms": true
  },
  "probes": {
    "d1": {
      "status": "unhealthy",
      "latencyMs": 12,
      "query": "SELECT 1 as healthy",
      "error": "D1 connection timeout"
    },
    "kv": {
      "status": "healthy",
      "latencyMs": 2,
      "key": "__health_check__"
    },
    "shopify": {
      "status": "healthy",
      "latencyMs": 3,
      "shop": "ChrisShop Leadville Workshop"
    },
    "r2": {
      "status": "healthy",
      "latencyMs": 1
    }
  },
  "uptime": {
    "processUptimeSec": 3605
  }
}
```

---

## 4. Discord `#dev-alerts` Notification Dispatch

When an edge health probe fails:
1. The route triggers an out-of-band asynchronous notification to Discord `#dev-alerts`.
2. Target webhook URL resolution order:
   - `process.env.DISCORD_WEBHOOK_DEV_ALERTS`
   - `process.env.DISCORD_WEBHOOK_ALERTS`
   - `process.env.OPS_ALERT_WEBHOOK_URL`
3. Payload format:
   - Mentions status (`UNHEALTHY`)
   - Lists exact failing probes with error messages and latencies
   - Links to Cloudflare Dashboard and Sentry for incident triage

---

## 5. Better Stack Uptime Monitoring Configuration

ChrisShop integrates with **Better Stack Uptime** (formerly Better Uptime) for external global edge synthetic monitoring.

### Setup Instructions
1. Navigate to **Better Stack Dashboard → Monitors → Create Monitor**.
2. **Monitor Type**: `URL / HTTP`
3. **URL to monitor**:
   - Production: `https://chrishop.jacobmiller22.com/api/health`
   - Staging: `https://staging-chrishop.jacobmiller22.com/api/health`
4. **Monitoring settings**:
   - **Check frequency**: `30 seconds`
   - **Request timeout**: `5 seconds`
   - **HTTP method**: `GET`
   - **Expected HTTP status**: `200`
   - **Keyword match**: Check that response body contains `"status":"healthy"`
5. **Alerting rules**:
   - Escalate to on-call engineer if monitor fails from 2 or more global edge locations.
   - Dispatch alerts to Discord `#dev-alerts` and Better Stack mobile push notifications.
6. Store Better Stack API Token:
   ```bash
   pnpm exec wrangler secret put BETTER_STACK_UPTIME_KEY --env production
   ```

---

## 6. Incident Triage & Troubleshooting Guide

### Issue: D1 Probe Failure (`probes.d1.status = 'unhealthy'`)
- Check Cloudflare D1 status page.
- Verify D1 binding name is `DB` in `wrangler.toml`.
- Run `pnpm exec wrangler d1 execute chrishop-prod-db --remote --command "SELECT 1"`.
- If database was restored or rotated, verify binding database ID matches `wrangler.toml`.

### Issue: KV Probe Failure (`probes.kv.status = 'unhealthy'`)
- Verify KV binding `NEXT_CACHE_WORKERS_KV` is correctly configured in `wrangler.toml`.
- Verify KV namespace ID exists on Cloudflare account: `pnpm exec wrangler kv:namespace list`.

### Issue: Shopify Probe Failure (`probes.shopify.status = 'unhealthy'`)
- Verify Shopify status page (status.shopify.com).
- Check `SHOPIFY_STOREFRONT_TOKEN` validity via `pnpm run verify:shopify`.
- Check if rate limits were triggered during drop events.
