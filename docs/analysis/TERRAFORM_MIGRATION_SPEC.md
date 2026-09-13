# Architecture Specification: Cloudflare Terraform IaC Migration (Story 4.12)

This specification defines the architectural model, migration strategy, concrete HCL configuration, and trade-off analysis for integrating **Terraform** (`hashicorp/terraform` with `cloudflare/cloudflare`) into the **ChrisShop** monorepo for multi-tier edge infrastructure management (Preview, Staging, and Production).

---

## 1. Executive Summary & Core Architectural Decision

### 1.1 The Decoupled Hybrid Model
In a modern Cloudflare Workers deployment running Next.js 15 App Router and Payload CMS v3 compiled via `@opennextjs/cloudflare`, deploying worker application scripts and hundreds of static client assets directly through Terraform's `cloudflare_worker_script` resource is an established anti-pattern. Doing so results in:
- Slow plan/apply cycles due to large binary uploads in Terraform state.
- Fragile multipart asset uploads that often exceed Terraform provider payload limits.
- Loss of Wrangler's optimized direct-to-edge asset streaming pipeline.

**Architectural Decision**: ChrisShop adopts a **Decoupled Hybrid Architecture**:
1. **Terraform (Cloud Infrastructure Plane)**: Authoritative owner of persistent and ephemeral cloud resources: D1 SQLite databases, Workers KV namespaces, R2 object buckets (including declarative CORS and lifecycle policies), DNS records, custom worker domains, Turnstile anti-bot widgets, and WAF rulesets.
2. **Wrangler / OpenNext (Application Deployment Plane)**: Authoritative builder and packager of application bundles (`.open-next/worker.js`) and static assets (`.open-next/assets`), deploying them to Cloudflare's edge using resource IDs dynamically exported by Terraform.
3. **Miniflare (Local Runtime Plane)**: Preserved as the sole local development and testing emulation engine (`scripts/dev.ts` / `pnpm run dev`), running in-process on developer laptops with zero cloud dependencies.

---

## 2. Existing Tooling vs. Target Architecture

### 2.1 Existing Tooling (How It Works Today)

Cloudflare edge resources across the repository are configured semi-declaratively in a single root `wrangler.toml` file and manipulated via imperative CLI commands:

- **Resource Creation**: D1 databases, KV namespaces, and R2 buckets were provisioned imperatively via `wrangler d1 create`, `wrangler kv:namespace create`, and `wrangler r2 bucket create`.
- **Manual ID Plumbing**: Output UUIDs (e.g. D1 `database_id: 7e6d708d-...`, KV `id: 8e448bf8...`) are hardcoded into `wrangler.toml` across `[env.staging]`, `[env.production]`, and `[env.preview]`.
- **Ephemeral Previews**: `preview-deploy.yml` uses bash `sed` commands to mutate `wrangler.toml` in-flight (`chrishop-preview-pr-${PR_NUM}`), reusing a single shared preview database (`chrishop-preview-db`) and KV namespace. On PR close, `preview-teardown.yml` only runs `wrangler delete` on the worker script, leaving database records, KV cache keys, and DNS entries dangling.
- **Drift & Audit**: Zero infrastructure state tracking. Any manual modifications made directly in the Cloudflare Dashboard are invisible, unversioned, and undetectable until a production failure occurs.

#### Current Tooling Workflow Diagram

```
                              [Developer / Git Push]
                                        │
                                        ▼
                         [GitHub Actions CI/CD Pipeline]
                                        │
               ┌────────────────────────┼────────────────────────┐
               ▼                        ▼                        ▼
        [Feature PR]             [Push to Staging]      [Promote to Prod (Gated)]
               │                        │                        │
       (preview-deploy.yml)        (deploy.yml)             (deploy.yml)
               │                        │                        │
        sed wrangler.toml               │                        │
        (inject PR worker name)         │                        │
               │                        │                        │
               ▼                        ▼                        ▼
     [pnpm run build]             [pnpm run build]         [pnpm run build]
     (OpenNext compile)          (OpenNext compile)       (OpenNext compile)
               │                        │                        │
               ▼                        ▼                        ▼
     [wrangler deploy]            [wrangler deploy]        [wrangler deploy]
     (Uploads worker bundle,      (Uploads worker bundle,  (Uploads worker bundle,
      assets & binds pre-created   assets & binds staging   assets & binds prod
      preview D1/KV/R2)            D1/KV/R2 from toml)      D1/KV/R2 from toml)
               │                        │                        │
               ▼                        ▼                        ▼
     [Health Probe Check]         [Health Probe Check]     [Health Probe Check]
               │
      (PR Closed: teardown)
               ▼
     [wrangler delete]
     (Deletes Worker script only;
      shared preview D1 & KV remain)
```

