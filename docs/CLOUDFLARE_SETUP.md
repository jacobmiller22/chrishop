# Cloudflare Operational Setup Guide (`docs/CLOUDFLARE_SETUP.md`)

This runbook guides operators, platform engineers, and automated agents through provisioning, configuring, deploying, and maintaining the complete Cloudflare platform suite (Workers, D1, Workers KV, R2, Secrets, and Custom Domains) for **ChrisShop**.

---

## 1. Architecture Overview & Environments

The ChrisShop platform runs on a serverless, zero-container edge deployment model using Cloudflare Workers and `@opennextjs/cloudflare` to co-locate the Next.js storefront and Payload CMS v3 under a single edge worker deployment.

The platform provides three distinct environments with configuration-as-code portability between personal Cloudflare accounts and dedicated production accounts:

| Environment | Branch | Custom Domain / Route (`jacobmiller22.com`) | Alternative Route | D1 Database | KV Namespace | R2 Bucket |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Production** | `main` | `chrishop.jacobmiller22.com/*` | `shop.jacobmiller22.com/*` | `chrishop-prod-db` | `NEXT_CACHE_WORKERS_KV` (prod) | `chrishop-media-prod` |
| **Staging** | `staging` | `staging-chrishop.jacobmiller22.com/*` | `staging-shop.jacobmiller22.com/*` | `chrishop-staging-db` | `NEXT_CACHE_WORKERS_KV` (staging) | `chrishop-media-staging` |
| **Preview** | PR branches | `pr-<PR_NUMBER>-chrishop.jacobmiller22.com` | `workers.dev` preview URL | `chrishop-preview-db` | `NEXT_CACHE_WORKERS_KV` (preview) | `chrishop-media-preview` |

---

## 2. Prerequisites & Authentication

1. **Cloudflare Account**: Workers Paid plan ($5/mo) enabled for custom domains, D1 databases, KV namespaces, and R2 buckets.
2. **Cloudflare API Token**: Created with the following permissions:
   - `Account` > `Workers Scripts` > `Edit`
   - `Account` > `Workers KV Storage` > `Edit`
   - `Account` > `D1` > `Edit`
   - `Account` > `Workers R2 Storage` > `Edit`
   - `Zone` > `Workers Routes` > `Edit`
   - `Zone` > `DNS` > `Edit`
3. **Local Tooling**:
   - Node.js 22+ (Active LTS)
   - pnpm 9+
   - Wrangler CLI v3+ (`pnpm exec wrangler`)

### Authenticate Locally
```bash
pnpm exec wrangler login
```

Verify your authenticated account ID:
```bash
pnpm exec wrangler whoami
```

### AI Agent & Antigravity MCP Integration

To enable Antigravity (and other AI coding assistants) to manage Cloudflare infrastructure, register Cloudflare's official remote MCP servers in `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "cloudflare": { "serverUrl": "https://mcp.cloudflare.com/mcp" },
    "cloudflare-docs": { "serverUrl": "https://docs.mcp.cloudflare.com/mcp" },
    "cloudflare-bindings": { "serverUrl": "https://bindings.mcp.cloudflare.com/mcp" },
    "cloudflare-builds": { "serverUrl": "https://builds.mcp.cloudflare.com/mcp" },
    "cloudflare-observability": { "serverUrl": "https://observability.mcp.cloudflare.com/mcp" }
  }
}
```

Install the official Cloudflare agent skills globally:
```bash
npx -y skills add cloudflare/skills --skill '*' --yes --global
```

---

## 3. D1 Relational Database Setup

Provision isolated SQLite-compatible D1 databases for each tier:

```bash
# 1. Create Staging D1 Database
pnpm exec wrangler d1 create chrishop-staging-db

# 2. Create Production D1 Database
pnpm exec wrangler d1 create chrishop-prod-db

# 3. Create Ephemeral Preview D1 Database
pnpm exec wrangler d1 create chrishop-preview-db
```

Each provisioning command outputs a unique `database_id` UUID. Bind these IDs in `wrangler.toml` under `[[d1_databases]]`, `[[env.staging.d1_databases]]`, and `[[env.preview.d1_databases]]`.

### 2.2 D1 Bindings in `wrangler.toml`

The ChrisShop monorepo declares D1 bindings across environments with the migrations directory configured:

```toml
# Production Cloudflare D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "chrishop-prod-db"
database_id = "<production-database-uuid>"
migrations_dir = "migrations"

