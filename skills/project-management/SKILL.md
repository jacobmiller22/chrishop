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

### 2.1 Issue Creation & Formatting
Every issue must specify:
- Clear title matching `Story X.Y: <Capability Name>`.
- Body detailing task acceptance criteria, dependencies (`Dependencies: Story A.B`), and technical components involved.
- Relevant labels (`epic:phase-X`, `type:feature` / `type:infra` / `type:security` / `type:docs`, and `creator-review` if applicable).
- Milestone assignment.

```bash
gh issue create --title "Story X.Y: <Title>" --body "<Description>" --label "epic:phase-X,type:feature" --milestone "Phase X: <Name>"
```

### 2.2 Updating Issue Status
When beginning work on an issue:
1. Create a feature branch named `feature/story-X-Y-<short-name>`.
2. Link the PR to the issue by including `Fixes #<IssueNumber>` in the PR description.
3. The `.github/workflows/board-sync.yml` automation will automatically move the card to `In Progress`.
4. Upon PR creation, status moves to `In Review`.
5. Upon PR merge to `main`, status moves to `Done`.

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
