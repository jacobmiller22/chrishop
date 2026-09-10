---
name: backlog-refinement
description: Process and instructions for conducting adversarial backlog grooming, story refinement, gap analysis, and issue creation across ChrisShop delivery phases.
---

# Backlog Grooming & Adversarial Refinement Skill

This skill defines the operational protocol for periodic, adversarial backlog refinement across the **ChrisShop** monorepo. It ensures that user stories across all phases (Phase 1 through Phase 6+) are meticulously planned, shovel-ready, and verified against the actual codebase reality.

---

## 1. Objectives

1. **Re-Review Outstanding & Completed Work**:
   - Verify completed stories against actual code in the repository (`apps/`, `packages/`, `infra/`, `docs/`).
   - Check if features marked closed have test coverage, error handling, and matching schema.
2. **Adversarial Gap Detection**:
   - Act as an adversary looking for failure modes: race conditions during drops, unhandled webhook errors, missing DB transactions, missing rollback runbooks, secrets leakage, unvalidated inputs.
   - Read between the lines: identify missing glue code, implicit prerequisites, and omitted sub-tasks that are required for end-to-end success.
3. **Refinement & Story Enrichment**:
   - Add concrete implementation details (file paths, interface definitions, API endpoints, error cases) to existing issues.
   - Break down oversized stories into single-worktree executable tasks.
4. **New Story Creation**:
   - File new GitHub issues (`gh issue create`) for missing functionality, operational tasks, or test gaps.
5. **Low-Confidence Decision Escalation**:
   - Flag any ambiguous requirements or architectural trade-offs to the creator/user with clear options.

---

## 2. Refinement Workflow

### Step 1: Inventory Current State
Inspect GitHub issues and pull requests:
```bash
# List open issues by epic
gh issue list --state open --limit 100

# Review recently closed issues to verify implementation
gh issue list --state closed --limit 20

# Check open PRs
gh pr list
```

### Step 2: Codebase Ground-Truth Check
Compare the repository state against `docs/HIGH_LEVEL_DESIGN.md` and `docs/deps/`:
- **Storefront**: `apps/web` (Next.js App Router, routes, components)
- **CMS**: `apps/cms` (Directus schema, extensions, hooks)
- **Packages**: `packages/types`, `packages/ui`, `packages/notifications`
- **Infrastructure**: `infra/docker`, `infra/vps`, `infra/caddy`

Confirm whether implemented code matches the design specifications.

### Step 3: Adversarial Challenge Checklist
Review each phase against the following failure modes:
- **Drop Concurrency**: Are Redis stock reservations atomic and bounded? Is there an automated unlock mechanism if checkout is abandoned?
- **Stripe Edge Cases**: Is webhook verification raw-body? Are replay attacks (>300s) rejected? Are idempotency keys used?
- **Schema & Migrations**: Are Directus migrations version-controlled and applied idempotently in CI/CD?
- **Observability**: Are Sentry, Better Stack, and Discord alerts configured with actionable error context?
- **Worktree Cleanliness**: Are all previous worktrees reaped and pruned (`wt list`)?

### Step 4: Refine & File Stories
When updating or creating issues:
- Use standard labels: `epic:phase-X`, `type:feature` / `type:infra` / `type:bug`, `priority:high` / `priority:medium` / `priority:low`, `size:small` / `size:medium` / `size:large`.
- Clearly document dependencies in the issue body:
  ```markdown
  ### Dependencies
  - Prerequisites: #<IssueNumber>
  - Unblocks: #<IssueNumber>
  ```
- Detail acceptance criteria with explicit file paths and verification commands (`pnpm run check`, `pnpm run build`).

### Step 5: Report Findings & Escalate Decisions
Compile a structured Grooming & Refinement Report containing:
1. **Audit Summary**: State of completed vs open work.
2. **Gaps & Discrepancies**: Hidden risks or inconsistencies found.
3. **Refined & Created Stories**: Links to updated or newly opened issues.
4. **Decisions Needing Input**: Any low-confidence questions presented with specific options.

---

## 3. Autonomous Scheduled Daemon (`launchd`)

ChrisShop provides an automated host-level background daemon using macOS `launchd` to execute this refinement protocol every 12 hours (at 02:00 and 14:00 EDT/EST).

### Management Commands
```bash
# Install and register the LaunchAgent with macOS launchd
./infra/launchd/install.sh install

# Check daemon registration and status
./infra/launchd/install.sh status

# Trigger an immediate refinement execution
./infra/launchd/install.sh run-now

# View latest logs
./infra/launchd/install.sh logs

# Unload and remove daemon
./infra/launchd/install.sh uninstall
```

### Components
- `infra/launchd/com.chrishop.backlog-refinement.plist`: LaunchAgent definition configured with `StartCalendarInterval` for 02:00 and 14:00 daily.
- `infra/launchd/refinement-runner.sh`: Executable bash runner that loads environment, runs health checks, and invokes the Python auditor.
- `infra/launchd/refinement_audit.py`: Zero-dependency Python auditor cross-referencing issues, code on disk, and automated AI critique routed through the Antigravity CLI (`agy`) with zero API key configuration.
- `infra/launchd/install.sh`: Turnkey management script for operator installation and monitoring.

