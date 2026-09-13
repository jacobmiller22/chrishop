# Development Guide (`DEVELOPMENT.md`)

Welcome to the **ChrisShop** monorepo development guide. This document provides developers and automated agents with instructions for setting up, developing, testing, and building the Cloudflare-native Next.js and Shopify Headless e-commerce platform.

---

## 1. Getting Started

Follow these quick steps to get a fully working local development environment up and running in under two minutes.

### 1.1 Prerequisites
Ensure your local workstation has the following tools installed:
- **Node.js**: `v20.x` or higher (Active LTS `v22.x` recommended)
- **pnpm**: `v9.x` or higher (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Cloudflare Wrangler**: Installed locally in devDependencies (`pnpm exec wrangler`)

### 1.2 Quickstart Setup
```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Initialize environment variables
cp .env.example .env
cp .env.example apps/web/.dev.vars

# 3. Launch the unified development stack
pnpm dev
```

### 1.3 What `pnpm dev` Runs
The unified `pnpm dev` command is an orchestrator that concurrently starts everything required for local development:
1. **Pre-flight**:
   - Generates Cloudflare Worker binding types (`worker-configuration.d.ts`) via `wrangler types`.
   - Prepares local Cloudflare D1 storage directories (`.wrangler/state/v3/d1`).
   - Ensures the edge worker entrypoint (`.open-next/worker.js`) is initialized.
2. **Next.js App Server**:
   - Spawns `@chrishop/web` Next.js 15 App Router and embedded Payload CMS v3 on **`http://localhost:3000`**.
   - Admin CMS UI is accessible at **`http://localhost:3000/admin`**.
3. **Cloudflare Wrangler & Miniflare Edge Worker**:
   - Spawns `wrangler dev` simulating Cloudflare Workers and bindings (D1 SQLite, Workers KV, R2) on **`http://localhost:8787`**.
4. **Process Management**:
   - Captures `SIGINT` (Ctrl+C) and `SIGTERM` to cleanly terminate both process trees without leaving orphaned background `workerd` isolates.

---

## 2. Monorepo Script Taxonomy

The root `package.json` provides an organized suite of scripts for development, building, testing, and database management:

### 2.1 Development Scripts
| Command | Action | Description |
| :--- | :--- | :--- |
| `pnpm dev` | `tsx scripts/dev.ts` | **Unified Dev Stack**: Launches Next.js (:3000) + Wrangler Miniflare (:8787) + binding types |
| `pnpm run dev:web` | `turbo run dev` | Runs **only** the Next.js storefront & Payload CMS dev server |
| `pnpm run dev:wrangler` | `wrangler dev --port 8787` | Runs **only** the Cloudflare Wrangler edge worker emulator |
| `pnpm run dev:types` | `wrangler types` | Generates/refreshes TypeScript types for Cloudflare bindings |
| `pnpm run dev:db` | `tsx scripts/seed-db.ts` | Seeds the local SQLite/D1 database with catalog fixtures |
| `pnpm run branch <name>` | `bash scripts/create-branch.sh` | **Branch Helper**: Fetches `origin/staging` and provisions an isolated worktree from `staging` |

### 2.2 Production Build Scripts
| Command | Action | Description |
| :--- | :--- | :--- |
| `pnpm run build` | `turbo run build && tsx scripts/build-worker.ts` | **Turnkey Production Build**: Builds all workspaces + Cloudflare Worker bundle |
| `pnpm run build:apps` | `turbo run build` | Builds only the application and package workspaces via Turborepo |
| `pnpm run build:worker` | `tsx scripts/build-worker.ts` | Compiles the Cloudflare Worker bundle into `.open-next/worker.js` |
| `pnpm run build:prod` | `turbo run build && tsx scripts/build-worker.ts` | Explicit alias for complete production build of all apps and worker bundles |

### 2.3 Quality, Testing & CI Scripts
| Command | Action | Description |
| :--- | :--- | :--- |
| `pnpm run check` | `turbo run check` | Monorepo typecheck across all workspaces |
| `pnpm run lint` | `turbo run check` | Monorepo ESLint & TypeScript linter |
| `pnpm test` | `turbo run test` | Runs unit tests across all package workspaces |
| `pnpm run test:unit` | `turbo run test && tsx --test tests/integration/dependency-control.test.ts` | Package unit tests + dependency control gate |
| `pnpm run test:integration` | `tsx --test tests/integration/**/*.test.ts tests/spike/**/*.test.ts` | Ephemeral D1 SQLite, Shopify client, and integration tests |
| `pnpm run test:spike` | `tsx --test tests/spike/**/*.test.ts` | Edge runtime and database latency spike tests |
| `pnpm run test:all` | `pnpm run test:unit && pnpm run test:integration` | Complete unit and integration test suite |
| `pnpm run verify:local` | `tsx scripts/verify-local.ts` | Turnkey 7-stage pre-PR verification pipeline |
| `pnpm run audit:security` | `pnpm audit --audit-level=high` | Checks all dependencies against known CVEs |
| `pnpm run format` | `prettier --write .` | Formats all files with Prettier |
| `pnpm run format:check` | `prettier --check .` | Checks formatting without modifying files |

### 2.4 Database & Cloudflare Utilities
| Command | Action | Description |
| :--- | :--- | :--- |
| `pnpm run db:seed` | `tsx scripts/seed-db.ts` | Seeds catalog items, categories, and variations into D1 SQLite |
| `pnpm run db:migrate:local` | `wrangler d1 migrations apply chrishop-prod-db --local` | Applies migrations locally via Miniflare |
| `pnpm run cf:types` | `wrangler types` | Generates `worker-configuration.d.ts` from `wrangler.toml` |

---

## 3. Local Runtime Architecture & Cloudflare Bindings

ChrisShop is designed to run locally with **zero external background daemons or Docker containers**:
- **Storefront & Admin CMS (`http://localhost:3000`)**: Next.js 15 App Router hosting both the public e-commerce store and Payload CMS v3 under `/admin`.
- **Cloudflare Edge Worker (`http://localhost:8787`)**: Local Miniflare instance emulating Cloudflare edge environment.
- **Local D1 Database**: Backed by a local SQLite file stored under `.wrangler/state/v3/d1/local.sqlite` (or ephemeral `:memory:` during automated tests).
- **Local KV Store**: Backed by local filesystem storage under `.wrangler/state/v3/kv`.

---

## 3.1 Git Workflow & Staging-First Branching Protocol

ChrisShop follows a strict staged promotion pipeline: `feature/*` ➔ `staging` ➔ `production`.

- **`staging`**: Active integration target where all feature branches merge. All new branches **MUST** branch from fresh `origin/staging`.
- **`production`**: Protected live release edge. Direct PRs to `production` are strictly blocked; code promotes from `staging` via release PRs.
- **`main`**: Legacy branch. Direct PRs to `main` are strictly blocked by CI (`enforce-promotion-rules`).

### Branching Commands
```bash
# Recommended turnkey command
pnpm run branch feature/story-<X>-<Y>-<shortname>

# Or manually with worktrunk:
git fetch origin staging && wt switch --create feature/story-<X>-<Y>-<shortname> --base origin/staging
```

### Pull Request & Teardown Protocol
- Always target `staging`: `gh pr create --base staging ...`
- Worktree teardown: switch back to `staging`: `wt switch staging && wt remove --reap feature/...`

---

## 4. Pre-PR Quality Verification

Before opening any pull request, run the local verification pipeline:

```bash
pnpm run verify:local
```

This pipeline automatically validates:
1. **Architecture Integrity Gate**: `wrangler.toml` routes, bindings, and dependency rules.
2. **Monorepo Typecheck & Lint**: TypeScript compilation across all apps and packages.
3. **Unit Test Suites**: Domain models, notification providers, and dependency control.
4. **Ephemeral Miniflare Integration Tests**: D1 database schemas, foreign keys, and Shopify mock clients.
5. **Dependency Security Audit**: Zero high-severity vulnerabilities.
6. **Production Build Validation**: Compiles Next.js storefront and Cloudflare Worker bundle.
7. **Git Worktree Cleanliness**: Ensures no untracked `.tmp`, `.log`, or leaked secrets exist.

---

## 5. Related Documentation
- [LOCAL_DEVELOPMENT.md](file:///Users/jacobmiller22/projects/chrishop/LOCAL_DEVELOPMENT.md): Detailed local service topology and debugging workflows.
- [docs/CLOUDFLARE_SETUP.md](file:///Users/jacobmiller22/projects/chrishop/docs/CLOUDFLARE_SETUP.md): Cloudflare operational runbook for staging, production, and preview deployments.
- [docs/HIGH_LEVEL_DESIGN.md](file:///Users/jacobmiller22/projects/chrishop/docs/HIGH_LEVEL_DESIGN.md): System architecture and component boundaries.
