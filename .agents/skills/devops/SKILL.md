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
        ├─► 3. Staging Edge Verification & SHA Integrity Suite (test-staging)
        │       ├─► Checkpoint A: Pre-Test Staging Edge Commit Hash Assertion
        │       ├─► Checkpoint B: Staging Environment Parity Loop (/api/health)
        │       └─► Checkpoint C: Post-Test Staging SHA Integrity Check (Anti-Mutation)
        ├─► 4. ✋ Await Human Reviewer Approval (GitHub Actions Environment Gate: jacobmiller22)
        │       └─► Pre-Approval Production Target Commit Validation (HEAD == Trigger SHA)
        ├─► 5. Deploy to Production Edge (https://chrishop.jacobmiller22.com) & Verify (deploy-production)
        └─► 6. Dispatch Discord #dev-alerts Status Alert (notify-deployment)
```

### Key Security & Integrity Guarantees

1. **Default PR Target**: The repository default branch is `staging`. All standard feature branches, bugfixes, and refactors target `staging` by default.
2. **Promotion Hierarchy Enforcement**: Direct pull requests or pushes to `production` from any branch other than `staging` are strictly rejected by the CI check `enforce-promotion-rules` (`.github/workflows/ci.yml`).
3. **Commit Hash Verification (Story 4.23)**:
   - **Pre-Test Staging SHA Assertion**: Before tests execute, probes `staging-chrishop.jacobmiller22.com/api/health` and asserts that the live edge `commitSha` matches the candidate commit.
   - **Post-Test Mutation Guard**: Immediately after tests pass, re-probes staging to detect and reject mid-test mutations or interleaving merges.
   - **Pre-Approval Gate**: Asserts that the commit being approved and compiled strictly matches the release candidate SHA.
4. **Human Reviewer Gate**: Production deployments pause at the GitHub Actions `production` environment, requiring explicit sign-off from designated reviewers (`jacobmiller22`).
5. **Post-Deployment Health Probe**: Once deployed, the edge health endpoint (`https://chrishop.jacobmiller22.com/api/health`) is probed up to 12 times to confirm live operational status.
6. **Automated Discord Alerts**: Dispatches rich embedded operational status notifications to `#dev-alerts` via incoming webhook on both successful deployments and regressions.

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
- **Stage 3: `test-staging`**:
  - **Pre-Test Staging Edge Commit Hash Assertion**: Probes `https://staging-chrishop.jacobmiller22.com/api/health` and verifies that the live edge `commitSha` matches the candidate commit SHA before tests run.
  - **Staging Environment Parity Loop**: Executes 12-attempt health and parity test suite against the staging edge.
  - **Post-Test Staging SHA Integrity Check**: Re-probes staging `/api/health` post-test to confirm the edge SHA has not drifted mid-test due to interleaving merges.
- **Stage 4: `deploy-production` (✋ Human Gate)**:
  - **Pre-Approval Production Target Commit Validation**: Asserts local checkout HEAD strictly matches the trigger commit SHA prior to prompting reviewer.
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
  - Upon approval, the job reconciles Terraform infrastructure, automatically applies pending D1 migrations to `chrishop-prod-db` (`pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote || true`), and deploys the Cloudflare Worker bundle (`deploy --env production`).
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

ChrisShop provides an automated TypeScript CLI script for production promotion with built-in commit hash verification:

```bash
# Dry-run inspection (probes staging & production, lists pending commits, verifies SHAs)
pnpm run deploy:prod --dry-run

# Run full promotion with staging health probe and PR creation
pnpm run deploy:prod

# Enforce commit SHA verification (enabled by default)
pnpm exec tsx scripts/promote-production.ts --verify-sha

# Bypass SHA verification if troubleshooting edge propagation delays
pnpm exec tsx scripts/promote-production.ts --no-verify-sha

# Wait and poll up to 12 attempts for staging edge to finish propagating candidate commit
pnpm exec tsx scripts/promote-production.ts --wait-for-staging

# Probe staging and production edge health only
pnpm run deploy:prod --probe-only

# Create release PR without auto-merging
pnpm run deploy:prod --create-pr-only
```

---

## 4. Promotion Integrity & Immutable Version Promotion Protocol (Story 4.23)

### Pattern A: Runtime Commit Hash Verification (Current Production Standard)
ChrisShop currently operates under Pattern A:
1. **Worker Build Injection**: `scripts/build-worker.ts` bakes `buildCommitSha`, `buildShortSha`, and `buildIsoTimestamp` directly into the worker runtime bundle.
2. **Runtime Endpoint & Headers**: `GET /api/health` exposes `commitSha`, `shortSha`, `buildTimestamp`, and `environment`, and returns `x-chrishop-commit-sha` in the HTTP response headers.
3. **Triple Checkpoints**:
   - **Pre-Test Assertion**: Confirms staging edge is running the candidate commit before tests execute.
   - **Post-Test Mutation Guard**: Confirms staging edge did not receive an interleaving deployment during test execution.
   - **Pre-Approval Gate**: Validates target commit identity prior to human reviewer approval.

### Pattern B: Cloudflare Workers Immutable Version Promotion (`wrangler versions promote`)
Pattern B decouples deployment from source rebuilding by promoting immutable bytecode:
1. **Upload**: `wrangler versions upload --message "Candidate ${{ github.sha }}"` compiles and uploads the Worker bundle once, yielding an immutable Version ID.
2. **Staging Deploy**: `wrangler versions deploy <version-id>@100% --env staging` activates that exact binary on staging.
3. **Validate**: Integration and parity tests validate the exact artifact.
4. **Promote**: `wrangler versions promote <version-id>@100% --env production` activates that exact same immutable artifact on production with zero rebuilds.

This architecture completely eliminates build artifact divergence and environment drift, paving the way for Cloudflare Gradual Deployments (canary releases).

---

## 5. DevOps Tooling & Scripts Inventory

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

## 6. Emergency Rollback Procedures

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
