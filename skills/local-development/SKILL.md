---
name: local-development
description: Detailed instructions and workflows for running, debugging, seeding, and testing the ChrisShop local monorepo development stack.
---

# Local Development Skill

This skill provides step-by-step instructions for AI agents and developers working with the **ChrisShop** monorepo local development environment.

## When to Use This Skill
Use this skill whenever you need to:
- Boot up or stop local containerized infrastructure (PostgreSQL, Directus CMS, Redis OSS, MinIO).
- Apply Directus schema migrations or export schema snapshots.
- Seed local database catalog data with test categories, products, variations, and admin RBAC rules.
- Run local development servers for `apps/web` (Next.js) or `apps/cms` (Directus).
- Forward and test local Stripe webhook events via Stripe CLI.

---

## Workspace Layout Quick Reference

- Storefront: `apps/web`
- CMS Extensions & Config: `apps/cms`
- UI Design System: `packages/ui`
- Shared Types: `packages/types`
- Notifications Engine: `packages/notifications`
- Docker Dev Stack: `infra/docker/docker-compose.dev.yml`

---

## Step-by-Step Operations

### 1. Boot Local Container Infrastructure
Run the following command to start PostgreSQL, Directus, Redis, and MinIO:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

To verify container health:
```bash
docker compose -f infra/docker/docker-compose.dev.yml ps
```

### 2. Apply Directus Schema & Seed Catalog Data
Apply the version-controlled Directus snapshot and populate initial seed data:

```bash
# Apply schema snapshot
pnpm --filter cms schema:apply

# Run catalog seed script
pnpm seed
```

### 3. Run Monorepo Development Servers
Start all applications concurrently via Turborepo:

```bash
pnpm run dev
```

Or target specific packages:
- Storefront (`apps/web`): `pnpm --filter web dev`
- Directus Extensions (`apps/cms`): `pnpm --filter cms dev`

### 4. Test Stripe Webhooks Locally
1. Start Stripe CLI listener forwarding to the local Next.js API route:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
2. Trigger test checkout completed event:
   ```bash
   stripe trigger checkout.session.completed
   ```

### 5. Cleaning Up Local Environment
To stop containers and wipe volume data for a clean test state:
```bash
docker compose -f infra/docker/docker-compose.dev.yml down -v
```
