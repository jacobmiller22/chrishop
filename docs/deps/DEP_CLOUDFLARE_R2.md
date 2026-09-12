# Dependency Specification: Cloudflare R2 (`DEP_CLOUDFLARE_R2.md`)

This document specifies the integration architecture, S3 API compatibility, bucket definitions, CORS rules, and lifecycle policies for **Cloudflare R2**, the zero-egress object storage service for ChrisShop.

---

## 1. Service Overview & Architecture

- **Provider**: Cloudflare, Inc.
- **Protocol**: S3-Compatible Object Storage API (AWS Signature Version 4)
- **Primary Cost Advantage**: **Zero egress bandwidth charges** (critical for high-resolution product photography and art gallery media).
- **Dual-Bucket Strategy**:
  - **`chrishop-media`**: Public media uploads, product photos, category imagery, and thumbnail transforms.
  - **`chrishop-backups`**: Private offsite encrypted database and configuration dumps.
- **Local Development Emulator**: Containerized MinIO (`infra/docker/docker-compose.dev.yml`) running on `localhost:9000`.

---

## 2. Connection Specs & S3 API Compatibility

### 2.1 Endpoint & Authentication

```env
CLOUDFLARE_ACCOUNT_ID="<cloudflare-account-id>"
CLOUDFLARE_R2_ACCESS_KEY_ID="<r2-access-key-id>"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="<r2-secret-access-key>"
CLOUDFLARE_R2_ENDPOINT="https://<cloudflare-account-id>.r2.cloudflarestorage.com"
```

### 2.2 Payload CMS & Cloudflare Workers Storage Integration

Payload CMS connects to R2 using `@payloadcms/storage-s3` or native Cloudflare Workers R2 bucket bindings (`env.BUCKET`):

```env
R2_BUCKET_NAME="chrishop-media"
R2_ACCESS_KEY_ID="${CLOUDFLARE_R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY="${CLOUDFLARE_R2_SECRET_ACCESS_KEY}"
R2_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
NEXT_PUBLIC_R2_PUBLIC_URL="https://media.chrishop.jacobmiller22.com"
```

### 2.3 Programmatic SDK Access (`@aws-sdk/client-s3`)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});
```

---

## 3. Bucket Configurations & Access Policies

| Bucket Name        | Visibility              | CDN Domain                                    | Encryption at Rest                      | Purpose                                                         |
| ------------------ | ----------------------- | --------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `chrishop-media`   | Public Read             | `https://media.chrishop.jacobmiller22.com`    | Server-Side (AES-256)                   | Product gallery images, category hero banners, catalog assets   |
| `chrishop-backups` | Private (No public URL) | None                                          | Client-side `age` + Server-Side AES-256 | Automated D1 database backups and snapshot exports              |

---

## 4. CORS Rules Specification

CORS must permit browser asset uploads and cross-origin rendering across production, staging, preview, and local development environments:

```json
[
  {
    "AllowedOrigins": [
      "https://chrishop.jacobmiller22.com",
      "https://staging-chrishop.jacobmiller22.com",
      "https://admin-chrishop.jacobmiller22.com",
      "https://shop.jacobmiller22.com",
      "https://staging-shop.jacobmiller22.com",
      "https://admin-shop.jacobmiller22.com",
      "https://*-chrishop.jacobmiller22.com",
      "http://localhost:3000",
      "http://localhost:8055"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Applied via Wrangler CLI:

```bash
wrangler r2 bucket cors set chrishop-media --file infra/r2/cors-media.json
```

---

## 5. Lifecycle Policies & Storage Class Transitions (Prod, Staging, Preview)

Cloudflare R2 lifecycle rules automate storage tier transitions (Standard to Infrequent Access) and object expiration to optimize costs while preventing storage accumulation from test and preview environments.

### 5.1 Multi-Tier Retention & Storage Class Matrix

| Environment / Bucket | Target Prefix | Action / Transition | Threshold (Days / Seconds) | Business Objective |
| :--- | :--- | :--- | :--- | :--- |
| **Production** (`chrishop-media-prod`) | *(Root catalog & drops)* | Permanent Retention | No Expiration | Permanent availability of active drops, collection media, and artwork imagery. |
| **Production** (`chrishop-media-prod`) | `archive/` | Transition to Infrequent Access (IA) | 90 Days (`7776000s`) | 50%+ storage cost savings on archived artwork photography. |
| **Production** (`chrishop-media-prod`) | `drops/past/` | Transition to Infrequent Access (IA) | 180 Days (`15552000s`) | Slashing unit storage costs for historical limited-edition drop media. |
| **Production** (`chrishop-media-prod`) | *(All prefixes)* | Abort Multipart Uploads | 7 Days (`604800s`) | Cleans up orphaned multipart upload parts. |
| **Staging** (`chrishop-media-staging`) | *(All prefixes)* | Transition to Infrequent Access (IA) | 30 Days (`2592000s`) | Shifts test drop media to cold storage during ongoing validation. |
| **Staging** (`chrishop-media-staging`) | *(All prefixes)* | Delete Object (Expiration) | 90 Days (`7776000s`) | Prevents staging storage bloat after testing cycles conclude. |
| **Staging** (`chrishop-media-staging`) | *(All prefixes)* | Abort Multipart Uploads | 3 Days (`259200s`) | Rapid cleanup of abandoned upload chunks in staging. |
| **Preview** (`chrishop-media-preview`) | *(All prefixes)* | Delete Object (Expiration) | 7 Days (`604800s`) | Aggressive automated cleanup guaranteeing zero zombie storage footprint. |
| **Preview** (`chrishop-media-preview`) | *(All prefixes)* | Abort Multipart Uploads | 1 Day (`86400s`) | Daily purge of incomplete multipart sessions from ephemeral PR builds. |
| **Backups** (`chrishop-backups`) | `daily/` | Delete Object | 7 Days (`604800s`) | Daily rotating database snapshot (RPO < 24h). |
| **Backups** (`chrishop-backups`) | `weekly/` | Delete Object | 28 Days (4 Weeks) | Weekly milestone database snapshot. |
| **Backups** (`chrishop-backups`) | `monthly/` | Delete Object | 365 Days (12 Months) | Long-term compliance archive. |

### 5.2 Applying Lifecycle Policies

Apply configurations via the idempotent monorepo provisioning tool:

```bash
# Dry run verification across all environments
infra/scripts/deps/r2_apply_lifecycle.sh --dry-run