# Staging Environment Configuration
[env.staging]
[[env.staging.d1_databases]]
binding = "DB"
database_name = "chrishop-staging-db"
database_id = "<staging-database-uuid>"
migrations_dir = "migrations"

# Ephemeral PR Preview Environment Configuration
[env.preview]
[[env.preview.d1_databases]]
binding = "DB"
database_name = "chrishop-preview-db"
database_id = "<preview-database-uuid>"
migrations_dir = "migrations"
```

### 2.3 Local Miniflare Emulation Setup

Cloudflare D1 runs locally via **Miniflare** in-process, without requiring Docker, PostgreSQL, or external daemon processes.

- **Local State Location**: Local SQLite state is persisted under `.wrangler/state/v3/d1`.
- **Git Hygiene**: `.wrangler/` is git-ignored to prevent ephemeral database state files from entering version control.
- **Turnkey Setup Script**: Run `./scripts/d1-local-setup.sh` or `pnpm run d1:setup` to apply initial migrations and verify tables and query indexes.

### 2.4 D1 Migrations Workflow

Migrations are stored in the `migrations/` directory and tracked in the `d1_migrations` table:

```bash
# 1. Author a new migration file
pnpm exec wrangler d1 migrations create chrishop-prod-db <migration_name>

# 2. Apply migrations to local Miniflare emulation
pnpm exec wrangler d1 migrations apply chrishop-prod-db --local
# or via npm script:
pnpm run d1:migrate:local

# 3. Apply migrations to remote staging
pnpm exec wrangler d1 migrations apply chrishop-staging-db --remote --env staging

# 4. Apply migrations to remote production
pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote
```

### 2.5 Query Execution & Verification

Verify database schema and query indexes using `wrangler d1 execute`:

```bash
# Execute query against local Miniflare SQLite
pnpm exec wrangler d1 execute chrishop-prod-db --local --command "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index');"

# Execute query against remote staging database
pnpm exec wrangler d1 execute chrishop-staging-db --remote --env staging --command "SELECT count(*) FROM products;"

# Execute query against remote production database
pnpm exec wrangler d1 execute chrishop-prod-db --remote --command "SELECT count(*) FROM products;"
```

---

## 4. Workers KV Namespace Setup (ISR Edge Cache)

Workers KV accelerates storefront performance by caching Next.js App Router Incremental Static Regeneration (ISR) pages and Payload API queries.

```bash
# 1. Create Staging KV Namespace
pnpm exec wrangler kv:namespace create NEXT_CACHE_WORKERS_KV --env staging

# 2. Create Production KV Namespace
pnpm exec wrangler kv:namespace create NEXT_CACHE_WORKERS_KV

# 3. Create Preview KV Namespace
pnpm exec wrangler kv:namespace create NEXT_CACHE_WORKERS_KV --env preview
```

Copy the resulting `id` strings into `wrangler.toml` under the respective `kv_namespaces` tables.

---

## 5. Cloudflare R2 Media Bucket Provisioning

Cloudflare R2 provides S3-compatible, zero-egress object storage for product galleries and limited edition artwork drops.

```bash
# 1. Create Staging R2 Bucket
pnpm exec wrangler r2 bucket create chrishop-media-staging

# 2. Create Production R2 Bucket
pnpm exec wrangler r2 bucket create chrishop-media-prod

# 3. Create Preview R2 Bucket
pnpm exec wrangler r2 bucket create chrishop-media-preview
```

### Apply CORS Configuration

Allow image requests from storefront custom domains:

```bash
# Apply CORS to Staging Bucket
pnpm exec wrangler r2 bucket cors set chrishop-media-staging --file infra/r2/cors-media.json

