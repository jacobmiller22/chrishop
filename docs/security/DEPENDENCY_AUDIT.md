# ChrisShop Dependency Vulnerability Audit & Security Architecture Report

## 1. Executive Summary

This security audit and vulnerability assessment was conducted to establish continuous automated dependency scanning and vulnerability mitigation across the ChrisShop monorepo per `docs/HIGH_LEVEL_DESIGN.md` Section 7.

As of this audit, the ChrisShop monorepo has achieved **zero high-severity** and **zero critical-severity** vulnerabilities across all 7 workspace packages and their transitive dependencies.

### Summary Metrics

| Metric | Status / Value | Target SLA |
| :--- | :--- | :--- |
| **Critical Vulnerabilities** | **0** | 0 (Zero Tolerance) |
| **High Vulnerabilities** | **0** | 0 (Blocks CI/CD) |
| **Moderate Vulnerabilities** | **3** (Development-only isolated dependencies) | Review & patch |
| **Low Vulnerabilities** | **1** (Development-only isolated dependency) | Review & patch |
| **Automated CI Enforcement** | Active (`pnpm audit --audit-level=high`) | Mandatory Gate |
| **PR Dependency Review** | Active (`actions/dependency-review-action@v4`) | Mandatory Gate |
| **Dependabot Monorepo Coverage** | 100% (7 npm workspaces + GitHub Actions) | Weekly Automated |

---

## 2. Monorepo Package Inventory

The ChrisShop codebase operates as a pnpm workspace monorepo consisting of the following modules:

| Workspace Path | Package Identifier | Purpose | Runtime Target |
| :--- | :--- | :--- | :--- |
| `/` | `chrishop-monorepo` | Root orchestrator, build scripts, verification pipelines | Node.js 22+ / pnpm 9+ |
| `apps/web` | `@chrishop/web` | Next.js App Router Headless Storefront | Cloudflare Workers (Edge) |
| `apps/cms` | `@chrishop/cms` | Content Management System & Extension SDK | Cloudflare Workers / D1 |
| `packages/config` | `@chrishop/config` | Shared TypeScript, Tailwind, and ESLint configurations | Build-time |
| `packages/notifications` | `@chrishop/notifications` | Customer notification dispatch and templating | Cloudflare Workers (Edge) |
| `packages/types` | `@chrishop/types` | Centralized domain models and D1 SQLite schemas | Universal |
| `packages/ui` | `@chrishop/ui` | Reusable UI component library | Storefront / React 19 |

---

## 3. High & Critical Vulnerability Remediation Matrix

During initial baseline scanning, 9 high-severity vulnerabilities were detected across transitive dependencies. All 9 vulnerabilities were remediated using strict pnpm dependency overrides and package-level resolutions.

