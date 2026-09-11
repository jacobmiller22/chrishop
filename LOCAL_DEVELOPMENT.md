# Local Development Guide (`LOCAL_DEVELOPMENT.md`)

Welcome to the **ChrisShop** monorepo local development guide. This document provides step-by-step instructions for human developers and AI coding assistants to configure, execute, test, and troubleshoot the Cloudflare-native and Shopify Headless development stack.

---

## 1. System Architecture & Local Runtime

The **ChrisShop** platform is organized as a Turborepo monorepo powered by `pnpm` workspaces and Cloudflare Workers:

- **Storefront & Embedded CMS (`apps/web`)**: Next.js 15 App Router co-locating **Payload CMS v3** under `/admin/*`.
- **UI Design System (`packages/ui`)**: Shared React components and Tailwind CSS styling presets.
- **Shared Types (`packages/types`)**: TypeScript domain models for catalog, drop mechanics, and Shopify payloads.
- **Notifications Engine (`packages/notifications`)**: Transactional email (Resend) and Discord webhook alerts.
- **Shared Config (`packages/config`)**: Centralized TypeScript, ESLint, Prettier, and environment variable validation schemas.
- **Cloudflare Runtime (`wrangler.toml`)**: Cloudflare Workers bindings (D1, KV, R2) emulated locally via **Miniflare**.
- **Commerce Engine**: **Shopify Headless** via Storefront API and Shopify Development Store.

### Zero-Container Local Topology

Unlike legacy server architectures, this stack requires **zero virtual machines or background container daemons**. Miniflare emulates SQLite D1 databases, Workers KV, and R2 storage in-process.

| Service / Interface    | Local Port | Access URL                    | Description                            |
| :--------------------- | :--------- | :---------------------------- | :------------------------------------- |
| **Next.js Storefront** | `3000`     | `http://localhost:3000`       | Public customer storefront             |
| **Payload CMS Admin**  | `3000`     | `http://localhost:3000/admin` | Embedded TypeScript content management |
| **Edge API Routes**    | `3000`     | `http://localhost:3000/api/*` | Health check, webhooks, cart mutations |
| **Miniflare Local D1** | In-Process | `.wrangler/state/v3/d1`       | Local SQLite-compatible database       |
| **Miniflare Local KV** | In-Process | `.wrangler/state/v3/kv`       | Local ISR cache handler                |

---

## 2. Prerequisites & Workstation Setup

Ensure your local machine has the following tools installed:

1. **Node.js**: `v20.x` or higher (Active LTS recommended).
   ```bash
   node -v # Should report >= v20.0.0
   ```
2. **pnpm**: `v9.x` or higher.
   ```bash
   corepack enable
   pnpm -v # Should report >= 9.0.0
   ```
3. **Cloudflare Wrangler CLI**: Installed locally as a workspace dev dependency and accessible via `pnpm`.
   ```bash
   pnpm exec wrangler --version
   ```
4. **Shopify CLI**: Required for triggering test webhooks and interacting with Shopify dev stores.
   ```bash
   # Via Homebrew:
   brew install shopify-cli
   # Or via npm:
   npm install -g @shopify/cli
   shopify version
   ```
5. **Git & Worktrunk (`wt`)**: Required for branch and worktree isolation.
   ```bash
   brew install worktrunk
   ```

---

## 3. Environment Configuration

### 3.1 Initialize Environment Variables

Copy the template file to create your active `.env` and `.dev.vars` files:

```bash
cp .env.example .env
cp .env.example apps/web/.dev.vars
```

### 3.2 Environment Variable Matrix

```env
# Runtime
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Payload CMS v3
PAYLOAD_SECRET=development-secret-key-must-be-at-least-32-chars-long
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000

# Shopify Headless Credentials
SHOPIFY_STORE_DOMAIN=chrishop-dev.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=mock_storefront_access_token_for_local_dev
SHOPIFY_ADMIN_TOKEN=mock_admin_api_access_token_for_local_dev
SHOPIFY_WEBHOOK_SECRET=mock_webhook_secret_key

# Cloudflare Bindings (Emulated by Miniflare in dev)
CLOUDFLARE_ACCOUNT_ID=mock_cf_account_id
R2_BUCKET_NAME=chrishop-media
R2_ACCESS_KEY_ID=mock_r2_key
R2_SECRET_ACCESS_KEY=mock_r2_secret
R2_ENDPOINT=http://localhost:3000/mock-r2

# Pluggable Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/mock/dev-channel
RESEND_API_KEY=mock_resend_api_key
```

---

## 4. Running the Local Development Stack

### 4.1 Install Monorepo Dependencies

```bash
pnpm install
```

### 4.2 Start Unified Development Server

```bash
pnpm run dev
```

This single orchestrator command:

1. Runs pre-flight checks: generates Cloudflare types (`wrangler types`), ensures local D1 SQLite state exists, and compiles the edge worker stub.
2. Serves the Next.js Storefront at `http://localhost:3000`.
3. Serves Payload CMS Admin at `http://localhost:3000/admin`.
4. Spawns Cloudflare Wrangler & Miniflare edge runtime at `http://localhost:8787` with local D1, KV, and R2 bindings.
5. Manages clean shutdown of all child processes on `SIGINT` (Ctrl+C) or `SIGTERM`.

#### Granular Dev Commands
- `pnpm run dev:web`: Run only the Next.js storefront & Payload CMS server.
- `pnpm run dev:wrangler`: Run only the Cloudflare Wrangler emulator.
- `pnpm run dev:types`: Refresh Cloudflare binding types (`worker-configuration.d.ts`).
- `pnpm run dev:db`: Seed local D1 database with sample products and categories.

For the complete guide, see [DEVELOPMENT.md](file:///Users/jacobmiller22/projects/chrishop/DEVELOPMENT.md).

---

## 5. Local Database Management (Cloudflare D1)

Cloudflare D1 stores local development data in SQLite database files managed under `.wrangler/state/v3/d1`.

### 5.1 Turnkey Local D1 Setup & Emulation

Run the automated local D1 setup script to apply migrations and verify query indexes:

```bash
pnpm run d1:setup
```

### 5.2 Execute SQL Queries Locally

```bash
pnpm exec wrangler d1 execute chrishop-prod-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### 5.3 Apply Database Migrations Locally

```bash
pnpm run d1:migrate:local
# Or directly via wrangler:
pnpm exec wrangler d1 migrations apply chrishop-prod-db --local
```

---

## 6. Shopify Webhook Testing

Test order creation and fulfillment notifications locally using the Shopify CLI:

```bash
# Trigger orders/create test event
shopify app webhook trigger \
  --topic orders/create \
  --address http://localhost:3000/api/webhooks/shopify
```

Verify that the webhook handler logs successful verification and that the Discord notification provider formats the order payload.

---

## 7. Testing & Quality Verification

Run tests and the full verification pipeline before submitting any PR:

```bash
# 1. Monorepo Typecheck & Lint
pnpm run check

# 2. Monorepo Unit Test Suites
pnpm run test:unit

# 3. Ephemeral Integration Tests (In-memory D1 SQLite & Shopify Client)
pnpm run test:integration

# 4. Run All Tests
pnpm run test:all

# 5. Production Build Validation (All Workspaces & Cloudflare Worker)
pnpm run build
# Or explicitly build only apps or only worker bundle:
pnpm run build:apps
pnpm run build:worker
pnpm run build:prod

# 6. Turnkey Pre-PR Verification Pipeline (All 7 Stages)
pnpm run verify:local
```