# Apply CORS to Production Bucket
pnpm exec wrangler r2 bucket cors set chrishop-media-prod --file infra/r2/cors-media.json
```

### Apply & Monitor Bucket Lifecycle Policies (Story 2.36)

Automate object lifecycle rules, Infrequent Access transitions, and orphan cleanup across production, staging, and preview tiers:

```bash
# Apply lifecycle rules idempotently across all buckets (or pass --dry-run to validate)
infra/scripts/deps/r2_apply_lifecycle.sh --env all

# Or apply per-environment using the Wrangler CLI:
pnpm exec wrangler r2 bucket lifecycle set chrishop-media-prod --file infra/r2/lifecycle-prod.json -y
pnpm exec wrangler r2 bucket lifecycle set chrishop-media-staging --file infra/r2/lifecycle-staging.json -y
pnpm exec wrangler r2 bucket lifecycle set chrishop-media-preview --file infra/r2/lifecycle-preview.json -y

# View and audit active bucket lifecycle configurations:
pnpm exec wrangler r2 bucket lifecycle list chrishop-media-prod
pnpm exec wrangler r2 bucket lifecycle list chrishop-media-staging
pnpm exec wrangler r2 bucket lifecycle list chrishop-media-preview
```

---

## 6. Secret Management & Isolation

All sensitive runtime credentials must be securely injected via encrypted Cloudflare Workers Secrets. **Never commit secrets to git repository or configuration files.**

### Required Secret Matrix

| Secret Key | Description | Target Environments |
| :--- | :--- | :--- |
| `PAYLOAD_SECRET` | 32+ character encryption secret for Payload CMS sessions | Production, Staging, Preview |
| `SHOPIFY_ADMIN_TOKEN` | Shopify Private App Admin API access token | Production, Staging |
| `SHOPIFY_STOREFRONT_TOKEN` | Shopify Headless Storefront API access token | Production, Staging |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhook HMAC SHA-256 verification secret | Production, Staging |
| `RESEND_API_KEY` | Resend transactional email API key | Production, Staging |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for order drop notifications | Production, Staging |

### Setting Secrets for Staging

```bash
pnpm exec wrangler secret put PAYLOAD_SECRET --env staging
pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env staging
pnpm exec wrangler secret put SHOPIFY_STOREFRONT_TOKEN --env staging
pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env staging
pnpm exec wrangler secret put RESEND_API_KEY --env staging
pnpm exec wrangler secret put DISCORD_WEBHOOK_URL --env staging
```

### Setting Secrets for Production

```bash
pnpm exec wrangler secret put PAYLOAD_SECRET --env production
pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env production
pnpm exec wrangler secret put SHOPIFY_STOREFRONT_TOKEN --env production
pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env production
pnpm exec wrangler secret put RESEND_API_KEY --env production
pnpm exec wrangler secret put DISCORD_WEBHOOK_URL --env production
```

### Verifying Active Secrets

List active secret names (values remain encrypted and hidden):

```bash
pnpm exec wrangler secret list --env staging
pnpm exec wrangler secret list --env production
```

### Architectural Policy & Operational Runbook
- **Architectural Decision Record**: For architectural rationale, threat modeling, and `@opennextjs/cloudflare` runtime dynamics, see [`docs/decisions/ADR_CLOUDFLARE_SECRETS_EVALUATION.md`](decisions/ADR_CLOUDFLARE_SECRETS_EVALUATION.md).
- **Secret Rotation Runbook**: For zero-downtime rollover procedures, verification probes, and emergency revocation, see [`docs/runbooks/SECRET_ROTATION.md`](runbooks/SECRET_ROTATION.md).

---

## 7. Custom Domain Routes & DNS Configuration

Cloudflare Workers routing connects custom domains directly to worker execution at Cloudflare's global edge without intermediate reverse proxies.

### DNS Records in Cloudflare Zone (`jacobmiller22.com`)

Ensure the following proxied (orange-clouded) DNS records exist in the Cloudflare Dashboard:

| Type | Name | Content / Target | Proxy Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `CNAME` | `chrishop` | `chrishop.workers.dev` (or Worker route) | Proxied | Production ChrisShop domain |
| `CNAME` | `shop` | `chrishop.workers.dev` (or Worker route) | Proxied | Production shop alias |
| `CNAME` | `staging-chrishop` | `chrishop-staging.workers.dev` | Proxied | Staging environment (2-tier Universal SSL compliant) |
| `CNAME` | `staging-shop` | `chrishop-staging.workers.dev` | Proxied | Staging alias (2-tier Universal SSL compliant) |
| `CNAME` | `*-chrishop` | `chrishop-preview.workers.dev` | Proxied | Wildcard for PR previews (1-level Universal SSL compliant) |

### Route Definitions in `wrangler.toml`

The routes are explicitly managed in `wrangler.toml`:

```toml
# Production Routes (top-level and [env.production])
routes = [
  { pattern = "chrishop.jacobmiller22.com/*", zone_name = "jacobmiller22.com" },
  { pattern = "shop.jacobmiller22.com/*", zone_name = "jacobmiller22.com" }
]

