# Better Stack Uptime Monitoring Operational Runbook (`docs/observability/BETTER_STACK_UPTIME_RUNBOOK.md`)

This operational runbook defines the architecture, configuration matrix, automated synchronization, alerting policies, public status page, and incident simulation procedures for **ChrisShop** external synthetic uptime monitoring via **Better Stack**.

---

## 1. Architectural Overview & Objectives (Story 4.7)

ChrisShop leverages **Better Stack Uptime** (free tier compatible) to conduct continuous, external blackbox synthetic heartbeat checks against the `/api/health` endpoint across global regions.

```
+-----------------------------------------------------------------------------------+
|                        Better Stack Global Synthetic Probes                       |
|               (US East, US West, Europe, Asia-Pacific Multi-Region)                |
+-----------------------------------------------------------------------------------+
                                         │
                 HTTP GET /api/health (Every 60s, Timeout 5s)
                                         ▼
+-----------------------------------------------------------------------------------+
|                          Cloudflare Workers Edge Runtime                          |
|                       https://chrishop.jacobmiller22.com                          |
|                                                                                   |
|  Active Subsystem Probes:                                                         |
|  ├─ D1 Database Probe:      SELECT 1 as healthy                                   |
|  ├─ Workers KV Probe:       Read / Write __health_check__                         |
|  ├─ Shopify Storefront:     GraphQL ping                                          |
|  └─ Cloudflare R2 Probe:    Bucket listing                                        |
+-----------------------------------------------------------------------------------+
                     │                                            │
           Outage Detected (HTTP != 200)                  Recovery Confirmed
                     ▼                                            ▼
+------------------------------------------+  +-------------------------------------+
|        Better Stack Webhook Dispatch     |  |       Public Status Page Update     |
|   ├─ Event: incident.started             |  |      https://status.chrishop.com    |
|   ├─ Escalation to Discord #dev-alerts   |  |   ├─ Storefront & Customer Services |
|   └─ Push Notifications to On-Call Ops   |  |   ├─ Core Edge Infrastructure       |
+------------------------------------------+  |   └─ Admin & Security Systems       |
                                              +-------------------------------------+
```

### Key Objectives
1. **Zero Silent Outages**: Catch edge worker regressions, D1 database drops, or external API failures within 60 seconds.
2. **Deep Health Validation**: Validate HTTP 200 *and* JSON body keyword `"status":"healthy"`.
3. **Automated Escalation**: Immediately broadcast rich embed alerts to Discord `#dev-alerts`.
4. **Transparent Customer Communication**: Maintain real-time public status updates at `status.chrishop.com`.
5. **On-Call Verification Drills**: Safely simulate edge outages with zero downtime via `/api/health?simulate=500`.

---

## 2. Monitor Configuration Matrix

Better Stack probes are configured with 60-second polling frequencies (fully compatible with Better Stack free tier limits) and 5-second connection timeouts.

| Parameter | Production Storefront Monitor | Staging Storefront Monitor |
| :--- | :--- | :--- |
| **Monitor Name** | `ChrisShop Production Edge Health (/api/health)` | `ChrisShop Staging Edge Health (/api/health)` |
| **Target URL** | `https://chrishop.jacobmiller22.com/api/health` | `https://staging-chrishop.jacobmiller22.com/api/health` |
| **Check Frequency** | `60 seconds` | `60 seconds` |
| **Request Timeout** | `5 seconds` | `5 seconds` |
| **HTTP Method** | `GET` | `GET` |
| **Expected HTTP Status** | `200` | `200` |
| **Keyword Match** | `"status":"healthy"` | `"status":"healthy"` |
| **Probe Regions** | US (`us`), Europe (`eu`), Asia (`as`) | US (`us`) |
| **Follow Redirects** | `true` | `true` |
| **Alert Escalation** | Discord `#dev-alerts`, Email, Mobile Push | Discord `#dev-alerts` |

---

## 3. Discord `#dev-alerts` Escalation Format

When Better Stack detects an outage or recovery, incident webhooks are processed and dispatched to `#dev-alerts`.

### Down State Alert (`incident.started`)
- **Header**: `🚨 [Better Stack Uptime Alert] ChrisShop Production Edge Health (/api/health): DOWN`
- **Embed Color**: `0xef4444` (Crimson Red)
- **Embed Fields**:
  - `Monitor`: `ChrisShop Production Edge Health (/api/health)`
  - `Target URL`: `https://chrishop.jacobmiller22.com/api/health`
  - `Status`: `DOWN`
  - `HTTP Status`: e.g. `500` or `503`
  - `Probe Region`: e.g. `US-EAST`
  - `Incident Cause`: Detailed cause string from probe

