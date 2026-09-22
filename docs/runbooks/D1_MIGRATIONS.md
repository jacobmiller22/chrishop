# Operational Runbook: Cloudflare D1 Database Migrations & Rollback Strategy (`D1_MIGRATIONS.md`)

This runbook establishes standard operating procedures for developing, validating, applying, and rolling back **Cloudflare D1 SQLite** database schema migrations across all ChrisShop environments (Local Miniflare, Preview, Staging, and Production), adhering to `docs/HIGH_LEVEL_DESIGN.md` Section 8.3 and `docs/deps/DEP_CLOUDFLARE_D1.md`.

---

## 1. Core Principles & Additive Schema Evolution

Cloudflare D1 operates serverlessly with distributed read replicas across Cloudflare's global edge network. To guarantee zero downtime and prevent schema-code desynchronization across edge workers, all D1 schema evolutions MUST be **strictly additive**:

### The Expand / Contract Migration Pattern
1. **Expand (Phase 1)**:
   - Add new tables with `CREATE TABLE IF NOT EXISTS`.
   - Add new columns to existing tables using `ALTER TABLE <table> ADD COLUMN <col> <type>;`.
   - New columns MUST be either nullable (`TEXT`, `INTEGER`) or specify a non-null default (`NOT NULL DEFAULT 'value'`). SQLite and D1 throw hard errors if `NOT NULL` is added without a `DEFAULT`.
   - Add query performance indexes (`CREATE INDEX IF NOT EXISTS`) to back all new filter and foreign key lookup fields.
2. **Dual-Write / Backfill (Phase 2)**:
   - Application code reads from legacy or new columns with fallback (`row.new_col ?? row.legacy_col`).
   - Mutations write to both legacy and new structures, or background data backfill scripts reconcile existing records.
3. **Contract (Phase 3)**:
   - Applications transition exclusively to the new column or table.
   - Deprecated columns are left dormant in the schema. **Destructive operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE TABLE`) are strictly prohibited** in routine migrations to prevent race conditions with running edge worker instances.

### Prohibited Statements
- `DROP TABLE`
- `DROP VIEW`
- `DROP COLUMN` (`ALTER TABLE ... DROP COLUMN`)
- `TRUNCATE TABLE`
- `ALTER TABLE ... ADD COLUMN ... NOT NULL` (without `DEFAULT`)

---

## 2. Declarative Migration Runner (`scripts/d1-migrate.ts`)

ChrisShop provides a declarative migration runner and pre-flight static analysis tool that enforces additive migration standards before any DDL statements reach D1 instances:

```bash
# 1. Run static pre-flight additive validation on all migration files (lint only)
pnpm run d1:migrate:check

# 2. Apply migrations to local Miniflare D1 emulator (.wrangler/state/v3/d1)
pnpm run d1:migrate:local

# 3. Apply migrations to remote Staging database (chrishop-staging-db)
pnpm run d1:migrate:staging

# 4. Apply migrations to remote Production database (chrishop-prod-db)
pnpm run d1:migrate:prod