# Staging Routes ([env.staging])
[env.staging]
routes = [
  { pattern = "staging-chrishop.jacobmiller22.com/*", zone_name = "jacobmiller22.com" },
  { pattern = "staging-shop.jacobmiller22.com/*", zone_name = "jacobmiller22.com" }
]
```

### SSL/TLS Encryption Configuration

In Cloudflare Dashboard:
1. Navigate to **SSL/TLS** > **Overview**.
2. Set Encryption Mode to **Full (Strict)**.
3. Under **Edge Certificates**, confirm **Always Use HTTPS** and **Automatic HTTPS Rewrites** are enabled.

---

## 8. Local Emulation via Miniflare (`wrangler dev`)

Developers can run the complete Cloudflare Workers runtime locally without connecting to live Cloudflare services.

```bash
# 1. Ensure local environment variables are populated
cp .env.example .env
cp .env.example apps/web/.dev.vars

# 2. Run local development server (spawns Miniflare)
pnpm run dev
```

Miniflare automatically:
- Emulates SQLite D1 databases locally under `.wrangler/state/v3/d1`.
- Emulates Workers KV storage under `.wrangler/state/v3/kv`.
- Emulates R2 object storage in memory.
- Exposes Next.js storefront and Payload CMS at `http://localhost:3000`.

To run Wrangler's native local emulation:

```bash
pnpm exec wrangler dev --port 3000
```

---

## 9. Automated Pull Request Preview Deployments

Every pull request triggers an automated preview deployment via `.github/workflows/preview-deploy.yml`:

1. **Trigger**: Pull requests targeting `main` or `staging` (`opened`, `synchronize`, `reopened`).
2. **Quality Gates**: Runs `pnpm run check` (typecheck & lint) and `pnpm run test:all` (unit and local in-memory integration tests).
3. **Build**: Builds production bundle using `@opennextjs/cloudflare`.
4. **Deploy**: Deploys to Cloudflare Workers preview environment:
   ```bash
   pnpm exec wrangler deploy --env preview --name chrishop-preview-pr-<PR_NUMBER>
   ```
5. **PR Notification & Verification**: Probes edge health (`/api/health`) and posts a sticky comment with the verified preview URL (`https://pr-<PR_NUMBER>-chrishop.jacobmiller22.com`).
6. **Teardown**: When the PR is closed or merged, `.github/workflows/preview-teardown.yml` executes automated resource cleanup via `wrangler delete`.

---

## 10. CI/CD Staged Promotion Pipeline (Staging ➔ Production)

Deployments are governed by `.github/workflows/deploy.yml` across two promotion stages:

- **Stage 1: Staging Integration (`staging` branch)**:
  - Feature branches target `staging` by default.
  - On push to `staging`, `deploy.yml` executes:
    1. `build-and-validate`: Lint, typecheck, unit tests, security audit (`pnpm audit --audit-level=high`), and Next.js / OpenNext bundle build.
    2. `deploy-staging`: Deploys worker bundle to staging via `wrangler deploy --env staging`.
    3. `test-staging`: Executes automated health probe loop verifying `https://staging-chrishop.jacobmiller22.com/api/health` returns HTTP 200.

