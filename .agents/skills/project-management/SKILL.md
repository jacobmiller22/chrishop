---
name: project-management
description: Guidance and instructions for AI agents acting as Technical Project Managers (TPM) on the ChrisShop project to manage GitHub Project v2 boards, milestones, labels, issues, status automation, and dependency tracking.
---

# Technical Project Management Skill

This skill informs AI agents how to manage project delivery, update GitHub Project v2 boards, track story dependencies, and execute TPM responsibilities for the **ChrisShop** monorepo.

## When to Use This Skill

Use this skill whenever you need to:

- Set up or verify GitHub Milestones, Labels, Project v2 boards, and custom fields.
- Create, update, or close issues corresponding to delivery stories across Phase 1 to Phase 6+.
- Move cards through board columns (`Backlog` ➔ `In Progress` ➔ `In Review` ➔ `Done`).
- Map and enforce inter-story dependencies before starting work on a feature.
- Conduct Creator (Chris) vision review touchpoints and capture feedback.

---

## 1. Project Delivery Phases (Epics)

The project is structured into 6 delivery phases:

- **Phase 1: Prototyping & Local Dev** (`epic:phase-1`) - Monorepo skeleton, Cloudflare Workers dev harness, `LOCAL_DEVELOPMENT.md`, baseline CI, branch protection, local Creator review.
- **Phase 2: Infrastructure & Dependencies** (`epic:phase-2`) - `DEP_*.md` manifests, dependency control scripts, ephemeral Miniflare/D1 integration tests, Cloudflare preview environments, Creator preview review.
- **Phase 3: End-to-End Integration** (`epic:phase-3`) - Storefront + Payload CMS v3 integration, Shopify checkout & cart mutations, Discord alerts, Resend tracking email, full drop dry run with Chris.
- **Phase 4: DevOps & Failover Automation** (`epic:phase-4`) - Cloudflare Workers CI/CD deployment pipeline, edge route health check gate (`/api/health`), D1 zero-downtime migrations, emergency instant rollback (`rollback.yml`), disaster recovery runbook.
- **Phase 5: Security Hardening** (`epic:phase-5`) - Cloudflare WAF & bot management, Payload CMS RBAC + 2FA, Shopify webhook HMAC validation, CI security audits.
- **Phase 6+: Feature Enhancements** (`epic:phase-6`) - Shippo 1-click shipping labels, drop waitlists, analytics dashboards.

---

## 2. Issue Lifecycle & Board Management

### 2.1 Issue Start Protocol (`In Progress`)

Before commencing work on any story:

1. Label the issue: `gh issue edit <IssueNumber> --add-label "status:in-progress"`
2. Post an initial comment on the issue (`gh issue comment <IssueNumber> --body "🚀 **Status**: In Progress..."`).
3. Move card on GitHub Project v2 board to `In Progress`.

### 2.2 Periodic Progress Audit Comments

During execution, post comments at key milestones (local check passed, SME Judge intent review, deferred scope creation, PR opened).

### 2.3 Creating Pull Requests & Linking Issues

When work on a story is ready for review/merge:

1. Ensure changes are committed on a feature branch (`feature/story-X-Y-<short-name>`) or isolated worktree branch (`subagent-Story-X-Y-...`).
2. Create a GitHub Pull Request using `gh pr create`:
   ```bash
   gh pr create \
     --title "feat(phase-X): Story X.Y <Story Title>" \
     --body "## Summary of Changes
   <Detailed technical summary of deliverables, components, and packages>

   ## Related Issue
   Fixes #<IssueNumber>" \
     --base main
   ```
3. **Mandatory Issue Linking**: The PR description **MUST** explicitly include `Fixes #<IssueNumber>` or `Closes #<IssueNumber>`. This links the PR directly to the issue on GitHub and ensures the GitHub Project Board (`board-sync.yml`) moves the issue card through `In Progress` ➔ `In Review` ➔ `Done` automatically upon PR creation and merge.

---

## 3. Dependency Verification Rules

Before marking a story `In Progress`:

1. Check `task.md` or `implementation_plan.md` to identify prerequisite dependencies.
2. Verify that all dependent stories are marked `[x]` complete or `Closed` on GitHub.
3. If a dependency is blocked, report the blocker to the team/user before proceeding.

---

## 4. Creator Review Touchpoint Protocol

For stories marked with `creator-review` (Story 1.8, Story 2.7, Story 3.7):

