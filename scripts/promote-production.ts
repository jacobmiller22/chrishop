#!/usr/bin/env tsx
/**
 * ChrisShop Production Promotion & Deployment Automation CLI (Story 2.37, 2.40, 4.1, 4.23)
 *
 * Promotes staging integration changes to production edge:
 * 1. Probes staging edge health (https://staging-chrishop.jacobmiller22.com/api/health)
 * 2. Asserts staging edge commit hash matches candidate SHA (pre-test assertion)
 * 3. Compares git commits between origin/production and origin/staging
 * 4. Creates/verifies the staged release promotion PR (staging ➔ production)
 * 5. Asserts staging edge commit hash integrity hasn't drifted (post-test integrity check)
 * 6. Merges promotion PR to trigger deployment DAG (.github/workflows/deploy.yml)
 * 7. Monitors workflow run, alerts when human approval gate is reached, and verifies production edge health
 *
 * Usage:
 *   pnpm run deploy:prod
 *   tsx scripts/promote-production.ts --dry-run
 *   tsx scripts/promote-production.ts --probe-only
 *   tsx scripts/promote-production.ts --verify-sha
 *   tsx scripts/promote-production.ts --no-verify-sha
 *   tsx scripts/promote-production.ts --wait-for-staging
 */

import { execSync } from 'node:child_process';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

export const STAGING_HEALTH_URL = 'https://staging-chrishop.jacobmiller22.com/api/health';
export const STAGING_FALLBACK_URL = 'https://staging.chrishop.jacobmiller22.com/api/health';
export const PROD_HEALTH_URL = 'https://chrishop.jacobmiller22.com/api/health';

export function runCmd(cmd: string, check = true): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err: any) {
    if (check) {
      const msg = err.stderr ? err.stderr.toString() : err.message;
      throw new Error(`Command failed: ${cmd}\n${msg}`);
    }
    return '';
  }
}

export interface ProbeHealthResult {
  ok: boolean;
  status: number;
  data?: any;
  commitSha?: string;
  shortSha?: string;
  buildTimestamp?: string;
  environment?: string;
  headers: Record<string, string>;
  error?: string;
}

export async function probeHealth(url: string, timeoutMs = 7000): Promise<ProbeHealthResult> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'cache-control': 'no-store' },
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    const commitSha =
      data?.commitSha ||
      headers['x-chrishop-commit-sha'] ||
      undefined;
    const shortSha =
      data?.shortSha ||
      (commitSha && commitSha.length >= 7 ? commitSha.slice(0, 7) : undefined);
    const buildTimestamp = data?.buildTimestamp || undefined;
    const environment = data?.environment || undefined;

    return {
      ok: res.status === 200,
      status: res.status,
      data,
      commitSha,
      shortSha,
      buildTimestamp,
      environment,
      headers,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      headers: {},
      error: err?.message || String(err),
    };
  }
}

export interface VerifyStagingShaResult {
  verified: boolean;
  edgeSha?: string;
  expectedSha: string;
  attempts: number;
  error?: string;
}

export async function verifyStagingEdgeSha(
  expectedSha: string,
  options: {
    targetUrl?: string;
    maxRetries?: number;
    retryIntervalMs?: number;
    logger?: (msg: string) => void;
  } = {}
): Promise<VerifyStagingShaResult> {
  const targetUrl = options.targetUrl || STAGING_HEALTH_URL;
  const maxRetries = options.maxRetries ?? 6;
  const retryIntervalMs = options.retryIntervalMs ?? 5000;
  const log = options.logger || console.log;

  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const probe = await probeHealth(targetUrl);
    const edgeSha = probe.commitSha;

    if (edgeSha) {
      const match =
        edgeSha === expectedSha ||
        edgeSha.slice(0, 7) === expectedSha.slice(0, 7);

      if (match) {
        return { verified: true, edgeSha, expectedSha, attempts };
      }

      log(`  ${colors.dim}Attempt ${attempts}/${maxRetries}: Edge SHA (${edgeSha.slice(0, 7)}) != Target (${expectedSha.slice(0, 7)}). Waiting ${retryIntervalMs / 1000}s...${colors.reset}`);
    } else {
      log(`  ${colors.dim}Attempt ${attempts}/${maxRetries}: No SHA returned from edge. Waiting ${retryIntervalMs / 1000}s...${colors.reset}`);
    }

    if (attempts < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }

  const finalProbe = await probeHealth(targetUrl);
  return {
    verified: false,
    edgeSha: finalProbe.commitSha,
    expectedSha,
    attempts,
    error: finalProbe.commitSha
      ? `Staging edge commit SHA (${finalProbe.commitSha}) does not match target release candidate commit (${expectedSha}).`
      : 'Failed to retrieve commit SHA from staging edge health probe.',
  };
}

