# Dependency Specification: Payload CMS v3 (`DEP_PAYLOAD_CMS.md`)

This document specifies the embedded content management architecture, Cloudflare D1 adapter integration, Cloudflare R2 media adapter, collection schema workflows, and Shopify synchronization hooks for **Payload CMS v3**.

---

## 1. Service Overview & Architecture

- **Package**: `payload` (v3.x)
- **Deployment Topology**: Co-located inside Next.js App Router application (`apps/web`) deployed to Cloudflare Workers via `@opennextjs/cloudflare`.
- **Database Adapter**: `@payloadcms/db-d1-sqlite` (stable Cloudflare D1 adapter).
- **Storage Adapter**: `@payloadcms/storage-s3` configured for Cloudflare R2.
- **Admin UI Route**: `/admin/*` (rendered directly within Next.js App Router).
- **Authentication**: Native Payload auth with mandatory TOTP Two-Factor Authentication (2FA).

---

## 2. Configuration (`payload.config.ts`)

```typescript
import { buildConfig } from 'payload';
import { d1Adapter } from '@payloadcms/db-d1-sqlite';
import { s3Storage } from '@payloadcms/storage-s3';
import { Categories } from './collections/Categories';
import { Products } from './collections/Products';
import { ProductVariations } from './collections/ProductVariations';
import { Media } from './collections/Media';

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [
    Categories,
    Products,
    ProductVariations,
    Media,
  ],
  db: d1Adapter({
    binding: process.env.DB, // Bound in Cloudflare Workers environment
  }),
  plugins: [
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.R2_BUCKET_NAME || 'chrishop-media',
      config: {
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        region: 'auto',
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'development-secret-key-min-32-chars',
});
```

---

## 3. Collection Schemas & Data Model

Payload CMS defines schemas as standard TypeScript collection configurations:

### 3.1 `Products` Collection
- `title`: Text (required)
- `slug`: Text (unique, required)
- `shopify_product_id`: Text (unique index, linked Shopify GID)
- `base_price`: Number (required)
- `status`: Select (`draft`, `scheduled`, `active`, `archived`)
- `category_id`: Relationship to `Categories`
- `featured_image`: Upload relationship to `Media`
- `gallery`: Array of Upload relationships to `Media`
- `artist_statement`: Text / RichText
- `description`: RichText (Lexical)

### 3.2 `ProductVariations` Collection
- `product_id`: Relationship to `Products`
- `shopify_variant_id`: Text (unique index, linked Shopify GID)
- `variation_name`: Text (required)
- `sku`: Text (unique, required)
- `price_override`: Number (optional)
- `is_limited_edition`: Checkbox (default: true)
- `total_edition_count`: Number (required for limited editions)
- `stock_quantity`: Number (initial stock, synced to Shopify)
- `release_date`: Date (optional scheduled drop timestamp)
- `status`: Select (`coming_soon`, `active`, `sold_out`, `archived`)

---

## 4. Lifecycle Hooks & Shopify Admin API Sync

Payload provides type-safe lifecycle hooks. A dedicated `afterChange` hook triggers on product publish:

```typescript
export const afterChangeProductSync: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (doc.status === 'active') {
    await syncToShopifyAdmin(doc);
  }
  return doc;
};
```

---

## 5. Local Development Workflow

- Payload CMS boots alongside Next.js during `pnpm dev`.
- Miniflare handles D1 SQLite table creation and local emulated storage automatically.
- No compilation ceremony or external database container is needed.
