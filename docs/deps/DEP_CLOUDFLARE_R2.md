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

## 5. Lifecycle Policies & Retention Rules

Automated retention lifecycle rules are enforced on `chrishop-backups` to satisfy the **RPO < 24 hrs; RTO < 15 mins** requirement without unbounded storage consumption:

| Prefix / Path | Retention Window     | Action        | Description                        |
| ------------- | -------------------- | ------------- | ---------------------------------- |
| `daily/`      | 7 Days               | Delete Object | Daily rotating database snapshot   |
| `weekly/`     | 28 Days (4 Weeks)    | Delete Object | Weekly milestone database snapshot |
| `monthly/`    | 365 Days (12 Months) | Delete Object | Long-term compliance archive       |

Managed via R2 bucket lifecycle configuration:

```bash
wrangler r2 bucket lifecycle add chrishop-backups \
  --name "expire-daily-backups" \
  --prefix "daily/" \
  --expire-days 7
```

---

## 6. Reconciled Configuration Files & Monorepo Paths

| Path                                      | Status     | Scheduled Story | Description                                                    |
| ----------------------------------------- | ---------- | --------------- | -------------------------------------------------------------- |
| `infra/docker/docker-compose.dev.yml`     | `[EXISTS]` | Phase 1         | MinIO S3 emulator for local development                        |
| `infra/scripts/backup.sh`                 | `[EXISTS]` | Phase 1         | Automated backup script uploading encrypted dumps to R2        |
| `infra/scripts/restore.sh`                | `[EXISTS]` | Phase 1         | Disaster recovery script downloading and decrypting R2 backups |
| `infra/scripts/deps/r2_create_buckets.sh` | `[EXISTS]` | Story 2.2       | Automation script provisioning R2 buckets and applying CORS    |
| `infra/r2/cors-media.json`                | `[EXISTS]` | Story 2.2       | CORS configuration rules for media bucket                      |

---

## 7. Operational Testing & Verification

```bash
# List buckets via AWS CLI using R2 endpoint
aws --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com" s3 ls

# Test file upload to media bucket
aws --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  s3 cp test.jpg s3://chrishop-media/test.jpg

# Verify public CDN URL resolution
curl -I https://media.chrishop.jacobmiller22.com/test.jpg

# Verify backup upload pipeline
infra/scripts/backup.sh
```
