# Production Promotion & Deployment Runbook

This runbook defines the standard operating procedure for promoting code through the ChrisShop two-stage delivery pipeline: from feature branches (`feature/story-*`) into the pre-production integration branch (`staging`), and subsequently into the protected live release branch (`production`).

---

## 1. Pipeline Architecture & Governance Overview

```
[Feature Branches] (feature/story-X.Y-*)
        │
        ▼ (PR targeting 'staging' with automated preview deploy & checks)
   [staging] ──► Auto-deploy to Staging Edge (staging-chrishop.jacobmiller22.com)
        │
        ▼ (Release PR: ONLY 'staging' is permitted to target 'production')
  [production]
        │
        ├─► 1. Run Build, Lint, Typecheck & Unit Tests (build-and-validate)
        ├─► 2. Deploy to Cloudflare Workers Staging Edge (deploy-staging)
        ├─► 3. Probe Staging Edge Health (/api/health) (test-staging) (MUST PASS)
        ├─► 4. ✋ Await Human Reviewer Approval (GitHub Actions Environment Gate)
        └─► 5. Deploy to Production Edge (chrishop.jacobmiller22.com) & Verify (deploy-production)
```

### Key Security & Integrity Guarantees

1. **Default PR Target**: The repository default branch is `staging`. All standard feature branches, bugfixes, and refactors target `staging` by default.
2. **Promotion Hierarchy Enforcement**: Direct pull requests or pushes to `production` from any branch other than `staging` are strictly rejected by the CI check `enforce-promotion-rules`.
3. **Automated Staging Gate**: Production deployments automatically re-deploy and verify the health of the staging edge (`staging-chrishop.jacobmiller22.com/api/health`) before requesting human approval.
4. **Human Reviewer Gate**: Production deployments pause at the GitHub Actions `production` environment, requiring explicit sign-off from designated reviewers (`jacobmiller22`).
5. **Post-Deployment Health Probe**: Once deployed, the edge health endpoint (`https://chrishop.jacobmiller22.com/api/health`) is probed up to 12 times to confirm live operational status.

---

## 2. Step-by-Step Promotion Workflow

### Phase A: Merging Feature Work into Staging

1. **Feature Development**:
   - Implement changes in a dedicated git worktree (`feature/story-<X>-<Y>-<shortname>`).
   - Run local validation: `pnpm run verify:local`.
2. **Open Pull Request Targeting `staging`**:
   - Push branch: `git push -u origin feature/story-<X>-<Y>-<shortname>`.
   - Open PR targeting `staging`:
     ```bash
     gh pr create --base staging --title "feat(<scope>): Story <X>.<Y> <Title>" --body "Fixes #<Issue>"
     ```
3. **Review & CI Gates**:
   - Ephemeral preview deploys to `https://pr-<PR_NUM>-chrishop.jacobmiller22.com`.
   - Automated quality gates pass: `Lint, Typecheck, Test & Build` and `Enforce Staged Promotion Rules`.
4. **Merge to `staging`**:
   - Squash-and-merge into `staging`.
   - GitHub Actions `deploy.yml` deploys to Cloudflare Workers staging edge (`https://staging-chrishop.jacobmiller22.com`).

---

### Phase B: Promoting Staging into Production (Automated Release PR)

1. **Automated Release PR Generation & Continuous Rolling Changelog**:
   - Every push/merge to `staging` automatically triggers `.github/workflows/staging-release-pr.yml`.
   - The workflow invokes `pnpm run release:notes` (`scripts/compose-release-notes.ts`) to compose the release manifest from `origin/production..origin/staging`.
   - If an open Release PR (`staging ➔ production`) exists, its body is continuously updated with the latest commits, merged PRs, resolved issues, changed monorepo workspaces, and pending D1 migrations.
   - If no Release PR exists, one is automatically created:
     `chore(release): Promote staging to production [Pending Review]`
     with labels `type:release`, `status:needs-review`, and reviewer `jacobmiller22` assigned.
   - Alternatively, maintainers can manually compose or inspect release notes locally:
     ```bash
     pnpm run release:notes --base origin/production --head origin/staging
     ```

2. **Confirm Staging Health & Preflight Checks**:
   - Verify staging edge returns HTTP 200:
     ```bash
     curl -s -f https://staging-chrishop.jacobmiller22.com/api/health | jq .
     ```
   - Review preflight promotion checklist items inside the Release PR description.

