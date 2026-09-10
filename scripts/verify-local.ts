#!/usr/bin/env tsx
/**
 * ChrisShop Turnkey Local Pre-PR Verification Pipeline
 *
 * This script runs comprehensive local quality, dependency, and integration checks
 * to ensure that code changes satisfy architectural and runtime requirements
 * BEFORE opening a Pull Request.
 *
 * Usage:
 *   pnpm run verify:local
 *   pnpm run verify:local --skip-build
 *   pnpm run verify:local --skip-containers
 */

import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';

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
const skipContainers = args.includes('--skip-containers');

function printBanner() {
  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}      🚀 ChrisShop Turnkey Local Pre-PR Verification Pipeline     ${colors.reset}`
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

// Stage 1: Docker Container Pre-Flight
async function verifyContainers() {
  // Check if Docker daemon is running
  const dockerCheck = spawnSync('docker', ['info'], { stdio: 'pipe' });
  if (dockerCheck.status !== 0) {
    throw new Error(
      'Docker daemon is not running. Please start Docker Desktop, OrbStack, or Colima.\n' +
        'To bypass container checks, pass --skip-containers'
    );
  }

  // Check docker compose status
  const composePath = 'infra/docker/docker-compose.dev.yml';
  const psOutput = execSync(`docker compose -f ${composePath} ps`, { encoding: 'utf-8' });

  const requiredContainers = ['postgres', 'redis', 'minio', 'cms'];
  const missingContainers: string[] = [];

  for (const container of requiredContainers) {
    if (
      !psOutput.toLowerCase().includes(container) ||
      (!psOutput.includes('healthy') && !psOutput.includes('Up'))
    ) {
      missingContainers.push(container);
    }
  }

  if (missingContainers.length > 0) {
    throw new Error(
      `Required local container service(s) missing or unhealthy: [${missingContainers.join(', ')}].\n` +
        `Remediation:\n` +
        `  1. Run: docker compose -f ${composePath} up -d\n` +
        `  2. Apply schema: pnpm --filter cms schema:apply\n` +
        `  3. Seed catalog: pnpm seed`
    );
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

// Stage 4: Live Dependency & Route Health Probes
async function verifyLiveProbes() {
  const probes: { name: string; url: string; expectedStatus?: number }[] = [
    {
      name: 'Directus CMS Health',
      url: 'http://localhost:8055/server/health',
      expectedStatus: 200,
    },
    {
      name: 'Directus Products API',
      url: 'http://localhost:8055/items/products?limit=1',
      expectedStatus: 200,
    },
    {
      name: 'MinIO S3 Health',
      url: 'http://localhost:9000/minio/health/live',
      expectedStatus: 200,
    },
  ];

  for (const probe of probes) {
    try {
      const res = await fetch(probe.url);
      if (probe.expectedStatus && res.status !== probe.expectedStatus) {
        throw new Error(
          `${probe.name} returned status ${res.status}, expected ${probe.expectedStatus}`
        );
      }
    } catch (err: any) {
      throw new Error(`Probe failed for ${probe.name} (${probe.url}): ${err.message}`);
    }
  }

  // Probe Redis via Docker Compose
  try {
    const redisPing = execSync(
      'docker compose -f infra/docker/docker-compose.dev.yml exec -T redis redis-cli ping',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    if (!redisPing.includes('PONG')) {
      throw new Error(`Redis ping returned unexpected response: ${redisPing.trim()}`);
    }
  } catch (err: any) {
    throw new Error(`Redis health check failed: ${err.message}`);
  }
}

// Stage 5: Production Build Validation
function verifyBuild() {
  execSync('pnpm run build', { stdio: 'pipe' });
}

// Stage 6: Git Hygiene & Worktree Cleanliness
function verifyGitHygiene() {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  // We allow modified files if the developer/agent is currently working on them,
  // but warn if untracked temporary files or build artifacts are leaked
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
    console.log(`  ${statusIcon} | ${res.name.padEnd(38)} | ${duration.padStart(8)}`);
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

  await runStep('1. Docker Container Stack Health', verifyContainers, {
    skip: skipContainers,
    skipReason: '--skip-containers flag provided',
  });

  await runStep('2. Monorepo Typecheck & Lint (check)', verifyCheck);

  await runStep('3. Monorepo Unit Test Suites (test:unit)', verifyUnitTests);

  await runStep('4. Live Dependency & Service Probes', verifyLiveProbes, {
    skip: skipContainers,
    skipReason: 'Containers skipped',
  });

  await runStep('5. Production Build Validation (build)', verifyBuild, {
    skip: skipBuild,
    skipReason: '--skip-build flag provided',
  });

  await runStep('6. Git Worktree & Artifact Hygiene', verifyGitHygiene);

  printSummary();
}

main().catch((err) => {
  console.error(`Fatal error in verification script:`, err);
  process.exit(1);
});
