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
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { Categories } from './collections/Categories';
import { ProductLines } from './collections/ProductLines';
import { Products } from './collections/Products';
import { ProductVariations } from './collections/ProductVariations';
import { Media } from './collections/Media';
import { Users } from './collections/Users';

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [Categories, ProductLines, Products, ProductVariations, Media, Users],
  editor: lexicalEditor(),
  db: sqliteD1Adapter({
    binding: getD1Binding(),
    push: false,
    allowIDOnCreate: true,
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

## 3. Collection Schemas & Data Model (Paradigm 1: Hybrid Product-First)

Payload CMS defines schemas as standard TypeScript collection configurations:

### 3.1 `Categories` Collection

- `name`: Text (required)
- `slug`: Text (unique, required)
- `description`: Text (optional)
- `parent_id`: Relationship to `Categories` (optional hierarchical taxonomy)
- `image`: Upload relationship to `Media`

### 3.2 `ProductLines` Collection (Optional Narrative Container)

- `id`: Text (required, custom text ID, e.g. `line-alpine-chest-rig`)
- `title`: Text (required, e.g. "Alpine Chest Rig System")
- `slug`: Text (unique, index, required)
- `story`: Textarea (shared narrative design philosophy and testing background)
- `default_price`: Number (optional default base price inherited by child products)
- `hero_image`: Upload relationship to `Media`
- `lookbook_gallery`: Array of Upload relationships to `Media` (with `caption`)

### 3.3 `Products` Collection (First-Class Physical Item)

- `id`: Text (required, custom text ID, e.g. `prod-rig-minimalist`)
- `title`: Text (required)
- `slug`: Text (unique, index, required)
- `shopify_product_id`: Text (unique index, linked Shopify Product GID)
- `base_price`: Number (required; can inherit from parent `ProductLines.default_price`)
- `price`: Number (optional price override)
- `sku`: Text (unique SKU)
- `product_line_id`: Relationship to `ProductLines` (optional parent line)
- `category_id`: Relationship to `Categories` (legacy taxonomy compatibility)
- `category`: Select (`packs`, `apparel`, `accessories`)
- `options`: Array of embedded dimensions (`name`, `value`, `sku_suffix`)
- `status`: Select (`draft`, `scheduled`, `active`, `archived`)
- `featured_image`: Upload relationship to `Media`
- `gallery`: Array of Upload relationships to `Media`
- `maker_field_notes`: Textarea (bench notes)
- `artist_statement`: Textarea (legacy compatibility)
- `materials`: Text (technical fabric specs)
- `weight`: Text (garment/pack weight)
- `fit_profile`: Text (fit characteristics)
- `origin`: Text (default: "Hand-crafted in Chris's workshop")
- `description`: RichText (Lexical)

### 3.4 `ProductVariations` Collection (Serialized & Limited Runs)

- `product_id`: Relationship to `Products`
- `shopify_variant_id`: Text (unique index, linked Shopify GID)
- `variation_name`: Text (required)
- `sku`: Text (unique, required)
- `variation_type`: Select (`standard`, `limited_edition`, `one_off_prototype`, `numbered_run`)
- `edition_badge`: Text (e.g. "Only 10 Crafted", "1-of-1 Workbench Prototype")
- `variation_notes`: Text (serialized notes)
- `variation_images`: Array of Upload relationships to `Media`
- `price_override`: Number (optional; falls back to product base price or line default)
- `is_limited_edition`: Checkbox (default: true)
- `total_edition_count`: Number (required for limited editions)
- `stock_quantity`: Number (synced to Shopify inventory level)
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
