#!/usr/bin/env tsx
/**
 * ChrisShop Turnkey Local Pre-PR Verification Pipeline
 *
 * This script runs comprehensive local quality, dependency, and integration checks
 * to ensure that code changes satisfy architectural and runtime requirements
 * BEFORE opening a Pull Request.
 *
 * Architecture: Cloudflare-Native (Payload CMS v3 + D1 + Workers + Shopify Headless)
 *
 * Usage:
 *   pnpm run verify:local
 *   pnpm run verify:local --skip-build
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface StepResult {
  name: string;
  durationMs: number;
  passed: boolean;
  error?: string;
  skipped?: boolean;
}

const results: StepResult[] = [];
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');

function printBanner() {
  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}   🚀 ChrisShop Cloudflare-Native Pre-PR Verification Pipeline  ${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}================================================================${colors.reset}\n`
  );
}

async function runStep(
  name: string,
  fn: () => Promise<void> | void,
  options: { skip?: boolean; skipReason?: string } = {}
): Promise<boolean> {
  if (options.skip) {
    console.log(
      `${colors.yellow}⊘ [SKIP]${colors.reset} ${name} ${colors.dim}(${options.skipReason || 'flag passed'})${colors.reset}`
    );
    results.push({ name, durationMs: 0, passed: true, skipped: true });
    return true;
  }

  process.stdout.write(`${colors.blue}▶ [RUN]${colors.reset} ${name}... `);
  const start = Date.now();

  try {
    await fn();
    const durationMs = Date.now() - start;
    console.log(
      `${colors.green}✔ PASS${colors.reset} ${colors.dim}(${(durationMs / 1000).toFixed(2)}s)${colors.reset}`
    );
    results.push({ name, durationMs, passed: true });
    return true;
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(
      `${colors.red}✖ FAIL${colors.reset} ${colors.dim}(${(durationMs / 1000).toFixed(2)}s)${colors.reset}`
    );
    const errorMessage = err?.message || String(err);
    results.push({ name, durationMs, passed: false, error: errorMessage });
    return false;
  }
}

// Stage 1: Cloudflare & Architecture Integrity Gate
function verifyArchitectureIntegrity() {
  // 1. wrangler.toml existence and bindings
  if (!fs.existsSync('wrangler.toml')) {
    throw new Error('wrangler.toml missing at root');
  }
  const wranglerContent = fs.readFileSync('wrangler.toml', 'utf-8');
  if (
    !wranglerContent.includes('[[d1_databases]]') ||
    !wranglerContent.includes('binding = "DB"')
  ) {
    throw new Error('wrangler.toml must configure D1 database binding DB');
  }
  if (
    !wranglerContent.includes('[[kv_namespaces]]') ||
    !wranglerContent.includes('NEXT_CACHE_WORKERS_KV')
  ) {
    throw new Error(
      'wrangler.toml must configure KV cache namespace binding NEXT_CACHE_WORKERS_KV'
    );
  }
  if (
    !wranglerContent.includes('[[r2_buckets]]') ||
    !wranglerContent.includes('binding = "BUCKET"')
  ) {
    throw new Error('wrangler.toml must configure R2 bucket binding BUCKET');
  }

  // Assets binding check
  if (
    !wranglerContent.includes('binding = "ASSETS"') ||
    !wranglerContent.includes('.open-next/assets')
  ) {
    throw new Error('wrangler.toml must configure Static Assets binding ASSETS with directory .open-next/assets');
  }

  // Site and CMS bindings check
  if (!wranglerContent.includes('SITE_URL') || !wranglerContent.includes('CMS_URL')) {
    throw new Error('wrangler.toml must configure SITE_URL and CMS_URL vars');
  }

  // Verify Production and Staging Custom Domain Routes
  if (
    !wranglerContent.includes('pattern = "chrishop.jacobmiller22.com/*"') ||
    !wranglerContent.includes('zone_name = "jacobmiller22.com"')
  ) {
    throw new Error(
      'wrangler.toml must configure production route for chrishop.jacobmiller22.com/* with zone jacobmiller22.com'
    );
  }
  if (!wranglerContent.includes('pattern = "staging-chrishop.jacobmiller22.com/*"')) {
    throw new Error(
      'wrangler.toml must configure staging route for staging-chrishop.jacobmiller22.com/*'
    );
  }

  // 2. HLD zero-legacy references check
  const hld = fs.readFileSync('docs/HIGH_LEVEL_DESIGN.md', 'utf-8');
  const legacyRegex = /\b(hetzner|vps|docker|caddy|directus|redis|postgres|stripe)\b/i;
  const legacyMatch = hld.match(legacyRegex);
  if (legacyMatch) {
    throw new Error(
      `docs/HIGH_LEVEL_DESIGN.md contains prohibited legacy reference: "${legacyMatch[0]}"`
    );
  }

  // 3. Verbatim rationale check
  const depCf = fs.readFileSync('docs/deps/DEP_CLOUDFLARE.md', 'utf-8');
  if (!depCf.includes('The Problem with the VPS Approach')) {
    throw new Error('docs/deps/DEP_CLOUDFLARE.md missing Decision 1 verbatim rationale');
  }

  const depShopify = fs.readFileSync('docs/deps/DEP_SHOPIFY.md', 'utf-8');
  if (!depShopify.includes('The Problem with the Custom Stripe Implementation')) {
    throw new Error('docs/deps/DEP_SHOPIFY.md missing Decision 2 verbatim rationale');
  }

  // 4. Verify deploy workflow uses wrangler
  if (!fs.existsSync('.github/workflows/deploy.yml')) {
    throw new Error('.github/workflows/deploy.yml missing');
  }
}

// Stage 2: Monorepo Typecheck & Lint
function verifyCheck() {
  execSync('pnpm run check', { stdio: 'pipe' });
}

// Stage 3: Monorepo Unit Test Suite
function verifyUnitTests() {
  execSync('pnpm run test:unit', { stdio: 'pipe' });
}

// Stage 4: Ephemeral Miniflare & Integration Probes (D1, KV, Shopify Client)
function verifyIntegrationTests() {
  execSync('pnpm run test:integration', { stdio: 'pipe' });
}

// Stage 5: Dependency Security Audit Gate
function verifySecurityAudit() {
  execSync('pnpm audit --audit-level=high', { stdio: 'pipe' });
}

// Stage 6: Production Build Validation
function verifyBuild() {
  execSync('pnpm run build', { stdio: 'pipe' });
}

// Stage 6: Git Hygiene & Worktree Cleanliness
function verifyGitHygiene() {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  const leakedArtifacts = status
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('.log') || l.includes('.DS_Store') || l.includes('.tmp'));

  if (leakedArtifacts.length > 0) {
    throw new Error(`Untracked temporary or log files detected:\n${leakedArtifacts.join('\n')}`);
  }
}

function printSummary() {
  console.log(
    `\n${colors.bold}----------------------------------------------------------------${colors.reset}`
  );
  console.log(
    `${colors.bold}                  Verification Results Summary                  ${colors.reset}`
  );
  console.log(
    `${colors.bold}----------------------------------------------------------------${colors.reset}`
  );

  for (const res of results) {
    const statusIcon = res.skipped
      ? `${colors.yellow}SKIPPED${colors.reset}`
      : res.passed
        ? `${colors.green}PASSED ${colors.reset}`
        : `${colors.red}FAILED ${colors.reset}`;

    const duration = res.skipped ? '-' : `${(res.durationMs / 1000).toFixed(2)}s`;
    console.log(`  ${statusIcon} | ${res.name.padEnd(42)} | ${duration.padStart(8)}`);
    if (res.error) {
      console.log(`\n${colors.red}${colors.bold}  Error Details:${colors.reset}\n${res.error}\n`);
    }
  }

  const allPassed = results.every((r) => r.passed);
  console.log(
    `${colors.bold}----------------------------------------------------------------${colors.reset}`
  );

  if (allPassed) {
    console.log(
      `\n${colors.bold}${colors.green}✔ ALL VERIFICATION CHECKS PASSED! Ready for PR submission.${colors.reset}\n`
    );
    process.exit(0);
  } else {
    console.log(
      `\n${colors.bold}${colors.red}✖ VERIFICATION FAILED. Please resolve errors before creating a PR.${colors.reset}\n`
    );
    process.exit(1);
  }
}

async function main() {
  printBanner();

  await runStep('1. Cloudflare & Architecture Integrity', verifyArchitectureIntegrity);

  await runStep('2. Monorepo Typecheck & Lint (check)', verifyCheck);

  await runStep('3. Monorepo Unit Test Suites (test:unit)', verifyUnitTests);

  await runStep(
    '4. Local In-Memory Miniflare Integration (test:integration)',
    verifyIntegrationTests
  );

  await runStep('5. Dependency Security Audit Gate (audit:security)', verifySecurityAudit);

  await runStep('6. Production Build Validation (build)', verifyBuild, {
    skip: skipBuild,
    skipReason: '--skip-build flag provided',
  });

  await runStep('7. Git Worktree & Artifact Hygiene', verifyGitHygiene);

  printSummary();
}

main().catch((err) => {
  console.error('Fatal error in verification script:', err);
  process.exit(1);
});