---

### 2.2 Target Architecture (How It Changes with Terraform)

Under the target architecture:
1. All Cloudflare cloud infrastructure is declared in modular HCL under `infra/terraform/`.
2. Remote state is securely stored and locked in a dedicated Cloudflare R2 bucket (`chrishop-terraform-state`) via Terraform's S3-compatible backend.
3. Every feature PR provisions an isolated edge stack in a dedicated Terraform workspace (`preview-pr-${PR_NUM}`), complete with an ephemeral D1 database and KV cache.
4. On PR close, `terraform destroy` cleanly tears down every associated Cloudflare resource with zero dangling artifacts.
5. Nightly automated CI jobs run `terraform plan -detailed-exitcode` to detect and alert on any manual dashboard drift.

#### Target Architecture Workflow Diagram

```
                                  [Developer / Git Push]
                                            │
                                            ▼
                             [GitHub Actions CI/CD Pipeline]
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
       [Feature PR]                  [Push to Staging]           [Promote to Production]
              │                             │                             │
    ┌─────────┴───────────────┐   ┌─────────┴───────────────┐   ┌─────────┴───────────────┐
    │ 1. Terraform Workspace  │   │ 1. Terraform Staging    │   │ 1. Terraform Production │
    │    preview-pr-${PR_NUM} │   │    Apply                │   │    Plan (Review Gate)   │
    │ - Provision isolated D1 │   │ - Ensure D1, KV, R2     │   │ - Gated Apply           │
    │ - Provision isolated KV │   │ - Sync DNS & WAF        │   │ - Ensure 100% Parity    │
    │ - Provision DNS & Route │   │ - Enforce R2 Lifecycle  │   │ - Audit State in R2     │
    └─────────┬───────────────┘   └─────────┬───────────────┘   └─────────┬───────────────┘
              │                             │                             │
              ▼                             ▼                             ▼
    [Extract TF Outputs]          [Extract TF Outputs]          [Extract TF Outputs]
    (D1_ID, KV_ID, BUCKET)        (D1_ID, KV_ID, BUCKET)        (D1_ID, KV_ID, BUCKET)
              │                             │                             │
              ▼                             ▼                             ▼
    [OpenNext / Wrangler]         [OpenNext / Wrangler]         [OpenNext / Wrangler]
    - wrangler d1 migrate         - wrangler d1 migrate         - wrangler d1 migrate
    - seed-db (PR only)           - wrangler deploy --env       - wrangler deploy --env
    - wrangler deploy               staging                       production
              │                             │                             │
              ▼                             ▼                             ▼
    [Edge Health Probe]           [Edge Health Probe]           [Edge Health Probe]
              │
     (PR Close Trigger)
              ▼
    [terraform destroy]
    (Cleanly destroys PR D1,
     KV, DNS, & Worker workspace)
```

---

## 3. Runtime Location & The "No Local Option" in Terraform

### 3.1 Where Does the Code Run?
When using Terraform with Cloudflare, execution is strictly stratified:
1. **Terraform CLI (Control Plane)**: Runs locally on developer machines or inside GitHub Actions Ubuntu runner VMs, issuing HTTPS REST API requests to `https://api.cloudflare.com/client/v4/`.
2. **Application Worker Bundle (Edge Runtime)**: Runs across Cloudflare’s global Anycast edge network (300+ PoPs worldwide) inside isolated V8 runtime environments.
3. **Application Build Assets**: Compiled by `@opennextjs/cloudflare` on the CI runner and uploaded to Cloudflare's edge asset store.

### 3.2 Why Is There No "Local Option" (LocalStack Equivalent)?

In AWS environments, tools like **LocalStack** mock the AWS Control Plane APIs (IAM, DynamoDB, S3, SQS) on `http://localhost:4566`, allowing Terraform's AWS provider to manage local mock resources.

