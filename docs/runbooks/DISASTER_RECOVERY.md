# Operational Runbook: Disaster Recovery (`DISASTER_RECOVERY.md`)

This runbook documents procedures for recovering the **ChrisShop** platform following edge service disruptions, accidental deployments, D1 database mutations, or media asset loss.

Because ChrisShop is built on a **Cloudflare-Native serverless architecture** and **Shopify Headless SaaS**, there are zero single-point-of-failure virtual machines, container daemons, or self-hosted databases to rebuild from hardware failures.

---

## 1. Service Level Objectives (SLOs)

- **Recovery Point Objective (RPO)**: **< 1 Minute** (Cloudflare D1 distributed edge replication & Shopify multi-tenant ledger).
- **Recovery Time Objective (RTO)**: **< 5 Minutes** (Instant Cloudflare Workers deployment rollback or D1 time-travel restoration).

---

## 2. Recovery Scenarios & Procedures

### Scenario A: Edge Deployment Regression or Bad Release

If a newly deployed Cloudflare Worker release introduces fatal runtime exceptions or breaks storefront rendering:

```bash
# 1. View recent deployment history
pnpm exec wrangler deployments list

# 2. Instantly rollback to the previous known good deployment ID
pnpm exec wrangler rollback <deployment-id>

# 3. Or trigger the GitHub Actions rollback workflow via GitHub CLI
gh workflow run rollback.yml -f environment=production
```

### Scenario B: Database Corruption or Accidental D1 Deletion

Cloudflare D1 provides automated time-travel and point-in-time recovery (PITR) allowing rollback to any minute within the retention window:

```bash
# 1. Retrieve current D1 database state and time bookmark
pnpm exec wrangler d1 info chrishop-db-prod

# 2. Restore D1 database to a specific point-in-time timestamp
pnpm exec wrangler d1 time-travel restore chrishop-db-prod --timestamp="2026-09-11T12:00:00Z"

# 3. Or restore from a designated SQL backup snapshot
pnpm exec wrangler d1 execute chrishop-db-prod --file=./backups/backup-snapshot.sql
```

### Scenario C: Accidental R2 Media Deletion

Media assets in `chrishop-media` are protected by R2 bucket versioning:

```bash
# 1. List object versions in Cloudflare R2
aws --endpoint-url https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com \
  s3api list-object-versions --bucket chrishop-media --prefix "products/"

# 2. Restore deleted object by deleting the delete marker
aws --endpoint-url https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com \
  s3api delete-object --bucket chrishop-media --key "products/artwork.jpg" --version-id "<version-id>"
```

### Scenario D: Shopify Service Degradation

In the event of a Shopify platform disruption:
1. Product catalog browsing remains fully operational via Cloudflare D1 and Workers KV ISR caching.
2. Storefront gracefully displays high-traffic drop queue messaging if checkout initiation is temporarily unavailable.
3. Check status at [Shopify Status](https://status.shopify.com).

---

## 3. Post-Recovery Verification Checklist

1. Verify edge health endpoint returns HTTP 200:
   ```bash
   curl -f https://chrishop.jacobmiller22.com/api/health
   ```
2. Verify storefront product catalog and detail pages load cleanly (`https://chrishop.jacobmiller22.com/products`).
3. Verify Payload CMS Admin UI access (`https://chrishop.jacobmiller22.com/admin`).
4. Verify Shopify Storefront API cart creation mutation.
5. Trigger test operational alert to Discord (`#dev-alerts`) to confirm telemetry.
