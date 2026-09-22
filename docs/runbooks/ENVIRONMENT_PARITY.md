# Runbook: Cloudflare Environment Parity Verification (`ENVIRONMENT_PARITY.md`)

## 1. Overview & Architectural Purpose

The ChrisShop platform relies on Cloudflare-native primitives across four deployment tiers:
- **Local Emulation** (Miniflare, local SQLite D1 state, local KV cache)
- **Ephemeral PR Preview Deployments** (Terraform-provisioned isolated D1, KV, and custom worker domains per PR)
- **Staging Edge** (`staging-chrishop.jacobmiller22.com`, `chrishop-staging-db`)
- **Production Edge** (`chrishop.jacobmiller22.com`, `chrishop-prod-db`)

To guarantee zero drift across these environments, the Parity Verification Engine (`scripts/verify-parity.ts` / `pnpm run test:parity`) executes automated bidirectional checks before production promotion or PR merging:
1. **D1 SQLite Database Schema Parity**: Detects missing tables, divergent column schemas, or missing indexes between the local migration baseline and the target D1 database.
2. **D1 Migration Version Parity**: Asserts that every migration file in `migrations/*.sql` has been applied to the remote `d1_migrations` table.
3. **Synthetic Edge Probe Matrix**: Executes live HTTP probes against the edge worker to verify `/api/health` bindings (`d1`, `kv`, `r2`), catalog routes (`/products`), Payload CMS routes (`/admin`), security headers, and latency SLA (< 500ms).

---

## 2. CLI Command Taxonomy & Parameters

The verification runner can be executed locally, in continuous integration (GitHub Actions), or during manual release triage:

```bash
# 1. Verify staging environment against local migration baseline
pnpm run test:parity --target staging

# 2. Verify an ephemeral PR preview deployment
pnpm run test:parity --url https://pr-42-chrishop.jacobmiller22.com --env preview

# 3. Target custom D1 database name and Cloudflare environment
pnpm run test:parity --target staging --d1 chrishop-staging-db

# 4. Dry-run mode (tolerates missing remote credentials and performs baseline checks)
pnpm run test:parity --target staging --dry-run

# 5. Hermetic in-memory mock mode (100% offline, zero network I/O)
pnpm run test:parity --mock

# 6. Generate Markdown audit report file (useful for CI step summaries)
pnpm run test:parity --target staging --report .parity-report.md
```

### CLI Flag Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--target <env>` | String | `staging` | Target environment tier: `staging`, `production`, `preview`, or `local`. |
| `--url <url>` | String | Derived | Target edge worker URL (e.g. `https://pr-42-chrishop.jacobmiller22.com`). |
| `--env <env>` | String | Derived | Environment name override: `preview`, `staging`, `production`, `local`. |
| `--d1 <db-name>` | String | Derived | Target Cloudflare D1 database name (e.g. `chrishop-staging-db`). |
| `--max-latency <ms>` | Number | `500` | Maximum acceptable edge latency threshold in milliseconds. |
| `--mock` | Boolean | `false` | Run with in-memory simulated responses (offline safe). |
| `--dry-run` | Boolean | `false` | Fall back gracefully if Cloudflare API credentials are missing. |
| `--skip-d1` | Boolean | `false` | Skip D1 database schema and migration checks. |
| `--skip-probes` | Boolean | `false` | Skip synthetic HTTP edge probing. |
| `--report <file>` | String | None | Write a GitHub Flavored Markdown summary report to disk. |
| `--verbose` | Boolean | `false` | Enable verbose diagnostic logging for passed checks. |
| `--help, -h` | Boolean | `false` | Display command-line usage instructions. |

---

## 3. Parity Engine Architecture

```
                                  ┌───────────────────────────────┐
                                  │      migrations/*.sql         │
                                  │  (Local Git Baseline Schema)  │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────┐      ┌───────────────────────────────┐
│   Cloudflare D1 Target   │◄────►│  In-Memory SQLite (Node 22)   │
│ (REST API / Worker Probe)│      │  (DatabaseSync ':memory:')    │
└──────────────────────────┘      └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  Bidirectional Parity Diff    │
                                  │  - Core tables (products...)  │
                                  │  - Applied migrations         │
                                  │  - Critical indexes           │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  Synthetic Edge Probe Matrix  │
                                  │  - /api/health (bindings)     │
                                  │  - /products (storefront SSR) │
                                  │  - /admin (Payload CMS router)│
                                  │  - Security & Cache Headers   │
                                  │  - Edge Latency SLA (< 500ms) │
                                  └───────────────────────────────┘
```

