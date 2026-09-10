# High Level Design - Monorepo & Architecture for Chris's Shop

This document details the finalized technical, security, operational, and deployment architecture for Chris's product showcase and e-commerce platform. It reflects all user-approved design decisions.

---

## 1. Executive Summary & Design Decisions

- **Monorepo Architecture**: Clean `pnpm` + `Turborepo` monorepo containing storefront (`apps/web`), Directus CMS extensions & configurations (`apps/cms`), shared TypeScript types (`packages/types`), shared UI design system (`packages/ui` built with **Tailwind CSS v4 + Radix UI Primitives**), pluggable notifications engine (`packages/notifications`), and Infrastructure as Code (`infra/`).
- **Data Query Strategy (Hybrid)**: Storefront content reads use `@directus/sdk` for cached REST API queries and Directus permission handling. High-concurrency checkout and Stripe webhook database transactions use a lightweight direct PostgreSQL client (**`Kysely` / `pg`**) for atomic SQL inventory operations.
- **Object Storage**: **Cloudflare R2** (S3-compatible API, zero egress bandwidth costs) for product galleries, media, and asset transforms.
- **Payment & Order Management**: Stripe Checkout with dynamic pricing (`price_data`), SAQ-A PCI compliance, atomic DB reservation, normalized `order_items` relational schema, and automated Stripe Tax calculation.
- **Host VPS & Cost-Effective Provisioning**: Provisioned on **Hetzner Cloud** via Ansible & Cloud-Init (`infra/vps/`), starting on a lightweight **CX22 instance (2 vCPU / 4 GB RAM)** for development and early testing, and scaling seamlessly to **CPX21** prior to public production launch.
- **Caching & Pre-Checkout Lock**: Zero-cost **containerized Redis OSS** container running on host VPS with Append-Only File (AOF) persistence for 10-minute checkout inventory reservations.
- **Pluggable Event Notification Engine**: Modular `NotificationProvider` architecture supporting multiple alert sinks, starting with an interactive **Discord Bot** for development, drop launches, low-stock alerts, and order notifications.
- **Shipping & Fulfillment (Phase 1 Focused)**: Streamlined manual tracking number entry in Directus Admin with carrier tracking link generation and automated **Resend** customer emails. Schema is pre-structured for Phase 2 Shippo API label generation when order volume scales.
- **Security & Admin RBAC**: Strict Directus RBAC schema guardrails, **Mandatory TOTP Two-Factor Authentication (2FA)** for Admin users, raw-body cryptographic Stripe signature verification, and 300s replay attack defense.
- **Dynamic Ephemeral PR Previews**: Automated spin-up of isolated preview environments (`pr-X.preview.chrishop.com`) using Caddy dynamic routing with Cloudflare DNS-01 ACME challenge for automatic wildcard TLS certificates.
- **Observability**: **Sentry** (free tier JS error tracking) + **Better Stack** (uptime monitoring & `/api/health` checks) + **Discord Channel Alerts**.

---

## 2. Monorepo Architecture & Package Structure

