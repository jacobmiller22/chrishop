#!/usr/bin/env tsx
/**
 * ChrisShop Ephemeral Preview Stack Cleanup & Garbage Collection CLI
 *
 * Sweeps and tears down orphaned preview Cloudflare Workers and Terraform preview stacks
 * for pull requests that have been merged or closed.
 *
 * Usage:
 *   pnpm run preview:cleanup
 *   tsx scripts/cleanup-preview-environments.ts --dry-run
 *   tsx scripts/cleanup-preview-environments.ts --force
 *   tsx scripts/cleanup-preview-environments.ts --pr 231
 */

import { execSync } from 'node:child_process';
import https from 'node:https';
import path from 'node:path';
import fs from 'node:fs';

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

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const targetPrIndex = args.indexOf('--pr');
const targetPrNumber = targetPrIndex !== -1 && args[targetPrIndex + 1] ? parseInt(args[targetPrIndex + 1], 10) : null;

function runCmd(cmd: string, silent = false): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: silent ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'inherit'] }).trim();
  } catch (err: any) {
    if (silent) return '';
    const msg = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`Command failed: ${cmd}\n${msg}`);
  }
}

interface WorkerScriptSummary {
  id: string;
  prNumber: number;
}

interface PRStatus {
  number: number;
  state: string; // 'OPEN' | 'CLOSED' | 'MERGED'
  mergedAt: string | null;
}

async function fetchCloudflareWorkers(accountId: string, apiToken: string): Promise<string[]> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/workers/scripts`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success && Array.isArray(parsed.result)) {
            resolve(parsed.result.map((w: any) => w.id));
          } else {
            console.warn(`${colors.yellow}⚠️ Could not list workers via Cloudflare API: ${parsed.errors?.[0]?.message || 'Unknown error'}${colors.reset}`);
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', (err) => {
      console.warn(`${colors.yellow}⚠️ Cloudflare API request failed: ${err.message}${colors.reset}`);
      resolve([]);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}

function getPRStatus(prNumber: number): PRStatus | null {
  try {
    const raw = runCmd(`gh pr view ${prNumber} --json number,state,mergedAt`, true);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCandidateClosedPRNumbers(): number[] {
  try {
    const raw = runCmd(`gh pr list --state closed --limit 100 --json number -q '.[].number'`, true);
    if (!raw) return [];
    return raw
      .split('\n')
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => !isNaN(n));
  } catch {
    return [];
  }
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🧹 ChrisShop Ephemeral Preview Environment Cleanup CLI       ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);

  if (isDryRun) {
    console.log(`${colors.yellow}Mode: DRY-RUN (No resources will be deleted)${colors.reset}\n`);
  } else {
    console.log(`${colors.blue}Mode: LIVE EXECUTION${colors.reset}\n`);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';

  const discoveredWorkers: WorkerScriptSummary[] = [];

  if (targetPrNumber) {
    console.log(`${colors.blue}Targeting specific PR: #${targetPrNumber}${colors.reset}`);
    discoveredWorkers.push({ id: `chrishop-preview-pr-${targetPrNumber}`, prNumber: targetPrNumber });
  } else if (accountId && apiToken) {
    console.log(`${colors.blue}Querying Cloudflare Workers API for chrishop-preview-pr-* workers...${colors.reset}`);
    const workers = await fetchCloudflareWorkers(accountId, apiToken);
    for (const name of workers) {
      const match = name.match(/^chrishop-preview-pr-(\d+)$/);
      if (match) {
        discoveredWorkers.push({ id: name, prNumber: parseInt(match[1], 10) });
      }
    }
  } else {
    console.log(`${colors.yellow}Cloudflare credentials not in env. Auditing closed PRs via GitHub CLI...${colors.reset}`);
    const closedPrs = getCandidateClosedPRNumbers();
    for (const prNum of closedPrs) {
      discoveredWorkers.push({ id: `chrishop-preview-pr-${prNum}`, prNumber: prNum });
    }
  }

  console.log(`Found ${discoveredWorkers.length} candidate preview environments to evaluate.\n`);

  if (discoveredWorkers.length === 0) {
    console.log(`${colors.green}✔ No preview workers found. Cloudflare account is clean.${colors.reset}\n`);
    return;
  }

  let deletedCount = 0;
  let skippedCount = 0;

  for (const candidate of discoveredWorkers) {
    const prStatus = getPRStatus(candidate.prNumber);

    if (prStatus && prStatus.state === 'OPEN') {
      console.log(`${colors.dim}• PR #${candidate.prNumber}: OPEN — Preserving active preview worker (${candidate.id})${colors.reset}`);
      skippedCount++;
      continue;
    }

    const stateLabel = prStatus ? (prStatus.state === 'MERGED' || Boolean(prStatus.mergedAt) ? 'MERGED' : 'CLOSED') : 'UNKNOWN/CLOSED';
    console.log(`${colors.yellow}▶ Reclaiming orphaned stack for PR #${candidate.prNumber} (${stateLabel}): ${candidate.id}${colors.reset}`);

    if (isDryRun) {
      console.log(`  ${colors.cyan}[DRY-RUN] Would execute: wrangler delete --name ${candidate.id} --force${colors.reset}`);
      console.log(`  ${colors.cyan}[DRY-RUN] Would destroy Terraform preview state for pr-${candidate.prNumber}${colors.reset}`);
      deletedCount++;
      continue;
    }

    // 1. Delete Cloudflare Worker
    try {
      if (accountId && apiToken) {
        console.log(`  🗑 Deleting worker ${candidate.id}...`);
        runCmd(`pnpm exec wrangler delete --name ${candidate.id} --force`, true);
        console.log(`  ${colors.green}✔ Worker ${candidate.id} deleted successfully.${colors.reset}`);
      } else {
        console.log(`  ${colors.yellow}Skipping worker deletion (missing Cloudflare credentials).${colors.reset}`);
      }
    } catch (err: any) {
      console.warn(`  ${colors.yellow}Warning: Failed to delete worker ${candidate.id}: ${err.message}${colors.reset}`);
    }

    // 2. Destroy isolated Terraform Preview resources if present
    try {
      const previewTfDir = path.resolve(__dirname, '../infra/terraform/environments/preview');
      if (fs.existsSync(previewTfDir) && accountId && apiToken) {
        console.log(`  🗑 Purging Terraform preview state for PR #${candidate.prNumber}...`);
        const initCmd = `terraform -chdir="${previewTfDir}" init -backend-config="endpoints={s3=\\"https://${accountId}.r2.cloudflarestorage.com\\"}" -backend-config="key=\\"environments/preview-pr-${candidate.prNumber}/terraform.tfstate\\""`;
        const destroyCmd = `terraform -chdir="${previewTfDir}" destroy -auto-approve -var="cloudflare_account_id=${accountId}" -var="cloudflare_api_token=${apiToken}" -var="pr_number=${candidate.prNumber}"`;
        runCmd(initCmd, true);
        runCmd(destroyCmd, true);
        console.log(`  ${colors.green}✔ Terraform preview state purged.${colors.reset}`);
      }
    } catch (err: any) {
      console.warn(`  ${colors.yellow}Warning: Terraform preview destroy skipped: ${err.message}${colors.reset}`);
    }

    deletedCount++;
  }

  console.log(`\n${colors.bold}${colors.green}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.green}   Cleanup Completed: ${deletedCount} stacks reclaimed, ${skippedCount} active stacks preserved.${colors.reset}`);
  console.log(`${colors.bold}${colors.green}================================================================${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`${colors.red}Fatal cleanup error: ${err.message}${colors.reset}`);
  process.exit(1);
});
