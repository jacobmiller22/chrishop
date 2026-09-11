# Story 2.30: Full Monorepo Architecture Reconciliation — Eliminate Legacy Split, Archive Folders & Directus Stack

- **GitHub Issue**: [#142](https://github.com/jacobmiller22/chrishop/issues/142)
- **Status**: Completed
- **Epic**: `epic:phase-2` (Phase 2: Infrastructure & Dependencies)
- **Labels**: `epic:phase-2`, `type:infra`, `type:feature`, `type:docs`, `status:completed`, `priority:high`

---

## 1. Problem Statement & Background

Following initial architectural pivot explorations (Story 0.2), the ChrisShop codebase was split across two conflicting paradigms:
1. **The Legacy Paradigm**: PostgreSQL 16, Redis OSS, Directus 11, Hetzner VPS, Docker Compose, Caddy 2 reverse proxy, and Stripe Checkout sessions.
2. **The Target Paradigm**: Cloudflare Workers (via OpenNext), Next.js 15 App Router, Payload CMS v3, Cloudflare D1 (SQLite), Cloudflare R2 object storage, Workers KV, and Shopify Headless (Storefront API + Checkout).

### Concrete Issues Resolved:
- **Obsolete Workspaces**: `apps/cms` was maintained as an active pnpm workspace running Directus 11 with 5 unit test suites validating dead code in `infra/archive/`.
- **Archive Folder Clutter**: Deprecated code was moved into `infra/archive/` and `docs/deps/archive/`, leaving dead IaC, Compose files, and specs in source control.
- **Storefront Coupling**: `apps/web` depended on `@directus/sdk`, retained Directus REST queries, and displayed legacy MinIO/Directus copy in UI components.
- **Confusing Configuration**: Root `.env.example` still published PostgreSQL, Directus, MinIO, Redis, and Stripe credentials.
- **Type Mismatches**: `packages/types` still contained Directus foreign keys and Stripe session/payment IDs.
- **Outdated Operational Runbooks**: `docs/runbooks/DISASTER_RECOVERY.md` documented Hetzner VPS replacement, Ansible playbooks, and `pg_dump` restores rather than Cloudflare-native rollbacks and D1 point-in-time recovery.
- **Project Setup Inconsistencies**: `docs/PROJECT_SETUP.md` still contained legacy Phase 1-6 milestones and Directus/Stripe issue creation scripts.
- **Security & Dependabot Scope**: Dependabot and security audits scanned 7 packages including the dead `apps/cms`.
- **Missing Local Data Layer**: The storefront lacked an operational SQLite seed script and catalog data access layer.

---

## 2. Explicit User Directives & Constraints Solved

- **Zero Archive Folders**: Completely eliminate all archive directories (`infra/archive/`, `docs/deps/archive/`) and legacy files. No files are moved into archive folders.
- **No README/Markdown Regex Checks**: Verification scripts and test suites must strictly verify functional code and never regex-scan markdown documentation.
- **Local SQLite First**: The catalog data layer and seeding connect directly to local SQLite (`node:sqlite` `DatabaseSync`) for development and testing, with future-proof compatibility for Cloudflare D1.
- **Payload CMS Admin Verification**: Added automated integration testing confirming the Payload CMS admin panel (`/admin`), collections, App Router endpoints, REST, and GraphQL handlers compile and respond properly.
- **Shopify Mock Engine**: Implemented an in-process GraphQL WireMock engine for Shopify Storefront API cart mutations.

---

## 3. Implementation Summary

### 3.1 Workspace & Legacy Code Purge
- Deleted `apps/cms/` completely.
- Deleted `infra/archive/` and `docs/deps/archive/`.
- Deleted `infra/directus/` (`snapshot.yaml`).
- Deleted legacy scripts: `infra/scripts/deps/directus_sync.sh`, `infra/scripts/backup.sh`, `infra/scripts/restore.sh`.
- Removed `@directus/sdk` and deleted `apps/web/src/lib/directus*` and `apps/web/tests/directus*.test.ts`.
- Pruned workspace packages from 7 to 6 active packages (`/`, `/apps/web`, `/packages/config`, `/packages/notifications`, `/packages/types`, `/packages/ui`) in `.github/dependabot.yml` and `pnpm-lock.yaml`.

### 3.2 Database Migrations & Turnkey Seeder
- Authored canonical SQLite / D1 migration `migrations/0001_initial.sql` defining `categories`, `products`, and `product_variations` with indexes on `slug`, `shopify_product_id`, `sku`, and `product_id`.
- Created standalone local database seeder `scripts/seed-db.ts` (`node:sqlite` `DatabaseSync`) seeding 4 categories, 6 products, and 13 variations. Wired to `pnpm seed`.

### 3.3 Storefront Data Layer & Shopify Headless Integration (`apps/web`)
- Created `apps/web/src/lib/catalog.ts` providing typed queries (`getCategories`, `getProducts`, `getProductBySlug`, `getProductVariations`, `getFeaturedProducts`) with automatic fallback price resolution.
- Created `apps/web/src/lib/assets.ts` for client-safe Cloudflare R2 media URL formatting.
- Created `apps/web/src/lib/shopify-mock.ts` (in-process GraphQL mock for cart operations) and `apps/web/src/lib/shopify.ts` (typed storefront API client).
- Updated storefront routes (`page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`, `ProductDetailClient.tsx`) to consume `catalog.ts` and replaced all Directus/MinIO UI text and badges with Payload CMS / Cloudflare R2 / SQLite.

### 3.4 Shared Packages & Test Suites
- Updated `packages/types/src/index.ts`: Reconciled `Order` and `OrderItem` models with `shopify_order_id`, `shopify_order_number`, `shopify_checkout_url`, `shopify_variant_id`, and `ProcessedShopifyEvent`.
- Updated `packages/notifications/tests/notifications.test.ts`: Replaced Stripe IDs with Shopify order GIDs in mock orders.
- Updated `tests/integration/security-audit.test.ts`: Updated required workspaces to 6 active packages.
- Added `apps/web/tests/catalog.test.ts`: 26 unit tests covering catalog queries, fallback pricing, and R2 media URL resolution.
- Added `tests/integration/payload-admin.test.ts`: Validates Payload configuration, collections, App Router entries, REST, and GraphQL endpoints.

### 3.5 Documentation & Operational Runbooks
- Rewrote `README.md` from scratch with Cloudflare-native architecture diagram, tech stack table, and local quick start.
- Rewrote `.env.example` and `packages/config/src/env.ts` with Cloudflare, Payload CMS v3, and Shopify environment variables.
- Rewrote `docs/runbooks/DISASTER_RECOVERY.md` for Cloudflare Workers rollbacks, D1 time-travel / PITR, and R2 bucket versioning.
- Reconciled `docs/PROJECT_SETUP.md`, `docs/security/DEPENDENCY_AUDIT.md`, `docs/deps/README.md`, `docs/deps/DEP_CLOUDFLARE_R2.md`, `DEP_RESEND.md`, `DEP_DISCORD.md`, and agent skills (`local-development`, `backlog-refinement`).

---

## 4. Verification & Validation Results

| Gate | Command | Status | Result |
| :--- | :--- | :--- | :--- |
| **Monorepo Typecheck** | `pnpm run check` | **PASSED** | 9/9 turbo tasks clean across all workspace packages |
| **Unit Test Suites** | `pnpm run test:unit` | **PASSED** | 48/48 unit tests passing across all packages |
| **Integration Test Suites** | `pnpm run test:integration` | **PASSED** | 53/53 integration tests passing across all suites |
| **Production Build** | `pnpm run build` | **PASSED** | Next.js 15 App Router static/dynamic pages + Payload admin bundle |
| **Local Verification Pipeline** | `pnpm run verify:local` | **PASSED** | 7/7 verification gates passed |

Zero occurrences of `apps/cms`, `directus`, `stripe`, `hetzner`, `redis`, or `archive/` remain in application code, tests, or active configurations.
