---
name: local-development
description: Detailed instructions and workflows for running, debugging, seeding, and testing the ChrisShop local monorepo development stack.
---

# Local Development Skill

This skill provides step-by-step operational workflows and troubleshooting runbooks for AI agents and human developers interacting with the **ChrisShop** local monorepo development environment.

---

## When to Use This Skill

Activate or consult this skill whenever you need to:

- Initialize, verify, or shut down local containerized infrastructure (PostgreSQL 16, Redis 7, MinIO S3 emulator, Directus 11 CMS).
- Verify or manually execute S3 bucket provisioning for `chrishop-media`.
- Apply Directus schema migrations (`schema:apply`) or export updated snapshots (`schema:export`).
- Seed the local database catalog with sample categories, limited-edition products, variations, inventory, and administrative permissions.
- Run local development servers (`apps/web`, `apps/cms`) or execute monorepo quality checks (`pnpm run check`, `pnpm run test`, `pnpm run build`).
- Simulate and test local Stripe webhook events via Stripe CLI.
- Diagnose and resolve common local environment failure modes (port collisions, unhealthy containers, stale caches).

---

## Architecture & Service Directory

The ChrisShop platform comprises the following workspace packages and services:

| Component          | Path / Container         | Local Port      | URL / Interface         | Purpose                                       |
| :----------------- | :----------------------- | :-------------- | :---------------------- | :-------------------------------------------- |
| **Storefront**     | `apps/web`               | `3000`          | `http://localhost:3000` | Next.js 15 App Router customer storefront     |
| **CMS & Scripts**  | `apps/cms`               | `8055`          | `http://localhost:8055` | Directus 11 Headless CMS & schema migrations  |
| **UI Components**  | `packages/ui`            | N/A             | Shared package          | React UI component library                    |
| **Domain Types**   | `packages/types`         | N/A             | Shared package          | Shared TypeScript interfaces & types          |
| **Notifications**  | `packages/notifications` | N/A             | Shared package          | Transactional email & Discord alert utilities |
| **Tooling Config** | `packages/config`        | N/A             | Shared package          | Centralized ESLint, Prettier, and TS configs  |
| **PostgreSQL 16**  | `chrishop-postgres`      | `5432`          | `localhost:5432`        | Primary relational database                   |
| **Redis 7 OSS**    | `chrishop-redis`         | `6379`          | `localhost:6379`        | Caching & stock reservation locks             |
| **MinIO S3**       | `chrishop-minio`         | `9000` / `9001` | `http://localhost:9001` | Object storage emulator & admin console       |
| **MinIO Init**     | `chrishop-minio-init`    | N/A             | Container task          | Automated S3 bucket & policy provisioner      |

---

## Step-by-Step Agent Operations

### Step 1: Pre-Flight Environment Check

Confirm that the local host environment meets version requirements:

```bash
# Verify Node.js (>= 20.0.0)
node -v

# Verify pnpm (>= 9.0.0)
pnpm -v

# Verify Docker engine is running
docker info > /dev/null 2>&1 || echo "Docker daemon is not running!"
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

### Step 3: Launch Local Container Stack

Start containerized infrastructure using the root Docker Compose dev manifest:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Verify that containers have initialized and passed health checks:

```bash
docker compose -f infra/docker/docker-compose.dev.yml ps
```

_Expected output:_

- `chrishop-postgres`: `Up (healthy)`
- `chrishop-redis`: `Up (healthy)`
- `chrishop-minio`: `Up (healthy)`
- `chrishop-minio-init`: `Exited (0)`
- `chrishop-cms`: `Up (healthy)`

### Step 4: S3 Bucket Provisioning Verification

The `chrishop-minio-init` container automatically provisions the `chrishop-media` S3 bucket upon startup. Verify completion:

```bash
docker compose -f infra/docker/docker-compose.dev.yml logs minio-init | grep "MinIO bucket initialized successfully"
```

_Manual Fallback_: If the bucket was not created, run:

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec minio /bin/sh -c "
  mc alias set myminio http://localhost:9000 minioadmin minioadmin && \
  mc mb --ignore-existing myminio/chrishop-media && \
  mc anonymous set download myminio/chrishop-media
"
```

### Step 5: Directus Schema Synchronization & Database Seeding

Once PostgreSQL and Directus are healthy, apply the version-controlled schema snapshot and seed catalog data:

```bash
# Synchronize Directus collections and fields
pnpm --filter cms schema:apply

# Seed catalog categories, limited-edition products, variations, and admin roles
pnpm seed
```

### Step 6: Monorepo Verification & Quality Checks

Run monorepo validation tasks across all packages:

```bash
# Typecheck & Linting
pnpm run check

# Production Build Validation
pnpm run build

# Automated Tests
pnpm run test
```

### Step 7: Running Development Servers

Start all applications concurrently with live reloading via Turborepo:

```bash
pnpm run dev
```

Or target specific applications individually:

- **Next.js Storefront (`apps/web`)**: `pnpm --filter web dev` (available at `http://localhost:3000`)
- **Directus CMS Extensions (`apps/cms`)**: `pnpm --filter cms dev` (available at `http://localhost:8055`)

### Step 8: Testing Stripe Webhooks Locally

1. Forward Stripe events to the local Next.js webhook endpoint:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
2. Note the printed webhook signing secret (`whsec_...`) and update `STRIPE_WEBHOOK_SECRET` in `.env`.
3. In a separate terminal, trigger sample test events:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger checkout.session.expired
   ```

### Step 9: Environment Teardown & Clean Reset

- **Preserve Data (Normal Stop)**:
  ```bash
  docker compose -f infra/docker/docker-compose.dev.yml down
  ```
- **Wipe All Data & Volumes (Clean State Restart)**:
  ```bash
  docker compose -f infra/docker/docker-compose.dev.yml down -v
  ```

---

## Agent Troubleshooting Playbook

| Symptom / Error                                                  | Root Cause                                                                            | Automated Remediation Command                                                                                       |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| `Bind for 0.0.0.0:<PORT> failed: port is already allocated`      | Existing process or container is occupying port 5432, 6379, 8055, 9000, 9001, or 3000 | Run `lsof -ti :<PORT> \| xargs kill -9` then restart containers                                                     |
| Directus container exits or logs `Can't connect to the database` | Directus attempted connection before PostgreSQL finished initialization               | Healthchecks handle this automatically. Wait 10s and run `docker compose -f infra/docker/docker-compose.dev.yml ps` |
| Directus reports `NoSuchBucket` or media upload failure          | `chrishop-media` bucket not created in MinIO emulator                                 | Execute fallback bucket creation: `docker compose -f infra/docker/docker-compose.dev.yml up minio-init`             |
| `StripeSignatureVerificationError` on webhook receipt            | `STRIPE_WEBHOOK_SECRET` in `.env` does not match active `stripe listen` instance      | Copy active `whsec_...` from `stripe listen` into `.env` and restart dev server                                     |
| Stale TypeScript or Next.js build errors after branch switch     | Turborepo cache or Next.js `.next` folder contains stale artifacts                    | Run `rm -rf .turbo apps/*/.turbo apps/*/.next packages/*/.turbo packages/*/dist` then `pnpm run check`              |
| `pnpm: command not found`                                        | Corepack or global pnpm not installed                                                 | Run `corepack enable` or `npm install -g pnpm@9`                                                                    |
