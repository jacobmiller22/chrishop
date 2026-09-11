# Cloudflare Operational Setup Guide (`docs/CLOUDFLARE_SETUP.md`)

This runbook guides operators, platform engineers, and automated agents through provisioning, configuring, deploying, and maintaining the complete Cloudflare platform suite (Workers, D1, Workers KV, R2, Secrets, and Custom Domains) for **ChrisShop**.

---

## 1. Architecture Overview & Environments

The ChrisShop platform runs on a serverless, zero-container edge deployment model using Cloudflare Workers and `@opennextjs/cloudflare` to co-locate the Next.js storefront and Payload CMS v3 under a single edge worker deployment.

The platform provides three distinct environments with configuration-as-code portability between personal Cloudflare accounts and dedicated production accounts:

| Environment | Branch | Primary Custom Domain / Route | Personal Account Route (`jacobmiller22.com`) | D1 Database | KV Namespace | R2 Bucket |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Production** | `main` | `chrishop.com/*`, `www.chrishop.com/*` | `chrishop.jacobmiller22.com/*` | `chrishop-prod-db` | `NEXT_CACHE_WORKERS_KV` (prod) | `chrishop-media-prod` |
| **Staging** | `staging` | `staging.chrishop.com/*` | `staging.chrishop.jacobmiller22.com/*` | `chrishop-staging-db` | `NEXT_CACHE_WORKERS_KV` (staging) | `chrishop-media-staging` |
| **Preview** | PR branches | `pr-<PR_NUMBER>.preview.chrishop.com` | `pr-<PR_NUMBER>.preview.chrishop.jacobmiller22.com` | `chrishop-preview-db` | `NEXT_CACHE_WORKERS_KV` (preview) | `chrishop-media-preview` |

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

---

## 7. Custom Domain Routes & DNS Configuration

Cloudflare Workers routing connects custom domains directly to worker execution at Cloudflare's global edge without intermediate reverse proxies.

### DNS Records in Cloudflare Zone (`chrishop.com`)

Ensure the following proxied (orange-clouded) DNS records exist in the Cloudflare Dashboard:

| Type | Name | Content / Target | Proxy Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `A` / `AAAA` | `@` (`chrishop.com`) | `192.0.2.1` (or Cloudflare dummy target) | Proxied | Apex production domain |
| `CNAME` | `www` | `chrishop.com` | Proxied | Production www alias |
| `CNAME` | `staging` | `chrishop.com` | Proxied | Staging environment |
| `CNAME` | `*.preview` | `chrishop.com` | Proxied | Wildcard for PR previews |

### Route Definitions in `wrangler.toml`

The routes are explicitly managed in `wrangler.toml`:

```toml
# Production Routes (top-level and [env.production])
routes = [
  { pattern = "chrishop.com/*", zone_name = "chrishop.com" },
  { pattern = "www.chrishop.com/*", zone_name = "chrishop.com" }
]

# Staging Routes ([env.staging])
[env.staging]
routes = [
  { pattern = "staging.chrishop.com/*", zone_name = "chrishop.com" }
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
2. **Quality Gates**: Runs `pnpm run check` (typecheck & lint) and `pnpm run test:all` (unit and ephemeral integration tests).
3. **Build**: Builds production bundle using `@opennextjs/cloudflare`.
4. **Deploy**: Deploys to Cloudflare Workers preview environment:
   ```bash
   pnpm exec wrangler deploy --env preview
   ```
5. **PR Notification**: Posts a sticky comment with the preview URL (`https://pr-<PR_NUMBER>.preview.chrishop.com`).
6. **Teardown**: When the PR is closed or merged, `.github/workflows/preview-teardown.yml` executes automated resource cleanup.

---

## 10. CI/CD Deployment Pipeline (Staging & Production)

Deployments are automated through `.github/workflows/deploy.yml`:

- **Push to `staging` branch**:
  - Triggers automated quality validation (`check`, `test:unit`, `build`).
  - Deploys to staging environment via `pnpm exec wrangler deploy --env staging`.
  - Routes traffic to `https://staging.chrishop.com`.

- **Push to `main` branch**:
  - Triggers automated quality validation.
  - Deploys to production environment via `pnpm exec wrangler deploy --env production`.
  - Routes traffic to `https://chrishop.com` and `https://www.chrishop.com`.

- **Health Verification**:
  ```bash
  # Check Staging Health
  curl -s -f https://staging.chrishop.com/api/health | jq .

  # Check Production Health
  curl -s -f https://chrishop.com/api/health | jq .
  ```

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
