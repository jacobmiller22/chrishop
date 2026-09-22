# ChrisShop Operational Metrics, Visualizations & Alerting Catalog

**Document ID**: `DOC-OBS-2026-CATALOG-4.15`  
**Story Reference**: Story 4.15 (#167) — Phase 4: DevOps & Failover Automation  
**Target Personas**: Engineering & Operations (Jacob) | Creator & Business (Chris)  
**Status**: Formal Specification Approved  
**Date**: 2026-09-22T14:15:00.000Z  
**Author**: Jacob Miller & Autonomous DevOps Pair  

---

## 1. Executive Summary & Persona Architecture

During a high-concurrency physical art release ("drop") for **ChrisShop** (BankBeaters Adventure Gear), platform visibility must cater simultaneously to two distinct operational personas with non-overlapping data requirements:

1. **Engineering & Operations (Jacob)**: Needs real-time edge telemetry, isolate CPU consumption, D1 SQLite query latencies, Workers KV hit ratios, Sentry exception volatility, and edge WAF block rates to defend platform uptime and SLAs (< 200ms p95 latency, 0% 5xx errors).
2. **Creator & Business (Chris)**: Needs high-level business intelligence, real-time shopper concurrency, cart reservation velocity, conversion funnel progress, live inventory burn-down per SKU, and total Gross Merchandise Value (GMV).

This catalog defines the formal specification for all metric expressions, time-series resolutions, chart types, dashboard card layouts, and alerting thresholds.

```mermaid
flowchart TD
    subgraph DataSources [Platform Telemetry Sources]
        CF_EDGE[Cloudflare Workers Runtime]
        D1_SQL[Cloudflare D1 SQLite]
        KV_STORE[Workers KV Cache]
        SENTRY_ERR[Sentry Exception Engine]
        SHOPIFY_GQL[Shopify Headless Storefront]
        WH_QUEUE[Shopify Orders Queue]
    end

    subgraph TelemetryPipelines [Catalog Aggregation Engine]
        ENG_CAT[Engineering Operational Metrics Engine]
        BIZ_CAT[Creator Business KPI Engine]
    end

    subgraph Dashboards [Persona Presentation Layer]
        ENG_DASH[Engineering Dashboard (Jacob)]
        BIZ_DASH[Creator Drop Dashboard (Chris)]
    end

    subgraph Escalations [Alert Escalation Sinks]
        DISCORD_DEV[Discord #dev-alerts]
        DISCORD_OPS[Discord #store-orders]
        PAGER_DUTY[PagerDuty On-Call Paging]
    end

    DataSources --> TelemetryPipelines
    ENG_CAT --> ENG_DASH
    BIZ_CAT --> BIZ_DASH
    ENG_CAT --> DISCORD_DEV
    ENG_CAT --> PAGER_DUTY
    BIZ_CAT --> DISCORD_OPS
```

---

## 2. Engineering & Operations Dashboard Specification

### 2.1 Dashboard Layout & Visual Grid (Jacob's View)

The Engineering Operational Dashboard prioritizes instantaneous anomaly detection and system health:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CHRISSHOP ENGINEERING & OPERATIONS MONITOR                      │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────────┤
│ [CARD] Edge Ingress│ [CARD] HTTP 5xx   │ [CARD] p95 Latency│ [GAUGE] Worker CPU         │
│ 1,420 RPS         │ 0.00% (Healthy)   │ 18.4 ms           │ 12.2 ms / 50ms Quota       │
├───────────────────┴───────────────────┴───────────────────┴────────────────────────────┤
│ [CHART: TIME-SERIES] Edge Response Latency (p50 / p95 / p99 Percentiles in ms)         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
├───────────────────────────────────────┬────────────────────────────────────────────────┤
│ [CHART] D1 Query Latency & Slow Queries│ [GAUGE] Workers KV Cache Hit Ratio (%)         │
│ Avg: 4.2ms | Slow (>50ms): 0.1%       │ 94.6% Cache Hit (Healthy)                      │
├───────────────────────────────────────┼────────────────────────────────────────────────┤
│ [CHART] Cloudflare WAF Block Rate     │ [TABLE] Active Sentry Exceptions & Better Stack│
│ 14 blocks/sec (Rate Limiting active)  │ 0 Unresolved Critical Errors | Probe: 24ms     │
└───────────────────────────────────────┴────────────────────────────────────────────────┘
```

### 2.2 Engineering Metric Catalog & Calculation Matrix

| Metric ID | Metric Name | Subsystem | Calculation Formula | Source Signal | Cadence | Widget | Warning Threshold | Critical Threshold |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `eng.edge_rps` | Edge Ingress (Throughput) | Edge | `sum(rate(worker_requests[1m]))` | Workers Analytics | 10s | Time-Series | > 2,000 RPS | > 5,000 RPS |
| `eng.http_5xx_rate` | Edge 5xx Error Rate | Edge | `(sum(5xx) / sum(total)) * 100` | Edge Access Logs | 10s | Stat Card | >= 0.5% (2m) | >= 1.0% (1m) -> PagerDuty |
| `eng.edge_latency_p95` | Edge Response Latency (p95)| Edge | `histogram_quantile(0.95)` | Worker Execution | 15s | Time-Series | > 300 ms | > 1,000 ms -> PagerDuty |
| `eng.edge_latency_p99` | Edge Response Latency (p99)| Edge | `histogram_quantile(0.99)` | Worker Execution | 15s | Time-Series | > 1,500 ms | > 5,000 ms -> PagerDuty |
| `eng.worker_cpu_time` | Worker Isolate CPU Time | Edge | `avg(cpu_time_ms)` | Worker Watchdog | 15s | Gauge | > 35 ms (70%) | > 45 ms (90%) -> PagerDuty |
| `eng.d1_query_latency` | D1 Query Execution Latency | Database| `avg(statement_duration_ms)` | `catalog.ts` | 15s | Time-Series | > 25 ms | > 50 ms |
| `eng.d1_slow_query_rate`| D1 Slow Query Rate (>50ms) | Database| `(count(>50ms) / count(total)) * 100`| Query Profiler | 30s | Stat Card | >= 2.0% | >= 5.0% |
| `eng.kv_cache_hit_ratio`| Workers KV Cache Hit Ratio | Storage | `(hits / (hits + misses)) * 100` | KV Engine | 30s | Gauge | < 70% | < 50% |
| `eng.sentry_unresolved` | Sentry Unresolved Errors | Health | `count(issues where unresolved)` | Sentry SDK | 30s | Stat Card | > 5 new issues | > 20 issues |
| `eng.probe_latency` | Better Stack Synthetic Probe| Health | `better_stack_probe_response_ms` | `/api/health` | 60s | Time-Series | > 800 ms | > 2,000 ms or 503 |
| `eng.waf_block_rate` | Cloudflare WAF Block Rate | Security | `sum(rate(waf_blocks[1m]))` | Edge Security | 15s | Time-Series | > 100 req/s | > 500 req/s |
| `eng.turnstile_pass` | Turnstile Challenge Pass % | Security | `(pass_count / total_challenges) * 100`| `turnstile.ts` | 30s | Gauge | < 60% | < 30% |

---

## 3. Creator & Business Drop Performance Dashboard Specification

### 3.1 Dashboard Layout & Visual Grid (Chris's View)

The Creator Dashboard prioritizes real-time revenue, conversion velocity, and limited-edition inventory status:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CHRISSHOP CREATOR & DROP LIVE MONITOR                           │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────────┤
│ [CARD] Gross GMV  │ [CARD] Orders     │ [CARD] Avg Order  │ [CARD] Active Shoppers     │
│ $42,650.00        │ 312               │ $136.70           │ 1,840 Live on Site         │
├───────────────────┴───────────────────┴───────────────────┴────────────────────────────┤
│ [CHART: FUNNEL] Drop Conversion Funnel (Real-Time Stepped Bar)                         │
│ Countdown (8,420) ──► Product View (5,120) ──► Cart Add (1,410) ──► Checkout (312 Paid) │
├───────────────────────────────────────┬────────────────────────────────────────────────┤
│ [CHART] Cart Creation Velocity        │ [GAUGE] Batch Inventory Remaining              │
│ 48 carts / minute (Surging)           │ 14% Remaining (42 / 300 Units)                 │
├───────────────────────────────────────┼────────────────────────────────────────────────┤
│ [STAT] Projected Sell-Out Time        │ [CHART] Inventory Burn-Down Rate               │
│ ⏱️ 6.2 Minutes Remaining              │ 18 units / minute sold                         │
└───────────────────────────────────────┴────────────────────────────────────────────────┘
```

### 3.2 Creator Metric Catalog & Calculation Matrix

| Metric ID | Metric Name | Category | Calculation Formula | Source Signal | Cadence | Widget | Milestone / Alert Threshold |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `biz.concurrent_visitors` | Real-Time Active Visitors | Traffic | `count(distinct client_ip [5m])`| Access Logs | 5s | Stat Card | Info: >= 1,000 Concurrent |
| `biz.countdown_views` | Drop Countdown Impressions | Traffic | `sum(rate(countdown_views[1m]))` | Component Telemetry| 10s | Time-Series | Pre-drop viewer build-up |
| `biz.cart_velocity` | Cart Creation Velocity | Funnel | `sum(rate(cart_create_success[1m])) * 60`| `/api/cart/create` | 5s | Time-Series | Info: >= 50 carts / minute |
| `biz.checkout_failures` | Checkout Handshake Failures | Funnel | `sum(cart_errors) + sum(redirect_failures)`| Checkout Route | 5s | Stat Card | **CRITICAL: > 0 (Handshake Broken)** |
| `biz.conversion_rate` | Overall Drop Conversion Rate| Funnel | `(count(orders) / count(viewers)) * 100`| Funnel Aggregator | 30s | Funnel Bar | Healthy benchmark: 4–8% |
| `biz.inventory_burn_rate`| Inventory Burn-Down Rate | Inventory| `sum(rate(units_depleted[1m])) * 60` | Webhooks / D1 | 10s | Time-Series | Real-time sales pace |
| `biz.projected_sell_out` | Projected Sell-Out Time | Inventory| `remaining_stock / burn_down_rate`| Inventory Model | 15s | Stat Card | Info: <= 5 minutes (Imminent) |
| `biz.inventory_percent` | Batch Inventory Remaining %| Inventory| `(current_stock / batch_total) * 100`| Live Catalog D1 | 10s | Gauge | Warning: <= 10% Low Stock |
| `biz.gross_gmv` | Gross Merchandise Value (GMV)| Revenue | `sum(order_total_price_usd)` | `orders/paid` | 10s | Stat Card | Milestone: $10k, $50k, $100k crossed |
| `biz.average_order_value`| Average Order Value (AOV) | Revenue | `sum(revenue) / count(orders)` | Order Consumer | 30s | Stat Card | Standard: $120–$180 |
| `biz.total_orders` | Total Completed Orders | Revenue | `count(orders_paid)` | Shopify Webhooks | 10s | Stat Card | Total orders fulfilled |

---

## 4. Visual Widget & Chart Selection Taxonomy

To prevent visual fatigue during high-stress drops, visual widgets are strictly mapped to metric data types:

| Widget Type | Data Characteristics | Best Used For | Anti-Pattern (When NOT to use) |
| :--- | :--- | :--- | :--- |
| **Stat Card (Single KPI)** | Scalar instant value with delta percentage | Total Revenue (GMV), Active Visitors, 5xx Error Rate | Never use for fluctuating time-series trends |
| **Time-Series Line Chart** | Continuous numerical values over time | Response Latency (p50/p95/p99), Requests/sec, Burn-down | Never use for static or cumulative counters |
| **Progress / Radial Gauge** | Bounded percentages (0% – 100%) or quota ceilings | Worker CPU Time (of 50ms), KV Cache Hit Ratio, Inventory % | Never use for unbounded counters (like revenue) |
| **Funnel Bar Chart** | Sequential discrete conversion steps | Countdown ➔ PDP ➔ Cart ➔ Checkout ➔ Order Paid | Never use for non-sequential parallel processes |
| **Log / Event Table** | Structured chronological incident streams | Sentry unhandled exceptions, WAF blocks, Slow query log | Never use for high-volume raw request streams |

---

## 5. Unified Alerting Rules & Escalation Matrix

Alerts are partitioned into three actionable severity levels with dedicated dispatch channels to prevent alarm fatigue:

```mermaid
flowchart LR
    A[Metric Exceeds Rule] --> B{Severity Tier}
    B -->|Critical (P1)| C[PagerDuty On-Call Paging + Discord #dev-alerts]
    B -->|Warning (P2)| D[Discord #dev-alerts (No Paging)]
    B -->|Milestone (Info)| E[Discord #store-orders (Creator Channel)]
```

### 5.1 Severity Matrix & On-Call Escalation SLAs

| Severity Tier | Definition & Impact | Dispatch Channels | SLA Acknowledgment | On-Call Action Runbook |
| :--- | :--- | :--- | :---: | :--- |
| **Critical (P1)** | Immediate drop revenue interruption (e.g. 5xx rate >= 1%, broken checkout handshakes, Better Stack 503). | **PagerDuty Phone/SMS Paging** + Discord `#dev-alerts` | **< 3 minutes** | 1. Check `/api/health` status.<br/>2. If upstream degraded, trigger operational circuit breaker.<br/>3. Execute Instant Worker Rollback if code regression. |
| **Warning (P2)** | Elevated risk of failure (e.g. p99 latency > 1500ms, KV cache hit ratio < 70%, D1 slow queries >= 2%). | **Discord `#dev-alerts`** (Rich Embed) | **< 15 minutes** | 1. Inspect slow query logs in D1.<br/>2. Check Cloudflare WAF block rate for bot attack.<br/>3. Verify cache headers. |
| **Info / Milestone** | Business achievements or low-stock alerts (e.g. $10k GMV milestone, 1,000 active shoppers, sell-out in 5 mins). | **Discord `#store-orders`** | No SLA (Informational) | Celebrate milestone, prepare post-drop fulfillment notifications. |

---

## 6. Continuous Verification & Tooling

To ensure the metric catalog remains synchronized with platform code:
- **Typed Model Engine**: `apps/web/src/lib/metrics-catalog.ts` provides complete TypeScript types, metric expressions, and validation rules.
- **Verification CLI**: `scripts/verify-metrics-catalog.ts` validates catalog integrity, schema constraints, and threshold definitions via `pnpm run metrics:verify`.
- **Integration Test Suite**: `tests/integration/metrics-catalog.test.ts` validates all 23 metric calculations, widget taxonomy, and alerting rules.
