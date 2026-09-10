# Dependency Specification: Directus CMS (`DEP_DIRECTUS.md`)

This document specifies the integration, configuration, schema lifecycle, storage drivers, caching layers, and operational procedures for **Directus CMS 11**, the headless content and order management engine for ChrisShop.

---

## 1. Service Overview & Architecture

- **Version**: Directus `v11.x` (Official Docker image: `directus/directus:11`)
- **Runtime Environment**: Node.js 20 LTS on Alpine Linux
- **Architecture Role**:
  - Headless content management for categories, products, limited-edition variations, and media galleries.
  - Back-office order fulfillment console for Chris (shipping updates, tracking numbers, carrier dispatch).
  - Revision history tracking and scheduled drop release publishing.
- **Hybrid Data Access Pattern**:
  - **Storefront Reads**: Next.js (`apps/web`) uses `@directus/sdk` for cached REST API queries and permissions-validated content retrieval.
  - **Checkout Transactions**: High-concurrency Stripe webhook processing bypasses Directus API and writes directly to PostgreSQL via `Kysely` transactions to ensure strict ACID inventory locks.

---

## 2. Directus Configuration Specification

Directus is configured via environment variables supplied in Docker Compose:

### 2.1 Core Environment Variables

```env
# Runtime & Security Keys
KEY="<random-uuid-key>"
SECRET="<random-uuid-secret>"
PUBLIC_URL="https://admin.shop.jacobmiller22.com"
PORT=8055
LOG_LEVEL="info"

# PostgreSQL Database Connection
DB_CLIENT="pg"
DB_HOST="postgres"
DB_PORT=5432
DB_DATABASE="chrishop"
DB_USER="directus"
DB_PASSWORD="<db-password>"
DB_POOL_MIN=2
DB_POOL_MAX=10

# Cloudflare R2 / S3 Object Storage Configuration
STORAGE_LOCATIONS="r2"
STORAGE_R2_DRIVER="s3"
STORAGE_R2_KEY="<CLOUDFLARE_R2_ACCESS_KEY_ID>"
STORAGE_R2_SECRET="<CLOUDFLARE_R2_SECRET_ACCESS_KEY>"
STORAGE_R2_BUCKET="chrishop-media"
STORAGE_R2_REGION="auto"
STORAGE_R2_ENDPOINT="https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com"
STORAGE_R2_PUBLIC_URL="https://media.chrishop.com"
STORAGE_R2_FORCE_PATH_STYLE=false

# Redis Query & Asset Transform Caching
CACHE_ENABLED=true
CACHE_STORE="redis"
REDIS="redis://redis:6379"
CACHE_TTL="1h"
STORAGE_CACHE_TTL=86400

# Authentication & Admin Security
AUTH_PROVIDERS="local"
AUTH_2FA_REQUIRED=true
CORS_ENABLED=true
CORS_ORIGIN="https://shop.jacobmiller22.com,https://chrishop.com,http://localhost:3000"
CORS_METHODS="GET,POST,PATCH,DELETE"
```

---

## 3. Schema Snapshots & Data Model

Directus schema migrations and field definitions are version-controlled using standard YAML snapshots.

### 3.1 Core Data Collections

1. **`categories`**: Product taxonomy (UUID `id`, `name`, `slug`, `description`, `image`).
2. **`products`**: Parent product entities (UUID `id`, `title`, `slug`, `description`, `base_price`, `status`, `featured_image`, `gallery`, `category_id`).
3. **`product_variations`**: Purchasable stock keeping units (UUID `id`, `product_id`, `variation_name`, `sku`, `price_override`, `is_limited_edition`, `total_edition_count`, `stock_quantity`, `release_date`, `status`).
4. **`orders`**: Customer purchase orders (UUID `id`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `customer_email`, `shipping_name`, `shipping_address`, `order_status`, `shipping_status`, `carrier`, `tracking_number`, `tracking_url`, `amount_subtotal`, `amount_tax`, `amount_shipping`, `amount_total`, `created_at`).
5. **`order_items`**: Normalized order line items (UUID `id`, `order_id`, `variation_id`, `unit_price`, `quantity`).
6. **`processed_stripe_events`**: Idempotency ledger preventing duplicate Stripe webhook replays (VARCHAR `id`, `event_type`, `processed_at`).

### 3.2 Snapshot Management Commands

```bash
# Export active Directus schema to apps/cms/snapshot.yaml
pnpm --filter cms schema:snapshot

# Apply schema snapshot to active database
pnpm --filter cms schema:apply

# Seed development database with sample catalog and orders
pnpm seed
```

---

## 4. Extensions Architecture (`apps/cms/extensions/`)

Directus functionality is extended via `@directus/extensions-sdk`:

- **Directory**: `apps/cms/extensions/`
- **Build Pipeline**: `pnpm --filter cms build` bundles TypeScript extension hooks into `/directus/extensions/`.
- **Custom Action Hooks**:
  1. **Carrier Tracking URL Generator**: Triggered on `orders.items.update`. When `shipping_status` changes to `'shipped'` with a non-empty `tracking_number` and `carrier` (e.g. USPS), computes the canonical carrier tracking URL and persists it to `orders.tracking_url`.
  2. **Resend Shipping Notification**: Fires upon order fulfillment, invoking the `packages/notifications` engine to dispatch customer email with tracking link.
  3. **Scheduled Drop Publisher**: Background cron checking `release_date <= NOW()` to transition `product_variations.status` from `'coming_soon'` to `'active'`.

---

## 5. Security & Role-Based Access Control (RBAC)

### 5.1 Public Role Permissions (Storefront)

- **`categories`**: Read access strictly for categories associated with published products.
- **`products`**: Read access restricted to `status = 'published'`.
- **`product_variations`**: Read access restricted to `status IN ('coming_soon', 'active', 'sold_out')`.
- **`orders`, `order_items`, `processed_stripe_events`**: **Zero access** (blocked).

### 5.2 Administrator Role & Two-Factor Authentication

- Chris's administrative user belongs to the built-in Administrator role.
- **Mandatory TOTP 2FA**: Required for all administrators. Login requires username, password, and 6-digit TOTP authenticator token.

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                                  | Status     | Scheduled Story | Description                                              |
| ------------------------------------- | ---------- | --------------- | -------------------------------------------------------- |
| `apps/cms/snapshot.yaml`              | `[EXISTS]` | Phase 1         | Canonical Directus schema snapshot                       |
| `infra/directus/snapshot.yaml`        | `[EXISTS]` | Phase 1         | Infrastructure mirror of Directus schema snapshot        |
| `apps/cms/scripts/schema-apply.ts`    | `[EXISTS]` | Phase 1         | TypeScript script executing schema apply                 |
| `apps/cms/scripts/schema-export.ts`   | `[EXISTS]` | Phase 1         | TypeScript script exporting schema snapshot              |
| `apps/cms/scripts/seed.ts`            | `[EXISTS]` | Phase 1         | Database seeding script with demo catalog                |
| `apps/cms/extensions/`                | `[EXISTS]` | Phase 1         | Custom extensions directory for hooks and endpoints      |
| `infra/scripts/deps/directus_sync.sh` | `[EXISTS]` | Story 2.2       | Shell automation script for CI/CD schema synchronization |

---

## 7. Operational Health Checks & Verification

```bash
# Verify Directus service health (DB pool & storage connectivity)
curl -s http://localhost:8055/server/health | jq .

# Verify basic HTTP liveness
curl -s http://localhost:8055/server/ping
# Expected: "pong"

# Run automated schema snapshot integrity test
pnpm --filter cms test
```
