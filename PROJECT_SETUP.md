# Project Setup & Git Workflow Guide (`PROJECT_SETUP.md`)

Welcome to **ChrisShop**. This guide covers project initialization, dependency installation, and our mandatory staging-first branching workflow.

---

## 1. Quick Start

### 1.1 Prerequisites
- **Node.js**: `v20.x` or higher (Active LTS `v22.x` recommended)
- **pnpm**: `v9.x` or higher
- **Cloudflare Wrangler CLI**: `pnpm exec wrangler --version`
- **Worktrunk (`wt`)**: `brew install worktrunk`

### 1.2 Setup Repository
```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment templates
cp .env.example .env
cp .env.example apps/web/.dev.vars

# 3. Configure git remote HEAD to track staging
git remote set-head origin -a
```

---

## 2. Staging-First Branching Protocol

ChrisShop enforces a strict two-stage git promotion pipeline: `feature/*` ➔ `staging` ➔ `production`.

### ⚠️ Why Branch from `staging` (Not `production` or `main`)?
- `production` represents the stable live release edge, updated only during formal release promotions.
- When branches are cut from `production` (or legacy `main`), they lack all recent features, bug fixes, schema changes, and D1 migrations actively being merged into `staging`.
- When developers attempt to merge back into `staging`, they face severe drift, merge conflicts, and constant rebasing.

### 🌿 Protocol Rules

1. **Branch Creation**: Always cut from fresh `origin/staging`:
   ```bash
   # Using the turnkey helper
   pnpm run branch feature/story-<X>-<Y>-<shortname>

   # Or using worktrunk directly
   git fetch origin staging && wt switch --create feature/story-<X>-<Y>-<shortname> --base origin/staging

   # Or using vanilla git
   git fetch origin staging && git checkout -b feature/story-<X>-<Y>-<shortname> origin/staging
   ```

2. **Pull Request Target**: All feature PRs **MUST** target `staging`:
   ```bash
   gh pr create --base staging --title "feat(<scope>): Story <X>.<Y> <Title>" --body "Fixes #<Issue>"
   ```

3. **CI Promotion Gates**:
   - Direct PRs targeting `production` from any branch other than `staging` are blocked.
   - PRs targeting legacy `main` are strictly blocked.

4. **Worktree Teardown**:
   - Always return to `staging` before tearing down worktrees:
   ```bash
   wt switch staging
   wt remove --reap feature/story-<X>-<Y>-<shortname>
   git worktree prune
   ```

---

## 3. Related Documentation
- [LOCAL_DEVELOPMENT.md](file:///Users/jacobmiller22/projects/chrishop/LOCAL_DEVELOPMENT.md): Detailed local runtime and debugging.
- [DEVELOPMENT.md](file:///Users/jacobmiller22/projects/chrishop/DEVELOPMENT.md): Monorepo scripts, testing, and production build guides.
- [docs/runbooks/PRODUCTION_PROMOTION.md](file:///Users/jacobmiller22/projects/chrishop/docs/runbooks/PRODUCTION_PROMOTION.md): Promotion runbook from staging to production.