# 5. Display Point-in-Time Recovery (PITR) rollback instructions and bookmarks
pnpm run d1:rollback:info
```

### CLI Options Reference
| Flag | Description |
| :--- | :--- |
| `--local` | Target local Miniflare D1 SQLite instance (default). |
| `--remote` | Target Cloudflare remote edge database. |
| `--env <name>` | Environment target (`staging`, `production`, `preview`). Automatically selects corresponding database. |
| `--database <name>` | Explicit database name (`chrishop-prod-db`, `chrishop-staging-db`, `chrishop-preview-db`). |
| `--check` | Execute pre-flight additive static analysis only; exit 0 if compliant, non-zero if destructive SQL is found. |
| `--all-migrations` | Validate entire migration history including initial bootstrap files. |
| `--allow-destructive` | Explicit override flag allowing destructive SQL (emergency break-glass only). |
| `--pitr-info` | Output Point-in-Time Recovery instructions, timestamp syntax, and verification queries. |

---

## 3. Creating a New Migration

1. Generate a sequentially numbered migration file adhering to the naming convention:
   ```bash
   pnpm exec wrangler d1 migrations create chrishop-prod-db add_product_warranty_fields
   ```
   This creates `migrations/0010_add_product_warranty_fields.sql`.

2. Author additive SQL statements:
   ```sql
   -- Migration: 0010_add_product_warranty_fields.sql
   PRAGMA foreign_keys = OFF;

   -- 1. Additive column with default
   ALTER TABLE products ADD COLUMN warranty_months INTEGER DEFAULT 12;

   -- 2. Query index for new filter field per DEP_CLOUDFLARE_D1
   CREATE INDEX IF NOT EXISTS products_warranty_months_idx ON products (warranty_months);
   ```

3. Validate locally:
   ```bash
   pnpm run d1:migrate:check
   pnpm run d1:migrate:local
   ```

---

## 4. CI/CD Deployment Integration

In ChrisShop GitHub Actions deployment workflows (`.github/workflows/deploy.yml`):
- D1 migrations execute **strictly prior** to edge Worker deployment (`wrangler deploy`).
- Executing migrations first ensures the database schema is backwards-compatible with currently executing workers and ready for the incoming worker version.
- Both `deploy-staging` and `deploy-production` jobs invoke:
  ```bash
  pnpm exec wrangler d1 migrations apply chrishop-staging-db --remote
  # and
  pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote
  ```

---

## 5. Point-in-Time Recovery (PITR) & Rollback Strategy

Because routine migrations are strictly additive, forward code deployments can safely rollback worker code (`wrangler rollback`) without immediately rolling back the database.

However, if an accidental data corruption or schema malfunction occurs, Cloudflare D1 provides **Time Travel Point-in-Time Recovery (PITR)**:

### 5.1 Restoring to a Timestamp
D1 continuously replicates write-ahead logs with up to 30 days of retention. To restore the database to a point in time prior to the incident:

```bash
# Target production database:
pnpm exec wrangler d1 time-travel restore chrishop-prod-db --timestamp="2026-09-22T13:00:00Z"

# Target staging database:
pnpm exec wrangler d1 time-travel restore chrishop-staging-db --timestamp="2026-09-22T13:00:00Z"
```

### 5.2 Restoring to a Bookmark
Cloudflare D1 generates state bookmarks on every commit. To restore using a specific bookmark:

```bash
# 1. Retrieve current bookmark and database metadata
pnpm exec wrangler d1 info chrishop-prod-db

# 2. Restore to the designated bookmark
pnpm exec wrangler d1 time-travel restore chrishop-prod-db --bookmark="00000001-0000-0000-0000-000000000000"
```

### 5.3 Cold Backup Snapshot Export & Restore (Disaster Recovery Fallback)
Before major catalog operations, automated or manual snapshots can be exported:

```bash
# Export full SQL snapshot
pnpm exec wrangler d1 export chrishop-prod-db --output="./backups/chrishop-prod-backup-$(date +%Y%m%d%H%M).sql"

# Import / restore snapshot into target database
pnpm exec wrangler d1 execute chrishop-prod-db --file="./backups/chrishop-prod-backup-202609221200.sql"
```

### 5.4 Post-Recovery Verification Checklist
Following any PITR restoration or migration:
1. Verify database connectivity and table count:
   ```bash
   pnpm exec wrangler d1 execute chrishop-prod-db --command "SELECT count(*) AS total_tables FROM sqlite_master WHERE type='table';"
   ```
2. Verify migration tracking log in `d1_migrations`:
   ```bash
   pnpm exec wrangler d1 execute chrishop-prod-db --command "SELECT * FROM d1_migrations ORDER BY id DESC LIMIT 5;"
   ```
3. Run Edge Health check:
   ```bash
   curl -f https://chrishop.jacobmiller22.com/api/health
   ```
