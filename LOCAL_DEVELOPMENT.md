# Local Development Guide (`LOCAL_DEVELOPMENT.md`)

Welcome to the **ChrisShop** monorepo local development environment. This guide provides comprehensive, step-by-step instructions for human developers and AI assistants to set up, run, seed, test, and troubleshoot the entire local development stack.

---

## 1. System Architecture & Port Mapping

The **ChrisShop** platform is organized as a Turborepo monorepo managed with `pnpm` workspaces:

- **Storefront Application (`apps/web`)**: Next.js 15 App Router e-commerce frontend.
- **CMS Extensions & Scripts (`apps/cms`)**: Directus 11 headless CMS extensions, schema migrations, and database seed scripts.
- **UI Design System (`packages/ui`)**: Shared React components and Tailwind CSS styling presets.
- **Shared Types (`packages/types`)**: TypeScript domain models (Products, Variations, Orders, Inventory, Stripe Events).
- **Notifications Engine (`packages/notifications`)**: Transactional email (Resend / Mailpit) and Discord webhook alerts.
- **Shared Tooling Config (`packages/config`)**: Centralized TypeScript, ESLint, and Prettier configurations.
- **Container Infrastructure (`infra/docker/docker-compose.dev.yml`)**: Local containerized development stack.

### Local Service Port Reference

| Service                       | Port   | Internal / External URL           | Credentials / Notes                                 |
| :---------------------------- | :----- | :-------------------------------- | :-------------------------------------------------- |
| **Next.js Storefront**        | `3000` | `http://localhost:3000`           | Public customer storefront                          |
| **Directus CMS Admin UI**     | `8055` | `http://localhost:8055`           | `admin@chrishop.com` / `AdminPassword123!`          |
| **Directus CMS API**          | `8055` | `http://localhost:8055/items/...` | Internal/External REST & GraphQL API                |
| **MinIO S3 API**              | `9000` | `http://localhost:9000`           | `minioadmin` / `minioadmin` (S3 emulator)           |
| **MinIO Web Console**         | `9001` | `http://localhost:9001`           | `minioadmin` / `minioadmin`                         |
| **PostgreSQL 16**             | `5432` | `localhost:5432`                  | `chrishop` / `chrishop_dev_secret` (`chrishop_dev`) |
| **Redis 7 OSS**               | `6379` | `localhost:6379`                  | Caching & stock reservation locks                   |
| **Mailpit Web UI (Optional)** | `8025` | `http://localhost:8025`           | Local transactional email debugger                  |

---

## 2. Prerequisites & Machine Setup

Before cloning or running the project, ensure your workstation has the following installed:

1. **Node.js**: `v20.x` or higher (Active LTS recommended, e.g. Node 20 or 22).
   ```bash
   node -v # Should report >= v20.0.0
   ```
2. **pnpm**: `v9.x` or higher (`pnpm` is the strict package manager for this monorepo).
   ```bash
   corepack enable
   # Or install directly:
   npm install -g pnpm@9
   pnpm -v # Should report >= 9.0.0
   ```
3. **Docker & Docker Compose**: Docker Compose `v2.20+` via Docker Desktop, OrbStack, or Colima.
   ```bash
   docker --version
   docker compose version
   ```
4. **Git**: `v2.43+` with Worktree support.
   ```bash
   git --version
   ```
5. **Worktrunk (`wt`)**: Recommended CLI tool for isolated Git worktree management across stories.
   ```bash
   # Via Homebrew:
   brew install worktrunk
   # Or via Cargo:
   cargo install worktrunk
   ```
6. **Stripe CLI**: Required for intercepting and forwarding local Stripe webhook events.
   ```bash
   # macOS via Homebrew:
   brew install stripe/stripe-cli/stripe
   stripe -v
   ```

---

## 3. Environment Variable Setup

The repository provides a documented `.env.example` template at the root with safe local development defaults.

### 3.1 Initialize `.env`

Copy the template file to create your active local environment file:

```bash
cp .env.example .env
```

### 3.2 Key Variable Configuration

The default `.env` values work out-of-the-box with the local Docker Compose stack:

```env
# Runtime
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CMS_URL=http://localhost:8055

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
DIRECTUS_URL=http://localhost:8055

# Cloudflare R2 / Local MinIO Storage Emulator
STORAGE_LOCATIONS=s3
STORAGE_S3_DRIVER=s3
STORAGE_S3_KEY=minioadmin
STORAGE_S3_SECRET=minioadmin
STORAGE_S3_BUCKET=chrishop-media
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_REGION=us-east-1
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_S3_FORCE_PATH_STYLE=true
STORAGE_CACHE_TTL=86400

# Redis OSS
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_51placeholder_secret_key_for_local_dev
STRIPE_WEBHOOK_SECRET=whsec_placeholder_webhook_secret_for_local_dev
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51placeholder_pub_key_for_local_dev

# Notifications & Email
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/placeholder
SMTP_HOST=localhost
SMTP_PORT=1025
RESEND_API_KEY=re_placeholder_api_key_123456789
```

> [!WARNING]
> Never commit `.env` or any production secrets to Git. Source control only tracks `.env.example`.

---

## 4. Starting the Local Container Stack

The local infrastructure services run in Docker containers defined in `infra/docker/docker-compose.dev.yml`.

### 4.1 Boot the Services

Start PostgreSQL, Redis, MinIO, the `minio-init` bucket provisioner, and Directus in detached mode:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### 4.2 Verify Container Health

Check that all containers are healthy and running:

```bash
docker compose -f infra/docker/docker-compose.dev.yml ps
```

Expected container states:

- `chrishop-postgres`: `Up (healthy)` on port `5432`
- `chrishop-redis`: `Up (healthy)` on port `6379`
- `chrishop-minio`: `Up (healthy)` on ports `9000` (API) and `9001` (Console)
- `chrishop-minio-init`: `Exited (0)` (Successfully completed bucket creation)
- `chrishop-cms`: `Up (healthy)` on port `8055`

### 4.3 Inspect Container Logs

To stream live logs for all services or a single target service:

```bash
# All services:
docker compose -f infra/docker/docker-compose.dev.yml logs -f

# Specific service (e.g. Directus CMS):
docker compose -f infra/docker/docker-compose.dev.yml logs -f cms
```

---

## 5. MinIO S3 Media Storage & Bucket Setup

Directus stores product artwork images, thumbnails, and downloadable digital assets in S3-compatible object storage. In local development, **MinIO** serves as an emulator for production **Cloudflare R2**.

### 5.1 Automated Bucket Provisioning

The `infra/docker/docker-compose.dev.yml` stack includes an automated provisioner service (`minio-init` using `minio/mc:latest`). Upon startup:

1. It waits for `chrishop-minio` to pass healthchecks.
2. It sets up an alias `myminio` targeting `http://minio:9000`.
3. It creates the bucket `chrishop-media` (`mc mb --ignore-existing`).
4. It sets the bucket download policy to public (`mc anonymous set download myminio/chrishop-media`).

### 5.2 MinIO Web Console Access

You can inspect uploaded files, verify buckets, or manually upload assets via the MinIO Web Console:

- **URL**: `http://localhost:9001`
- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin`

### 5.3 Manual Bucket Creation Fallback

If the `minio-init` container was skipped or volume data was corrupted, you can initialize the bucket manually:

```bash
# Using Docker Compose exec:
docker compose -f infra/docker/docker-compose.dev.yml exec minio-init /bin/sh -c "
  /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin && \
  /usr/bin/mc mb --ignore-existing myminio/chrishop-media && \
  /usr/bin/mc anonymous set download myminio/chrishop-media
"
```

---

## 6. Schema Snapshot Application & Database Seeding

Once PostgreSQL and Directus are healthy, configure the Directus collections and populate test catalog data.

### 6.1 Apply Schema Snapshot

Directus collection schemas, relations, and fields are tracked under `apps/cms`. To synchronize the database schema:

```bash
pnpm --filter cms schema:apply
```

### 6.2 Seed the Database

Populate initial seed data (categories, limited-edition products, variations, inventory counts, and administrator roles):

```bash
pnpm seed
# Or target cms package directly:
pnpm --filter cms seed
```

Seeded entities include:

- **Categories**: `Sculptures`, `Paintings`, `Apparel`.
- **Products**: Sample artwork (e.g., `Midnight Gold Sculpture`) with markdown descriptions and pricing.
- **Variations**: Edition sizes (e.g., `Edition #1-25`), SKUs (`MNG-001`), and stock levels.
- **Admin Accounts**: Access credentials configured for local testing.

