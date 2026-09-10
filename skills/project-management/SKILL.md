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

- **Phase 1: Prototyping & Local Dev** (`epic:phase-1`) - Monorepo skeleton, `docker-compose.dev.yml`, `LOCAL_DEVELOPMENT.md`, baseline CI, branch protection, local Creator review.
- **Phase 2: Infrastructure & Dependencies** (`epic:phase-2`) - `DEP_*.md` manifests, dependency control scripts, integration tests, ephemeral preview environments (`pr-X.preview.chrishop.com`), Creator preview review.
- **Phase 3: End-to-End Integration** (`epic:phase-3`) - Storefront + CMS integration, Redis stock lock engine, Stripe dynamic checkout, Discord alerts, Resend tracking email, full drop dry run with Chris.
- **Phase 4: DevOps & Failover Automation** (`epic:phase-4`) - Production CD pipeline, rolling deployment health check gate (`/api/health`), two-phase migrations, offsite backups (`backup.sh`), emergency rollback (`rollback.yml`), disaster recovery runbook.
- **Phase 5: Security Hardening** (`epic:phase-5`) - VPS host hardening (Ansible), Directus RBAC + TOTP 2FA, `age` secrets isolation, CI security audits.
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

Upon finishing implementation for any task or story (refer to [story-feedback-loop](file:///Users/jacobmiller22/projects/chrishop/skills/story-feedback-loop/SKILL.md) for full execution details):

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
