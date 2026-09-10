---
name: local-development
description: Detailed instructions and workflows for running, debugging, seeding, and testing the ChrisShop local monorepo development stack with Cloudflare Workers, D1 SQLite, Workers KV, R2, Payload CMS v3, and Shopify.
---

# Local Development Skill

This skill provides step-by-step operational workflows and troubleshooting runbooks for AI agents and human developers interacting with the **ChrisShop** local monorepo development environment.

The ChrisShop platform operates on a **zero-container, Cloudflare-native architecture**. Local development runs purely in-process without containers or external servers. All local persistence and edge runtimes are handled via Miniflare, SQLite/D1, Workers KV, R2 emulation, and Shopify Storefront APIs.

---

## When to Use This Skill

Activate or consult this skill whenever you need to:

- Set up and verify the local development environment using Node.js 22+, pnpm 9+, and Wrangler CLI.
- Run local development servers (`apps/web`, `apps/cms`) with Turborepo and Wrangler.
- Execute the local verification harness (`pnpm run verify:local`) before committing or submitting pull requests.
- Run ephemeral integration tests (`pnpm run test:integration`) against in-memory D1 SQLite, Workers KV, and Shopify webhook HMAC validation.
- Execute local Cloudflare D1 migrations and database operations (`pnpm exec wrangler d1 execute`).
- Seed or inspect local catalog data, product variations, and administrative configurations.
- Diagnose and resolve common local environment failure modes (stale caches, missing environment variables, port conflicts).

---

## Architecture & Service Directory

The ChrisShop platform comprises the following workspace packages and services:

| Component          | Path / Service           | Local Port | URL / Interface               | Purpose                                          |
| :----------------- | :----------------------- | :--------- | :---------------------------- | :----------------------------------------------- |
| **Storefront**     | `apps/web`               | `3000`     | `http://localhost:3000`       | Next.js 15 App Router customer storefront        |
| **CMS**            | `apps/cms`               | `3000`     | `http://localhost:3000/admin` | Payload CMS v3 Headless CMS & D1 schema bindings |
| **UI Components**  | `packages/ui`            | N/A        | Shared package                | React UI component library                       |
| **Domain Types**   | `packages/types`         | N/A        | Shared package                | Shared TypeScript interfaces & types             |
| **Notifications**  | `packages/notifications` | N/A        | Shared package                | Transactional email & Discord alert utilities    |
| **Tooling Config** | `packages/config`        | N/A        | Shared package                | Centralized ESLint, Prettier, and TS configs     |
| **Cloudflare D1**  | SQLite / Miniflare       | In-process | Local SQLite file             | Primary relational catalog & orders database     |
| **Workers KV**     | Miniflare KV             | In-process | Local KV namespace            | Edge caching, ISR, and rate limiting             |
| **Cloudflare R2**  | Miniflare R2             | In-process | Local object storage          | Product artwork, photography, and media          |
| **Shopify API**    | Remote / Mock            | HTTPS      | Shopify Storefront API        | Checkout, cart mutations, and inventory source   |

---

## Step-by-Step Agent Operations

### Step 1: Pre-Flight Environment Check

Confirm that the local host environment meets runtime requirements:

```bash
# Verify Node.js (>= 20.0.0, recommended v22+ LTS)
node -v

# Verify pnpm (>= 9.0.0)
pnpm -v

# Verify Wrangler CLI is installed
pnpm exec wrangler --version
```

### Step 2: Environment Configuration

Ensure a `.env` file exists at the root of the workspace:

```bash
# If .env does not exist, copy from .env.example
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Initialized .env from template."
fi
```

Required environment variables in `.env` include:

- `NEXT_PUBLIC_SITE_URL` (default: `http://localhost:3000`)
- `PAYLOAD_SECRET` (local secret string)
- `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (or sandbox credentials)
- `SHOPIFY_WEBHOOK_SECRET` (for webhook HMAC verification)

### Step 3: Local Verification Harness (`pnpm run verify:local`)

Before pushing code or creating pull requests, execute the automated 6-stage verification harness:

```bash
pnpm run verify:local
```

The harness executes the following checks:

1. **Node.js & pnpm Versions**: Validates runtime engines against `package.json`.
2. **Monorepo Dependencies**: Verifies workspace links and lockfile integrity.
3. **Typecheck & Linting**: Runs `turbo run check` across all workspace packages.
4. **Ephemeral Integration Tests**: Runs `tsx --test tests/integration/**/*.test.ts` (in-memory D1 SQLite, Shopify client, and edge routes).
5. **Monorepo Production Build**: Runs `turbo run build` across all packages.
6. **Secret Hygiene Scan**: Scans workspace files for leaked API keys, tokens, or private credentials.

### Step 4: Running Ephemeral Integration Tests

Integration tests run completely in-process using Node.js built-in SQLite (`DatabaseSync(':memory:')`) and mock edge runtimes:

```bash
# Run integration test suite
pnpm run test:integration

# Run all tests (unit + integration)
pnpm run test:all
```

Integration test suites cover:

- `tests/integration/d1-database.test.ts`: D1 table schemas, indexes (`slug`, `shopify_product_id`, `sku`), relational joins, and `wrangler d1` CLI execution.
- `tests/integration/shopify-client.test.ts`: Storefront API cart creation, checkout redirect URLs, and raw HMAC-SHA256 webhook signature security validation.
- `tests/integration/edge-routes.test.ts`: Edge handler routes (`/api/health`).

### Step 5: Cloudflare D1 Local Database Operations

Execute D1 migrations and queries locally using the Wrangler CLI:

```bash
# Execute local D1 SQL migrations
pnpm exec wrangler d1 execute chrishop-prod-db --local --file=./migrations/0001_initial.sql

# Execute an interactive query against the local D1 database
pnpm exec wrangler d1 execute chrishop-prod-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Step 6: Running Development Servers

Start all monorepo applications concurrently with live reloading via Turborepo:

```bash
pnpm run dev
```

Or target specific applications individually:

- **Next.js Storefront & Payload CMS**: `pnpm --filter web dev` (available at `http://localhost:3000` and `http://localhost:3000/admin`)
- **Cloudflare Workers Preview**: `pnpm exec wrangler dev`

### Step 7: Environment Teardown & Clean Reset

Because the development environment is zero-container, cleaning the state is instantaneous:

```bash
# Wipe build caches and local test databases
rm -rf .turbo apps/*/.turbo apps/*/.next packages/*/.turbo packages/*/dist .wrangler
```

---

## Agent Troubleshooting Playbook

| Symptom / Error                                            | Root Cause                                                | Automated Remediation Command                                                                          |
| :--------------------------------------------------------- | :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `pnpm run verify:local` fails at Stage 4 (Integration)     | In-memory D1 schema mismatch or SQLite error              | Inspect `tests/integration/` test failures; run `pnpm run test:integration` with full stack traces     |
| `Shopify HMAC signature verification failed`               | Webhook handler did not receive raw text body             | Ensure webhook route reads raw body as `Buffer` or `text()` before parsing JSON                        |
| `Wrangler CLI not found`                                   | Wrangler not installed in root dependencies               | Run `pnpm install` at repo root                                                                        |
| Port `3000` is already in use                              | Lingering Next.js or node dev process                     | Run `lsof -ti :3000 \| xargs kill -9` then restart dev server                                          |
| Stale TypeScript or Next.js build errors after branch pull | Turborepo cache or `.next` cache contains stale artifacts | Run `rm -rf .turbo apps/*/.turbo apps/*/.next packages/*/.turbo packages/*/dist` then `pnpm run check` |
| `pnpm: command not found`                                  | Corepack or global pnpm not installed                     | Run `corepack enable` or `npm install -g pnpm@9`                                                       |