```
chrishop/
├── apps/
│   ├── web/                    # Next.js App Router storefront & API routes (/api/checkout, /api/webhooks/stripe, /api/health)
│   └── cms/                    # Directus custom hooks, extensions, snapshots & seed scripts
│       └── extensions/         # Custom Directus hooks & endpoints (built via @directus/extensions-sdk)
├── packages/
│   ├── types/                  # Shared TypeScript interfaces generated from Directus schema & Stripe types
│   ├── ui/                     # Accessible (WCAG 2.1 AA) design system (Tailwind CSS v4 + Radix UI primitives)
│   ├── notifications/          # Pluggable Notification Engine (Discord Bot Provider, Email Provider, extensible interface)
│   └── config/                 # Shared tsconfig, eslint, and prettier configurations
├── infra/
│   ├── vps/                    # Host OS Infrastructure as Code (Hetzner provisioning)
│   │   ├── cloud-init.yaml     # Server initialization script
│   │   ├── playbook.yml        # Ansible playbook (OS hardening, UFW, Docker, fail2ban)
│   │   └── inventory.ini       # Server inventory configuration
│   ├── docker/
│   │   ├── docker-compose.prod.yml    # Production multi-container stack
│   │   ├── docker-compose.staging.yml # Permanent Staging multi-container stack
│   │   ├── docker-compose.preview.yml # Template for ephemeral PR preview environments
│   │   └── docker-compose.dev.yml     # Local dev environment (Postgres, Directus, MinIO/R2 emulator, Redis OSS)
│   ├── caddy/                  # Caddyfile (Auto-HTTPS via Cloudflare DNS-01 challenge, wildcard preview routing)
│   ├── directus/
│   │   └── snapshot.yaml       # Directus schema version-controlled snapshot
│   └── scripts/                # Backup, restore, deployment, preview-teardown, security scripts
├── .github/
│   └── workflows/              # CI/CD pipelines (Lint, Test, Schema Apply, Preview Deploy, Preview Teardown, Deploy)
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 3. Directus Data Model & Hybrid Data Access

### 3.1 Data Schema (Normalized Relational Model)

1. **`categories` (Collection)**
   - `id` (UUID, Primary Key)
   - `name` (String, Required: e.g. "Sculptures", "Prints")
   - `slug` (String, Unique)
   - `description` (Text)
   - `image` (Directus File link -> Cloudflare R2)

2. **`products` (Collection)**
   - `id` (UUID, Primary Key)
   - `title` (String, Required)
   - `slug` (String, Unique)
   - `description` (Rich Text / Markdown)
   - `base_price` (Decimal, Required)
   - `status` (Select: `draft`, `published`, `archived`)
   - `featured_image` (Directus File link -> Cloudflare R2)
   - `gallery` (M2M Directus Files -> Cloudflare R2)
   - `category_id` (M2O -> `categories`)

3. **`product_variations` (Collection)**
   - `id` (UUID, Primary Key)
   - `product_id` (M2O -> `products`)
   - `variation_name` (String: e.g., "Midnight Gold Edition")
   - `sku` (String, Unique)
   - `price_override` (Decimal, Optional fallback to `base_price`)
   - `is_limited_edition` (Boolean, Default: true)
   - `total_edition_count` (Integer)
   - `stock_quantity` (Integer)
   - `release_date` (DateTime, Optional for scheduled drops)
   - `status` (Select: `coming_soon`, `active`, `sold_out`, `archived`)

4. **`orders` (Collection)**
   - `id` (UUID, Primary Key)
   - `stripe_checkout_session_id` (String, Unique)
   - `stripe_payment_intent_id` (String)
   - `customer_email` (String)
   - `shipping_name` (String)
   - `shipping_address` (JSON: street, city, state, postal_code, country)
   - `order_status` (Select: `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`)
   - `shipping_status` (Select: `unfulfilled`, `shipped`, `delivered`)
   - `carrier` (String, Optional: e.g., "USPS", "UPS", "FedEx")
   - `tracking_number` (String, Optional)
   - `tracking_url` (String, Optional generated URL)
   - `shippo_transaction_id` (String, Optional placeholder for Phase 2 Shippo integration)
   - `label_url` (String, Optional placeholder for Phase 2 Shippo integration)
   - `rate_id` (String, Optional placeholder for Phase 2 Shippo integration)
   - `amount_subtotal` (Decimal)
   - `amount_tax` (Decimal)
   - `amount_shipping` (Decimal)
   - `amount_total` (Decimal)
   - `created_at` (DateTime)

5. **`order_items` (Junction Collection - Normalized)**
   - `id` (UUID, Primary Key)
   - `order_id` (M2O -> `orders`)
   - `variation_id` (M2O -> `product_variations`)
   - `unit_price` (Decimal - Captured at point of sale)
   - `quantity` (Integer)

6. **`processed_stripe_events` (Idempotency Collection)**
   - `id` (String - Stripe Event ID `evt_...`, Primary Key)
   - `event_type` (String)
   - `processed_at` (DateTime)

### 3.2 Hybrid Data Layer
- **Content & Catalog Reads**: Storefront pages (`apps/web`) call `@directus/sdk` REST endpoints.
- **Stripe Webhooks & Checkout Transactions**: Direct PostgreSQL transactions executed via `Kysely` query builder inside Next.js API routes (`/api/webhooks/stripe`) to guarantee atomic stock decrements under raw SQL locks.
- **Price Override Fallback Formula**:
  $$\text{Effective Price} = \text{COALESCE}(\text{product\_variations.price\_override}, \text{products.base\_price})$$

### 3.3 Chris's Content Management & Revision History
- **Revision & Activity Logs**: Built-in Directus Revisions enabled for `products` and `product_variations`. Chris can view complete edit history and revert accidental edits with 1-click.
- **Drop Launch & Scheduled Publishing Mechanics**:
  - Chris sets `status = coming_soon` and populates `release_date`.
  - Storefront displays interactive live countdown timer.
  - Background Directus Cron hook automatically updates `status = active` when `release_date <= NOW()`, enabling Checkout button instantly.

### 3.4 Directus Extension Development Workflow
- Custom extensions (webhooks, automated cron triggers, fulfillment hooks) reside in `apps/cms/extensions/`.
- Built using `@directus/extensions-sdk` (`pnpm --filter cms build`). Output JavaScript bundles copy to `/directus/extensions/` inside the CMS Docker image.

---

## 4. Payment SaaS, Inventory Reservation & Order Processing

### 4.1 Stripe Dynamic Checkout (Zero-Sync Architecture)
- Checkout sessions use **Stripe `line_items.price_data`** dynamically generated at checkout creation from validated Directus DB records.
- Stripe Tax enabled via `automatic_tax: { enabled: true }`.
- Shipping options (flat rate / free shipping threshold) configured directly in Checkout session options.

### 4.2 Local Pre-Checkout Inventory Reservation (Redis OSS)
1. **Checkout Initiation**: User clicks "Checkout" → `/api/checkout` API executes a **Redis Stock Reservation**:
   - System checks `available_stock = DB.stock_quantity - Active_Redis_Reservations`.
   - If `available_stock >= requested_qty`, a Redis key is created: `reservation:{variation_id}:{session_id}` with a **10-minute TTL** matching Stripe Checkout session duration.
   - If stock is insufficient, user receives immediate UI notice: *"Item is currently reserved in another checkout session."*
2. **Payment Completion (Stripe Webhook)**:
   - Upon receiving `checkout.session.completed`, atomic SQL (via Kysely) updates inventory:
     ```sql
     UPDATE product_variations
     SET stock_quantity = stock_quantity - :qty,
         status = CASE WHEN (stock_quantity - :qty) <= 0 THEN 'sold_out' ELSE status END
     WHERE id = :variation_id AND stock_quantity >= :qty;
     ```
   - Deletes Redis reservation key `reservation:{variation_id}:{session_id}`.
3. **Session Expiration**: If customer abandons checkout, Redis TTL key expires automatically, releasing reserved unit back to available pool.

---

## 5. Shipping & Order Fulfillment Workflow

### Phase 1 Fulfillment Story (Current Focus):
1. **Order Alert**: Directus webhook calls `packages/notifications` engine -> triggers **Discord Bot alert** in `#store-orders`: *"🛒 New Order #1042 - Midnight Gold Edition (Qty: 1) - $150.00"*.
2. **Order Review**: Chris logs into Directus Admin (`admin.chrishop.com`) with TOTP 2FA, navigates to `orders` collection filtered by `shipping_status = 'unfulfilled'`.
3. **Packing & Dispatch**: Chris prepares and packs the physical product drop item.
4. **Fulfillment Update**: Chris selects Carrier (e.g., `USPS`), inputs `tracking_number`, updates `shipping_status` to `shipped`, and clicks **Save**.
5. **Carrier Tracking URL Builder**: Directus action hook computes carrier-specific tracking link (e.g. `https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}`) and updates `tracking_url`.
6. **Automated Customer Notification**: Directus hook dispatches branded HTML email via **Resend API** to `customer_email` with tracking link.

