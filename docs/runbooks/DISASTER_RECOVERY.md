# Operational Runbook: Disaster Recovery & Instant Rollbacks (`DISASTER_RECOVERY.md`)

This runbook establishes disaster recovery protocols, emergency instant rollbacks, and incident escalation procedures for the **ChrisShop** platform following edge service disruptions, bad releases, database mutations, or third-party outages.

Because ChrisShop is built on a **Cloudflare-Native serverless edge architecture** and **Shopify Headless SaaS**, there are zero physical servers, VM hypervisors, or self-hosted container clusters to rebuild from hardware failures.

---

## 1. Service Level Objectives (SLOs)

| Metric | Target | Description |
| :--- | :--- | :--- |
| **Recovery Time Objective (RTO)** | **< 5 Minutes** | Time to execute instant worker deployment rollback or restore D1 point-in-time state. |
| **Recovery Point Objective (RPO)** | **< 1 Minute** | Maximum allowable data loss window (Cloudflare D1 WAL replication & Shopify order ledger). |
| **Edge Health Restoration** | **< 60 Seconds** | Global edge CDN convergence after `wrangler rollback` execution. |

---

## 2. Incident Severity & Escalation Matrix

| Severity | Definition / Threshold | Response Time | Actions & Escalation |
| :--- | :--- | :--- | :--- |
| **Sev 1 (Critical)** | Storefront unavailable, checkout non-functional, edge 5xx error rate > 5%, or security breach. | **< 5 Minutes** | 1. Page On-Call Engineer.<br>2. Trigger immediate Worker Rollback via CLI or GitHub Actions.<br>3. Open War Room in `#dev-alerts`.<br>4. Notify Merchant & Ops via Discord/SMS. |
| **Sev 2 (Major)** | Partial catalog degradation, image delivery failure, or Payload CMS admin unreachable. | **< 15 Minutes** | 1. Triage error logs in Sentry / Cloudflare Tail.<br>2. Verify if D1 PITR or Worker rollback is required.<br>3. Toggle maintenance mode feature flag if necessary. |
| **Sev 3 (Minor)** | Non-blocking visual glitch, slow background telemetry, or non-critical worker warning. | **< 2 Hours** | 1. Document in GitHub Issues.<br>2. Schedule hotfix via standard `staging` ➔ `main` PR workflow. |

---

## 3. Recovery Scenarios & Procedures

### Scenario A: Edge Worker Deployment Regression (Instant Rollback)

If a newly deployed release introduces fatal unhandled runtime exceptions, hydration failures, or breaks storefront navigation:

#### Option 1: GitHub Actions Workflow Dispatch (Recommended for Teams)
Trigger the automated rollback workflow via GitHub CLI or Web UI:
```bash
# Roll back production to previous known good deployment
gh workflow run rollback.yml -f environment=production -f reason="Hydration errors on storefront PDP"

# Roll back production to a specific historical deployment ID
gh workflow run rollback.yml -f environment=production -f deployment_id="<deployment-id>" -f reason="Targeted rollback to v1.2.0"

# Roll back staging environment
gh workflow run rollback.yml -f environment=staging -f reason="Failed staging smoke verification"
```

The workflow automatically:
1. Executes `wrangler rollback` against the selected environment.
2. Runs automated health probes against `/api/health`.
3. Dispatches high-visibility deployment telemetry alerts to Discord `#dev-alerts`.

#### Option 2: CLI Rollback Helper (`scripts/rollback-worker.ts`)
```bash
# Preview rollback actions without mutating edge state
pnpm run rollback --env production --dry-run

# Execute instant rollback on production to previous deployment
pnpm run rollback --env production --reason="Sev 1 storefront downtime" --check-health --notify

# Execute instant rollback on staging to a specific deployment ID
pnpm run rollback --env staging --deployment-id="<deployment-id>" --check-health
```

#### Option 3: Direct Wrangler CLI Invocations
```bash
# 1. List recent deployment IDs and timestamps
pnpm exec wrangler deployments list --env production

# 2. Rollback to the previous deployment immediately
pnpm exec wrangler rollback --env production

# 3. Or rollback to a specific historical deployment ID
pnpm exec wrangler rollback <deployment-id> --env production
```

---

### Scenario B: Database Corruption or Accidental D1 Deletion (PITR)

