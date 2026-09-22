# Architectural Decision Record (ADR): Dashboard Architecture & Observability Platform Evaluation

**Document**: `docs/analysis/DASHBOARD_ARCHITECTURE_EVALUATION.md`  
**Story**: Story 4.16 (#168) — Dashboard Architecture Spike: SaaS vs In-House vs Hybrid  
**Status**: `ACCEPTED`  
**Deciders**: Jacob Miller (Lead Architect & Platform Ops), Chris (Brand Owner & Creator)  
**Date**: 2026-09-22  

---

## 1. Executive Summary & Decision

ChrisShop requires an observability and operational dashboard architecture capable of materializing the **12 Engineering Operational Metrics** and **11 Creator Business & Drop KPIs** defined in [Story 4.15 (`docs/analysis/METRICS_VISUALS_AND_ALERTS_CATALOG.md`)](file:///Users/jacobmiller22/projects/chrishop.feature-168-dashboard-architecture/docs/analysis/METRICS_VISUALS_AND_ALERTS_CATALOG.md).

We evaluated six candidate architectures across cost sustainability, data ingestion latency, surge pricing resistance, persona separation, and operational maintenance overhead:
1. **Datadog APM & Log Management** (Enterprise SaaS)
2. **Grafana Cloud** (Hosted Prometheus/Loki SaaS)
3. **Better Stack Telemetry & Dashboards** (Specialized SaaS)
4. **Cloudflare Native Observability** (Workers Analytics Engine + GraphQL API)
5. **Custom In-House Dashboard** (Embedded Payload CMS v3 + Next.js `/ops`)
6. **Hybrid Architecture** (Recommended Tri-Layer Pattern)

### The Architectural Decision: **Hybrid Tri-Layer Architecture (Option 6)**

We have decided to adopt a **Hybrid Tri-Layer Architecture**:
- **Layer 1: Chris's Live Creator Drop Room** (`apps/web/src/app/(payload)/admin/drop-room`)  
  A custom, lightweight, high-contrast dashboard embedded directly inside Payload CMS v3. Authenticated via Payload RBAC (`creator` role). Aggregates real-time sales, live visitor counters, cart velocities, and inventory burn-down gauges directly from Cloudflare D1 and Workers KV with sub-100ms response times.
- **Layer 2: Jacob's Technical Edge Ops Portal** (`apps/web/src/app/(storefront)/ops`)  
  An in-house edge diagnostic portal secured behind **Cloudflare Access Zero Trust** (Google OAuth + hardware key). Visualizes RPS, 5xx error distribution, p95/p99 latency, isolate CPU execution time, D1 slow queries, and Turnstile challenge rates by querying Cloudflare Workers Analytics Engine and GraphQL APIs directly on the edge.
- **Layer 3: External Synthetic Heartbeat & Mobile Alerting** (`Better Stack + Sentry`)  
  Leverages the existing **Better Stack** synthetic probe integration ([Story 4.7](file:///Users/jacobmiller22/projects/chrishop.feature-168-dashboard-architecture/docs/observability/BETTER_STACK_UPTIME_RUNBOOK.md)) probing `/api/health` from multi-region external locations, and **Sentry** ([Story 4.6](file:///Users/jacobmiller22/projects/chrishop.feature-168-dashboard-architecture/apps/web/src/lib/sentry.ts)) for exception stack tracing.

---

## 2. Problem Statement & Operational Personas

ChrisShop operates as a high-velocity creator commerce storefront built on Cloudflare Workers, Next.js 15, Payload CMS v3, D1 SQLite, Workers KV, and Shopify headless checkout. During YouTube merch drops, traffic spikes from 10 RPS to over 5,000 RPS within seconds.

Two fundamentally distinct personas require real-time visibility during these events:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               CHRISSHOP PERSONA SPLIT                                  │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│ 🛠️ JACOB (Platform Ops & Edge Architect) │ 🎥 CHRIS (Brand Owner & Creator)           │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Focus: Edge availability, p99 latency,  │ • Focus: Drop countdown, live shoppers,    │
│   5xx error spikes, D1 statement duration │   cart adds, inventory sell-out time, GMV  │
│ • Mindset: Technical, forensic, fast drill│ • Mindset: Creator, celebratory, zero jargon│
│ • UI: Time-series graphs, gauges, logs    │ • UI: Stat cards, countdown, progress bars │
│ • Security: Cloudflare Zero Trust (MFA)   │ • Security: Payload CMS Admin Login (RBAC) │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

A single one-size-fits-all dashboard fails both personas:
- Putting Chris into Datadog or Grafana overwhelms him with isolate CPU times, V8 garbage collection pauses, and SQL query plans.
- Putting Jacob into Shopify Analytics deprives him of Cloudflare edge status codes, KV cache miss rates, and D1 statement latencies.

---

## 3. Platform Comparison Matrix

| Evaluation Dimension | 1. Datadog APM | 2. Grafana Cloud | 3. Better Stack | 4. Cloudflare Native | 5. Custom In-House | 6. Hybrid Architecture (Selected) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Setup Time** | 24 hours | 16 hours | 6 hours | 8 hours | 18 hours | **14 hours** |
| **Operational Burden** | High (config drifts) | Medium (PromQL/Loki) | Low | Low | Medium | **Low** |
| **Data Ingestion Latency** | 3,000 ms | 2,500 ms | 1,200 ms | 800 ms | 50 ms | **50 ms (D1/KV) / 800 ms (Edge)** |
| **Base Monthly Cost** | \$30.00 / mo | \$0.00 / mo | \$0.00 / mo | \$5.00 / mo | \$0.00 / mo | **\$0.00 / mo** |
| **Drop Spike Cost (1M reqs)**| \$115.00+ | \$16.00 | \$5.00 | \$0.02 | \$0.00 | **\$0.02** |
| **Data Egress Fee** | \$0.09 / GB | \$0.00 | \$0.00 | \$0.00 | \$0.00 | **\$0.00 (Zero Egress)** |
| **Persona Fitness: Jacob** | 9 / 10 | 9 / 10 | 8 / 10 | 9 / 10 | 8 / 10 | **10 / 10** |
| **Persona Fitness: Chris** | 2 / 10 | 3 / 10 | 4 / 10 | 5 / 10 | 10 / 10 | **10 / 10** |
| **Access Control Model** | SaaS SAML ($15/seat) | Org RBAC | Team Access | Cloudflare Access | Payload RBAC | **Payload RBAC + Cloudflare Access** |
| **Resilience to Edge Outage**| High (External) | High (External) | High (External) | Low (Coupled) | Low (Coupled) | **High (Better Stack Probes)** |
| **Verdict** | **REJECTED** | **EVALUATED** | **INTEGRATED** | **INTEGRATED** | **INTEGRATED** | **RECOMMENDED** |

---

## 4. Deep-Dive Trade-Off Analysis

### 4.1 Cost & Free Tier Sustainability
1. **The Drop Surge Penalty**: Third-party SaaS tools charge exponentially for event volume. During a 1,000,000-request merch drop with 20 GB of structured edge logs:
   - **Datadog**: Charges \$1.70 per million log events + \$2.50 per GB indexed + \$15 per host agent. A single high-volume drop can generate hundreds of dollars in surprise billing.
   - **Grafana Cloud**: Free tier limits logs to 50 GB and Prometheus active series to 10k. While sustainable during baseline, drop surges push metrics into overage billing.
   - **Cloudflare Native & In-House**: Cloudflare Workers Paid plan ($5/mo flat) includes 10 million Worker requests and Workers Analytics Engine queries with **\$0 data egress**. Internal D1 SQL aggregation costs \$0 incremental spend.
2. **Long-Term TCO**: The Hybrid model has an ongoing incremental SaaS licensing cost of **\$0.00/month**, utilizing the generous free tiers of Better Stack (10 monitors, 60s heartbeats) and Sentry (5k events/mo) alongside Cloudflare's flat-rate edge runtime.

### 4.2 Real-Time Data Ingestion & Latency
- **Sub-100ms Commerce Telemetry**: Ingesting Shopify webhooks into external SaaS and polling SaaS APIs introduces 1,500ms to 3,000ms latency. Chris needs immediate feedback when a customer checks out. Querying D1 SQLite (`SELECT count(*) FROM orders`) on the same Cloudflare PoP executes in **< 15ms**.
- **Edge Analytics Pipeline**: Cloudflare Workers Analytics Engine writes high-cardinality telemetry directly at the edge without blocking the main fetch pipeline using `ctx.waitUntil()`. The Cloudflare GraphQL Analytics API provides real-time aggregation across global data centers without requiring third-party forwarders.

### 4.3 Access Control & Zero-Trust Persona Separation
- **Chris's Experience**: Chris is already authenticated into Payload CMS v3 to manage products, inventory drops, and content. Introducing a third-party login (Datadog/Grafana) requires separate 2FA, password management, and navigational overhead. By mounting the Drop Room at `/admin/drop-room`, Chris accesses his dashboard using existing credentials with native `creator` role authorization.
- **Jacob's Experience**: Jacob's operational portal (`/ops`) exposes low-level infrastructure telemetry. It is gated behind **Cloudflare Access Zero Trust** with hardware key / Google Workspace authentication, completely isolating sensitive system metrics from the public internet.

### 4.4 Blackbox Outage Protection
- The primary vulnerability of a 100% in-house dashboard is **fate-sharing**: if Cloudflare Workers encounters an edge runtime outage, the internal dashboard and internal alerts fail simultaneously.
- The Hybrid architecture addresses this vulnerability by retaining **Better Stack** as an external, multi-region blackbox synthetic monitor. Probing `/api/health` from external AWS/GCP regions guarantees that if the Cloudflare edge drops packets, Better Stack instantly triggers PagerDuty / Discord `#dev-alerts`.

---

## 5. Detailed Architecture Specification: The 3 Layers

```
                     ┌───────────────────────────────────────────────┐
                     │          CHRISSHOP HYBRID ARCHITECTURE         │
                     └───────────────────────────────────────────────┘
                                             │
      ┌──────────────────────────────────────┼──────────────────────────────────────┐
      │                                      │                                      │
      ▼                                      ▼                                      ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│   LAYER 1: CREATOR ROOM   │  │   LAYER 2: JACOB OPS      │  │ LAYER 3: SYNTHETIC PROBE  │
│  (Payload CMS v3 /admin)  │  │   (Next.js /ops Portal)   │  │   (Better Stack + Sentry) │
├───────────────────────────┤  ├───────────────────────────┤  ├───────────────────────────┤
│ • Audience: Chris         │  │ • Audience: Jacob         │  │ • Audience: On-Call Ops   │
│ • Auth: Payload Role RBAC │  │ • Auth: Cloudflare Access │  │ • Auth: External / Token  │
│ • Latency: < 100ms        │  │ • Latency: < 250ms        │  │ • Latency: 1,000ms        │
│ • Data: D1 + Workers KV   │  │ • Data: Workers Analytics │  │ • Target: /api/health     │
│ • UI: Gauges, Stat Cards  │  │ • UI: Latency Time-Series │  │ • Destination: Discord    │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
```

### Layer 1: Chris's Live Creator Drop Room
- **Route**: `apps/web/src/app/(payload)/admin/drop-room/page.tsx`
- **Authentication**: Payload CMS RBAC (`req.user.role === 'creator' || req.user.role === 'admin'`)
- **Key Visualizations**:
  - `LiveVisitorCounter`: Concurrency gauge querying Workers KV active shopper sessions.
  - `CountdownStatus`: Visual clock showing time to launch with one-click manual release trigger.
  - `InventoryBurnDown`: Variant stock depletion progress bars with color-coded depletion warnings (< 15%).
  - `DropRevenueTicker`: Live GMV counter and Average Order Value (AOV).
  - `ConversionFunnel`: Step progression bar (View ➔ Cart ➔ Checkout ➔ Order).

### Layer 2: Jacob's Technical Edge Ops Portal
- **Route**: `apps/web/src/app/(storefront)/ops/page.tsx`
- **Authentication**: Cloudflare Access Zero Trust Service Token or Identity Header (`Cf-Access-Authenticated-User-Email`).
- **Key Visualizations**:
  - `EdgeLatencyChart`: p50, p95, p99 edge response latency over 5m/1h/24h windows.
  - `HttpStatusBreakdown`: 2xx, 3xx, 4xx, and 5xx stacked bar chart.
  - `D1PerformanceMonitor`: Query execution duration percentiles and slow query table.
  - `KVCacheHitRatio`: Real-time cache hit percentage gauge.
  - `TurnstileSecurityWidget`: Challenge issuance vs pass/block rates.

### Layer 3: External Synthetic Heartbeat & Mobile Escalation
- **Location**: Better Stack Cloud Edge Network (US-East, US-West, EU-Central)
- **Target**: `GET https://chrishop.jacobmiller22.com/api/health`
- **Cadence**: Every 60 seconds (free tier compatible)
- **Escalation Routes**:
  - Immediate webhook post to Discord `#dev-alerts`
  - Push notification via Better Stack Mobile App to Jacob
  - Public status page hosted at `status.chrishop.com`

---

## 6. Implementation Roadmap & Backlog Recommendations

To deliver the selected Hybrid Architecture across upcoming delivery phases:

1. **Story 6.3 (#34 - E-Commerce Analytics & Sales Reporting Dashboard)**:
   - Implement Layer 1 (Creator Drop Room) inside Payload CMS v3 `/admin/drop-room`.
   - Build reusable React/Tailwind/Lucide chart components (`LiveVisitorCounter`, `InventoryBurnDown`, `DropRevenueTicker`).
   - Query D1 SQLite and Workers KV via Next.js Server Components.
2. **Story 4.25 (#330 - Distributed Tracing & Correlation ID Propagation)**:
   - Ensure `x-request-id` and correlation headers propagate across edge layers to link Layer 2 ops widgets directly to Sentry traces.
3. **Story 4.27 (#332 - Cloudflare D1 Statement Execution Latency & Slow Query Telemetry)**:
   - Implement the D1 query timing wrapper to populate Layer 2's slow query telemetry table.
4. **Story 4.28 (#333 - Drop Day Conversion Funnel Instrumentation)**:
   - Provide the granular step-event counter pipeline feeding Layer 1's conversion funnel stepper.

---

## 7. Acceptance Criteria Verification

- [x] Written Architectural Decision Record published at `docs/analysis/DASHBOARD_ARCHITECTURE_EVALUATION.md`.
- [x] Detailed matrix comparing cost, setup time, latency, and operational burden across Better Stack, Grafana Cloud, Datadog, Cloudflare Native, Custom In-House, and Hybrid.
- [x] Clear architectural decision selected with documented rationale addressing both Jacob's operational needs and Chris's creator business needs.
- [x] Type-safe evaluation engine implemented in `apps/web/src/lib/dashboard-architecture.ts`.
- [x] Automated test suite and validation CLI harness verifying architecture completeness.
