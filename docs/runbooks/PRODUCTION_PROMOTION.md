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

### Phase B: Promoting Staging into Production (Release PR)

1. **Confirm Staging Health**:
   - Verify staging edge returns HTTP 200:
     ```bash
     curl -s -f https://staging-chrishop.jacobmiller22.com/api/health | jq .
     ```
2. **Open Release Promotion PR**:
   - Open PR from `staging` targeting `production`:
     ```bash
     gh pr create \
       --base production \
       --head staging \
       --title "chore(release): Promote Staging to Production ($(date +%Y-%m-%d))" \
       --body "## Release Candidate Summary
     Promoting validated staging integration changes to production edge.

     ### Preflight Checklist
     - [x] Staging integration tests passed.
     - [x] Ephemeral previews verified.
     - [x] Staging edge health verified at https://staging-chrishop.jacobmiller22.com/api/health.
     - [ ] Production deployment approved via GitHub Actions environment gate."
     ```
3. **Automated CI Validation**:
   - `Enforce Staged Promotion Rules` verifies `head == staging`.
   - `Lint, Typecheck, Test & Build` completes 100% cleanly.
4. **Merge Release PR**:
   - Merge `staging` into `production` (approved review required).

---

### Phase C: Gated Production CD Deployment

Upon push to `production`:

1. **Job 1 (`build-and-validate`)**: Runs typecheck, unit tests, security audit, and build.
2. **Job 2 (`deploy-staging`)**: Deploys the release bundle to Cloudflare Workers staging environment.
3. **Job 3 (`test-staging`)**: Executes 12-attempt health probe against `https://staging-chrishop.jacobmiller22.com/api/health`.
4. **Job 4 (`deploy-production`) - ✋ Human Approval Gate**:
   - The workflow enters a `waiting` state under the `production` environment.
   - The designated reviewer (`jacobmiller22`) receives a notification to review the pending deployment in GitHub Actions.
   - Once approved, Wrangler executes `deploy --env production`.
5. **Job 5 (`verify-production`)**:
   - Probes `https://chrishop.jacobmiller22.com/api/health` and confirms HTTP 200 with all bindings active.

---

## 3. Emergency Rollback Procedure

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

## 4. Administrative Setup & Maintenance

To re-apply or audit branch protection and environment settings:

```bash
# Apply branch protection rules to staging, production, and main
./infra/scripts/setup-branch-protection.sh --tier all

# Configure GitHub Actions production environment with reviewer gate
./infra/scripts/setup-production-environment.sh --reviewer jacobmiller22
```
