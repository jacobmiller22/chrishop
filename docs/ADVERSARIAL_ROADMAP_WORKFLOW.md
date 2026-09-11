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
- **Issue Lifecycle Sync**: Any story marked `status:completed` or documented in `docs/` as finished MUST be formally closed on GitHub with linked commits/PRs.

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

### 3.3 Automated Scheduled Daemon (`launchd`)
The adversarial audit is wired into the 12-hour local `launchd` service (`com.chrishop.backlog-refinement`). Every scheduled execution at 02:00 and 14:00 runs:
1. Monorepo health check (`pnpm run check`).
2. Adversarial backlog critique (`refinement_audit.py`).
3. Roadmap & milestone audit (`pnpm run audit:roadmap`).

To test the daemon run manually:
```bash
./infra/launchd/install.sh run-now
./infra/launchd/install.sh logs
```
