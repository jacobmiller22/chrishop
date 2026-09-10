# Dependency Specification: Cloudflare R2 (`DEP_CLOUDFLARE_R2.md`)

This document specifies the integration, tooling, management scripts, and operational procedures for **Cloudflare R2**, providing zero-egress-fee S3-compatible object storage for product galleries, media uploads, and offsite database backups.

---

## 1. Service Overview & Architecture

- **Provider**: Cloudflare R2 (S3-Compatible Object Storage)
- **Cost Advantage**: Zero egress bandwidth charges.
- **Buckets**:
  - `chrishop-media` (Public media, artwork, product galleries attached to Directus CMS)
  - `chrishop-backups` (Private encrypted database dump archive)
- **Local Dev Emulator**: Containerized MinIO (`infra/docker/docker-compose.dev.yml`)

---

## 2. Interaction Tools & Interfaces

- **SDK**: AWS S3 SDK (`@aws-sdk/client-s3`) / Directus S3 Storage Driver
- **CLI Tool**: `wrangler r2 bucket` / AWS CLI (`aws --endpoint-url https://... s3 ls`)
- **Dashboard**: Cloudflare Dashboard (`https://dash.cloudflare.com`)

---

## 3. Storage Configuration & CORS Rules

CORS configuration for direct media uploads and CDN asset delivery:

```json
[
  {
    "AllowedOrigins": [
      "https://chrishop.com",
      "https://admin.chrishop.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. Control Scripts & Integration Testing

- **Create Bucket Script**: `infra/scripts/deps/r2_create_buckets.sh`
- **Upload Integration Test**: Verify test file write and public URL GET read.
- **Backup Offsite Upload Test**: Verify `infra/scripts/backup.sh` uploads encrypted `.age` archives successfully to `chrishop-backups`.
