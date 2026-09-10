# Dependency Specification: Cloudflare D1 Database (`DEP_CLOUDFLARE_D1.md`)

This document specifies the serverless relational database architecture, SQLite compatibility rules, row-read billing economics, query indexing requirements, and backup protocols for **Cloudflare D1**.

---

## 1. Service Overview & Architecture

- **Provider**: Cloudflare, Inc.
- **Engine**: SQLite dialect running serverlessly across Cloudflare's global edge network.
- **Role in ChrisShop**: Primary relational database for Payload CMS content collections (`categories`, `products`, `product_variations`, `media`).
- **Data Scope**: Content, artist statements, limited edition parameters, and media metadata. All customer payment data and checkout orders are owned by Shopify.
- **Consistency Model**: Strongly consistent single-primary writes with globally distributed read replication.

---

## 2. SQLite Dialect & Query Constraints

1. **Foreign Key Enforcement**: `PRAGMA foreign_keys = ON;` is automatically enabled.
2. **Column Types**: Standard SQLite affinity types (`TEXT`, `INTEGER`, `REAL`, `BLOB`).
3. **Transactions**: Batch operations and atomic multi-statement queries supported via `db.batch([...])`.

---

## 3. Billing Model & Query Indexing Economics

Cloudflare D1 Paid Plan billing is determined by **Rows Read** and **Rows Written**:

- **Included Limits**: 25 billion rows read / month; 50 million rows written / month on Workers Paid ($5/mo).
- **Indexing Mandate**: Every table query pattern must be backed by an index to avoid unindexed table scans that inflate row-read billing:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
  CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_product_id);
  CREATE INDEX IF NOT EXISTS idx_variations_product_id ON product_variations(product_id);
  CREATE INDEX IF NOT EXISTS idx_variations_sku ON product_variations(sku);
  CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
  ```
- **Caching Layer**: Workers KV caches frequent D1 catalog query outputs, reducing D1 row reads for anonymous storefront visitors to near zero.

---

## 4. Migrations & Schema Management

Migrations are managed declaratively using Wrangler:

```bash
# Create migration
wrangler d1 migrations create chrishop-prod-db add_shopify_fields

# Apply migrations locally (Miniflare)
wrangler d1 migrations apply chrishop-prod-db --local

# Apply migrations to remote production
wrangler d1 migrations apply chrishop-prod-db --remote
```

---

## 5. Backup, Disaster Recovery & Point-in-Time Recovery (PITR)

- **Automated Continuous Backup**: Cloudflare D1 provides automated continuous replication.
- **Point-in-Time Recovery (PITR)**: Restore the database state to any second within the past 30 days:
  ```bash
  wrangler d1 time-travel restore chrishop-prod-db --timestamp="2026-09-10T12:00:00Z"
  ```
- **Manual Snapshots**: Export full SQL dump for cold offline storage:
  ```bash
  wrangler d1 export chrishop-prod-db --output="./backups/d1-backup-$(date +%Y%m%d).sql"
  ```
