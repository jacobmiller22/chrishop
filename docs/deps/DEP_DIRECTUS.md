# Dependency Specification: Directus CMS (`DEP_DIRECTUS.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for **Directus CMS 11**, the headless content management system for product catalog, order management, and drop schedules.

---

## 1. Service Overview & Architecture

- **Version**: Directus `v11.x` (Docker containerized)
- **Role**: Headless CMS for categories, products, product variations, order review, carrier tracking, revision history, and drop release scheduling.
- **Data Access**: `@directus/sdk` REST client for storefront content queries; direct PostgreSQL transactions via `Kysely` for Stripe checkout inventory operations.

---

## 2. Interaction Tools & Interfaces

- **TypeScript SDK**: `@directus/sdk` (Storefront content queries)
- **CLI Tool**: `npx directus-cli` / `pnpm --filter cms schema:apply` / `pnpm --filter cms schema:snapshot`
- **Extensions SDK**: `@directus/extensions-sdk` (Custom Directus webhooks, action hooks, and custom endpoints)
- **Admin UI**: Directus Web Admin (`http://localhost:8055` in dev; `https://admin.chrishop.com` in prod)

---

## 3. Configuration & Schema Snapshots

- `apps/cms/snapshot.yaml` - Version-controlled Directus schema snapshot.
- `apps/cms/extensions/` - Custom Directus action hooks for tracking URL calculation and email notifications.
- `infra/scripts/deps/directus_sync.sh` - CLI script applying schema snapshots and seeding admin permissions.

---

## 4. Operational Commands & Integration Testing

- **Export Schema Snapshot**: `pnpm --filter cms schema:snapshot`
- **Apply Schema Snapshot**: `pnpm --filter cms schema:apply`
- **Health Endpoint Check**: `GET /server/health`
- **Permissions Audit**: Verify public role is strictly read-only for `published` status products.