### Resolved State Alert (`incident.resolved`)
- **Header**: `✅ [Better Stack Uptime Alert] ChrisShop Production Edge Health (/api/health): RESOLVED`
- **Embed Color**: `0x10b981` (Emerald Green)
- **Embed Fields**:
  - `Monitor`: `ChrisShop Production Edge Health (/api/health)`
  - `Target URL`: `https://chrishop.jacobmiller22.com/api/health`
  - `Status`: `RESOLVED`
  - `Downtime Duration`: e.g. `2.4 minutes`

---

## 4. Public Status Page Specification (`status.chrishop.com`)

The status page organizes monitored platform components into logical customer and infrastructure sections:

### Section 1: Storefront & Customer Services
- `Edge Storefront (Next.js 16 App Router)`
- `Checkout & Cart API`
- `R2 Static Media Assets`

### Section 2: Core Infrastructure & Dependencies
- `Edge Worker Runtime (Cloudflare Workers)`
- `Edge Database (Cloudflare D1 SQLite)`
- `Global KV Cache (Workers KV)`
- `Shopify Storefront API Integration`

### Section 3: Administrative & Security Systems
- `Payload CMS Admin Dashboard (/admin)`
- `Cloudflare Zero Trust Access Gate`

---

## 5. Simulated Downtime Drill & On-Call Testing

To verify uptime monitoring and alert escalation without taking down the production cluster, `/api/health` supports controlled outage simulation.

### Triggering a Simulated Outage
1. **Query Parameter**:
   ```bash
   curl -i "https://chrishop.jacobmiller22.com/api/health?simulate=500"
   ```
2. **HTTP Header**:
   ```bash
   curl -i -H "x-simulate-health-status: 500" "https://chrishop.jacobmiller22.com/api/health"
   ```

### Drill Response Payload (`HTTP 500 Internal Server Error`)
```json
{
  "status": "unhealthy",
  "service": "chrishop-edge-worker",
  "runtime": "cloudflare-workers",
  "timestamp": "2026-09-22T16:00:00.000Z",
  "durationMs": 5,
  "simulated": true,
  "error": "Simulated downtime drill (Story 4.7 / Better Stack Uptime Monitoring)",
  "probes": {
    "d1": { "status": "unhealthy", "error": "Simulated D1 connection timeout" },
    "kv": { "status": "healthy" },
    "shopify": { "status": "healthy" },
    "r2": { "status": "healthy" }
  }
}
```

Response Headers include:
- `x-simulated-outage: true`
- `cache-control: no-store`

---

## 6. CLI Automation Commands

ChrisShop provides first-class CLI automation via `scripts/better-stack-uptime.ts`:

### 1. Verify Configuration & Run Local Drill
```bash
pnpm run uptime:verify
```
Performs:
- Schema validation for Production and Staging monitors.
- In-memory execution of the simulated 500 drill against the Next.js API route.
- Discord alert payload compilation test (both down and resolved states).
- Status page resource map validation.

### 2. Synchronize Monitors with Better Stack API
```bash
export BETTER_STACK_API_TOKEN="<your_api_token>"
pnpm run uptime:sync
```
Synchronizes monitor configurations and public status page definitions directly with the Better Stack REST API.

---

## 7. Incident Response Playbook

When an uptime alert fires:

1. **Acknowledge the Alert**:
   - Check Discord `#dev-alerts`.
   - Acknowledge in Better Stack mobile app or dashboard to signal active triage.
2. **Inspect Subsystem Probes**:
   - Query `/api/health` directly without simulation:
     ```bash
     curl -s "https://chrishop.jacobmiller22.com/api/health" | jq .
     ```
   - Identify whether `d1`, `kv`, `shopify`, or `r2` reports `"status": "unhealthy"`.
3. **Execute Subsystem Recovery**:
   - **D1 Failure**: Run `pnpm run d1:rollback:info` or inspect Cloudflare D1 dashboard.
   - **Shopify Failure**: Verify status.shopify.com and check API credentials via `pnpm run verify:shopify`.
   - **Worker Failure**: Check Sentry error logs and initiate instant rollback if a bad release was deployed:
     ```bash
     pnpm run rollback
     ```
4. **Confirm Resolution**:
   - Ensure Better Stack probe returns green (`HTTP 200`).
   - Confirm `#dev-alerts` receives the green `RESOLVED` embed notification.
