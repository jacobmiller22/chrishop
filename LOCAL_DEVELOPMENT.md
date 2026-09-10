# Local Development Guide (`LOCAL_DEVELOPMENT.md`)

Welcome to the **ChrisShop** monorepo local development environment. This guide provides step-by-step instructions for getting the local development stack up and running, seeding sample data, running local services, and testing Stripe webhooks.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
- **Docker & Docker Compose**: `v2.20+` (Docker Desktop or Colima/OrbStack)
- **Stripe CLI**: For local webhook forwarding (`brew install stripe/stripe-cli/stripe`)
- **Git**: `v2.40+`

---

## 2. Quickstart Environment Setup

### 2.1 Workspace Installation

Install monorepo dependencies across all applications (`apps/web`, `apps/cms`) and packages (`packages/ui`, `packages/types`, `packages/notifications`):

```bash
pnpm install
```

### 2.2 Environment Variables

Copy the local environment template to `.env`:

```bash
cp .env.example .env
```

Ensure `.env` contains standard development defaults:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL
POSTGRES_DB=chrishop_dev
POSTGRES_USER=chrishop
POSTGRES_PASSWORD=chrishop_dev_secret
DATABASE_URL=postgresql://chrishop:chrishop_dev_secret@localhost:5432/chrishop_dev

# Directus CMS
KEY=chrishop-secret-key
SECRET=chrishop-secret-jwt
ADMIN_EMAIL=admin@chrishop.com
ADMIN_PASSWORD=AdminPassword123!

# Cloudflare R2 / Local MinIO Emulator
STORAGE_LOCATIONS=s3
STORAGE_S3_DRIVER=s3
STORAGE_S3_KEY=minioadmin
STORAGE_S3_SECRET=minioadmin
STORAGE_S3_BUCKET=chrishop-media
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_S3_FORCE_PATH_STYLE=true

# Redis OSS
REDIS_HOST=localhost
REDIS_PORT=6379

# Stripe (Test Mode Keys)
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Notifications Engine
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## 3. Starting the Local Container Stack

Launch the local Docker dev environment containing PostgreSQL, Directus CMS, Redis OSS, and MinIO (Cloudflare R2 emulator):

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### Container Endpoints:

- **Directus Admin UI**: `http://localhost:8055` (Login: `admin@chrishop.com` / `AdminPassword123!`)
- **MinIO Console**: `http://localhost:9001` (Login: `minioadmin` / `minioadmin`)
- **PostgreSQL**: `localhost:5432` (DB: `chrishop_dev`)
- **Redis OSS**: `localhost:6379`

To view container logs:

```bash
docker compose -f infra/docker/docker-compose.dev.yml logs -f
```

---

## 4. Schema Snapshot & Database Seeding

Populate Directus schema collections (`categories`, `products`, `product_variations`, `orders`, `order_items`, `processed_stripe_events`) and apply test seed data:

```bash
# Apply schema snapshot
pnpm --filter cms schema:apply

# Seed catalog with test artwork, variations, and admin permissions
pnpm seed
```

---

## 5. Running the Application Stack

Start all apps and packages in concurrent development mode via Turborepo:

```bash
pnpm run dev
```

### Running Individual Apps:

- **Storefront (`apps/web`)**: `pnpm --filter web dev` ➔ `http://localhost:3000`
- **CMS Extensions (`apps/cms`)**: `pnpm --filter cms dev`

---

## 6. Testing Stripe Webhooks Locally

To test checkout flows, stock locks, and webhook processing on your local machine:

1. Log into Stripe CLI:
   ```bash
   stripe login
   ```
2. Start local webhook forwarding to Next.js API route:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. Copy the printed webhook signing secret (`whsec_...`) into your `.env` file as `STRIPE_WEBHOOK_SECRET`.
4. Trigger test webhook events:
   ```bash
   stripe trigger checkout.session.completed
   ```

---

## 7. Useful Local Development Commands

- `pnpm run check` - Runs TypeScript typechecking and ESLint across all apps & packages.
- `pnpm run test` - Runs unit and integration test suites.
- `pnpm run build` - Builds production assets for all monorepo targets.
- `docker compose -f infra/docker/docker-compose.dev.yml down -v` - Destroys local containers and wipes volume data for a fresh restart.
