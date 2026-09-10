# Dependency Specification: Cloudflare Platform (`DEP_CLOUDFLARE.md`)

This document specifies the unified edge platform architecture, service bindings, environment topologies, and operational procedures for **Cloudflare**, the primary infrastructure provider for ChrisShop.

---

## 1. Architectural Decision Record: Cloudflare-Native Infrastructure

### Why We Are Migrating to Cloudflare

This rationale is preserved verbatim from Issue #88 as the official architectural decision record.

#### The Problem with the VPS Approach

The two-VPS architecture (2× Hetzner CPX12 at ~$28/mo) solved environment isolation, but created ongoing **developer maintenance obligations** that are disproportionate to the scale of this project:

- SSH access management, key rotation, and `known_hosts` hygiene
- OS-level patching (Ubuntu kernel updates, `apt upgrade`, unattended-upgrades monitoring)
- Docker Engine and Docker Compose plugin version management
- Ansible playbook maintenance as OS and Docker APIs evolve
- cloud-init boot script correctness across Ubuntu LTS versions
- Manual Directus image version pinning and upgrade testing
- VPS-level backup cron job correctness, monitoring, and restore testing
- Two separate environments to keep in sync (staging config drift is a real risk)

None of this delivers product value. Every hour spent on VPS maintenance is an hour not spent on storefront features, product drops, or Chris's revenue.

#### Why Cloudflare Solves This

Cloudflare Workers eliminates the entire class of server maintenance. The deployment model is `git push` → automatic global edge deployment. There is no server to patch, no SSH key to rotate, no Docker image to upgrade, no backup cron to monitor. Cloudflare manages the runtime, global distribution, and availability SLA.

#### Why Directus Cannot Work on Cloudflare

Directus is a persistent Node.js server that requires a long-lived process, a writable filesystem for extensions, and a server-side database connection pool. None of these are available in a Workers environment. Directus fundamentally cannot run on Cloudflare without a VPS — which defeats the entire purpose of the migration.

#### Why Payload CMS v3 Is the Right Replacement

Payload CMS v3 is architected to run _inside_ a Next.js App Router application as standard route handlers. This means:

- Payload admin UI is served at `/admin/*` routes within the same Workers deployment — no second server
- Schema is defined in TypeScript code (`payload.config.ts`) — version controlled naturally, no `snapshot.yaml` sync ceremony
- Official `@payloadcms/db-d1-sqlite` adapter (stable, v3.87+) connects directly to Cloudflare D1
- Works with `@opennextjs/cloudflare` adapter on Workers Paid plan

#### Cost Comparison (12-Month Horizon)

| Architecture                               | Monthly     | Annual       |
| :----------------------------------------- | :---------- | :----------- |
| Two Hetzner CPX12 VPS + Vercel             | ~$28/mo     | ~$336/yr     |
| Cloudflare Workers Paid (includes D1 + KV) | ~$5/mo      | ~$60/yr      |
| **Savings**                                | **~$23/mo** | **~$276/yr** |

#### Why Workers KV Is NOT a Database Replacement

Workers KV is eventually consistent and has no relational model. It is correct only as a **read cache** on top of D1 — not as the primary database. Cloudflare D1 (SQLite-compatible, strongly consistent, relational) is the correct database tier.

---

## 2. Cloudflare Service Topology & Capabilities

ChrisShop uses Cloudflare as an all-in-one edge platform:

1. **Cloudflare Workers**:
   - Runtime for Next.js App Router and Payload CMS v3 via `@opennextjs/cloudflare`.
   - Node.js compatibility enabled (`nodejs_compat`).
   - Deployment entrypoint: `.open-next/worker.js`.
2. **Cloudflare D1 (Serverless Relational Database)**:
   - Primary database for Payload CMS collections (`products`, `product_variations`, `categories`).
   - SQLite-compatible engine with global read replication and zero connection-pool bottlenecks.
3. **Workers KV (High-Speed Edge Read Cache)**:
   - Cache store for Next.js Incremental Static Regeneration (ISR) and memoized query results.
   - Sub-15ms edge read latencies globally.
4. **Cloudflare R2 (S3-Compatible Object Storage)**:
   - Media storage for product photography, edition artwork, and certificates.
   - Zero egress bandwidth charges.
5. **Edge Security & CDN**:
   - Global CDN caching static assets and immutable media.
   - Web Application Firewall (WAF), rate limiting, and Turnstile anti-bot challenges.
   - Automatic TLS 1.3 certificate management with HSTS.

---

## 3. Configuration & Bindings (`wrangler.toml`)

All Cloudflare bindings are defined declaratively in `wrangler.toml`:

```toml
name = "chrishop"
main = ".open-next/worker.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# D1 Relational Database Binding
[[d1_databases]]
binding = "DB"
database_name = "chrishop-prod-db"
database_id = "d1-prod-id"

# KV Cache Binding
[[kv_namespaces]]
binding = "NEXT_CACHE_WORKERS_KV"
id = "kv-cache-prod-id"

# R2 Object Storage Binding
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "chrishop-media-prod"

[env.staging]
name = "chrishop-staging"
[[env.staging.d1_databases]]
binding = "DB"
database_name = "chrishop-staging-db"
database_id = "d1-staging-id"

[[env.staging.kv_namespaces]]
binding = "NEXT_CACHE_WORKERS_KV"
id = "kv-cache-staging-id"

[[env.staging.r2_buckets]]
binding = "BUCKET"
bucket_name = "chrishop-media-staging"
```

---

## 4. Local Development with Miniflare

Local development requires zero external daemon processes. Running `pnpm dev` uses `wrangler dev`, which utilizes Miniflare to emulate:

- **D1**: Local SQLite storage stored in `.wrangler/state/v3/d1`.
- **KV**: Local key-value store in memory and filesystem.
- **R2**: Local filesystem-backed object storage emulator.

---

## 5. Security & Access Control

- **Workers Secrets**: Sensitive keys (`SHOPIFY_ADMIN_TOKEN`, `PAYLOAD_SECRET`, `RESEND_API_KEY`) are stored as Cloudflare Workers Secrets using `wrangler secret put <NAME>`.
- **API Tokens**: Cloudflare API Token for GitHub Actions CI/CD requires minimal scoped permissions:
  - `Account.Workers Scripts: Edit`
  - `Account.D1: Edit`
  - `Account.Workers KV Storage: Edit`
  - `Account.Workers R2 Storage: Edit`
  - `Zone.DNS: Edit`

---

## 6. Verification & Operational Health

- **Deployment Verification**:
  ```bash
  wrangler whoami
  wrangler d1 list
  wrangler kv:namespace list
  wrangler r2 bucket list
  ```
- **Rollback Procedure**:
  ```bash
  wrangler rollback <deployment-id>
  ```
