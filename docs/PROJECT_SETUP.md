# GitHub Project Setup & Issue Population Guide (`docs/PROJECT_SETUP.md`)

This document provides exact, agentic instructions for setting up the GitHub Project v2 board, Milestones, Labels, custom Project fields, and populating all user stories/issues for the **ChrisShop** monorepo.

---

## 1. Authentication & Prerequisites

Ensure the `gh` CLI is installed and authenticated with `project` / `repo` permissions:

```bash
gh auth refresh -s project,repo
```

---

## 2. GitHub Milestones Setup

Run the following commands to create the 6 Delivery Phase milestones:

```bash
gh milestone create --title "Phase 1: Prototyping & Local Dev" --description "Local development skeleton, docker stack, LOCAL_DEVELOPMENT.md, skills, baseline CI, branch protection, and local Creator review."
gh milestone create --title "Phase 2: Infrastructure & Dependencies" --description "External dependency manifests (DEP_*.md), control scripts, integration tests, ephemeral preview environments, and Creator preview review."
gh milestone create --title "Phase 3: End-to-End Integration" --description "Storefront + CMS SDK integration, Redis stock locks, Stripe dynamic checkout, Discord alerts, fulfillment workflow, and full drop dry run with Chris."
gh milestone create --title "Phase 4: DevOps & Failover Automation" --description "Production CD pipeline, rolling deployment health checks, two-phase migrations, encrypted offsite backups, emergency rollbacks, and disaster recovery runbooks."
gh milestone create --title "Phase 5: Security Hardening" --description "Hetzner VPS OS hardening, Directus RBAC + TOTP 2FA, age secrets isolation, and CI security vulnerability scanning."
gh milestone create --title "Phase 6+: Feature Enhancements" --description "Shippo 1-click shipping labels, drop waitlist subscriptions, and e-commerce analytics dashboards."
```

---

## 3. GitHub Labels Setup

Create standardized classification labels:

```bash
# Epic Phase Labels
gh label create "epic:phase-1" --color "0E8A16" --description "Phase 1: Prototyping & Local Dev"
gh label create "epic:phase-2" --color "1D76DB" --description "Phase 2: Infrastructure & Dependencies"
gh label create "epic:phase-3" --color "5319E7" --description "Phase 3: End-to-End Integration"
gh label create "epic:phase-4" --color "FBCA04" --description "Phase 4: DevOps & Failover"
gh label create "epic:phase-5" --color "D93F0B" --description "Phase 5: Security Hardening"
gh label create "epic:phase-6" --color "006B75" --description "Phase 6+: Feature Enhancements"

# Type Labels
gh label create "type:feature" --color "a2eeef" --description "Feature or capability task"
gh label create "type:infra" --color "c2e0c6" --description "Infrastructure or CI/CD task"
gh label create "type:security" --color "b60205" --description "Security hardening task"
gh label create "type:docs" --color "0075ca" --description "Documentation or process task"
gh label create "creator-review" --color "f9d0c4" --description "Creator (Chris) feedback or vision sign-off touchpoint"
```

---

## 4. GitHub Project (v2) Creation & Custom Fields

### 4.1 Create Project Board

```bash
gh project create --owner jacobmiller22 --title "ChrisShop Delivery Roadmap"
```

### 4.2 Add Custom `Phase` Field

Add a Single Select field named `Phase` with options:

- `Phase 1: Prototyping`
- `Phase 2: Infrastructure`
- `Phase 3: Integration`
- `Phase 4: DevOps`
- `Phase 5: Security`
- `Phase 6+: Enhancements`

---

## 5. Issue Creation Script Commands

An agent can execute the following `gh issue create` commands to populate all stories across all 6 phases:

### Phase 1 Stories

