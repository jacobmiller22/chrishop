---
name: devops
description: Autonomous DevOps & Release Engineering skill for ChrisShop. Manages production promotions, git promotion workflows (staging ➔ production), Cloudflare Workers CI/CD monitoring, edge health probes, database migrations, and emergency instant rollbacks.
---

# Autonomous DevOps & Release Engineering Skill

This skill informs AI agents how to act as a **DevOps & Release Engineer** for the **ChrisShop** monorepo. It governs code promotion through our two-stage git pipeline, orchestrates Cloudflare Workers deployments, monitors CI/CD execution graphs, manages approval gates, verifies live edge health, and executes instant rollbacks when needed.

---

## When to Use This Skill

Use this skill whenever you need to:

- **Execute a Production Deployment** (`/devops deploy-production` or "promote staging to production").
- **Inspect System & Edge Health** (`/devops status` or probing staging/production health endpoints).
- **Manage Staged Git Promotion** (`staging` ➔ `production` release PRs and CI promotion rules).
- **Monitor Deployment Pipelines** (tracking GitHub Actions `deploy.yml`, handling environment approval gates).
- **Execute Disaster Recovery & Rollback** (`/devops rollback` via Cloudflare Wrangler rollback or `rollback.yml`).
- **Audit Branch Protection & Security Gates** (verifying required checks and human reviewer gates).

---

## 1. Pipeline Architecture & Promotion Rules

ChrisShop enforces a strict two-stage git promotion pipeline:

```
[Feature Branches] (feature/story-X.Y-*)
        │
        ▼ (PR targeting 'staging' with automated preview deploy & checks)
   [staging] ──► Auto-deploy to Staging Edge (https://staging-chrishop.jacobmiller22.com)
        │
        ▼ (Release Promotion: ONLY 'staging' is permitted to target 'production')
  [production]
        │
        ├─► 1. Run Build, Lint, Typecheck & Unit Tests (build-and-validate)
        ├─► 2. Deploy to Cloudflare Workers Staging Edge (deploy-staging)
        ├─► 3. Probe Staging Edge Health (/api/health) (test-staging) (MUST PASS)
        ├─► 4. ✋ Await Human Reviewer Approval (GitHub Actions Environment Gate: jacobmiller22)
        └─► 5. Deploy to Production Edge (https://chrishop.jacobmiller22.com) & Verify (deploy-production)
```

### Key Security & Integrity Guarantees

1. **Default PR Target**: The repository default branch is `staging`. All standard feature branches, bugfixes, and refactors target `staging` by default.
2. **Promotion Hierarchy Enforcement**: Direct pull requests or pushes to `production` from any branch other than `staging` are strictly rejected by the CI check `enforce-promotion-rules` (`.github/workflows/ci.yml`).
3. **Automated Staging Gate**: Production deployments automatically re-deploy and verify the health of the staging edge (`https://staging-chrishop.jacobmiller22.com/api/health`) before requesting human approval.
4. **Human Reviewer Gate**: Production deployments pause at the GitHub Actions `production` environment, requiring explicit sign-off from designated reviewers (`jacobmiller22`).
5. **Post-Deployment Health Probe**: Once deployed, the edge health endpoint (`https://chrishop.jacobmiller22.com/api/health`) is probed up to 12 times to confirm live operational status.

---

## 2. Core Task: Executing Production Deployments (`staging` ➔ `production`)

When instructed to run the production deployment (`/devops deploy-production`), execute the following phased workflow:

### Phase 1: Preflight Health & Commit Inspection

1. **Verify Staging Edge Health**:
   ```bash
   curl -s -f https://staging-chrishop.jacobmiller22.com/api/health | jq .
   ```
   Staging MUST return HTTP 200 with status `"healthy"` and operational D1/R2 bindings before proceeding.

2. **Inspect Unpromoted Commits**:
   ```bash
   git fetch origin staging production
   git log --oneline origin/production..origin/staging
   ```
   - If 0 commits are returned, notify the operator: *"Production is already 100% up-to-date with staging. Zero unpromoted changes found."*
   - If unpromoted commits exist, compile a list of commit SHAs, authors, and summary titles to include in the release candidate report.