| Vulnerable Package | Initial Version | Severity | Advisory ID / CVE | Root Cause & Security Impact | Remediated Version / Override |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sharp` | `0.33.5` | **High** | GHSA-rgj7-g3m4-5g8c<br>CVE-2026-84383 | Memory corruption in bundled `libheif` and `libvips` processing untrusted image input | Override: `sharp >= 0.35.4` |
| `sharp` | `0.33.5` | **High** | GHSA-2jg2-4ch7-h545<br>CVE-2026-33327 | Out-of-bounds heap write vulnerability in libheif decoder | Override: `sharp >= 0.35.4` |
| `undici` | `5.29.0` | **High** | GHSA-g8m3-5g58-fq7m | Unbounded memory consumption in WebSocket permessage-deflate decompression | Override: `undici >= 6.28.0` |
| `undici` | `5.29.0` | **High** | GHSA-wqq4-5wpv-3x29 | Unhandled exception in WebSocket client due to invalid `server_max_window_bits` | Override: `undici >= 6.28.0` |
| `undici` | `5.29.0` | **High** | GHSA-m4v8-wqvr-p9f7 | WebSocket client denial of service via fragment count limit bypass | Override: `undici >= 6.28.0` |
| `ws` | `8.18.0` | **High** | GHSA-96hv-2xvq-fx4p | Memory exhaustion Denial of Service from tiny fragments and data chunks | DevDep & Override: `ws >= 8.21.3` |
| `postcss` | `8.4.31` | **High** | GHSA-6g55-p6wh-862q | Arbitrary file read and information disclosure via attacker-controlled `sourceMappingURL` | Override: `postcss >= 8.5.23` |
| `postcss` | `8.4.31` | **High** | GHSA-r28c-9q8g-f849 | Path traversal in previous source map auto-loading leading to `.map` file disclosure | Override: `postcss >= 8.5.23` |
| `js-yaml` | `4.3.1` | **High** | GHSA-2883-xcg3-v3hh<br>CVE-2026-84375 | `maxTotalMergeKeys` fails to limit CPU utilization for empty merge sources (CPU DoS) | Override: `js-yaml >= 4.3.2` |

---

## 4. Residual Low & Moderate Vulnerabilities & Risk Assessment

Residual findings are restricted to build-time / development-time utilities and have **zero runtime impact** on production edge workers or customer data:

| Module | Severity | Advisory Title | Context & Threat Modeling | Risk Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `esbuild@0.17.19` | Moderate | Dev server CORS bypass | Transitive dependency of `wrangler@3.100.0`. Only used during local development server binds; never bundled or exposed in edge production. | **Negligible Risk**. Controlled developer workstation environment. |
| `unhead@1.11.20` | Low / Moderate | `useHeadSafe` attribute and protocol sanitization bypass | Transitive dependency of `@directus/extensions-sdk`. Build-time metadata tooling; not utilized in edge workers or storefront SSR/RSC pipeline. | **Negligible Risk**. No user-generated head tags processed by build tooling. |

---

## 5. Continuous Automated Enforcement Architecture

To guarantee that new dependencies or version bumps never reintroduce high or critical vulnerabilities into the repository, four layers of automated protection are operational:

### 5.1 GitHub Actions CI/CD Pipeline Gates
- **Workflow**: `.github/workflows/deploy.yml`
  - Step: `Dependency Security Audit`
  - Command: `pnpm audit --audit-level=high`
  - Behavior: Fails the pipeline and terminates deployment execution if any high or critical vulnerability is detected.
- **Workflow**: `.github/workflows/ci.yml`
  - Step 1: `Dependency Security Audit` (`pnpm audit --audit-level=high`)
  - Step 2: `GitHub Dependency Review` (`actions/dependency-review-action@v4`)
  - Behavior: Evaluates dependency diffs on every Pull Request targeting `main` or `staging`, blocking PR merge on any introduced high-severity advisory.

### 5.2 Local Developer Pre-PR Verification
- **Command**: `pnpm run audit:security`
  - Standalone script executing `pnpm audit --audit-level=high`.
- **Pipeline**: `pnpm run verify:local`
  - The turnkey pre-PR verification script includes security audit enforcement before any code can be handed off for review or merged.

### 5.3 Dependabot Automated Monorepo Coverage
- **Configuration**: `.github/dependabot.yml`
  - Configured for weekly scanning (Monday 00:00 UTC) across all 7 workspace packages (`/`, `/apps/web`, `/apps/cms`, `/packages/config`, `/packages/notifications`, `/packages/types`, `/packages/ui`) and `.github/workflows` (`github-actions`).
  - Automated security advisories alert maintainers immediately upon CVE publication.

### 5.4 Automated Ephemeral Integration Testing
- **Test Suite**: `tests/integration/security-audit.test.ts`
  - Programmatically executes `pnpm audit --json` and asserts zero high or critical vulnerabilities.
  - Verifies Dependabot and GitHub Actions workflow configuration integrity on every CI run.

---

## 6. Vulnerability Triage & Incident Response Runbook

When Dependabot or CI alerts trigger for newly published CVEs:

1. **Investigate Advisory**:
   ```bash
   pnpm audit --json | jq '.advisories[] | select(.severity == "high" or .severity == "critical")'
   ```
2. **Determine Dependency Chain**:
   ```bash
   pnpm why -r <vulnerable-package>
   ```
3. **Apply Remediation**:
   - If direct dependency: Update `package.json` with patched version.
   - If transitive dependency: Add or update `pnpm.overrides` in root `package.json`:
     ```json
     "pnpm": {
       "overrides": {
         "<package>": ">=<patched-version>"
       }
     }
     ```
4. **Regenerate Lockfile & Verify**:
   ```bash
   pnpm install
   pnpm run audit:security
   pnpm run verify:local
   ```
5. **Open Security PR**: Commit updated lockfile with reference to the CVE advisory.