```bash
gh issue create --title "Story 1.1: Workspace & Monorepo Foundation Setup" --body "Initialize pnpm workspace, turbo.json, root package.json, tsconfig.json, eslint, and prettier." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.2: Local Development Docker Stack" --body "Create infra/docker/docker-compose.dev.yml containing Postgres 16, Directus 11, Redis OSS, and MinIO." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.3: Storefront & CMS App Skeletons" --body "Initialize Next.js 15 apps/web, Directus apps/cms, packages/ui, packages/types, and packages/notifications." --label "epic:phase-1,type:feature" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.4: Directus Schema Snapshot & Seed Script" --body "Define Directus schema (categories, products, product_variations, orders, order_items, processed_stripe_events), export snapshot.yaml, and pnpm seed script." --label "epic:phase-1,type:feature" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.5: Local Development Documentation & Agentic Skill" --body "Create LOCAL_DEVELOPMENT.md guide, docs/PROJECT_SETUP.md, and skills/local-development/SKILL.md." --label "epic:phase-1,type:docs" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.6: Baseline CI Prep Workflow" --body "Create .github/workflows/ci.yml running linting, type-checking, and workspace build validation on PRs." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.7: Branch Protection & Environment Lockdown" --body "Configure GitHub branch protection rules for main and production branches enforcing CI checks and PR approvals." --label "epic:phase-1,type:security" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.8: Phase 1 Creator Review - Local Demo & Content Model Walkthrough" --body "Conduct interactive local demo with Chris to review Directus Admin UI, product setup, draft content models, and drop countdown logic." --label "epic:phase-1,creator-review" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.9: .env.example Template File" --body "Create .env.example at repo root with safe placeholder values for Postgres, Directus, MinIO, Redis, Stripe, and Discord." --label "epic:phase-1,type:docs" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.10: Shared Config Package (packages/config)" --body "Create packages/config containing shared tsconfig.base.json, ESLint configs, and Prettier presets." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.11: MinIO Bucket Initialization Service" --body "Add minio-init helper service in docker-compose.dev.yml to provision chrishop-media S3 bucket automatically." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
```

### Phase 2 Stories

```bash
gh issue create --title "Story 2.1: External Dependency Specifications (DEP_*.md)" --body "Create DEP_HETZNER.md, DEP_DIRECTUS.md, DEP_STRIPE.md, DEP_CLOUDFLARE_R2.md, DEP_REDIS.md, DEP_RESEND.md, DEP_DISCORD.md, DEP_CADDY.md." --label "epic:phase-2,type:docs" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.2: Dependency Control Automation Scripts" --body "Build management scripts in infra/scripts/deps/ for bucket creation, schema applying, and server init." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.3: Dependency Control Integration Tests" --body "Implement automated integration tests validating live/mocked API connection health." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.4: Ephemeral Environment Docker & Caddy Routing Setup" --body "Create docker-compose.preview.yml and Caddy reverse proxy configuration for wildcard *.preview.chrishop.com." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.5: Ephemeral PR Preview Deployment Workflow" --body "Create .github/workflows/preview-deploy.yml for automated PR environment provisioning." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.6: Ephemeral PR Teardown Workflow" --body "Create .github/workflows/preview-teardown.yml to destroy preview stack on PR close." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.7: Phase 2 Creator Review - Live Ephemeral Preview Feedback Loop" --body "Deploy pr-X.preview.chrishop.com preview deployments for Chris to test staging features, drop UI, and R2 uploads." --label "epic:phase-2,creator-review" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.8: Production Docker Compose (docker-compose.prod.yml)" --body "Create infra/docker/docker-compose.prod.yml defining production container configurations." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.9: Staging Docker Compose (docker-compose.staging.yml)" --body "Create infra/docker/docker-compose.staging.yml for permanent staging environment at staging.chrishop.com." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.10: VPS Infrastructure Skeleton (cloud-init, Ansible)" --body "Create cloud-init.yaml, playbook.yml, and inventory.ini under infra/vps/." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.11: Custom Caddy Docker Image (xcaddy + Cloudflare DNS)" --body "Create infra/caddy/Dockerfile building Caddy with Cloudflare DNS plugin." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
```

### Phase 3 Stories

```bash
gh issue create --title "Story 3.1: Hybrid Storefront Data Fetching & UI Components" --body "Build storefront pages fetching live catalog data via @directus/sdk REST client." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.2: Pre-Checkout Lock & Dynamic Stripe Checkout" --body "Implement /api/checkout with 10-minute Redis reservation key and dynamic price_data Stripe session generation." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.3: Atomic Webhook Processing & Idempotent Stock Decrement" --body "Build /api/webhooks/stripe with raw signature validation, 300s replay check, processed_stripe_events idempotency table, and Kysely SQL locks." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.4: Order Event Pipeline & Discord Notification Engine" --body "Integrate packages/notifications to dispatch rich Discord embeds on purchases and low-stock alerts." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.5: Phase 1 Order Fulfillment & Customer Tracking Email Flow" --body "Configure Directus custom action hook for tracking link generation and Resend customer emails." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.6: End-to-End Integration Test Suite" --body "Write end-to-end integration tests simulating checkout, lock expiration, stock contention, and webhooks." --label "epic:phase-3,type:infra" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.7: Phase 3 Creator Review - Full End-to-End Drop Dry Run & Sign-Off" --body "Execute complete simulated drop launch with Chris from drop schedule to customer email delivery." --label "epic:phase-3,creator-review" --milestone "Phase 3: End-to-End Integration"
```

### Phase 4 Stories