- **Stage 2: Production Promotion (`staging` ➔ `production` Release PR)**:
  - Direct pushes or PRs to `production` from any branch other than `staging` are strictly rejected by `enforce-promotion-rules` in `.github/workflows/ci.yml`.
  - Merging a release PR from `staging` into `production` triggers the full gated CD pipeline:
    1. `build-and-validate`: Full build and test suite execution.
    2. `deploy-staging`: Deploys bundle to staging edge.
    3. `test-staging`: Confirms 100% healthy staging probe results.
    4. `deploy-production` (**✋ Human Approval Gate**): Enters waiting state in GitHub Actions `environment: production`, requiring explicit human reviewer approval (`jacobmiller22`). Once approved, executes `wrangler deploy --env production`.
    5. `verify-production`: Automatically probes `https://chrishop.jacobmiller22.com/api/health` verifying live edge availability.

- **Health Verification**:
  ```bash
  # Check Staging Health
  curl -s -f https://staging-chrishop.jacobmiller22.com/api/health | jq .

  # Check Production Health
  curl -s -f https://chrishop.jacobmiller22.com/api/health | jq .
  ```

For full details, see the operational runbook: [docs/runbooks/PRODUCTION_PROMOTION.md](docs/runbooks/PRODUCTION_PROMOTION.md).

---

## 11. Rollback & Disaster Recovery

If an issue is detected post-deployment:

### Instant Edge Worker Rollback

Roll back immediately to the previous stable deployment using Cloudflare's instant version rollback:

```bash
# Roll back staging
pnpm exec wrangler rollback --env staging

# Roll back production
pnpm exec wrangler rollback --env production
```

Or trigger the automated GitHub Actions rollback workflow `.github/workflows/rollback.yml` via workflow dispatch.

### Live Tail & Diagnostics

Stream real-time edge execution logs:

```bash
pnpm exec wrangler tail --env staging
pnpm exec wrangler tail --env production
```

For complete disaster recovery and Point-in-Time Recovery (PITR) procedures, refer to [`docs/runbooks/DISASTER_RECOVERY.md`](runbooks/DISASTER_RECOVERY.md).

---

## 12. Cloudflare Image Resizing Edge Pipeline & Media Transformation Infrastructure

This section documents the configuration, canonical URI scheme, edge caching policies, verification procedures, and troubleshooting runbook for **Cloudflare Image Resizing** (`/cdn-cgi/image/...`) serving media stored in Cloudflare R2 (`chrishop-media`).

### 12.1 Architectural Context & Zero-Sharp Edge Policy

Payload CMS and Next.js default to `sharp` (a native C++ Node.js library) for image resizing, thumbnail generation, and WebP/AVIF format conversion. Because native C++ addons **cannot run within standard Cloudflare Workers V8 isolates**, server-side `sharp` is strictly excluded from the ChrisShop edge deployment:

```mermaid
flowchart LR
    Client[Browser Client] -->|1. GET /cdn-cgi/image/width=800,format=auto/uploads/art.jpg| CFEdge[Cloudflare CDN Edge]
    CFEdge -->|2. Check Edge Cache (Vary: Accept)| CFCache{Edge Cache Hit?}
    CFCache -->|Yes: 200 OK| Client
    CFCache -->|No: Fetch Origin| R2[Cloudflare R2 Bucket / Custom Domain]
    R2 -->|3. Return Master JPEG/PNG| CFResizer[Cloudflare Image Resizing Service]
    CFResizer -->|4. Transcode to WebP/AVIF + Resize| CFEdge
    CFEdge -->|5. Cache 1 Week (max-age=604800)| CFCache
    CFEdge -->|6. Return Transformed Media| Client
```

- **Master Asset Storage**: High-resolution originals (up to 25 MB) are uploaded once to Cloudflare R2 (`chrishop-media`) via `@payloadcms/storage-s3`. No thumbnail variants are generated on upload.
- **Zero Egress**: Egress from Cloudflare R2 to Cloudflare Image Resizing within the Cloudflare global network incurs **zero bandwidth charges**.
- **Edge Cache Invalidation**: Purging the source URL in R2 automatically purges all edge-transformed variants.

### 12.2 Canonical Transformation URI Scheme

All image requests conform to the canonical Cloudflare Image Resizing URL structure:

```plaintext
/cdn-cgi/image/width={width},quality={quality},format=auto/{r2_asset_path}
```

#### URI Schema Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `width` | integer | (original) | Target width in pixels (e.g., `320`, `640`, `768`, `1024`, `1280`, `1536`, `1920`). |
| `height` | integer | (optional) | Target height in pixels. |
| `quality` | integer | `80` | Compression quality (`1-100`). `80` for standard catalog, `90` for hero artwork, `60` for thumbnails. |
| `format` | string | `auto` | Output format. `auto` dynamically serves AVIF or WebP based on client `Accept` headers. |
| `fit` | string | `scale-down` | Resizing mode: `scale-down`, `contain`, `cover`, `crop`, or `pad`. |
| `sharpen` | number | `0` | Edge sharpening amount (`0-10`). |
| `{r2_asset_path}` | string | (required) | Path to original R2 asset (e.g. `uploads/sculpture-01.jpg` or absolute URL `https://media.chrishop.jacobmiller22.com/uploads/sculpture-01.jpg`). |

#### Examples

```plaintext
# Relative R2 key with standard options
/cdn-cgi/image/width=800,quality=80,format=auto/uploads/sculpture-01.jpg

# High-resolution hero artwork banner
/cdn-cgi/image/width=1920,quality=90,format=auto/uploads/hero-banner.jpg

# Square product card thumbnail
/cdn-cgi/image/width=400,height=400,fit=cover,quality=80,format=auto/uploads/product-ring.jpg

# Absolute CDN source URL
/cdn-cgi/image/width=1024,quality=80,format=auto/https://media.chrishop.jacobmiller22.com/uploads/pottery.png
```

### 12.3 Cloudflare Zone Configuration (Image Resizing & Transformations Enablement)

Cloudflare Image Transformations must be enabled on the primary zone (`jacobmiller22.com`).

#### Cloudflare Images Free Tier Allocation
- **5,000 Unique Transformations / Month Included at $0.00**:
  - Applies to remote assets stored outside Cloudflare Images (e.g. Cloudflare R2).
  - Format auto-negotiation (`format=auto`) counts as **only 1 transformation** across both AVIF and WebP deliveries.
  - Repeat requests within the month are cached and do not count toward quota.
  - ChrisShop catalog scale (24 photos × 4 variants = 96 monthly transforms) consumes **< 2% of the free tier**.
  - Exceeding limit returns `9422` error or falls back via `onerror=redirect` without unexpected charges.

#### Cloudflare API Token Permissions Matrix
- **Storefront & Client Browsers (Runtime)**:
  - **No token required**. Browsers request public `/cdn-cgi/image/...` URLs; Cloudflare edge authenticates against the zone setting.
- **CI/CD Automation & Setup Scripts (`setup-image-resizing.sh`)**:
  - `Zone > Zone Settings: Edit` — Allows API to toggle image resizing on/off (`PATCH /zones/:id/settings/image_resizing`).
  - `Zone > Cache Rules: Edit` — Allows declarative cache rule management (`infra/r2/cache-rules-images.json`).
- **Account-level Cloudflare Images Token**:
  - Not required for ChrisShop runtime operations because master photos are stored in Cloudflare R2, not Cloudflare Images hosted storage.

#### Option A: Cloudflare Dashboard (Recommended)
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and select the account owning `jacobmiller22.com`.
2. Navigate to **Images** > **Transformations** (or **Stream** > **Transformations**).
3. Under **Zones**, locate `jacobmiller22.com` and toggle **Enable**.
4. In **Sources / Allowed Origins**, ensure zone preview domains and custom domains (`*.jacobmiller22.com`) are permitted.

#### Option B: Automated Configuration via Monorepo Script
```bash
# Dry run validation
infra/scripts/setup-image-resizing.sh --dry-run

# Apply to zone via Cloudflare API
CLOUDFLARE_API_TOKEN="<token>" infra/scripts/setup-image-resizing.sh --zone-name jacobmiller22.com

# Verify active status
CLOUDFLARE_API_TOKEN="<token>" infra/scripts/setup-image-resizing.sh --verify
```