In the Cloudflare ecosystem, **no equivalent control-plane mock server exists**:
1. **Control Plane vs. Data Plane**: Miniflare and `workerd` only emulate the **runtime data plane** (V8 isolates, `fetch` handlers, and bindings to local SQLite/files). They do **not** expose Cloudflare v4 REST API endpoints (`/client/v4/accounts/.../d1/database`).
2. **Speed of In-Process Emulation**: Cloudflare designed local development around `wrangler dev` and Miniflare, which parse configuration and initialize local SQLite databases in memory in **under 150 milliseconds**, bypassing the need for an HTTP management API.
3. **State Integrity**: Terraform requires authoritative cloud IDs for state mapping (`terraform.tfstate`). Managing local `.sqlite` files inside remote Terraform state files would cause state corruption across team members.

**Conclusion**: Terraform is strictly a **remote cloud orchestration tool**. Local development remains powered by Miniflare (`pnpm run dev` / `scripts/dev.ts`).

---

## 4. Concrete Terraform Configuration Specification

### 4.1 Directory Structure (`infra/terraform/`)

```
infra/terraform/
├── versions.tf                        # Terraform & Cloudflare provider constraints
├── backend.tf                         # S3-compatible backend pointing to Cloudflare R2
├── variables.tf                       # Root account variables & environment toggle
├── outputs.tf                         # Root outputs (bridge to Wrangler)
├── modules/
│   └── cloudflare_stack/              # Parameterized reusable stack module
│       ├── main.tf                    # Environment metadata & local tags
│       ├── d1.tf                      # cloudflare_d1_database
│       ├── kv.tf                      # cloudflare_workers_kv_namespace
│       ├── r2.tf                      # cloudflare_r2_bucket, cors & lifecycle
│       ├── dns.tf                     # cloudflare_record & cloudflare_worker_domain
│       ├── security.tf                # cloudflare_turnstile_widget & cloudflare_ruleset (WAF)
│       ├── variables.tf               # Module inputs
│       └── outputs.tf                 # Module outputs (IDs, names, bindings)
└── environments/
    ├── production/
    │   ├── main.tf
    │   ├── terraform.tfvars
    │   └── backend-prod.hcl
    ├── staging/
    │   ├── main.tf
    │   ├── terraform.tfvars
    │   └── backend-staging.hcl
    └── preview/
        ├── main.tf
        └── variables.tf               # Dynamic workspace inputs
```

### 4.2 HCL Configurations

#### `infra/terraform/versions.tf`
```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }
}
```

#### `infra/terraform/backend.tf`
```hcl
terraform {
  backend "s3" {
    bucket                      = "chrishop-terraform-state"
    key                         = "environments/${var.environment}/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
    endpoints = {
      s3 = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
    }
  }
}
```

#### `infra/terraform/modules/cloudflare_stack/d1.tf`
```hcl
resource "cloudflare_d1_database" "primary" {
  account_id = var.cloudflare_account_id
  name       = "chrishop-${var.environment}-db"
}
```

#### `infra/terraform/modules/cloudflare_stack/kv.tf`
```hcl
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = "NEXT_CACHE_WORKERS_KV_${upper(var.environment)}"
}
```

#### `infra/terraform/modules/cloudflare_stack/r2.tf`
```hcl
resource "cloudflare_r2_bucket" "media" {
  account_id = var.cloudflare_account_id
  name       = "chrishop-media-${var.environment}"
  location   = "ENAM"
}

# Declarative CORS configuration replacing infra/r2/cors-media.json
resource "cloudflare_r2_bucket_cors" "media_cors" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.media.name

  rules = [
    {
      allowed = {
        origins = [
          "https://${var.primary_domain}",
          "https://staging-${var.primary_domain}",
          "http://localhost:3000"
        ]
        methods = ["GET", "HEAD"]
        headers = ["*"]
      }
      max_age_seconds = 86400
    }
  ]
}

# Declarative lifecycle rules replacing infra/r2/lifecycle-*.json
resource "cloudflare_r2_bucket_lifecycle" "media_lifecycle" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.media.name

  rules = [
    {
      id      = "transition-to-infrequent-access"
      status  = "Enabled"
      conditions = {
        prefix = "uploads/"
        age    = var.environment == "preview" ? 7 : 90
      }
      transitions = [
        {
          storage_class = "InfrequentAccess"
        }
      ]
    },
    {
      id      = "expire-preview-media"
      status  = var.environment == "preview" ? "Enabled" : "Disabled"
      conditions = {
        prefix = "uploads/"
        age    = 14
      }
      expiration = {
        delete_marker = true
      }
    }
  ]
}
```

