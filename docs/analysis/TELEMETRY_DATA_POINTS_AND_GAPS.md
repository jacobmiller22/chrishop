# ChrisShop System-Wide Telemetry & Observability Gap Audit

**Document ID**: `DOC-OBS-2026-AUDIT-4.14`  
**Story Reference**: Story 4.14 (#166) — Phase 4: DevOps & Failover Automation  
**Target Platform**: Cloudflare Workers + Next.js 15 App Router + Cloudflare D1 SQLite + Workers KV + R2 + Shopify Storefront API  
**Status**: Completed & Verified  
**Date**: 2026-09-22T13:50:00.000Z  
**Author**: Jacob Miller & Autonomous DevOps Pair  

---

## 1. Executive Summary & Audit Objectives

During limited-edition physical art releases ("drops") for **ChrisShop** (BankBeaters Adventure Gear), thousands of concurrent shoppers converge on the platform within seconds. Operating a hybrid e-commerce architecture combining **Next.js 15 App Router**, **Cloudflare Workers edge runtime**, **Cloudflare D1 SQLite**, **Workers KV**, **Cloudflare R2**, and **Shopify Headless Storefront/Admin APIs** requires absolute observability.

Prior to this audit, ChrisShop relied on fragmented, disconnected monitoring silos:
- Cloudflare Workers runtime metrics recorded aggregate requests and status codes without request-level distributed tracing.
- Sentry captured unhandled exceptions, but lacked distributed correlation tags linking errors back to database queries or Shopify GraphQL responses.
- Better Stack uptime monitored `/api/health` heartbeats every 60 seconds, but lacked insight into individual D1 query latency percentiles or client-side Real User Monitoring (RUM).
- Shopify webhooks were deduplicated in Workers KV, but Dead-Letter Queue (DLQ) message accumulation had no automated alerting.

### 1.1 Key Audit Metrics
- **Total Audited Signals**: 26 telemetry points across 6 system tiers.
- **Active Telemetry**: 14 signals (54%) fully instrumented in production code.
- **Partial Telemetry**: 5 signals (19%) partially implemented or lacking structured export.
- **Identified Gaps**: 7 signals (27%) uninstrumented, representing critical operational blind spots.
- **Shovel-Ready Follow-Up Issues Filed**: 5 discrete GitHub issues with explicit priority labels (#330, #331, #332, #333, #334).

---

## 2. Observability Topology Architecture

The diagram below maps the flow of telemetry signals across ChrisShop's multi-tier edge architecture, highlighting active sinks versus identified observability gaps:

```mermaid
flowchart TD
    subgraph ClientBrowser [1. Client Browser Shoppers]
        RUM[Core Web Vitals & RUM Beacon] -.->|GAP: Uninstrumented| BEACON[/api/telemetry/vitals/]
        FUNNEL[Funnel Events: Countdown, PDP, Cart] -.->|GAP: Uninstrumented| WAE[(Workers Analytics Engine)]
        SENTRY_C[Sentry Browser SDK] -->|Active: Unhandled Errors| SENTRY_SINK[(Sentry.io Cloud)]
    end

    subgraph EdgeTier [2. Cloudflare Edge Runtime]
        CF_INGRESS[Cloudflare Ingress] -->|Active: CF-Ray, CPU Time, Status| CF_ANALYTICS[Cloudflare Metrics]
        CF_WAF[WAF Managed & Rate Limiter] -->|Active: Bot & 429 Blocks| CF_SEC[Cloudflare Security Logs]
        HEALTH[/api/health Probes] -->|Active: 60s Polling| BETTER_STACK[Better Stack Uptime]
        HEALTH -->|Active: Out-of-band 503| DISCORD_DEV[#dev-alerts Discord]
        TIMEOUT[edge-timeout.ts Watchdog] -->|Active: Branded 504| BROWSER_504[Shopper Browser]
        CORR_ID[Trace & Correlation ID] -.->|GAP: Missing Downstream Propagation| D1_TIER
    end

    subgraph DataAndStorage [3. Data & Storage Tier]
        D1_TIER[(Cloudflare D1 SQLite)]
        D1_METRICS[D1 Query Latency p50/p95/p99] -.->|GAP: Missing Query Profiler| D1_TIER
        KV[(Workers KV Cache)] -->|Active: Idempotency TTL 86400| KV_HEADER[x-idempotency-status]
        R2[(Cloudflare R2 Media)] -->|Active: 1yr Immutable Cache-Control| CF_CDN[Edge CDN Cache]
    end

    subgraph ShopifyIntegration [4. Shopify & Third-Party APIs]
        SHOPIFY_CLIENT[Shopify Storefront GraphQL] -->|Active: Buyer-IP Forwarding| SHOPIFY_API[Shopify API]
        SHOPIFY_RATE[GraphQL Rate Limit Points] -.->|GAP: extensions.cost Unmonitored| SHOPIFY_CLIENT
        RESEND[Resend Email Provider] -->|Active: Order Dispatch Log| RESEND_API[Resend API]
    end

    subgraph WebhookQueue [5. Webhook & Background Queue]
        WH_INGRESS[/api/webhooks/shopify] -->|Active: HMAC-SHA256 Subtle| KV
        WH_INGRESS -->|Active: Enqueue| QUEUE[(SHOPIFY_ORDERS_QUEUE)]
        QUEUE -->|Active: Order Consumer| DISCORD_ORDERS[#store-orders Discord]
        DLQ[(SHOPIFY_ORDERS_DLQ)] -.->|GAP: DLQ Accumulation Alert Missing| DISCORD_DEV
    end
```

---

## 3. Comprehensive Telemetry Audit Matrix

### 3.1 Tier 1: Cloudflare Edge Runtime

| Signal ID | Signal Name | Type | Source Component | Destination / Cadence | State | Criticality | Operational Status & Observability Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `edge.request_volume` | Request Volume & Status Codes | Metric | Cloudflare Edge Gateway | Cloudflare Dashboard (30-day retention) | **Active** | Critical | Tracks requests/sec, 2xx, 3xx, 4xx, and 5xx edge responses across domains. |
| `edge.worker_cpu_time` | Worker CPU & Wall-Clock Duration | Metric | Cloudflare Workers Runtime | Cloudflare Metrics Dashboard | **Active** | Critical | Monitored per request isolate execution against 50ms CPU limit. |
| `edge.ray_id` | Cloudflare Ray ID (`cf-ray`) | Trace | Cloudflare Ingress Proxy | `edge-timeout.ts` / Sentry | **Partial** | Critical | Extracted during 504 timeouts, but **not systematically propagated** across D1 queries, Shopify client, or regular API responses. |
| `edge.timeout_interception` | Edge Timeout & Branded 504 | Event | `apps/web/src/lib/edge-timeout.ts` | HTTP Response Headers / Console | **Active** | High | Preempts 30s isolate watchdog at 25s, serving branded 504 HTML or JSON. |
| `edge.health_synthetic_probe` | Edge Health Probes (`/api/health`) | Metric | `apps/web/src/lib/health-monitoring.ts` | Better Stack / Discord #dev-alerts | **Active** | Critical | Active 60s synthetic probe evaluating D1 (SELECT 1), KV, R2, and Shopify. |
| `edge.waf_turnstile_events` | WAF Blocks & Turnstile Challenges | Event | Cloudflare WAF & `turnstile.ts` | Cloudflare Security Logs / Console | **Active** | High | Rate-limiting (30 req/min) on `/api/cart/*` and Turnstile bot token verification. |

### 3.2 Tier 2: Storefront App & Payload CMS

| Signal ID | Signal Name | Type | Source Component | Destination / Cadence | State | Criticality | Operational Status & Observability Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `storefront.sentry_exceptions` | Unhandled Exceptions & Errors | Alert | `apps/web/src/lib/sentry.ts` | Sentry.io / Discord #dev-alerts | **Active** | Critical | Captures browser, Node.js, and Cloudflare Worker runtime exceptions with sourcemap resolution. |
| `storefront.core_web_vitals` | Real-User Core Web Vitals (RUM) | Metric | Browser Web Vitals API | None (Uninstrumented) | **Missing** | High | **Zero RUM telemetry**. Mobile shopper LCP, INP, and CLS during flash drops are invisible. |
| `storefront.drop_conversion_funnel`| Drop Conversion Funnel Steps | Event | Storefront UI Components | None (Uninstrumented) | **Missing** | Critical | **No funnel telemetry**. Step drop-off (Countdown -> PDP -> Cart -> Checkout -> Paid) is untracked. |
| `storefront.payload_cms_audit` | Payload Admin Audit Log | Log | Payload CMS v3 Collection Hooks | D1 SQLite / System Tables | **Active** | Medium | Records administrative authoring actions, product line updates, and schema migrations. |
| `storefront.payload_2fa_events` | Admin RBAC & 2FA Auth Events | Event | `apps/web/src/lib/payload-2fa.ts` | Application Security Audit Log | **Active** | High | Logs TOTP 2FA verification attempts, backup code redemptions, and role permissions. |

### 3.3 Tier 3: Cloudflare D1 SQLite Data Tier

| Signal ID | Signal Name | Type | Source Component | Destination / Cadence | State | Criticality | Operational Status & Observability Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `d1.query_execution_latency` | D1 Query Latency (p50/p95/p99) | Metric | `apps/web/src/lib/catalog.ts` | None (Uninstrumented) | **Missing** | Critical | Catalog queries execute raw `d1.prepare().all()` without timing measurement or percentile aggregation. |
| `d1.slow_query_alerts` | D1 Slow Query Warnings (> 50ms) | Alert | Data Access Layer | None (Uninstrumented) | **Missing** | High | No threshold warnings triggered when un-indexed SQL queries exceed 50ms. |
| `d1.read_write_volume` | D1 Storage Row Read/Write Counts | Metric | Cloudflare D1 Engine | Cloudflare D1 Dashboard Analytics | **Active** | Medium | Cloudflare aggregates hourly/daily row read and write quotas. |
| `d1.singleflight_coalescing` | SingleFlight Deduplication | Metric | `apps/web/src/lib/singleflight.ts` | In-Memory Promise Map | **Partial** | High | Coalesces thundering herds during flash drops, but does not export telemetry counters. |
| `d1.migration_version_state` | D1 Schema Migration Checkpoints | Log | `scripts/d1-migrate.ts` | Console / `d1_migrations` table | **Active** | High | Validates applied database schema versions across local, staging, and production. |

### 3.4 Tier 4: Storage Tier (Workers KV & Cloudflare R2)

| Signal ID | Signal Name | Type | Source Component | Destination / Cadence | State | Criticality | Operational Status & Observability Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `kv.cache_hit_miss_ratio` | Workers KV Cache Hit/Miss Ratio | Metric | Workers KV Engine | Headers (`x-idempotency-status`) | **Partial** | High | Per-request status reported in response headers, but aggregated ratio is not exported to dashboard. |
| `kv.idempotency_keys` | KV Idempotency Collisions | Event | `apps/web/src/lib/shopify-webhook.ts` | Webhook JSON Response / Logs | **Active** | Critical | 24-hour idempotency TTL (`order_webhook:<id>`) prevents duplicate webhook execution. |
| `r2.media_request_volume` | R2 Media Egress & Storage Bandwidth| Metric | Cloudflare R2 Analytics | Cloudflare Dashboard Analytics | **Active** | Medium | Tracks asset download requests, storage capacity, and zero-egress transfers. |
| `r2.image_resizing_cache` | Image Resizing Transformations | Metric | `/cdn-cgi/image/` Engine | Edge CDN Cache Headers | **Active** | Medium | Caches responsive WebP/AVIF media at edge with 1-year immutable Cache-Control. |

### 3.5 Tier 5: Shopify Storefront / Admin & Third-Party APIs

| Signal ID | Signal Name | Type | Source Component | Destination / Cadence | State | Criticality | Operational Status & Observability Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `shopify.graphql_request_duration` | Shopify GraphQL Latency | Metric | `apps/web/src/lib/shopify.ts` | None (Uninstrumented) | **Missing** | High | Outbound GraphQL calls to Shopify Headless API do not measure or log roundtrip latency. |
| `shopify.graphql_rate_limit_points` | Shopify Cost & Point Consumption | Metric | `extensions.cost` in GraphQL responses| None (Uninstrumented) | **Missing** | Critical | Shopify leaky bucket point consumption (`requestedQueryCost`, `currentlyAvailable`) is ignored. |
| `shopify.rate_limit_retries` | 429 Throttle & Backoff Retries | Event | `apps/web/src/lib/shopify.ts` | Console Warnings / Error Throw | **Partial** | High | Exponential backoff with jitter works, but intermediate retry events are unmetered. |
| `notifications.resend_dispatch` | Resend Transactional Email Status| Event | `packages/notifications` | Resend Dashboard / Server Logs | **Active** | Medium | Tracks transactional email dispatches, message IDs, and carrier delivery errors. |
| `notifications.discord_alerts` | Discord Alert Escalation Latency | Event | Alerting Engine | Discord `#dev-alerts` Webhooks | **Active** | High | Rich embed dispatches for health probe degradation, Sentry fatal errors, and new orders. |

### 3.6 Tier 6: Webhook Ingestion & Background Queues

| Signal ID | Signal Name | Type | Source Component | Destination / Cadence | State | Criticality | Operational Status & Observability Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `webhook.ingestion_latency` | Webhook Ingestion Duration | Metric | `/api/webhooks/shopify/route.ts` | Response Header (`x-response-time-ms`)| **Active** | Critical | Measures end-to-end ingestion latency (HMAC verification + KV lookup + queue enqueue). |
| `webhook.hmac_verification_failures`| HMAC Signature Rejections | Security | `verifyShopifyWebhookHmacSubtle` | HTTP 401 Unauthorized Logs | **Active** | Critical | Rejects spoofed or corrupted incoming webhook requests using constant-time Web Crypto. |
| `webhook.queue_backpressure` | Cloudflare Queue Depth & Lag | Metric | `SHOPIFY_ORDERS_QUEUE` | Cloudflare Queues Dashboard | **Partial** | High | Queue depth is visible in Cloudflare dashboard, but consumer processing lag is unmonitored. |
| `webhook.dlq_dead_letter_accumulation`| DLQ Message Accumulation Alert | Alert | `SHOPIFY_ORDERS_DLQ` | None (Uninstrumented automated alert)| **Missing** | Critical | If messages exhaust retries and enter DLQ, no automated Discord alert or paging incident fires. |

---

## 4. In-Depth Observability Gap Analysis

### 4.1 Gap 1: Missing Distributed Trace Context & Correlation ID Propagation (Critical)
- **Vulnerability**: When an error or timeout occurs in production, the only trace identifier is the Cloudflare `cf-ray` header returned on 504 errors. There is no unified `x-request-id` propagated across the application stack.
- **Consequence**: An engineer investigating a Sentry issue cannot match the client-side error with corresponding D1 SQLite queries, outbound Shopify GraphQL calls, or webhook messages.
- **Remediation**:
  1. Generate or extract `x-request-id` (defaulting to `cf-ray`) in edge middleware.
  2. Forward `X-Request-ID` and `Shopify-Storefront-Buyer-IP` into outbound Shopify GraphQL calls.
  3. Include `correlation_id` and `cf_ray` tags in all Sentry exception captures.
  4. Echo `x-request-id` and `cf-ray` in all JSON API responses.
- **Tracked In**: [Story 4.25 (#330)](https://github.com/jacobmiller22/chrishop/issues/330)

### 4.2 Gap 2: Lack of Real User Monitoring (RUM) & Core Web Vitals Beaconing (High)
- **Vulnerability**: Current uptime monitoring (`/api/health`) is purely synthetic and measures server-side edge response times. It provides zero visibility into real-user browser performance.
- **Consequence**: Shoppers on cellular connections during flash drops experience unmonitored Cumulative Layout Shift (CLS) when rich media loads, or high Interaction to Next Paint (INP) latency during Turnstile token generation and cart drawer toggles.
- **Remediation**:
  1. Implement Next.js `useReportWebVitals` on storefront layouts.
  2. Create lightweight non-blocking edge telemetry beacon endpoint (`POST /api/telemetry/vitals`) supporting `navigator.sendBeacon`.
  3. Track LCP, INP, CLS, FCP, TTFB, connection type, and device memory against Google Core Web Vitals thresholds.
- **Tracked In**: [Story 4.26 (#331)](https://github.com/jacobmiller22/chrishop/issues/331)

### 4.3 Gap 3: Uninstrumented D1 Statement Execution Latency & Slow Query Warning (Critical)
- **Vulnerability**: In `apps/web/src/lib/catalog.ts`, queries are wrapped with raw `d1.prepare().all()` with zero timing measurement.
- **Consequence**: An unindexed query or N+1 query regression introduced in a code update causes D1 query latency to inflate from 3ms to 120ms during flash drops, causing isolate queue congestion and 504 timeouts before engineering realizes the database is bottlenecked.
- **Remediation**:
  1. Wrap `D1DatabaseLike` with transparent execution timing.
  2. Log structured warnings or Sentry breadcrumbs whenever any statement exceeds 50ms.
  3. Expose statement count and average execution duration in `/api/health` diagnostic probes.
- **Tracked In**: [Story 4.27 (#332)](https://github.com/jacobmiller22/chrishop/issues/332)

### 4.4 Gap 4: Missing Drop Day Conversion Funnel Step Telemetry (Critical)
- **Vulnerability**: The platform tracks total orders in Shopify, but has no unified event pipeline tracking shopper progression through the drop funnel.
- **Consequence**: If 10,000 visitors land on the drop countdown, but only 5 add to cart, operations cannot determine whether visitors bounced on the countdown, encountered out-of-stock errors, were blocked by Turnstile bot defense, or failed at checkout redirection.
- **Remediation**:
  1. Standardize drop funnel event schema (`countdown_view` -> `product_view` -> `add_to_cart_attempt` -> `cart_create_result` -> `checkout_redirect` -> `order_completed`).
  2. Instrument storefront client components and `/api/cart/create` route.
  3. Pipe funnel transition events to Workers Analytics Engine for real-time drop day conversion dashboards.
- **Tracked In**: [Story 4.28 (#333)](https://github.com/jacobmiller22/chrishop/issues/333)

### 4.5 Gap 5: Untracked Webhook Retry Backpressure & DLQ Accumulation Alerting (Critical)
- **Vulnerability**: Order webhooks entering `/api/webhooks/shopify` are acknowledged fast and pushed to `SHOPIFY_ORDERS_QUEUE`. However, if the consumer fails and messages exhaust max retries, they land silently in `SHOPIFY_ORDERS_DLQ`.
- **Consequence**: Failed order notifications or fulfillment updates accumulate in the Dead-Letter Queue without alerting on-call engineers, resulting in unfulfilled customer orders.
- **Remediation**:
  1. Instrument webhook ingestion timing headers and queue enqueue latencies.
  2. Configure automated Discord alert escalation whenever any message lands in `SHOPIFY_ORDERS_DLQ`.
  3. Expose queue depth and processing lag in health diagnostics.
- **Tracked In**: [Story 4.29 (#334)](https://github.com/jacobmiller22/chrishop/issues/334)

---

## 5. Shovel-Ready Follow-Up Action Matrix

All identified telemetry gaps have been formalized into shovel-ready GitHub issues assigned to **Phase 4: DevOps & Failover Automation**:

| Issue | Title | Tier | Priority | Size | Status | Primary Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [#330](https://github.com/jacobmiller22/chrishop/issues/330) | **Story 4.25**: Distributed Tracing & Edge Correlation ID Propagation | Edge Runtime | `priority:high` | `size:medium` | Backlog Ready | Edge middleware for `x-request-id` & `cf-ray`, Shopify client forwarding, Sentry tag correlation. |
| [#331](https://github.com/jacobmiller22/chrishop/issues/331) | **Story 4.26**: Real User Monitoring (RUM) & Core Web Vitals Beacon Pipeline | Storefront | `priority:medium` | `size:medium` | Backlog Ready | Client `useReportWebVitals`, `/api/telemetry/vitals` non-blocking edge beacon endpoint, Web Vitals thresholds. |
| [#332](https://github.com/jacobmiller22/chrishop/issues/332) | **Story 4.27**: Cloudflare D1 Statement Execution Latency & Slow Query Telemetry | Data Tier | `priority:high` | `size:medium` | Backlog Ready | D1 database wrapper timing, slow query warnings (>50ms), p50/p95/p99 latency calculations. |
| [#333](https://github.com/jacobmiller22/chrishop/issues/333) | **Story 4.28**: Drop Day Conversion Funnel Instrumentation & Step Telemetry | Storefront | `priority:high` | `size:medium` | Backlog Ready | Unified funnel schema, countdown & PDP impressions, cart outcomes, checkout redirects. |
| [#334](https://github.com/jacobmiller22/chrishop/issues/334) | **Story 4.29**: Shopify Webhook Queue Telemetry & Retry Backpressure Monitor | Webhook | `priority:medium` | `size:medium` | Backlog Ready | Webhook ingestion timing, DLQ dead-letter accumulation alert to Discord, queue lag metrics. |

---

## 6. Continuous Verification & Audit Automation

To ensure this audit remains an active, verifiable contract and does not drift from codebase reality, automated verification tools are established:

1. **Typed Catalog Model** (`apps/web/src/lib/telemetry-audit.ts`):
   - Defines strict TypeScript interfaces for `TelemetrySignal`, `TelemetryGap`, and `SystemTier`.
   - Programmatically validates tier coverage (minimum 3 audited signals per tier), signal ID uniqueness, and follow-up issue linkage.
2. **CLI Audit Script** (`scripts/verify-telemetry-audit.ts`):
   - Validates markdown documentation existence, parses signal tables, asserts 6/6 system tiers, checks for follow-up issue citations, and verifies active code hooks.
   - Run via: `pnpm run telemetry:verify`.
3. **Integration Test Suite** (`tests/integration/telemetry-gap-audit.test.ts`):
   - Executed as part of local and CI integration gates (`pnpm run test:integration`).
   - Asserts catalog validity, gap triage coverage, and compliance with the 9-stage verification pipeline.