3. **Automated CI Validation**:
   - `Enforce Staged Promotion Rules` in `.github/workflows/ci.yml` verifies `head == staging`.
   - `Lint, Typecheck, Test & Build` completes 100% cleanly.

4. **Review, Approve & Merge Release PR**:
   - Designated maintainer (`jacobmiller22`) approves the Release PR on GitHub.
   - Merge `staging` into `production` (rebase or squash-and-merge).


---

### Phase C: Gated Production CD Deployment

Upon push to `production`:

1. **Job 1 (`build-and-validate`)**: Runs typecheck, unit tests, security audit, and build.
2. **Job 2 (`deploy-staging`)**: Deploys the release bundle to Cloudflare Workers staging environment.
3. **Job 3 (`test-staging`)**: Executes the 3-checkpoint staging verification suite:
   - **Pre-Test Staging Edge Commit Hash Assertion**: Probes `https://staging-chrishop.jacobmiller22.com/api/health` and verifies the returned `commitSha` (or `x-chrishop-commit-sha` header) matches the candidate commit SHA before running tests. Automatically polls for edge propagation.
   - **Staging Environment Parity Loop**: Executes 12-attempt health and parity test suite against the staging edge.
   - **Post-Test Staging SHA Integrity Check**: Re-probes staging `/api/health` post-test to confirm the edge SHA has not drifted mid-test due to interleaving merges.
4. **Job 4 (`deploy-production`) - ✋ Human Approval Gate**:
   - **Pre-Approval Production Target Commit Validation**: Asserts local checkout HEAD matches the trigger commit SHA prior to prompting reviewer and compiling production build.
   - The workflow enters a `waiting` state under the `production` environment.
   - The designated reviewer (`jacobmiller22`) receives a notification to review the pending deployment in GitHub Actions.
   - Once approved:
     - Terraform validates and reconciles production Cloudflare infrastructure.
     - Automated D1 migrations are applied cleanly to the production database (`chrishop-prod-db`) via `pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote || true` prior to Worker deployment, preventing schema-code desynchronization.
     - Wrangler executes `deploy --env production` to deploy the application bundle to Cloudflare Workers.
5. **Job 5 (`verify-production`)**:
   - Probes `https://chrishop.jacobmiller22.com/api/health` and confirms HTTP 200 with all bindings active.
6. **Job 6 (`notify-deployment`)**:
   - Executes unconditionally (`if: always()`) upon pipeline completion to catch both successes and regressions.
   - Formats a rich Discord embed and dispatches status notification to `#dev-alerts` via incoming webhook (`DISCORD_WEBHOOK_DEV_ALERTS`).
   - Reports environment, status (SUCCESS or FAILURE), git ref & commit hash, deployment actor, edge endpoint URL, and health probe URL.

---

## 3. Promotion Integrity & Commit Hash Verification Protocol (Story 4.23)

### The Release Integrity & Race Problem
In continuous integration and staged promotion pipelines, a critical race condition can occur if feature merges continue to land on the `staging` branch while a release candidate is undergoing integration testing or awaiting approval. If the staging edge advances mid-flight, integration tests may run against code that differs from the commit being approved, or production may rebuild an unverified commit.

ChrisShop resolves this with runtime commit hash verification and immutable release guardrails.

### Pattern A: Runtime Commit Hash Verification (Active Implementation)

#### 1. Runtime Commit Metadata Exposure
During Worker build (`scripts/build-worker.ts`), the git commit SHA, 7-character short SHA, and build ISO timestamp are baked directly into the Cloudflare Worker bundle:
- **`GET /api/health`**: Returns JSON payload with `commitSha`, `shortSha`, `buildTimestamp`, and `environment`.
- **Response Headers**: Returns `x-chrishop-commit-sha` on edge responses with `cache-control: no-store`.

```json
{
  "status": "healthy",
  "environment": "staging",
  "commitSha": "31b26f59bf0a2c9183dc2ad9ecf91a5db9f95018",
  "shortSha": "31b26f5",
  "buildTimestamp": "2026-09-22T08:00:00.000Z",
  "dependencies": {
    "d1": { "status": "operational" },
    "kv": { "status": "operational" },
    "r2": { "status": "operational" }
  }
}
```

#### 2. Three-Point Hash Verification Protocol
1. **Pre-Test Assertion**:
   Before integration tests run against staging, the deployment pipeline probes `staging-chrishop.jacobmiller22.com/api/health` (polling up to 12 attempts) and asserts that the live edge `commitSha` matches the release candidate `GITHUB_SHA`. If staging has drifted or failed to deploy, testing halts immediately.