### Phase 2 Architecture Readiness (Future Shippo Upgrade):
- `orders` collection schema includes placeholder fields (`shippo_transaction_id`, `label_url`, `rate_id`).
- When order volume scales past 50 orders/month, a custom Directus action extension can be enabled to fetch shipping rates and purchase 1-click labels directly within Directus Admin.

---

## 6. Notification System Architecture (`packages/notifications`)

To ensure adaptability to multiple communication platforms:

```typescript
export interface NotificationPayload {
  title: string;
  message: string;
  fields?: Record<string, string>;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<void>;
}

// Development & Operational Implementation
export class DiscordNotificationProvider implements NotificationProvider {
  constructor(private webhookUrl: string) {}
  async send(payload: NotificationPayload): Promise<void> { /* Rich Discord Embed formatting */ }
}
```

- **Development & Operations Sink**: Discord Bot / Webhook posting to `#store-orders` (purchases & low stock alerts) and `#dev-alerts` (deployments, uptime alerts, errors).
- **Extensibility**: Easy addition of Telegram, Slack, or SMS adapters in the future without refactoring core storefront or CMS code.

---

## 7. Security Architecture, VPS Hardening & Secrets Management

- **Admin Account Security**: **Mandatory TOTP Two-Factor Authentication (2FA)** for Chris's account and any admin roles in Directus.
- **Secrets Management**:
  - Dev: Local `.env` (git-ignored).
  - CI/CD: GitHub Encrypted Secrets.
  - Production at Rest: Production secrets stored in `infra/vps/.env.production` encrypted using `age`.
  - Backup Key Isolation: Master backup decryption key (`AGE_BACKUP_KEY`) stored strictly in GitHub Secrets and off-site password manager. Never stored unencrypted on VPS host.