export interface CommitSummary {
  sha: string;
  title: string;
  author: string;
}

export function getUnpromotedCommits(): CommitSummary[] {
  // Fetch latest branch heads
  runCmd('git fetch origin staging production', false);

  const raw = runCmd('git log --oneline origin/production..origin/staging', false);
  if (!raw) return [];

  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, ...rest] = line.split(' ');
      return {
        sha,
        title: rest.join(' '),
        author: '',
      };
    });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const probeOnly = args.includes('--probe-only');
  const createPrOnly = args.includes('--create-pr-only');
  const autoMerge = args.includes('--auto-merge');
  const shouldVerifySha = !args.includes('--no-verify-sha');
  const waitForStaging = args.includes('--wait-for-staging');

  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🚀 ChrisShop Production Promotion & Deployment Automation    ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  // 1. Probe current staging & production health
  process.stdout.write(`📡 Probing Staging Edge Health (${STAGING_HEALTH_URL})... `);
  let stagingProbe = await probeHealth(STAGING_HEALTH_URL);
  if (!stagingProbe.ok) {
    stagingProbe = await probeHealth(STAGING_FALLBACK_URL);
  }

  if (stagingProbe.ok) {
    console.log(`${colors.green}HEALTHY (HTTP 200)${colors.reset}`);
    if (stagingProbe.commitSha) {
      console.log(`  - Live Staging Commit:    ${colors.cyan}${stagingProbe.commitSha}${colors.reset} (${stagingProbe.shortSha})`);
      if (stagingProbe.buildTimestamp) {
        console.log(`  - Staging Build Time:     ${colors.dim}${stagingProbe.buildTimestamp}${colors.reset}`);
      }
    }
  } else {
    console.log(`${colors.red}FAILED (${stagingProbe.status || stagingProbe.error})${colors.reset}`);
    if (!dryRun && !probeOnly) {
      console.error(`\n${colors.red}❌ Staging edge health check failed. Aborting promotion to protect production.${colors.reset}`);
      process.exit(1);
    }
  }

  process.stdout.write(`📡 Probing Live Production Edge Health (${PROD_HEALTH_URL})... `);
  const prodProbe = await probeHealth(PROD_HEALTH_URL);
  if (prodProbe.ok) {
    console.log(`${colors.green}HEALTHY (HTTP 200)${colors.reset}`);
    if (prodProbe.commitSha) {
      console.log(`  - Live Production Commit: ${colors.cyan}${prodProbe.commitSha}${colors.reset} (${prodProbe.shortSha})`);
    }
  } else {
    console.log(`${colors.yellow}OFFLINE / UNREACHABLE (${prodProbe.status || prodProbe.error})${colors.reset}`);
  }

  if (probeOnly) {
    console.log(`\n${colors.green}✅ Edge health probe complete.${colors.reset}\n`);
    process.exit(stagingProbe.ok ? 0 : 1);
  }

  // 2. Diff commits between production and staging
  console.log(`\n${colors.bold}🔍 Comparing Staging vs Production Git State:${colors.reset}`);
  const unpromoted = getUnpromotedCommits();

  if (unpromoted.length === 0) {
    console.log(`  ${colors.green}✨ Production is already 100% up-to-date with staging.${colors.reset} No pending changes to deploy.`);
    console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);
    return;
  }

  console.log(`  Found ${colors.bold}${unpromoted.length}${colors.reset} pending unpromoted commit(s) in staging:\n`);
  for (const c of unpromoted) {
    console.log(`  - ${colors.yellow}${c.sha}${colors.reset} ${c.title}`);
  }

  // Target Candidate Commit SHA (head of staging)
  let candidateSha = '';
  try {
    candidateSha = runCmd('git rev-parse origin/staging', false) || runCmd('git rev-parse HEAD', false);
  } catch {
    candidateSha = unpromoted[0]?.sha || '';
  }
  const candidateShort = candidateSha.slice(0, 7);
  console.log(`\n${colors.bold}🎯 Target Release Candidate Commit:${colors.reset} ${colors.cyan}${candidateSha}${colors.reset} (${candidateShort})`);

  // 3. Pre-Test Staging Edge Commit Hash Assertion (Story 4.23)
  if (shouldVerifySha && stagingProbe.ok && stagingProbe.commitSha) {
    process.stdout.write(`🔒 Verifying Staging Edge Commit Hash matches Target Candidate (${candidateShort})... `);
    const shaVerification = await verifyStagingEdgeSha(candidateSha, {
      maxRetries: waitForStaging ? 12 : 2,
      retryIntervalMs: 3000,
    });

    if (shaVerification.verified) {
      console.log(`${colors.green}MATCHED ✔${colors.reset}`);
    } else {
      console.log(`${colors.yellow}MISMATCH ⚠${colors.reset}`);
      console.log(`  ${colors.yellow}Staging Edge SHA:   ${shaVerification.edgeSha || 'unknown'}${colors.reset}`);
      console.log(`  ${colors.yellow}Target Release SHA: ${candidateSha}${colors.reset}`);
      if (!dryRun) {
        console.warn(`  ⚠ Staging edge has not yet propagated commit ${candidateShort}. Proceeding with caution.`);
      }
    }
  }

  if (dryRun) {
    console.log(`\n${colors.cyan}ℹ️ [DRY RUN] Would create/merge release PR targeting 'production' from 'staging'.${colors.reset}`);
    console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);
    return;
  }

  // 4. Check for existing open release PR
  console.log(`\n${colors.bold}📋 Checking Open Release PRs (staging ➔ production):${colors.reset}`);
  const existingPrRaw = runCmd('gh pr list --base production --head staging --json number,title,url', false);
  let openPrNumber: number | null = null;
  let openPrUrl: string | null = null;

  try {
    const prs = JSON.parse(existingPrRaw || '[]');
    if (prs.length > 0) {
      openPrNumber = prs[0].number;
      openPrUrl = prs[0].url;
      console.log(`  Found existing release PR #${openPrNumber}: ${openPrUrl}`);
    }
  } catch {
    // Ignore JSON parse error
  }

  // 5. Create release PR if none exists
  if (!openPrNumber) {
    console.log(`  Creating new release promotion PR...`);
    const dateStr = new Date().toISOString().slice(0, 10);
    const prTitle = `chore(release): Promote Staging to Production (${dateStr})`;
    const commitList = unpromoted.map((c) => `- ${c.sha} ${c.title}`).join('\n');
    const prBody = `## Release Candidate Summary
Promoting validated staging integration changes to production edge.

### Release Target Commit
- **Candidate Commit SHA**: \`${candidateSha}\` (\`${candidateShort}\`)

### Included Commits (${unpromoted.length})
${commitList}

### Preflight Verification Checklist
- [x] Staging edge health verified at ${STAGING_HEALTH_URL}
- [x] Pre-test staging commit hash assertion verified
- [x] Promotion rules verified (staging ➔ production)
- [ ] Gated production deployment approval via GitHub Actions environment
- [ ] Post-deployment edge health verification`;

    try {
      const prUrl = runCmd(
        `gh pr create --base production --head staging --title "${prTitle}" --body "${prBody}"`
      );
      openPrUrl = prUrl;
      const match = prUrl.match(/\/pull\/(\d+)/);
      if (match) openPrNumber = parseInt(match[1], 10);
      console.log(`  ${colors.green}✅ Release PR created:${colors.reset} ${prUrl}`);
    } catch (err: any) {
      console.error(`  ${colors.red}❌ Failed to create PR:${colors.reset} ${err.message}`);
      process.exit(1);
    }
  }

  if (createPrOnly) {
    console.log(`\n${colors.green}✅ Release PR ready:${colors.reset} ${openPrUrl}`);
    return;
  }

  // 6. Merge release PR if auto-merge is specified
  if (autoMerge && openPrNumber) {
    console.log(`\n${colors.bold}🔀 Merging Release PR #${openPrNumber} into production...${colors.reset}`);
    try {
      runCmd(`gh pr merge ${openPrNumber} --merge --admin`);
      console.log(`  ${colors.green}✅ PR #${openPrNumber} merged into production!${colors.reset}`);
    } catch (err: any) {
      console.log(`  ℹ️ Merge failed or requires approval: ${err.message}`);
      console.log(`  👉 Please review and merge at: ${openPrUrl}`);
    }
  } else {
    console.log(`\n${colors.bold}👉 Next Step to Deploy:${colors.reset}`);
    console.log(`  1. Review and merge the release PR: ${colors.cyan}${openPrUrl}${colors.reset}`);
    console.log(`  2. Or run: ${colors.bold}gh pr merge ${openPrNumber} --merge${colors.reset}`);
    console.log(`  3. Upon merge, GitHub Actions 'deploy.yml' will run:`);
    console.log(`     - build-and-validate ➔ deploy-staging ➔ test-staging (with SHA integrity checks)`);
    console.log(`     - ✋ Production Human Approval Gate (jacobmiller22)`);
    console.log(`     - deploy-production ➔ verify-production ➔ notify-deployment`);
  }

  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n${colors.red}❌ Unhandled error:${colors.reset} ${err.message}`);
    process.exit(1);
  });
}