3. **Optional Turnkey Dry-Run**:
   ```bash
   pnpm run deploy:prod --dry-run
   ```

### Phase 2: Create or Verify Release PR

1. **Check for Existing Open Release PR**:
   ```bash
   gh pr list --base production --head staging
   ```

2. **Create Release PR (if not already opened)**:
   ```bash
   gh pr create \
     --base production \
     --head staging \
     --title "chore(release): Promote Staging to Production ($(date +%Y-%m-%d))" \
     --body "## Release Candidate Summary
   Promoting validated staging integration changes to production edge.

   ### Preflight Checklist
   - [x] Staging edge health verified at https://staging-chrishop.jacobmiller22.com/api/health.
   - [x] Promotion rules verified (staging ➔ production).
   - [ ] Production deployment approved via GitHub Actions environment gate.
   - [ ] Live production edge health probe verified."
   ```

### Phase 3: Merge Release PR into Production

1. **Verify CI Status**:
   ```bash
   gh pr checks <pr-number>
   ```
   Confirm `Enforce Staged Promotion Rules` and all pre-merge tests pass cleanly.

2. **Merge the PR**:
   ```bash
   gh pr merge <pr-number> --merge
   ```

### Phase 4: Monitor the 5-Stage Deployment DAG (`deploy.yml`)

Watch the triggered production deployment workflow:
```bash
gh run list --workflow=deploy.yml --limit 1
gh run watch <run-id>
```

#### The 5 Stages Explained:
- **Stage 1: `build-and-validate`**: Builds application, checks bundle budget, runs unit tests and linter.
- **Stage 2: `deploy-staging`**: Deploys the release bundle to Cloudflare Workers staging edge.
- **Stage 3: `test-staging`**: Probes `https://staging-chrishop.jacobmiller22.com/api/health` up to 12 times.
- **Stage 4: `deploy-production` (✋ Human Gate)**:
  - When the run transitions to `waiting`, **immediately alert the user**:
    > ✋ **ACTION REQUIRED**: Production deployment is paused at the GitHub Actions Environment Approval Gate.
    >
    > **Approval URL**: `https://github.com/jacobmiller22/chrishop/actions/runs/<RUN_ID>`
    >
    > Please click **Review deployments** ➔ select **production** ➔ click **Approve and deploy**.
  - If the CLI has review permissions:
    ```bash
    gh run review <run-id> --approve --env production
    ```
- **Stage 5: `verify-production`**:
  - Automatically probes `https://chrishop.jacobmiller22.com/api/health` up to 12 times until HTTP 200 is confirmed.

### Phase 5: Handoff & Notification

Once the workflow finishes, deliver a formatted deployment report to the operator:

```markdown
## 🚀 Production Deployment Successful (vX.Y.Z)

**Status**: 🟢 LIVE & HEALTHY  
**Triggered By**: Staging Promotion PR #<PR_NUM>  
**Deployment Run**: [GitHub Actions Run #<ID>](https://github.com/jacobmiller22/chrishop/actions/runs/<ID>)  
**Deployed Commit**: `<SHA>`  

### 🔗 Live Edge Endpoints
| Service | URL | Status |
| :--- | :--- | :--- |
| **Storefront** | [chrishop.jacobmiller22.com](https://chrishop.jacobmiller22.com) | 🟢 200 OK |
| **Admin Panel** | [chrishop.jacobmiller22.com/admin](https://chrishop.jacobmiller22.com/admin) | 🟢 200 OK |
| **Edge Health** | [chrishop.jacobmiller22.com/api/health](https://chrishop.jacobmiller22.com/api/health) | 🟢 200 OK |

### 📋 Included Changes (<COUNT> commits)
- `<sha>` <Commit Title>
- `<sha>` <Commit Title>

### 🚨 Emergency Rollback Quick Action
If any issues arise, execute instant rollback:
\`\`\`bash
pnpm exec wrangler rollback --env production
\`\`\`
```