2. **Post-Test Mutation Check**:
   Immediately after integration tests pass, staging edge health is re-probed. If the live edge SHA changed during test execution (indicating an interleaving staging deployment occurred), the pipeline aborts with:
   `🚨 Mid-test staging mutation detected! Edge SHA changed from <EXPECTED> to <ACTUAL> during test execution. Failing promotion.`
3. **Pre-Approval Target Validation**:
   In the gated `deploy-production` job, before human approval sign-off, the runner asserts that `git rev-parse HEAD` strictly equals the trigger commit SHA.

#### 3. CLI Diagnostics (`scripts/promote-production.ts`)
The promotion CLI provides real-time hash verification and propagation polling:
```bash
# Full promotion with SHA verification (default)
pnpm run deploy:prod

# Explicitly await staging edge propagation
pnpm exec tsx scripts/promote-production.ts --wait-for-staging

# Dry-run inspection showing target vs staging edge vs prod edge SHAs
pnpm exec tsx scripts/promote-production.ts --dry-run
```

---

### Pattern B: Cloudflare Workers Immutable Version Promotion (`wrangler versions promote`)

While Pattern A verifies commit identity across distinct environment builds, **Pattern B** represents the next architectural evolution: promoting the exact, byte-identical Cloudflare Worker binary without rebuilding from source.

#### Mechanism & Workflow
1. **Upload Immutable Version**:
   ```bash
   wrangler versions upload --message "Release candidate ${{ github.sha }}"
   # Cloudflare returns an immutable Version ID (e.g. 5d1e2f9a-...)
   ```
2. **Deploy to Staging**:
   ```bash
   wrangler versions deploy <version-id>@100% --env staging
   ```
3. **Run Tests & Verify Parity**:
   Run the integration and health probe suite against staging.
4. **Promote Immutable Version to Production**:
   Upon human approval, promote the exact verified version to production:
   ```bash
   wrangler versions promote <version-id>@100% --env production
   ```

#### Comparative Analysis: Pattern A vs Pattern B
| Dimension | Pattern A: Hash Verification (Current) | Pattern B: Immutable Version Promotion (Future) |
| :--- | :--- | :--- |
| **Verification Gate** | Edge `/api/health` commit SHA probe & header comparison | Cryptographic version ID promotion via Cloudflare control plane |
| **Build Count** | Re-builds per environment (`staging`, `production`) | Single build uploaded once; identical binary deployed everywhere |
| **Drift Risk** | Eliminated via 3-point SHA assertions | Mathematically impossible (identical bytecode) |
| **Tooling Dependency** | Standard Next.js / OpenNext / Wrangler CLI | Cloudflare Gradual Deployments & Versioning API |
| **Rollback Speed** | Rollback to prior version via `wrangler rollback` | Rollback or split traffic instantly via version percentages |

#### Future Roadmap: Gradual Deployments & Canary Releases
Pattern B unlocks Cloudflare Gradual Deployments, allowing production traffic to be shifted incrementally (e.g. 10% canary ➔ 50% ➔ 100%) while automated health probes monitor error rates and latency. ChrisShop's `deploy.yml` pipeline will migrate to `wrangler versions promote` as Cloudflare OpenNext versioning bindings stabilize for Next.js 16 full-stack bundles.

---

## 4. Emergency Rollback Procedure

If unexpected edge regression or downtime occurs in production:

1. **Immediate Wrangler Rollback**:
   Revert to the previous stable worker deployment version:
   ```bash
   pnpm exec wrangler rollback --env production
   ```
2. **Verify Edge Recovery**:
   ```bash
   curl -s -f https://chrishop.jacobmiller22.com/api/health | jq .
   ```
3. **Hotfix Flow**:
   - Apply hotfix on a branch branching off `staging`: `git checkout -b hotfix/issue-description staging`.
   - Merge hotfix to `staging`, verify on staging edge, and promote via release PR to `production`.

---

## 5. Administrative Setup & Maintenance

To re-apply or audit branch protection and environment settings:

```bash
# Apply branch protection rules to staging, production, and main
./infra/scripts/setup-branch-protection.sh --tier all

# Configure GitHub Actions production environment with reviewer gate
./infra/scripts/setup-production-environment.sh --reviewer jacobmiller22
```