#### `infra/terraform/modules/cloudflare_stack/dns.tf`
```hcl
resource "cloudflare_record" "storefront" {
  zone_id = var.cloudflare_zone_id
  name    = var.subdomain_prefix == "" ? "chrishop" : "${var.subdomain_prefix}-chrishop"
  content = "100::" # Standard proxied CNAME/Worker destination
  type    = "AAAA"
  proxied = true
  comment = "Managed by Terraform - ChrisShop ${var.environment}"
}

resource "cloudflare_worker_domain" "custom_domain" {
  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  hostname    = "${cloudflare_record.storefront.name}.${var.zone_name}"
  service     = "chrishop-${var.environment}"
  environment = "production"
}
```

#### `infra/terraform/modules/cloudflare_stack/outputs.tf`
```hcl
output "d1_database_id" {
  description = "UUID of the provisioned D1 database"
  value       = cloudflare_d1_database.primary.id
}

output "kv_namespace_id" {
  description = "ID of the Workers KV cache namespace"
  value       = cloudflare_workers_kv_namespace.cache.id
}

output "r2_bucket_name" {
  description = "Name of the R2 media bucket"
  value       = cloudflare_r2_bucket.media.name
}

output "storefront_url" {
  description = "Full URL for the storefront"
  value       = "https://${cloudflare_record.storefront.name}.${var.zone_name}"
}
```

---

## 5. End-to-End Migration Plan with Adversarial Reconciliation

### Phase 1: State Storage & Baseline Module Setup
1. Create the dedicated remote state R2 bucket: `chrishop-terraform-state`.
2. Configure Cloudflare API token with required Account and Zone permissions (`D1:Edit`, `KV:Edit`, `R2:Edit`, `DNS:Edit`, `Workers:Edit`, `Zone Settings:Edit`).
3. Author the clean base Terraform files in `infra/terraform/` (`versions.tf`, `backend.tf`, and `modules/cloudflare_stack/`).

### Phase 2: Adversarial State Reconciliation & Zero-Downtime Import
To prevent **codifying accidental production drift** (e.g. temporary dashboard tweaks, forgotten test records, or misconfigured security settings), we enforce the 4-step reconciliation protocol:

1. **Author Desired Intent in Clean HCL**:
   Write clean, standardized HCL reflecting our documented architecture in `wrangler.toml` and `docs/CLOUDFLARE_SETUP.md`.
2. **Dump Live State to Scratch Area**:
   Run `cf-terraforming generate` into a temporary scratch folder:
   ```bash
   mkdir -p scratch/live-dump
   cf-terraforming generate -z $CLOUDFLARE_ZONE_ID --resource-type "cloudflare_record" > scratch/live-dump/dns.tf
   cf-terraforming generate -a $CLOUDFLARE_ACCOUNT_ID --resource-type "cloudflare_d1_database" > scratch/live-dump/d1.tf
   cf-terraforming generate -a $CLOUDFLARE_ACCOUNT_ID --resource-type "cloudflare_workers_kv_namespace" > scratch/live-dump/kv.tf
   cf-terraforming generate -a $CLOUDFLARE_ACCOUNT_ID --resource-type "cloudflare_r2_bucket" > scratch/live-dump/r2.tf
   ```
3. **Execute Adversarial Drift Diff**:
   Perform a structured line-by-line diff between `scratch/live-dump/` and our clean HCL:
   - *Legitimate Hotfixes*: Intentionally added to clean HCL with explicit commit rationale.
   - *Undocumented UI Tweaks / Dangling Records*: Left out of HCL so Terraform can purge or correct them.
4. **Import & Surface Drift in Plan**:
   Import existing live IDs into the clean state:
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
   Run `terraform plan`. Any existing drift is explicitly surfaced in the plan diff for operator approval rather than being hidden.