- **Hetzner VPS OS Hardening**: Managed via Ansible (`infra/vps/playbook.yml`) and Cloud-Init (`infra/vps/cloud-init.yaml`): UFW firewall (80, 443, 22 permitted), private Docker network isolation for Postgres & Redis, SSH key authentication enforced, fail2ban active, Docker log rotation (`10m`, `3` files).
- **Stripe Security**: Raw-body signature verification, 300s replay attack window check, `processed_stripe_events` idempotency table.

---

## 8. Multi-Environment Architecture & Ephemeral PR Previews

### 8.1 Environment Matrix
1. **Local Dev**: `docker-compose.dev.yml` (Postgres, Directus, MinIO/R2 local emulator, Redis OSS).
2. **Ephemeral PR Previews (`pr-X.preview.chrishop.com`)**: Automated spin-up for open PRs with Caddy Cloudflare DNS-01 ACME wildcard SSL certificates.
3. **Permanent Staging (`staging.chrishop.com`)**: Staging stack (`docker-compose.staging.yml`) on **Hetzner CX22**.
4. **Production (`chrishop.com`)**: Production stack (`docker-compose.prod.yml`) promoted to **Hetzner CPX21** prior to public launch.

---

### 8.2 Ephemeral PR Preview Workflow (Per-PR Staging)

```
[ Developer opens PR #42 (feature/new-drop-ui) ]
                      │
                      ▼
 [ GitHub Actions: .github/workflows/preview-deploy.yml ]
                      │
                      ├─▶ 1. Builds preview Docker images (web:pr-42, cms:pr-42)
                      ├─▶ 2. Provisions Docker compose project `pr-42` on VPS via docker-compose.preview.yml
                      ├─▶ 3. Provisions isolated Postgres DB `pr_42_db` & seeds sample products (`pnpm seed`)
                      ├─▶ 4. Caddy + Cloudflare DNS-01 ACME configures wildcard TLS: `pr-42.preview.chrishop.com`
                      └─▶ 5. GitHub Bot posts comment on PR: "🚀 Preview deployed: https://pr-42.preview.chrishop.com"
```

- **Resource Teardown**: When PR is closed/merged, `.github/workflows/preview-teardown.yml` destroys containers, database `pr_42_db`, and Caddy route.

---

### 8.3 Two-Phase Expand-and-Contract Schema Snapshot Workflow
- **Phase A (Additive)**: Schema migrations in release $N$ are strictly **additive** (adding new columns, tables, or non-null fields with default values). `directus schema apply` runs Phase A non-destructively while old containers run.
- **Application Deployment**: New app containers deploy and pass health checks.
- **Phase B (Contract - Cleanup)**: Destructive changes (dropping obsolete columns/tables) are deferred to a separate **Contract Release $N+1$** after old app containers have been fully drained.

---