### 3.1 D1 Baseline Extraction
The baseline engine loads all SQL migration scripts in order into an ephemeral in-process SQLite isolate using `node:sqlite`:
- Compiles the exact expected table schema (27 tables).
- Extracts index definitions and table column structures (`PRAGMA table_info`).
- Lists required migration file names (`0001_initial.sql` through latest).

### 3.2 Target D1 Schema Retrieval Strategies
The verifier retrieves target D1 metadata through a tiered resolution strategy:
1. **Edge Worker Diagnostic Probe (`GET /api/debug`)**: Queries the live deployed worker isolate over HTTP to extract `sqlite_master` tables, indexes, and `d1_migrations`.
2. **Cloudflare D1 REST API**: When `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured, issues authenticated SQL queries directly to the Cloudflare D1 endpoint.
3. **Local Miniflare SQLite State**: When targeting `local`, inspects `.wrangler/state/v3/d1/local.sqlite`.
4. **Mock / Dry-Run Fallback**: Gracefully validates baseline integrity without failing CI jobs when secrets are absent.

### 3.3 Synthetic Probe Matrix
Probes the edge runtime host:
- **`GET /api/health`**: Asserts HTTP 200, JSON schema `{ status: "healthy", runtime: "cloudflare-workers" }`, and checks that bindings report `{ d1: true, kv: true, r2: true }`.
- **`GET /products`**: Asserts HTTP 200 (or 30x), verifying that server-side catalog rendering is functional.
- **`GET /admin`**: Asserts HTTP 200 or 30x redirect, confirming Payload CMS is initialized and not crashing with 500/502 errors.
- **Security & Cache Headers**: Asserts `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` on API health, and CDN caching on `/products`.
- **Latency SLA**: Measures round-trip time across probes to verify response latency is within threshold (< 500ms).

---

## 4. GitHub Actions CI/CD Integration

### Ephemeral PR Preview Workflow (`.github/workflows/preview-deploy.yml`)
Following Terraform provisioning and Cloudflare Worker deployment, the preview workflow automatically executes parity verification against the ephemeral preview URL:

```yaml
- name: Verify Ephemeral Preview Parity & Edge Health
  run: pnpm run test:parity --url "${{ env.PREVIEW_URL }}" --env preview
```

The outcome is posted as a rich audit comment on the Pull Request.

### Staging Promotion Workflow (`.github/workflows/deploy.yml`)
Before promoting changes to production, the `test-staging` job executes:

```yaml
- name: Staging Environment Parity Loop
  run: pnpm run test:parity --target staging
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## 5. Troubleshooting & Remediation Playbooks

### Failure 1: Target D1 Missing Critical Table(s)
**Symptom**: `Target D1 database is missing N critical table(s): products, categories`
**Root Cause**: D1 migrations were not applied or failed during deployment.
**Remediation**:
```bash
# Apply pending migrations to target D1 database
pnpm exec wrangler d1 migrations apply chrishop-staging-db --remote --env staging

# Re-run parity check to confirm
pnpm run test:parity --target staging
```

### Failure 2: D1 Migration Version Divergence
**Symptom**: `Target D1 database is behind by N migration(s): 0008_story_3_15_pages...`
**Root Cause**: New migration committed to Git but not executed against remote D1.
**Remediation**:
```bash
# Execute missing migration
pnpm exec wrangler d1 migrations apply <db-name> --remote --env <env>
```

### Failure 3: Edge Binding Downtime (`d1: false` or `kv: false`)
**Symptom**: `Unsatisfied bindings on edge: d1=false, kv=true, r2=true`
**Root Cause**: `wrangler.toml` binding configuration mismatch or unprovisioned database ID.
**Remediation**:
1. Check `wrangler.toml` under `[env.<target>.d1_databases]` to verify `database_id` matches the Cloudflare dashboard.
2. Check Cloudflare Worker deployment logs in the dashboard or via `wrangler tail`.

### Failure 4: Edge Response Latency Exceeds SLA (> 500ms)
**Symptom**: `Observed peak latency (720ms) exceeded SLA threshold (< 500ms)`
**Root Cause**: Cold start isolate initialization, remote database latency, or uncached query path.
**Remediation**:
1. Warm the isolate with multiple consecutive probes.
2. If persistent, investigate D1 query plans (`EXPLAIN QUERY PLAN`) to verify index utilization.
