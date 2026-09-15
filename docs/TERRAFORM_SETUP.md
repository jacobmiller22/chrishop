# Cloudflare Terraform Infrastructure as Code (IaC) Runbook (`docs/TERRAFORM_SETUP.md`)

This operational runbook provides engineers and automated CI/CD agents with guidelines for provisioning, maintaining, importing, and validating Cloudflare edge infrastructure across ChrisShop deployment tiers (Preview, Staging, and Production) using **Terraform** (`hashicorp/terraform`) and the official **Cloudflare Provider** (`cloudflare/cloudflare`).

---

## 1. Architectural Model: Decoupled Hybrid Architecture

ChrisShop separates concerns between cloud infrastructure provisioning and application runtime bundling:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. TERRAFORM (Cloud Infrastructure Plane)                                   │
│    • Authoritative owner of Cloudflare cloud resources                      │
│    • D1 SQLite Databases, Workers KV Namespaces, R2 Buckets                 │
│    • DNS Records, Custom Worker Domains, Turnstile Bot Mitigation           │
│    • Remote State stored in Cloudflare R2 (`chrishop-terraform-state`)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Exports IDs & Bindings
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. WRANGLER / OPENNEXT (Application Deployment Plane)                       │
│    • Compiles Next.js 15 & Payload CMS v3 into `.open-next/worker.js`       │
│    • Direct-to-edge multipart upload of hundreds of static client assets    │
│    • Executes D1 SQLite DDL migrations (`wrangler d1 migrations apply`)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Emulates Runtime Locally
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MINIFLARE & WORKERD (Local Development Plane)                            │
│    • Local in-process emulation via `pnpm run dev` (`scripts/dev.ts`)       │
│    • Emulates D1 SQLite locally in `.wrangler/state/v3/d1`                  │
│    • Zero cloud dependencies, works offline, sub-150ms startup              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure (`infra/terraform/`)

```
infra/terraform/
├── versions.tf                        # Provider constraints (Terraform >= 1.6, Cloudflare ~> 4.35)
├── backend.tf                         # S3-compatible remote state in Cloudflare R2
├── variables.tf                       # Root account variables
├── main.tf                            # Root provider & module orchestration
├── outputs.tf                         # Exported resource IDs (D1, KV, R2, URLs)
├── modules/
│   └── cloudflare_stack/              # Parameterized reusable multi-tier module
│       ├── main.tf                    # Common locals and tagging
│       ├── d1.tf                      # cloudflare_d1_database
│       ├── kv.tf                      # cloudflare_workers_kv_namespace
│       ├── r2.tf                      # cloudflare_r2_bucket (ENAM region)
│       ├── dns.tf                     # cloudflare_record & cloudflare_workers_domain
│       ├── security.tf                # cloudflare_turnstile_widget
│       ├── variables.tf               # Module inputs
│       └── outputs.tf                 # Module outputs
└── environments/
    ├── production/                    # Production tier stack
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── staging/                       # Staging tier stack
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── preview/                       # Ephemeral PR preview stack
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

---

## 3. Prerequisites & Local Tooling Installation

### 3.1 Install Terraform CLI
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify installation
terraform version
```

### 3.2 Install `cf-terraforming` (Resource Discovery & Import Tool)
```bash
brew tap cloudflare/cloudflare
brew install cloudflare/cloudflare/cf-terraforming
```

### 3.3 Authentication
Ensure the following environment variables are set with appropriate permissions (`D1:Edit`, `KV:Edit`, `R2:Edit`, `DNS:Edit`, `Workers:Edit`, `Zone Settings:Edit`):
```bash
export CLOUDFLARE_API_TOKEN="<your-api-token>"
export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
export CLOUDFLARE_ZONE_ID="<your-zone-id>"
```

---

## 4. Local Validation & Quality Gates

Run formatting and validation checks locally:

```bash
# 1. Check HCL code formatting
terraform fmt -recursive -check infra/terraform

# 2. Auto-format HCL files
terraform fmt -recursive infra/terraform

# 3. Validate root and module syntax
cd infra/terraform
terraform init -backend=false
terraform validate -no-color

# 4. Validate all environments
for env in production staging preview; do
  (cd infra/terraform/environments/$env && terraform init -backend=false >/dev/null && terraform validate -no-color)
done

# 5. Run automated monorepo integration test suite
pnpm exec tsx --test tests/integration/terraform-config.test.ts
```