Cloudflare D1 provides automated time-travel and Point-in-Time Recovery (PITR) allowing restoration to any minute within the retention window (up to 30 days):

```bash
# 1. Inspect current D1 database state and latest commit bookmark
pnpm exec wrangler d1 info chrishop-prod-db

# 2. Restore D1 database to a specific point-in-time timestamp (ISO 8601)
pnpm exec wrangler d1 time-travel restore chrishop-prod-db --timestamp="2026-09-22T13:00:00Z"

# 3. Or restore using a specific commit bookmark hash
pnpm exec wrangler d1 time-travel restore chrishop-prod-db --bookmark="00000001-0000-0000-0000-000000000000"

# 4. Or restore from a designated SQL backup snapshot
pnpm exec wrangler d1 execute chrishop-prod-db --file=./backups/backup-snapshot.sql

# 5. Display quick PITR instructions via CLI
pnpm run d1:rollback:info
```

> [!IMPORTANT]
> Because ChrisShop migrations adhere to the **strictly additive Expand/Contract pattern**, code rollbacks rarely require database rollbacks. Consult [docs/runbooks/D1_MIGRATIONS.md](file:///Users/jacobmiller22/projects/chrishop/docs/runbooks/D1_MIGRATIONS.md) before rolling back D1 state.

---

### Scenario C: Accidental R2 Media Deletion

Media assets in `chrishop-media-prod` and `chrishop-media-staging` are protected by R2 bucket object versioning:

```bash
# 1. List object versions in Cloudflare R2
aws --endpoint-url https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com \
  s3api list-object-versions --bucket chrishop-media-prod --prefix "products/"

# 2. Restore deleted object by deleting the delete marker
aws --endpoint-url https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com \
  s3api delete-object --bucket chrishop-media-prod --key "products/artwork.jpg" --version-id "<version-id>"
```

---

### Scenario D: Shopify Service Degradation

In the event of a Shopify platform disruption:
1. **Zero Customer Impact for Browsing**: Product catalog browsing remains 100% operational via Cloudflare D1 and Workers KV ISR edge caching.
2. **Graceful Cart & Checkout Queue**: The storefront automatically catches checkout rate limits and returns human-friendly surge queue messaging (`Retry-After: 2`).
3. **Emergency Circuit Breaker**: If Shopify checkout API is fully degraded, toggle the emergency checkout kill switch:
   - Set `FLAG_DISABLE_CHECKOUT="true"` in Cloudflare Flagship / wrangler vars.
4. Check upstream status at [Shopify Status](https://status.shopify.com).

---

## 4. Post-Recovery Verification Checklist

Execute the following verification steps immediately after completing an emergency rollback or PITR restore:

1. **Edge Health Probe**: Confirm HTTP 200 from the health endpoint:
   ```bash
   curl -f https://chrishop.jacobmiller22.com/api/health
   # or staging:
   curl -f https://staging-chrishop.jacobmiller22.com/api/health
   ```
2. **Catalog Navigation**: Load `/products` and a product detail page to confirm D1 reads and Workers KV caching.
3. **Payload CMS Admin**: Authenticate at `/admin` and confirm collection records load properly.
4. **Shopify Cart Mutation**: Execute a test cart creation mutation to verify Shopify Storefront API connectivity.
5. **Observability Verification**: Verify alert dispatch to Discord `#dev-alerts` and confirm error spikes in Sentry / Better Stack have subsided.
6. **Automated Verification**: Run the automated rollback and D1 integration test suites to verify system resilience:
   ```bash
   pnpm run test:rollback
   pnpm exec tsx --test tests/integration/worker-instant-rollback.test.ts
   pnpm exec tsx --test tests/integration/d1-migration-automation.test.ts
   ```

---

## 5. Incident Post-Mortem Protocol

Within 24 hours of resolving a Sev 1 or Sev 2 incident, author a post-mortem document covering:
- **Incident Summary**: Exact start, detection, mitigation, and resolution timestamps.
- **Root Cause Analysis (RCA)**: The 5 Whys detailing what caused the failure.
- **Corrective Actions**: Action items tracked in GitHub Issues to eliminate the failure mode.
- **Recovery Metrics**: Actual RTO and RPO achieved vs SLO targets.