### 8.4 Container Health Check Specifications
Health checks run every 5 seconds during rolling container deployments:
1. **Storefront (`web`) Health Endpoint (`/api/health`)**: Checks HTTP 200, Postgres query (`SELECT 1`), Redis ping (`redis.ping()`), and Directus REST API (`GET /server/ping`).
2. **CMS (`cms`) Health Endpoint (`/server/health`)**: Verifies Postgres DB pool status and Cloudflare R2 storage access.
3. **Deployment Gate**: Traffic is swapped upstream only after **3 consecutive healthy HTTP 200 checks**.

---

### 8.5 Backup, Disaster Recovery & Off-Site Archiving
Daily cron `infra/scripts/backup.sh` runs `pg_dump` compressed & AES-256 encrypted using `age`, uploading immediately to secondary off-site S3/R2 bucket (`chrishop-backups`). Retention: 7 daily, 4 weekly, 12 monthly. **RPO < 24 hrs; RTO < 15 mins**.

---

## 9. Observability & Alerting Matrix

| Component | Metric / Condition | Threshold | Alert Channel | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **Uptime** | HTTP GET `/api/health` | Status != 200 for 60s | Better Stack & Discord `#dev-alerts` | Immediate container restart |
| **App Errors** | JS Exceptions | > 5 errors/min | Sentry & Discord `#dev-alerts` | Inspect Sentry trace |
| **New Purchases** | Order Creation | Event `checkout.session.completed` | Discord `#store-orders` | Fulfillment review |
| **Drop Inventory** | Variation Stock Quantity | `stock_quantity <= 3` | Discord `#store-orders` | Prepare "Sold Out" banner |

---

## 10. Performance, Caching, SEO & Accessibility

- **Cloudflare Edge CDN**: Caches static assets, global CSS/JS, and public media.
- **Next.js ISR / SSG**: Product pages statically generated with Incremental Static Regeneration (`revalidate = 60`).
- **Directus Asset Caching**: Redis asset transform caching (`STORAGE_CACHE_TTL=86400`).
- **SEO & OpenGraph**: Dynamic metadata, OpenGraph images (`og:image`), Twitter Cards, canonical tags, `sitemap.xml`, and JSON-LD `Product` / `Offer` schemas.
- **Accessibility**: **WCAG 2.1 AA Compliance** (Tailwind CSS v4 + Radix UI primitives, 4.5:1 contrast, visible focus outlines, keyboard navigation, screen reader ARIA labels).

---

## 11. Local Development Environment & Workflow

- **Dev Stack**: `docker compose -f infra/docker/docker-compose.dev.yml up` (Postgres, Directus, MinIO/R2 local emulator, Redis OSS).
- **Stripe Webhook Testing**: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- **Database Seeding**: `pnpm seed` populates local Directus with sample categories, products, variations, and Chris RBAC permissions.

---

## Verification & Test Plan

### Automated Verification
1. **Workspace Type & Lint Check**: `pnpm run check` across all monorepo packages (`web`, `cms`, `ui`, `notifications`).
2. **Ephemeral PR Preview Deploy & Teardown**: Open test PR -> verify GitHub Actions provisions `pr-X.preview.chrishop.com` with Caddy Cloudflare DNS-01 wildcard TLS -> close PR -> verify automatic teardown.
3. **Pre-Checkout Reservation Test**: Unit tests verifying Redis reservation keys expire after 10 minutes and prevent double-booking.
4. **Stripe Webhook Security Suite**: Unit tests verifying valid signatures pass, invalid signatures fail (400), expired timestamps fail, duplicate `event.id` calls return 200 without re-processing logic.
5. **Health Check Endpoint Integration Test**: Integration test verifying `/api/health` returns 200 when DB/Redis/CMS are healthy.

### Manual Verification
1. **Discord Bot Alert Verification**: Trigger test checkout -> verify rich Discord embed arrives in `#store-orders` channel.
2. **Directus 2FA Verification**: Attempt login to Directus Admin -> verify TOTP prompt appears and blocks authentication without valid code.
3. **Phase 1 Fulfillment User Story**: Create test order -> Chris inputs tracking number in Directus -> verify tracking URL is generated and Resend email is delivered.