---

## 5. Adversarial State Reconciliation & Brownfield Import Guide

To prevent **codifying accidental production drift** (such as ad-hoc Cloudflare Dashboard clicks, forgotten temporary hotfixes, or dangling DNS records), follow the 4-step reconciliation protocol:

### Step 1: Write Clean HCL Based on Documented Intent
Author clean, standardized HCL in `infra/terraform/modules/cloudflare_stack/` reflecting our documented architecture.

### Step 2: Dump Live Cloudflare State to Scratch Area
```bash
mkdir -p scratch/live-dump
cf-terraforming generate -z $CLOUDFLARE_ZONE_ID --resource-type "cloudflare_record" > scratch/live-dump/dns.tf
cf-terraforming generate -a $CLOUDFLARE_ACCOUNT_ID --resource-type "cloudflare_d1_database" > scratch/live-dump/d1.tf
cf-terraforming generate -a $CLOUDFLARE_ACCOUNT_ID --resource-type "cloudflare_workers_kv_namespace" > scratch/live-dump/kv.tf
cf-terraforming generate -a $CLOUDFLARE_ACCOUNT_ID --resource-type "cloudflare_r2_bucket" > scratch/live-dump/r2.tf
```

### Step 3: Execute Adversarial Line-by-Line Diff
Compare `scratch/live-dump/` against clean HCL:
- Legitimate production hotfixes are formally incorporated into HCL with a commit explaining why.
- Undocumented manual tweaks or dangling test records are omitted from HCL so Terraform can restore clean architecture.

### Step 4: Import Existing Resources into State
```bash
# Production D1 Database
terraform import module.production.cloudflare_d1_database.primary <account_id>/7e6d708d-a5c5-4ea5-b4d2-11bd637844ec

# Production KV Namespace
terraform import module.production.cloudflare_workers_kv_namespace.cache <account_id>/8e448bf8d94d4d8ea2cba989f193343d

# Production R2 Bucket
terraform import module.production.cloudflare_r2_bucket.media <account_id>/chrishop-media-prod

# Staging D1 Database
terraform import module.staging.cloudflare_d1_database.primary <account_id>/c49a7e32-455c-4e2a-9b04-163870368d82

# Staging KV Namespace
terraform import module.staging.cloudflare_workers_kv_namespace.cache <account_id>/0f39e4af03e344eaa160d11b047d09b6

# Staging R2 Bucket
terraform import module.staging.cloudflare_r2_bucket.media <account_id>/chrishop-media-staging
```

Run `terraform plan`. Terraform will explicitly surface any discrepancies as a readable diff rather than hiding them.

---

## 6. Monorepo & Wrangler Bridge Integration

To connect Terraform outputs with Wrangler deployments:

```bash
# Verify current bindings against wrangler.toml
pnpm exec tsx scripts/generate-wrangler-config.ts --env staging --verify

# Sync Terraform outputs to wrangler.toml (dry run)
pnpm exec tsx scripts/generate-wrangler-config.ts --env staging --dry-run

# Sync from a Terraform output JSON file
terraform output -json > /tmp/tf_out.json
pnpm exec tsx scripts/generate-wrangler-config.ts --env staging --from-tf-output /tmp/tf_out.json
```

---

## 7. CI/CD Pipeline Automation

1. **Preflight CI Gate (`.github/workflows/ci.yml`)**:
   Runs `terraform fmt -check` and `terraform validate` on every pull request.
2. **Ephemeral PR Previews (`.github/workflows/preview-deploy.yml`)**:
   Provisions dedicated PR infrastructure (`preview-pr-${PR_NUM}`) via Terraform before deploying worker bundles.
3. **PR Preview Cleanup (`.github/workflows/preview-teardown.yml`)**:
   Runs `terraform destroy` when an unmerged PR is closed, ensuring zero dangling Cloudflare resources.
4. **Staging & Production Deployments (`.github/workflows/deploy.yml`)**:
   Executes `terraform apply` before pushing worker bundles to ensure 100% infrastructure parity.
5. **Nightly Drift Detection (`.github/workflows/terraform-drift.yml`)**:
   Runs `terraform plan -detailed-exitcode` daily at 00:00 UTC to catch out-of-band manual changes in Cloudflare.
