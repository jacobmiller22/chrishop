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
gh milestone create --title "Phase 1: Prototyping & Local Dev" --description "Local development skeleton, SQLite/D1 seed script, LOCAL_DEVELOPMENT.md, skills, baseline CI, branch protection, and local Creator review."
gh milestone create --title "Phase 2: Infrastructure & Dependencies" --description "Cloudflare Workers & Wrangler bindings, D1 SQLite database, R2 object storage, Payload CMS v3 collections, Shopify Storefront API client, and ephemeral preview deployments."
gh milestone create --title "Phase 3: End-to-End Integration" --description "Storefront catalog + Payload CMS integration, Shopify headless cart & checkout, Shopify webhook processing, Discord alerts, and fulfillment tracking emails."
gh milestone create --title "Phase 4: DevOps & Failover Automation" --description "Production Cloudflare Workers CD pipeline, D1 time-travel recovery, zero-downtime deployment rollbacks, and disaster recovery runbooks."
gh milestone create --title "Phase 5: Security Hardening" --description "Cloudflare WAF & Turnstile anti-bot, Payload CMS RBAC + auth hardening, secrets isolation, and CI security vulnerability scanning."
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
gh issue create --title "Story 1.2: Local Development SQLite & D1 Seed Pipeline" --body "Create SQLite migration and scripts/seed-db.ts seeding categories, products, and variations." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.3: Storefront & Embedded Payload CMS App Skeleton" --body "Initialize Next.js 15 apps/web with embedded Payload CMS v3 under /admin, packages/ui, packages/types, and packages/notifications." --label "epic:phase-1,type:feature" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.4: Catalog Data Access Layer & Price Fallback Formula" --body "Implement local catalog queries in apps/web/src/lib/catalog.ts with unit tests." --label "epic:phase-1,type:feature" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.5: Local Development Documentation & Agentic Skill" --body "Create LOCAL_DEVELOPMENT.md guide, docs/PROJECT_SETUP.md, and skills/local-development/SKILL.md." --label "epic:phase-1,type:docs" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.6: Baseline CI Prep Workflow" --body "Create .github/workflows/ci.yml running linting, type-checking, and workspace build validation on PRs." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.7: Branch Protection & Environment Lockdown" --body "Configure GitHub branch protection rules for main and production branches enforcing CI checks and PR approvals." --label "epic:phase-1,type:security" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.8: Phase 1 Creator Review - Local Demo & Content Model Walkthrough" --body "Conduct interactive local demo with Chris to review Payload Admin UI, product setup, draft content models, and drop countdown logic." --label "epic:phase-1,creator-review" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.9: .env.example Template File" --body "Create .env.example at repo root with safe placeholder values for Cloudflare D1/R2, Payload CMS, Shopify, Resend, and Discord." --label "epic:phase-1,type:docs" --milestone "Phase 1: Prototyping & Local Dev"
gh issue create --title "Story 1.10: Shared Config Package (packages/config)" --body "Create packages/config containing shared tsconfig.base.json, ESLint configs, and Prettier presets." --label "epic:phase-1,type:infra" --milestone "Phase 1: Prototyping & Local Dev"
```

### Phase 2 Stories

```bash
gh issue create --title "Story 2.1: External Dependency Specifications (DEP_*.md)" --body "Create DEP_CLOUDFLARE.md, DEP_CLOUDFLARE_D1.md, DEP_CLOUDFLARE_R2.md, DEP_PAYLOAD_CMS.md, DEP_SHOPIFY.md, DEP_RESEND.md, DEP_DISCORD.md." --label "epic:phase-2,type:docs" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.2: Cloudflare Workers Configuration (wrangler.toml)" --body "Configure wrangler.toml with production, staging, and preview environments, D1, KV, and R2 bindings." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.3: Dependency Control Integration Tests" --body "Implement automated integration tests validating live/mocked API connection health for D1, R2, Shopify, Resend, Discord." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.4: Payload CMS v3 Collections & D1 Adapter" --body "Define Categories, Products, ProductVariations, Media, Users collections in apps/web." --label "epic:phase-2,type:feature" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.5: Ephemeral PR Preview Deployment Workflow" --body "Create .github/workflows/preview-deploy.yml for automated Cloudflare Workers PR environment provisioning." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.6: Ephemeral PR Teardown Workflow" --body "Create .github/workflows/preview-teardown.yml to clean preview deployments on PR close." --label "epic:phase-2,type:infra" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.7: Phase 2 Creator Review - Live Ephemeral Preview Feedback Loop" --body "Deploy pr-preview Cloudflare Worker deployments for Chris to test staging features, drop UI, and R2 uploads." --label "epic:phase-2,creator-review" --milestone "Phase 2: Infrastructure & Dependencies"
gh issue create --title "Story 2.30: Full Monorepo Architecture Reconciliation — Eliminate Legacy Split, Archive Folders & Directus Stack" --body "Purge apps/cms, archive folders, and Directus/Stripe references; establish local SQLite catalog query layer, Shopify mock client, and Payload admin integration tests." --label "epic:phase-2,type:infra,status:completed" --milestone "Phase 2: Infrastructure & Dependencies"
```

### Phase 3 Stories

```bash
gh issue create --title "Story 3.1: Hybrid Storefront Data Fetching & UI Components" --body "Build storefront pages fetching catalog data from Cloudflare D1 with R2 media CDN integration." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.2: Shopify Headless Cart & Checkout Flow" --body "Implement cart creation and Shopify checkout redirection via Storefront API GraphQL client." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.3: Atomic Shopify Webhook Processing & Order Ingestion" --body "Build /api/webhooks/shopify with raw HMAC validation, idempotency checks, and order record insertion." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.4: Order Event Pipeline & Discord Notification Engine" --body "Integrate packages/notifications to dispatch rich Discord embeds on purchases and low-stock alerts." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.5: Phase 1 Order Fulfillment & Customer Tracking Email Flow" --body "Configure customer tracking link generation and Resend customer transactional emails." --label "epic:phase-3,type:feature" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.6: End-to-End Integration Test Suite" --body "Write end-to-end integration tests simulating catalog browsing, cart creation, checkout redirect, and webhook processing." --label "epic:phase-3,type:infra" --milestone "Phase 3: End-to-End Integration"
gh issue create --title "Story 3.7: Phase 3 Creator Review - Full End-to-End Drop Dry Run & Sign-Off" --body "Execute complete simulated drop launch with Chris from drop schedule to customer email delivery." --label "epic:phase-3,creator-review" --milestone "Phase 3: End-to-End Integration"
```

### Phase 4 Stories

```bash
gh issue create --title "Story 4.1: Production Cloudflare Workers CD Deployment Pipeline" --body "Create .github/workflows/deploy.yml for automated Wrangler deployment to Cloudflare Workers." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.2: Health Check Gate & Edge Deployment Strategy" --body "Implement Next.js /api/health endpoint and post-deployment validation gates." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.3: D1 Database Migrations Automation" --body "Configure automated wrangler d1 migrations apply in CI/CD before worker release." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.4: Cloudflare D1 Time-Travel & Snapshot Recovery Runbook" --body "Document automated D1 point-in-time recovery and snapshot exports." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
gh issue create --title "Story 4.5: Emergency Rollback Workflow & Disaster Recovery Runbook" --body "Create .github/workflows/rollback.yml with wrangler rollback and document docs/runbooks/DISASTER_RECOVERY.md." --label "epic:phase-4,type:infra" --milestone "Phase 4: DevOps & Failover Automation"
```

### Phase 5 & Phase 6+ Stories

```bash
gh issue create --title "Story 5.1: Cloudflare WAF, Rate Limiting & Turnstile Anti-Bot" --body "Configure Cloudflare WAF rules, rate limiting for API routes, and Turnstile challenge for drop checkout." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"
gh issue create --title "Story 5.2: Payload CMS RBAC & Authentication Hardening" --body "Configure Payload permission policies, role-based access control, and secure session management." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"
gh issue create --title "Story 5.3: Secrets Management & Wrangler Environment Secrets Isolation" --body "Audit production secrets configuration with wrangler secret put, keeping master keys strictly in GitHub Secrets." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"
gh issue create --title "Story 5.4: CI Security & Dependency Vulnerability Audit" --body "Enforce pnpm audit and Dependabot across all packages with automated security CI checks." --label "epic:phase-5,type:security" --milestone "Phase 5: Security Hardening"

gh issue create --title "Story 6.1: Shippo Automated 1-Click Shipping Label Generation" --body "Implement shipping integration to fetch carrier rates and purchase shipping labels." --label "epic:phase-6,type:feature" --milestone "Phase 6+: Feature Enhancements"
gh issue create --title "Story 6.2: Drop Launch Waitlist & Email Alert System" --body "Extend packages/notifications and storefront UI for drop waitlist subscriptions." --label "epic:phase-6,type:feature" --milestone "Phase 6+: Feature Enhancements"
gh issue create --title "Story 6.3: E-Commerce Analytics & Sales Reporting Dashboard" --body "Create reporting dashboard tracking total revenue, top variations, and inventory velocity." --label "epic:phase-6,type:feature" --milestone "Phase 6+: Feature Enhancements"
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