### Phase 3: Monorepo & Wrangler Bridge Integration
1. Implement a lightweight bridge script (`scripts/generate-wrangler-config.ts` or environment overlays) that takes Terraform output IDs (`TF_OUT_D1_ID`, `TF_OUT_KV_ID`) and supplies them to `wrangler deploy`.
2. Retain `wrangler.toml` for local Miniflare development so developer workflows (`pnpm run dev`) remain completely unaffected.

### Phase 4: CI/CD Pipeline Integration
1. **`ci.yml`**: Add preflight formatting and validation check (`terraform fmt -check`, `terraform validate`).
2. **`preview-deploy.yml`**: Replace `sed` edits with `terraform workspace select -or-create preview-pr-${PR_NUM}` and `terraform apply -auto-approve`.
3. **`preview-teardown.yml`**: Replace `wrangler delete` with `terraform workspace select preview-pr-${PR_NUM}` and `terraform destroy -auto-approve`.
4. **`deploy.yml`**: Run `terraform apply` for staging and production prior to executing `wrangler deploy`.

### Phase 5: Automated Drift Detection & Operational Runbooks
1. Add `.github/workflows/terraform-drift.yml` scheduled daily at 00:00 UTC to execute `terraform plan -detailed-exitcode` and alert the engineering team on any unauthorized manual changes.
2. Publish complete disaster recovery and resource restoration procedures in `docs/TERRAFORM_SETUP.md`.

---

## 6. Capabilities Gained vs. Key Abilities Lost

### 6.1 Capabilities Gained

| Capability | Impact & Value to ChrisShop |
| :--- | :--- |
| **Authoritative Declarative State** | All cloud resources (D1, KV, R2, DNS, WAF, Turnstile) are fully version-controlled in git. Eliminates undocumented manual dashboard changes. |
| **Continuous Drift Detection** | Automated CI checks alert immediately when out-of-band changes occur in Cloudflare, preventing silent configuration divergence. |
| **True Ephemeral PR Isolation** | Every PR receives its own isolated D1 database and KV namespace rather than sharing a dirty preview DB. Zero dangling resources on PR close. |
| **Consolidated Policy Governance** | Replaces disparate JSON files (`cors-media.json`, `lifecycle-prod.json`, `lifecycle-staging.json`) and bash scripts (`r2_apply_lifecycle.sh`) with native declarative HCL. |
| **Automated PR Plan Reviews** | Pull requests receive an automated sticky comment with `terraform plan` output showing the exact edge infrastructure changes before merging. |
| **Cross-Resource References** | Custom worker domains and DNS records reference computed resource IDs directly, eliminating hardcoded UUID copy-paste errors. |

### 6.2 Key Abilities & Ergonomics Lost (Trade-Offs)

| Lost Ability / Trade-Off | Engineering Impact | Mitigation Protocol |
| :--- | :--- | :--- |
| **Single-Command Atomic Deploy (`wrangler deploy`)** | Deployments become a two-step process (Terraform apply -> Wrangler deploy), increasing CI execution time. | Skip the Terraform apply phase in CI if no files in `infra/terraform/**` were modified in the commit. |
| **No Local Dev Emulation in Terraform** | Terraform cannot run local workers or emulate D1/KV locally. | Keep Miniflare and `scripts/dev.ts` as the sole local development stack. Never attempt to use Terraform for local development. |
| **D1 Schema Migration Split** | Terraform manages the database instance, but cannot safely manage DDL migrations (tracking version tables, schema checksums, rollbacks). | Continue managing schema DDL migrations via `wrangler d1 migrations apply` using the database provisioned by Terraform. |
| **Static Asset Upload Friction** | OpenNext outputs hundreds of static chunks that cannot be efficiently deployed via Terraform's Cloudflare provider. | Maintain the Decoupled Hybrid Model: let OpenNext/Wrangler handle asset and worker code deployment. |
| **Plaintext Secrets in Remote State** | Secrets managed in Terraform are stored unencrypted in `terraform.tfstate`. | Do not store runtime application secrets in Terraform. Continue managing runtime secrets via encrypted GitHub Secrets and `wrangler secret put`. |
| **Provider Schema Volatility** | The Cloudflare Terraform provider undergoes frequent breaking changes across major versions (v4 to v5). | Pin provider versions strictly (`~> 4.35`) and isolate all Cloudflare resources inside the `cloudflare_stack` module. |