# Provision production lifecycle policy
infra/scripts/deps/r2_apply_lifecycle.sh --env prod

# Provision staging lifecycle policy
infra/scripts/deps/r2_apply_lifecycle.sh --env staging

# Provision preview lifecycle policy
infra/scripts/deps/r2_apply_lifecycle.sh --env preview

# Provision all environments idempotently
infra/scripts/deps/r2_apply_lifecycle.sh --env all
```

Alternatively, apply directly using the Wrangler CLI:

```bash
pnpm exec wrangler r2 bucket lifecycle set chrishop-media-prod --file infra/r2/lifecycle-prod.json -y
pnpm exec wrangler r2 bucket lifecycle set chrishop-media-staging --file infra/r2/lifecycle-staging.json -y
pnpm exec wrangler r2 bucket lifecycle set chrishop-media-preview --file infra/r2/lifecycle-preview.json -y
```

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                                      | Status     | Scheduled Story | Description                                                    |
| ----------------------------------------- | ---------- | --------------- | -------------------------------------------------------------- |
| `infra/docker/docker-compose.dev.yml`     | `[EXISTS]` | Phase 1         | MinIO S3 emulator for local development                        |
| `infra/scripts/backup.sh`                 | `[EXISTS]` | Phase 1         | Automated backup script uploading encrypted dumps to R2        |
| `infra/scripts/restore.sh`                | `[EXISTS]` | Phase 1         | Disaster recovery script downloading and decrypting R2 backups |
| `infra/scripts/deps/r2_create_buckets.sh` | `[EXISTS]` | Story 2.2       | Automation script provisioning R2 buckets and applying CORS    |
| `infra/scripts/deps/r2_apply_lifecycle.sh`| `[EXISTS]` | Story 2.36      | Automation script applying R2 lifecycle policies idempotently  |
| `infra/r2/cors-media.json`                | `[EXISTS]` | Story 2.2 / 2.36| CORS configuration rules for media bucket (dual Cloudflare/S3) |
| `infra/r2/lifecycle-prod.json`            | `[EXISTS]` | Story 2.36      | Production R2 lifecycle policy (IA transitions, multipart)     |
| `infra/r2/lifecycle-staging.json`         | `[EXISTS]` | Story 2.36      | Staging R2 lifecycle policy (IA @ 30d, expiration @ 90d)       |
| `infra/r2/lifecycle-preview.json`         | `[EXISTS]` | Story 2.36      | Preview R2 lifecycle policy (expiration @ 7d, zero orphan)     |
| `tests/integration/r2-lifecycle.test.ts`  | `[EXISTS]` | Story 2.36      | Automated integration test suite for R2 lifecycle policies     |

---

## 7. Operational Testing & Verification

```bash
# List buckets via AWS CLI using R2 endpoint
aws --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com" s3 ls

# Inspect active lifecycle configuration via Wrangler
pnpm exec wrangler r2 bucket lifecycle list chrishop-media-prod
pnpm exec wrangler r2 bucket lifecycle list chrishop-media-staging
pnpm exec wrangler r2 bucket lifecycle list chrishop-media-preview

# Run automated integration tests
pnpm exec tsx --test tests/integration/r2-lifecycle.test.ts
```