#### Option C: Cloudflare REST API
```bash
# Enable Image Resizing on the zone
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/image_resizing" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"value":"on"}' | jq .
```

### 12.4 Edge Caching & Content Negotiation Policies

Transformed assets at the Cloudflare edge are governed by caching and content negotiation directives defined in `infra/r2/cache-rules-images.json`:

1. **1-Week Caching Policy (Performance Testing & Active Iteration)**:
   - `Cache-Control: public, max-age=604800` (7 days / 604,800s)
   - Configured for both `/cdn-cgi/image/*` transformations and source assets on `/media/*`.
   - Browser and Cloudflare edge caches retain the optimized image for 1 week.
   - Prevents stale image lockup during catalog photography iterations while providing instant edge cache hits for performance benchmarks.
2. **Dynamic Format Negotiation & Cache Key Variation (`format=auto`)**:
   - Cloudflare inspects the incoming client `Accept` request header:
     - If client supports `image/avif`: Transcodes and returns AVIF format.
     - Else if client supports `image/webp`: Transcodes and returns WebP format.
     - Else: Returns original format (JPEG/PNG).
   - Response header **MUST** include `Vary: Accept` to guarantee that CDN edge caches do not serve WebP to an AVIF-capable browser or vice versa.
3. **Tiered Cache & Cache Reserve**:
   - Cloudflare Tiered Cache and Cache Reserve are enabled on transformed media to eliminate cache misses across global edge PoPs.

### 12.5 Automated Edge Verification Script

An automated probing script validates the end-to-end edge resizing pipeline:

```bash
# Run automated in-memory simulation / test harness
pnpm run verify:images -- --mock

# Probe live staging or preview edge environment
pnpm run verify:images -- --live --url https://pr-202-chrishop.jacobmiller22.com --image-path media/bushwhack-storm-anorak/camo-variation.jpeg

# Probe specific asset key with verbose output
pnpm run verify:images -- --live --url https://chrishop.jacobmiller22.com --image-path media/bushwhack-storm-anorak/camo-variation.jpeg --verbose
```

The script verifies:
- `HTTP 200 OK` response from `/cdn-cgi/image/...`
- `Cache-Control: public, max-age=604800` header presence (>= 7 days)
- `Vary: Accept` header presence
- Format auto-negotiation (`image/avif` and `image/webp` responses)
- Absence of native `sharp` imports across `apps/web/src`

### 12.6 Troubleshooting Runbook

| Symptom / Status Code | Root Cause | Remediation Procedure |
| :--- | :--- | :--- |
| **HTTP 400 Bad Request** (`9400`) | Invalid resizing options or malformed transformation parameters in URL. | Verify URL format matches `/cdn-cgi/image/<options>/<source>`. Check that options are comma-separated without spaces (e.g. `width=800,quality=80,format=auto`). |
| **HTTP 403 Forbidden** (`9403` / `9407`) | Image Resizing is disabled on the Cloudflare zone, or source URL is not allowed by origin restriction rules. | 1. Run `infra/scripts/setup-image-resizing.sh --verify` to ensure zone setting is `on`.<br>2. Ensure source origin domain (`media.chrishop.jacobmiller22.com`) is allowed in zone settings. |
| **HTTP 404 Not Found** (`9404`) | Source image does not exist in R2 bucket at the specified path. | Verify that the source asset exists in R2: `pnpm exec wrangler r2 object get chrishop-media-prod/<path>`. Confirm filename casing matches. |
| **HTTP 520 / 9401 Error** | Source image exceeds 25 MB limit or unsupported image format. | Ensure uploaded images conform to `Media` collection constraints (MIME types: JPEG, WebP, PNG, AVIF; max size: 25 MB). |
| **Missing `Vary: Accept` Header** | Cache rule missing Vary directive or edge transform bypassed. | Verify that `infra/r2/cache-rules-images.json` rule is active on the zone. Clear zone cache via Cloudflare dashboard or API if rule was updated recently. |
| **Stale Image Displayed** | Transformed variant cached after source image updated in R2. | Purge the **original source URL** in Cloudflare Cache. Cloudflare automatically cascades origin purges to all `/cdn-cgi/image/...` variants. |

