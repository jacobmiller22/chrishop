# 🛑 DEPRECATED BRANCH — `main`

> [!CAUTION]
> **The `main` branch is deprecated, read-only, and locked.**
> 
> Pull requests targeting `main` are strictly prohibited and will be automatically retargeted to `staging` by `.github/workflows/pr-base-guard.yml` or blocked by CI.

---

## ChrisShop Branching & Promotion Architecture

ChrisShop operates on a two-stage **`staging` ➔ `production`** branch model:

```
        [Feature PRs / Agent Worktrees]
                      │
                      ▼ (PR targeting 'staging' with automated preview deploy & checks)
                 [staging] ──► Auto-deploy to Staging Edge (https://staging-chrishop.jacobmiller22.com)
                      │
                      ▼ (Release Promotion: ONLY 'staging' is permitted to target 'production')
                [production] ──► Auto-deploy to Production Edge (https://chrishop.jacobmiller22.com)
```

### Key Rules
1. **Default Branch**: The repository default branch on GitHub is **`staging`**.
2. **Feature Branching**: All new feature branches, bugfixes, and refactors **MUST** branch from fresh `origin/staging`:
   ```bash
   git fetch origin staging
   pnpm run branch <feature-name>
   # or via worktrunk:
   wt switch --create feature/<name> --base origin/staging
   ```
3. **Pull Requests**: All feature pull requests must target `staging` (`gh pr create --base staging`).
4. **Production Promotions**: Only `staging` can merge into `production` via formal release promotion PRs (`/devops deploy-production`).
5. **Branch `main`**: Retained strictly as an archived reference point. Direct commits, force-pushes, and pull requests to `main` are disabled and locked.