---

## 3. Automation Tooling (`scripts/promote-production.ts`)

ChrisShop provides an automated TypeScript CLI script for production promotion:

```bash
# Dry-run inspection (probes staging & production, lists pending commits, simulates PR)
pnpm run deploy:prod --dry-run

# Run full promotion with staging health probe and PR creation
pnpm run deploy:prod

# Probe staging and production edge health only
pnpm run deploy:prod --probe-only

# Create release PR without auto-merging
pnpm run deploy:prod --create-pr-only
```

---

## 4. DevOps Tooling & Scripts Inventory

The DevOps engineer must be familiar with the location and role of all automation scripts in the monorepo:

### GitHub Actions Workflows (`.github/workflows/`)
- `deploy.yml`: 5-stage staged promotion pipeline (`staging` ➔ `production` Cloudflare Workers deployment).
- `ci.yml`: Monorepo CI verification, worker bundle budget gate, and `enforce-promotion-rules` check.
- `preview-deploy.yml`: Ephemeral preview deployment per PR (`pr-<NUM>-chrishop.jacobmiller22.com`).
- `preview-teardown.yml`: Cleans up ephemeral preview worker and bindings upon PR merge/close.
- `rollback.yml`: On-demand manual rollback workflow for `staging` or `production`.
- `board-sync.yml`: Synchronizes PR and issue cards across GitHub Project v2 columns.

### Monorepo Scripts (`scripts/`)
- `scripts/promote-production.ts`: Turnkey promotion CLI (probes health, creates PR, monitors DAG).
- `scripts/audit-roadmap.ts`: Unified on-demand adversarial roadmap & backlog auditor.
- `scripts/build-worker.ts`: OpenNext bundle compiler for Cloudflare Workers.
- `scripts/check-bundle-budget.ts`: PR bundle budget enforcement gate (10MB compressed limit).
- `scripts/benchmark-bundle.ts`: Measures OpenNext artifact sizes, assets, and compression stats.
- `scripts/verify-local.ts`: Comprehensive local verification pipeline (lint, typecheck, tests, bundle).
- `scripts/seed-db.ts`: Seeds local D1 database with catalog and creator data.
- `scripts/d1-local-setup.sh`: Initializes local D1 SQLite schema and applies migrations.
- `scripts/simulate-flash-drop.ts`: High-concurrency traffic simulator for drop day stress testing.

### Infrastructure Provisioning Scripts (`infra/scripts/`)
- `infra/scripts/setup-branch-protection.sh`: Applies GitHub branch protection to `staging`, `production`, and `main`.
- `infra/scripts/setup-production-environment.sh`: Configures GitHub Actions `production` environment with required reviewer gate.
- `infra/scripts/setup-image-resizing.sh`: Verifies Cloudflare Images and media transformations.

### Runbooks & Architecture Reference (`docs/runbooks/` & `docs/`)
- `docs/runbooks/PRODUCTION_PROMOTION.md`: Official Production Promotion Runbook.
- `docs/CLOUDFLARE_SETUP.md`: Complete Cloudflare Workers, D1, R2, KV, and DNS setup guide.
- `docs/HIGH_LEVEL_DESIGN.md`: Architecture specification for the Cloudflare-native + Shopify stack.

---

## 5. Emergency Rollback Procedures

If unexpected regressions, edge routing exceptions, or downtime occur in production:

### 1. Instant Wrangler Rollback (Fastest - <15s)
Revert Cloudflare Workers edge deployment to the previous stable release version:
```bash
pnpm exec wrangler rollback --env production
```

### 2. GitHub Actions Manual Rollback Workflow
Trigger automated rollback through GitHub Actions:
```bash
gh workflow run rollback.yml -f environment=production
```

### 3. Verify Health Post-Rollback
```bash
curl -s -f https://chrishop.jacobmiller22.com/api/health | jq .
```
Confirm all database and storage bindings return healthy before closing the incident.
