# Drop Day High-Concurrency Load Testing & Edge Resilience Runbook (`docs/runbooks/DROP_DAY_RESILIENCE.md`)

This operational runbook defines the architecture, automated load testing procedures, edge caching parameters, Shopify rate limit backoff strategies, and incident escalation protocols for **ChrisShop limited-edition flash drops** per **Story 4.10 (#148)**.

---

## 1. Drop Day Traffic Mechanics & Concurrency Profile

Chris's business model centers on scheduled, limited-edition outdoor gear drops (e.g. 50–250 handcrafted units per drop). Flash drops induce extreme concurrency spikes at the exact drop second ($T=0$):

```
       [ Drop Second T=0 ]
Traffic ▲               ████ (Phase B & C: Synchronized PDP + Cart Burst)
  (RPS) │             ████████
        │           ████████████
        │       ██████████████████ (Phase A: 500+ Buyers Polling Countdown)
        │ ░░░░░░████████████████████████░░░░░░
        └────────────────────────────────────────► Time
          T-15m   T-5m    T=0    T+2m    T+10m
```

### Key Concurrency Targets:
- **Phase A (Pre-Drop Anticipation)**: 500+ concurrent virtual buyers polling the drop countdown timer and catalog (`/` and `/products`).
- **Phase B (Drop Release Surge)**: Synchronized burst to product detail pages (`/products/[slug]`) within 500ms of countdown expiration.
- **Phase C (Cart Mutation Race)**: 200+ concurrent `POST /api/cart/create` requests racing for allocated edition stock.
- **Phase D (Checkout Redirection)**: Sub-10ms redirection to Shopify Hosted Checkout URLs (`https://${domain}/checkouts/c/...`).

---

## 2. Multi-Layer Edge Defense Architecture

To prevent database query saturation, edge CPU exhaustion, and Shopify Storefront API rate limits (leaky bucket 429s), ChrisShop implements 5 concentric defense layers:

| Layer | Defense Mechanism | Configuration / Header | Purpose & Protection |
| :--- | :--- | :--- | :--- |
| **Layer 1** | **Cloudflare Turnstile** | `mode = "managed"`<br>`TURNSTILE_RATE_LIMIT_MAX = 10` | Blocks headless scrapers, bot swarms, and automated checkout scalpers. |
| **Layer 2** | **Edge CDN S-Maxage Cache** | `public, s-maxage=10, stale-while-revalidate=50` | Shields Cloudflare D1 from read queries; serves cached catalog data in < 15ms. |
| **Layer 3** | **Buyer IP Forwarding** | `Shopify-Storefront-Buyer-IP: <client-ip>` | Forwards client IP from `CF-Connecting-IP` to prevent Shopify from pooling edge requests under a single worker IP. |
| **Layer 4** | **Leaky Bucket Exponential Backoff** | Full jitter: `baseDelay * 2^(attempt-1) + jitter`<br>`maxRetries = 3` | Smooths Shopify 429/THROTTLED bursts; absorbs transient Storefront API rate limits. |
| **Layer 5** | **Emergency Circuit Breakers** | `FLAG_EMERGENCY_KILL_SWITCH`<br>`FLAG_DISABLE_CHECKOUT` | Instantly disables cart and checkout mutations at the edge without requiring code deployment. |

---

## 3. Concurrency Simulation Harness (`tests/load/drop-surge.ts`)

The automated load testing scenario evaluates end-to-end resilience under simulated drop surges without requiring third-party SaaS load platforms.

### Running the Load Test
```bash
# Execute standard 250-buyer drop surge simulation
pnpm run test:load

# Execute customized load scenario with 500 concurrent virtual buyers
pnpm exec tsx tests/load/drop-surge.ts --concurrency=500

# Run against a live preview or local dev server
pnpm exec tsx tests/load/drop-surge.ts --concurrency=250 --url=http://127.0.0.1:3000
```

### Performance & Resilience SLA Gates

Every execution of `pnpm run test:load` validates the following empirical gates:

1. **Simulated Concurrency Execution**: Successfully executes 100–500 virtual buyer journeys across Phases A through D.
2. **Edge Catalog Latency Gate**: p95 edge latency for catalog and product detail browsing remains strictly below **150ms** (typical: 8–18ms under cache hit).
3. **Edge Error Rate Gate**: Overall error rate remains strictly below **0.10%** across the entire simulation run.
4. **Cart Creation Resilience**: At least **95%** of valid cart creation requests complete successfully with valid Shopify checkout URLs.
5. **D1 Read Shielding**: Edge cache hit ratio must exceed **95%** on catalog browsing, shielding D1 SQLite from flash drop query exhaustion.

---

## 4. Shopify Storefront API Rate Limit & Backoff Protocol

Shopify enforces a leaky bucket rate limiting algorithm on the Storefront API with a maximum capacity of 50 cost points and a leak rate of 50 points per second. Under burst conditions, requests may receive HTTP 429 or GraphQL `THROTTLED` extensions.

### Client Retry Mechanics (`apps/web/src/lib/shopify.ts`)
```typescript
public calculateBackoffDelay(attempt: number, retryAfterSec?: number): number {
  const jitter = Math.random() * 50;
  if (retryAfterSec !== undefined && !isNaN(Number(retryAfterSec))) {
    return Number(retryAfterSec) * 1000 + jitter;
  }
  return this.baseDelayMs * Math.pow(2, attempt - 1) + jitter;
}
```

### Human-Friendly Error Translation (`/api/cart/create`)
Under extreme saturation or when stock is depleted:
- **HTTP 429 Too Many Requests**: Returns `"Drop traffic is surging! We're queuing your request, please retry in a moment."` with `Retry-After: 2` header.
- **HTTP 400 Out of Stock**: Returns `"The requested limited edition drop item is currently out of stock or reserved by another buyer."`
- **HTTP 503 Circuit Breaker**: Returns `"Checkout is temporarily paused during maintenance. Please check back shortly."`

---

## 5. Drop Day Operational Runbook & War Room Checklist

### T-60 Minutes: Pre-Drop Preparation
1. **Edge Health Audit**: Verify `/api/health` returns `200 OK` with all bindings healthy (`d1`, `kv`, `r2`, `shopify`).
2. **Verify Feature Flags**: Ensure `FLAG_DISABLE_CHECKOUT` and `FLAG_EMERGENCY_KILL_SWITCH` are `false`.
3. **Execute Pre-Drop Load Benchmark**: Run `pnpm run test:load` to ensure latency percentiles are within SLA.

### T-15 Minutes: Edge Cache Pre-Warming
1. Issue warmup GET requests to `/` and `/products` from multiple global regions to populate edge cache.
2. Verify `Cache-Control: public, s-maxage=10, stale-while-revalidate=50` headers are active.

### T=0: Flash Drop Release
1. Monitor Cloudflare Analytics dashboard for:
   - Worker execution duration (p95 < 50ms)
   - Edge HTTP status codes (2xx > 99.5%, 429 < 0.5%, 5xx < 0.01%)
   - Turnstile challenge solve rate
2. Monitor Shopify Admin: Real-time orders and Storefront API API call volume.

### Incident Escalation & Mitigation
| Symptom | Probable Cause | Immediate Action |
| :--- | :--- | :--- |
| **Catalog p95 > 250ms** | D1 read query bottleneck or cache miss storm | Verify `s-maxage=10` headers; inspect Cloudflare Edge cache ratio. |
| **Spike in 429 from Shopify** | Shared IP throttling (missing buyer IP) | Verify `Shopify-Storefront-Buyer-IP` header forwarding from edge. |
| **Bot / Scraper Flood** | Turnstile challenge bypass or misconfiguration | Verify `CLOUDFLARE_TURNSTILE_SECRET_KEY` in Wrangler secrets; set Turnstile mode to `managed` or `interactive`. |
| **Unrecoverable Service Degradation** | Upstream commerce disruption | Trip circuit breaker: `wrangler secret put FLAG_DISABLE_CHECKOUT` -> `true`. |