1. Ensure the demo artifact or preview environment URL is active.
2. Document walkthrough instructions and test accounts.
3. Obtain explicit sign-off or feedback from Chris before closing the review story.

---

## 5. Task Completion Protocol (Mandatory Workflow)

Upon finishing implementation for any task or story (refer to [story-feedback-loop](../story-feedback-loop/SKILL.md) for full execution details):

1. **Execute Monorepo Verification**:
   - Run typechecking and linting (`npx pnpm run check`) to ensure zero errors across all workspace projects.
   - Run build validation (`npx pnpm run build`) where applicable.
2. **Create & Link Pull Request**:
   - Create a Pull Request via `gh pr create` targeting `main`, including `Fixes #<IssueNumber>` in the PR body.
3. **Merge Pull Request / CI Verification**:
   - Verify CI status via `gh pr checks <pr-number>` or merge the PR into `main` (`gh pr merge --merge` or `git merge --no-ff`).
4. **Post Comprehensive Completion Comment & Close GitHub Issue**:
   - Post a comprehensive completion comment on the corresponding GitHub Issue (`gh issue comment <IssueNumber> --body "..."`) containing:
     - **Completion Status & Deliverables Summary** (created/modified files, interfaces, endpoints, verification outputs).
     - **Linked Pull Requests & Commit References** (PR URL e.g. `https://github.com/jacobmiller22/chrishop/pull/<PR_NUMBER>`, commit SHA).
     - **Verification Results** (typecheck, lint, build, test outputs).
     - **Follow-up Actions & Spawned Stories** (list of follow-up issues created e.g. `#123`, unblocked next stories, deployment notes).
   - Update issue label to `status:completed` and close the issue (`gh issue close <IssueNumber>`).
5. **Update Progress & Unblocked Dependencies**:
   - Update task tracking artifacts (`task.md` / `walkthrough.md` / `implementation_plan.md`) if active.
   - Present a concise report to the user with completed work, PR/commit references, and unblocked next steps.
6. **Worktree Teardown & Process Reaping**:
   - Switch back to the main monorepo worktree: `wt switch main`.
   - Reap processes and remove the isolated worktree: `wt remove --reap feature/story-X-Y-<shortname>`.
   - Prune git metadata: `git worktree prune` and confirm with `wt list`.

---

## 6. Priority-First Governance & Mandatory Priority Labeling

Every issue across the ChrisShop monorepo **MUST** carry an explicit priority label before it can be considered shovel-ready or dispatched to autonomous agents:

- `priority:critical`: Showstopper / production-down / zero-day security flaw. Preempts all other work immediately across all agents.
- `priority:high`: Critical path milestone deliverable, active phase blocker, or immediate Creator review dependency. Prioritized first by autonomous dispatchers.
- `priority:medium`: Standard phase feature or infrastructure task with no immediate downstream blockers.
- `priority:low`: Nice-to-have visual polish, deferred scope, or post-launch enhancement.

### Priority Labeling Commands:
```bash
# Add or update priority
gh issue edit <IssueNumber> --add-label "priority:high"

# Remove lower priority when escalating
gh issue edit <IssueNumber> --remove-label "priority:medium" --add-label "priority:high"
```

When creating follow-up stories from completed tasks or adversarial audits, agents **MUST** evaluate criticality and assign an explicit priority label immediately upon issue creation.

---

## 7. Adversarial Roadmap & Milestone Audit Protocol

Technical Project Managers and autonomous agents must periodically verify that GitHub Milestones, Backlog Epics, and local architecture remain synchronized and free of architectural drift.

### Audit Command:
```bash
pnpm run audit:roadmap
```

### Verification Checks Enforced:
1. **Milestone Architectural Drift**: Flags legacy stack keywords (`docker`, `postgres`, `redis`, `stripe`, `hetzner`, `directus`) in milestone titles and descriptions.
2. **Orphaned Issues**: Detects open issues with no assigned milestone (`milestone == null`).
3. **Priority Health**: Flags any open issue missing an explicit `priority:*` label.
4. **Issue Lifecycle Sync**: Flags any issue with `status:completed` label that remains open on GitHub.
5. **Milestone Completion Gate**: A milestone cannot be closed until all child issues are either completed or formally re-parented with documented rationale, and human creator review touchpoints (Stories 1.8, 2.7, 3.7) have explicit sign-off.