### 6.3 Exporting Schema Changes

When modifying collections, fields, or permissions via the Directus Admin UI (`http://localhost:8055`), export the updated schema snapshot to commit it:

```bash
pnpm --filter cms schema:export
```

---

## 7. Running Development Servers

Install dependencies across the monorepo first:

```bash
pnpm install
```

### 7.1 Start All Monorepo Applications Concurrently

Run all workspace applications in development mode with live reload via Turborepo:

```bash
pnpm run dev
```

### 7.2 Running Individual Applications

To run specific applications in isolation:

- **Next.js Storefront (`apps/web`)**:

  ```bash
  pnpm --filter web dev
  ```

  Open `http://localhost:3000` in your browser.

- **Directus CMS Extensions (`apps/cms`)**:
  ```bash
  pnpm --filter cms dev
  ```
  Open `http://localhost:8055` in your browser.

---

## 8. Code Quality, Testing, and Verification

The monorepo enforces strict TypeScript, linting, and formatting rules across all packages.

### 8.1 Typechecking & Linting

Run TypeScript typecheck across all applications and shared packages:

```bash
pnpm run check
# Or linting alias:
pnpm run lint
```

### 8.2 Automated Test Suites

Run unit and integration tests across the monorepo:

```bash
pnpm run test
```

### 8.3 Production Build Validation

Validate production compilation for all applications and packages:

```bash
pnpm run build
```

### 8.4 Code Formatting

Verify and apply Prettier formatting across the codebase:

```bash
# Check formatting without modifications:
pnpm run format:check

# Automatically format all files:
pnpm run format
```

---

## 9. Testing Stripe Webhooks Locally

> [!NOTE]
> **Planned for Phase 3 (Story 3.3)**: The `/api/webhooks/stripe` endpoint and dynamic Stripe Checkout integration are scheduled for implementation in Phase 3. The instructions below document the target development workflow once those routes are established.

ChrisShop uses Stripe Checkout for order payments and stock reconciliation. To test webhook event handling locally:

### 9.1 Log In to Stripe CLI

Authenticate the Stripe CLI with your test account:

```bash
stripe login
```

### 9.2 Forward Webhook Events to Next.js

Start the Stripe event listener forwarding to the local Next.js webhook endpoint:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Upon launching, Stripe CLI outputs a signing secret:

```text
> Ready! Your webhook signing secret is whsec_1234567890abcdef...
```

### 9.3 Update Local `.env`

Copy the printed `whsec_...` value and set it in your root `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

Restart your Next.js dev server (`pnpm --filter web dev`) so it picks up the updated secret.

### 9.4 Trigger Simulated Events

In a separate terminal, trigger sample events to test fulfillment and order creation logic:

```bash
# Completed checkout session:
stripe trigger checkout.session.completed

# Expired session (triggers Redis lock release):
stripe trigger checkout.session.expired
```

---

## 10. Container Teardown & Environment Reset

### 10.1 Stopping Containers

To stop running containers while preserving database and S3 volume data:

```bash
docker compose -f infra/docker/docker-compose.dev.yml down
```

### 10.2 Full Volume Reset (Fresh Start)

To wipe all PostgreSQL tables, Directus schemas, Redis cache keys, and MinIO storage volumes for a completely clean environment:

```bash
docker compose -f infra/docker/docker-compose.dev.yml down -v
```

After wiping volumes, reboot the stack and re-seed:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
pnpm --filter cms schema:apply
pnpm seed
```

---

## 11. Automated Backlog Grooming & Refinement Daemon (macOS `launchd`)

ChrisShop provides an autonomous host-level background daemon using macOS `launchd` to perform adversarial backlog review, codebase alignment checks, and story refinement every 12 hours (scheduled at `02:00` and `14:00` EDT/EST).

