# Adversarial Roadmap & Milestone Evaluation Workflow

This document establishes the official Technical Project Management (TPM) protocol for conducting periodic, adversarial evaluations of the **ChrisShop** roadmap, delivery milestones, and backlog issues.

---

## 1. Objectives & Executive Purpose

As codebases evolve—particularly following major architectural pivots (such as ChrisShop's transition from Hetzner/Docker/Postgres/Directus to Cloudflare Workers/Payload CMS v3/D1/Shopify)—project management boards and milestones inevitably diverge from code reality.

The **Adversarial Roadmap Evaluation Workflow** enforces continuous synchronization between:
1. **Repository Reality**: The actual code, packages, configs, and tests running in `apps/web`, `packages/`, and `infra/`.
2. **GitHub Delivery Board**: Milestones, Epics, Priority labels, and Issue dependencies.
3. **Strategic Milestones**: The Creator (Chris) review touchpoints and production launch gates.

---

## 2. The Five Adversarial Pillars

### Pillar 1: Architectural Drift Detection
- Continuously audit milestone titles, descriptions, and active story bodies for deprecated architectural keywords: `docker`, `postgres`, `redis`, `stripe`, `hetzner`, `directus`, `caddy`, `ansible`, `minio`.
- Ensure all stories reflect the finalized Cloudflare-native + Shopify Headless architecture defined in `docs/HIGH_LEVEL_DESIGN.md`.

### Pillar 2: Milestone Hygiene & Zero-Orphan Policy
- **Zero Orphaned Issues**: Every open issue MUST be assigned to an Epic label (`epic:phase-X`) AND an active GitHub Milestone. Floating issues with `milestone: null` are strictly forbidden.
- **De-duplication**: Proactively identify duplicate stories across phases (e.g. CI/CD deploy pipeline stories split across Phase 2 and Phase 4) and consolidate them immediately.
- **Issue Lifecycle Sync**: Stories marked `status:completed` legitimately remain open while their respective pull requests are pending review/merge. Once the pull request is merged, the issue MUST be formally closed on GitHub with linked commits/PRs.

### Pillar 3: Priority-First Governance
Every story MUST be classified into a standardized priority tier:
- `priority:critical` (P0): Showstopper / zero-day / production-down bug. Preempts all other work across all agents.
- `priority:high` (P1): Critical path milestone deliverable, active phase blocker, or immediate Creator review dependency. Highest dispatch priority for autonomous agents.
- `priority:medium` (P2): Standard phase deliverable with no immediate downstream blockers.
- `priority:low` (P3): Nice-to-have visual polish, deferred scope, or post-launch enhancement.

Autonomous dispatchers (`find_candidates.py`) rank candidates by **Priority Tier first**, ensuring high-priority work is tackled ahead of low-priority tasks regardless of phase number.

### Pillar 4: Strategic Horizon Mapping
Organize backlog execution into 4 distinct horizons:
1. **Horizon 1: Immediate Critical Path (Next 24–48 Hours)**: Finishing prerequisites to close the current active milestone.
2. **Horizon 2: Primary Milestone Convergence**: Resolving external dependencies and staging deployment for the subsequent milestone.
3. **Horizon 3: End-to-End Delivery**: Feature integrations, transactional webhooks, and full drop dry runs.
4. **Horizon 4: Pre-Launch Readiness & Live Cutover**: High-concurrency load testing, security audits, and DNS cutover to `chrishop.jacobmiller22.com`.

### Pillar 5: Milestone Transition & Closeout Gates
A GitHub milestone CANNOT be closed until:
1. All child issues are closed OR explicitly re-parented to a future milestone with documented rationale.
2. The corresponding `creator-review` story (Story 1.8 for Phase 1, Story 2.7 for Phase 2, Story 3.7 for Phase 3) has recorded explicit client sign-off.
3. Monorepo verification pipeline passes cleanly (`pnpm run verify:local`).

### Pillar 6: Two-Stage Git Promotion & Deployment Gates
Code promotion to live environments is governed by strict git branch hierarchy:
1. **Feature branches** target `staging` (repository default branch).
2. **Release promotion** from `staging` into `production` requires:
   - PR originating exclusively from `staging` (enforced via `enforce-promotion-rules` CI check).
   - Automated staging deployment and live edge health verification (`staging-chrishop.jacobmiller22.com/api/health`).
   - Human approval gate in GitHub Actions `production` environment (`jacobmiller22`).
   - Post-deployment edge health probe against `https://chrishop.jacobmiller22.com/api/health`.
   - See [docs/runbooks/PRODUCTION_PROMOTION.md](runbooks/PRODUCTION_PROMOTION.md) for standard operating procedures.

---

## 3. Automated Tooling & CLI Commands

### 3.1 Run Adversarial Roadmap Audit
```bash
# Run local interactive audit
pnpm run audit:roadmap

# Run in strict mode (fails on drift or completed issues left open)
pnpm run audit:roadmap --strict

# Export markdown report
pnpm run audit:roadmap --markdown docs/ROADMAP_AUDIT_LATEST.md
```

### 3.2 Discover Top Priority-First Shovel-Ready Stories
```bash
# Discover top 4 candidates prioritized by priority tier first
python3 .agents/skills/story-orchestrator/scripts/find_candidates.py --limit 4

# Filter to critical or high priority only
python3 .agents/skills/story-orchestrator/scripts/find_candidates.py --limit 4 --min-priority high
```

### 3.3 On-Demand Execution & Project Management Skill
The legacy 12-hour background `launchd` daemon has been decommissioned in favor of an on-demand, unified TypeScript auditor.

Operators and AI agents can invoke the audit instantly:
```bash
# Direct CLI execution
pnpm run audit:roadmap

# With full codebase deliverables verification
pnpm run audit:backlog

# Trigger via Project Management skill
/project-management roadmap audit
```
### 3.4 Automated Staging-to-Production Release PR & Rolling Changelog Generation
When features, bugfixes, or dependencies merge into the `staging` integration branch:
1. **GitHub Actions Trigger**: `.github/workflows/staging-release-pr.yml` runs automatically on pushes to `staging`.
2. **Delta & Manifest Composition**: Invokes `pnpm run release:notes` (`scripts/compose-release-notes.ts`) to compute the `production..staging` git delta:
   - Merged pull requests and commit hashes.
   - Closed issue references (`Fixes #X`, `Closes #X`, `Resolves #X`).
   - Impacted monorepo workspaces (`apps/web`, `packages/*`, `infra/`, `.github/`, etc.).
   - Pending D1 SQLite database migrations (`migrations/*.sql`) with execution alerts.
   - Standard preflight promotion checklist.
3. **Release PR Synchronization**:
   - Queries GitHub API for an existing open PR with `head: staging` and `base: production`.
   - If found: dynamically updates the PR title and description with the latest composed release manifest.
   - If none exists: creates a new Release PR titled `chore(release): Promote staging to production [Pending Review]`.
   - Attaches labels `type:release` and `status:needs-review`, and assigns designated reviewer (`jacobmiller22`).
4. **Human Review Gate & Production Edge Deployment**:
   - Maintainer reviews the rolling changelog, verifies staging edge health, and approves the PR.
   - Merging into `production` triggers the multi-stage deployment pipeline in `.github/workflows/deploy.yml` (build ➔ deploy-staging ➔ test-staging ➔ human environment gate ➔ deploy-production).