```bash
gh issue create --title "Story 4.1: Production CD Deployment Pipeline" --body "Create .github/workflows/deploy.yml for automated SSH deployment to Hetzner VPS." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.2: Health Check Gate & Rolling Deployment Strategy" --body "Implement Next.js /api/health endpoint and Caddy rolling traffic swap gate after 3 healthy checks." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.3: Two-Phase Expand-and-Contract Migration Automation" --body "Configure directus schema apply pipeline enforcing additive Phase A changes before container swap." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.4: Automated Offsite Encrypted Backup & System Restore" --body "Create infra/scripts/backup.sh (pg_dump + age encryption to S3/R2) and restore.sh script." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.5: Emergency Rollback Workflow & Disaster Recovery Runbook" --body "Create .github/workflows/rollback.yml and document docs/runbooks/DISASTER_RECOVERY.md." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
```

### Phase 5 & Phase 6+ Stories

```bash
gh issue create --title "Story 5.1: Hetzner VPS Server OS Hardening" --body "Complete Ansible playbook infra/vps/playbook.yml enforcing UFW firewall, SSH pubkeys, fail2ban, and Docker log rotation." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"
gh issue create --title "Story 5.2: Directus RBAC & Mandatory TOTP 2FA Enforcement" --body "Configure Directus permission policies and enforce mandatory TOTP 2FA for Admin users." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"
gh issue create --title "Story 5.3: Secrets Management Audit & Age Key Isolation" --body "Audit production secrets encryption with age, keeping master keys strictly in GitHub Secrets." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"
gh issue create --title "Story 5.4: CI Security & Dependency Vulnerability Audit" --body "Add pnpm audit and trivy container scanning to GitHub Actions CI pipeline." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"

gh issue create --title "Story 6.1: Shippo Automated 1-Click Shipping Label Generation" --body "Implement Directus extension to fetch Shippo rates and purchase shipping labels directly in Directus." --label "epic:phase-6,type:feature" --milestone "Phase 6+: Feature Enhancements"
gh issue create --title "Story 6.2: Drop Launch Waitlist & SMS/Email Alert System" --body "Extend packages/notifications and storefront UI for drop waitlist subscriptions." --label "epic:phase-6,type:feature" --milestone "Phase 6+: Feature Enhancements"
gh issue create --title "Story 6.3: E-Commerce Analytics & Sales Reporting Dashboard" --body "Create Directus insights dashboard tracking total revenue, top variations, and inventory velocity." --label "epic:phase-6,type:feature" --milestone "Phase 6+: Feature Enhancements"
```

---

## 6. Board Synchronization (`board-sync.yml`)

Ensure `.github/workflows/board-sync.yml` is active in the repository. The workflow handles automatic card transitions:

- Move to **`In Progress`** when a branch or PR referencing an issue (`Fixes #X`) is pushed.
- Move to **`In Review`** when a PR is marked ready for review.
- Move to **`Done`** when a PR is merged to `main`.

---

## 7. Branch Protection Setup (`infra/scripts/setup-branch-protection.sh`)

To preserve codebase stability and enforce CI quality gates as the repository moves beyond Phase 1, `main` branch protection is programmatically configured via `infra/scripts/setup-branch-protection.sh`.

### 7.1 Enforced Guardrails
- **Required Status Checks**: Strict checking for the CI workflow check (`Lint, Typecheck, Test & Build`). Branches must be up-to-date with `main` before merging.
- **Linear History**: Merge commits are disallowed (`required_linear_history: true`). Merges must use squash or rebase workflows.
- **Administrator Enforcement**: Protection rules apply to repository administrators (`enforce_admins: true`).
- **Destructive Action Lockdown**: Direct force pushes (`allow_force_pushes: false`) and branch deletions (`allow_deletions: false`) are permanently blocked.
- **Conversation Resolution**: All review conversations must be resolved before merging (`required_conversation_resolution: true`).
- **PR Review Approvals**: Review approvals can be enabled with `--require-reviews true` and `--min-approvals <count>` when multiple maintainers are active. Defaults to `false` for solo development velocity.

### 7.2 Running Branch Protection Setup
Run the setup script using the GitHub CLI:

```bash
# Apply standard protection rules to main
./infra/scripts/setup-branch-protection.sh

# Optional: Enable PR review approvals with 1 reviewer
./infra/scripts/setup-branch-protection.sh --require-reviews true --min-approvals 1

# Optional: Target a different branch (e.g. production/staging)
./infra/scripts/setup-branch-protection.sh --branch production
```

### 7.3 Verification
Verify the protection rules via GitHub CLI:

```bash
gh api repos/:owner/:repo/branches/main/protection
```