This daemon runs independently of active IDE sessions or in-editor timers.

### 11.1 Service Management Commands

The service is managed using the turnkey script in `infra/launchd/install.sh`:

```bash
# Install and register the LaunchAgent with macOS launchd
./infra/launchd/install.sh install

# Check service registration and status
./infra/launchd/install.sh status

# Trigger an immediate manual refinement run (without waiting for the schedule)
./infra/launchd/install.sh run-now

# View latest stdout and stderr logs
./infra/launchd/install.sh logs

# Unload and remove the service
./infra/launchd/install.sh uninstall
```

### 11.2 Enabling AI Reasoning (Claude Opus / Gemini)

The daemon automatically runs deterministic backlog integrity audits. To enable deep adversarial LLM analysis (identifying missing failure modes, suggesting new stories, spotting race conditions), configure your API key in `~/.chrishop/refinement.env`:

```bash
# Example ~/.chrishop/refinement.env
ANTHROPIC_API_KEY=sk-ant-api03-...
REFINEMENT_MODEL=claude-3-opus-20240229
```

Generated reports are persisted to `~/.chrishop/logs/refinement-report-latest.md`.

---

## 12. Troubleshooting & FAQ

### Issue: Port Collisions (`address already in use`)

- **Symptoms**: `Error response from daemon: driver failed programming external connectivity on endpoint: Bind for 0.0.0.0:5432 failed: port is already allocated`.
- **Cause**: A local instance of PostgreSQL, Redis, or an old container is bound to the port.
- **Remediation**:
  Identify and terminate the conflicting process:
  ```bash
  # Check PostgreSQL port (5432):
  lsof -i :5432
  # Check Redis port (6379):
  lsof -i :6379
  # Check Directus port (8055):
  lsof -i :8055
  # Check MinIO ports (9000, 9001):
  lsof -i :9000
  lsof -i :9001
  # Check Next.js port (3000):
  lsof -i :3000

  # Terminate conflicting process by PID:
  kill -9 <PID>
  ```

### Issue: Directus Connection Retries on Boot

- **Symptoms**: `chrishop-cms` logs repeatedly report `Can't connect to the database` before stabilizing.
- **Cause**: PostgreSQL takes a few seconds to run initialization scripts. Directus will retry automatically. The Docker Compose configuration includes healthchecks ensuring Directus depends on PostgreSQL being healthy.
- **Remediation**: Allow 10–15 seconds for healthchecks to pass. Check `docker compose -f infra/docker/docker-compose.dev.yml ps` to confirm `chrishop-postgres` is `(healthy)`.

### Issue: MinIO Bucket `chrishop-media` Missing or Unauthorized

- **Symptoms**: Directus reports S3 `NoSuchBucket` or `Access Denied` when uploading media.
- **Remediation**:
  1. Check `minio-init` container logs:
     ```bash
     docker compose -f infra/docker/docker-compose.dev.yml logs minio-init
     ```
  2. If the container failed, re-run the manual initialization command described in [Section 5.3](#53-manual-bucket-creation-fallback).
  3. Ensure `STORAGE_S3_FORCE_PATH_STYLE=true` is present in your `.env`.

### Issue: Stripe Webhook Signature Verification Fails

- **Symptoms**: `POST /api/webhooks/stripe 400 Bad Request` — `Webhook Error: No signatures found matching the expected signature for payload`.
- **Cause**: `STRIPE_WEBHOOK_SECRET` in `.env` does not match the secret output by the currently running `stripe listen` instance.
- **Remediation**: Every new `stripe listen` session provides a unique secret. Update `STRIPE_WEBHOOK_SECRET` in `.env` and restart `apps/web`.

### Issue: Turborepo Stale Cache or Build Artifacts

- **Symptoms**: Typecheck or build fails with stale references after switching branches or updating packages.
- **Remediation**:
  Purge Turborepo caches and Next.js build outputs:
  ```bash
  rm -rf .turbo apps/*/.turbo apps/*/.next packages/*/.turbo packages/*/dist
  pnpm run check
  ```
