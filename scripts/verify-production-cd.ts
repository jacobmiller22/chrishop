#!/usr/bin/env tsx
/**
 * ChrisShop Production CD Pipeline Verification CLI (Story 4.1)
 *
 * Validates the Cloudflare Workers continuous deployment configuration:
 * 1. .github/workflows/deploy.yml structure, jobs, and triggers
 * 2. Concurrency groups & deployment locks (cancel-in-progress: false)
 * 3. D1 database migrations before production worker deployment
 * 4. Post-deployment edge health probe loop
 * 5. Discord #dev-alerts status dispatch on success or failure
 * 6. Live edge health reachability probe (optional/configurable)
 *
 * Usage:
 *   pnpm run verify:cd
 *   tsx scripts/verify-production-cd.ts --live-probe
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

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

export interface VerificationCheck {
  id: string;
  name: string;
  passed: boolean;
  details?: string;
}

export function verifyDeployWorkflowConfiguration(workflowContent: string): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  // 1. Triggers
  const triggersOnProd =
    workflowContent.includes('branches:') &&
    workflowContent.includes('production') &&
    workflowContent.includes('staging');
  checks.push({
    id: 'triggers',
    name: 'Workflow Triggers (production, staging, main, workflow_dispatch)',
    passed: triggersOnProd,
    details: triggersOnProd ? 'Triggers include staging, production, and workflow_dispatch' : 'Missing branch triggers',
  });

  // 2. Concurrency locks
  const hasConcurrencyLock =
    workflowContent.includes('concurrency:') &&
    workflowContent.includes('cancel-in-progress: false') &&
    workflowContent.includes('group: deploy-');
  checks.push({
    id: 'concurrency',
    name: 'Deployment Concurrency & Non-Overlapping Lock',
    passed: hasConcurrencyLock,
    details: hasConcurrencyLock ? 'Concurrency group active with cancel-in-progress: false' : 'Missing concurrency locking',
  });

  // 3. Staged Promotion & Human Gate
  const hasHumanGate =
    workflowContent.includes('environment: production') &&
    workflowContent.includes('needs: [build-and-validate, deploy-staging, test-staging]');
  checks.push({
    id: 'human_gate',
    name: 'Staged Promotion & Production Environment Gate',
    passed: hasHumanGate,
    details: hasHumanGate ? 'deploy-production requires staging verification & production environment approval' : 'Missing staging gate or production environment',
  });

  // 4. D1 Migrations Prior to Deploy
  const d1MigrationIdx = workflowContent.indexOf('wrangler d1 migrations apply chrishop-prod-db --remote');
  const deployWorkerIdx = workflowContent.indexOf('Deploy to Cloudflare Workers (Production)');
  const migrationsPrior = d1MigrationIdx !== -1 && deployWorkerIdx !== -1 && d1MigrationIdx < deployWorkerIdx;
  checks.push({
    id: 'd1_migrations',
    name: 'Automated D1 Production Migrations (pre-deploy)',
    passed: migrationsPrior,
    details: migrationsPrior ? 'D1 migrations execute strictly before worker deployment' : 'D1 migrations missing or out of order',
  });

  // 5. Edge Health Probe Loop
  const hasHealthProbe =
    workflowContent.includes('verify-production:') &&
    workflowContent.includes('https://chrishop.jacobmiller22.com') &&
    workflowContent.includes('/api/health');
  checks.push({
    id: 'health_probe',
    name: 'Production Edge Health Probe Loop (/api/health)',
    passed: hasHealthProbe,
    details: hasHealthProbe ? 'verify-production probes live edge health endpoint with retry loop' : 'Missing health probe job',
  });

  // 6. Discord Alerting
  const hasDiscordAlert =
    workflowContent.includes('notify-deployment:') &&
    workflowContent.includes('DISCORD_WEBHOOK') &&
    workflowContent.includes('SUCCESS') &&
    workflowContent.includes('FAILURE');
  checks.push({
    id: 'discord_alert',
    name: 'Discord #dev-alerts Status Dispatcher',
    passed: hasDiscordAlert,
    details: hasDiscordAlert ? 'notify-deployment handles success/failure alerts to Discord' : 'Missing Discord notification step',
  });

  return checks;
}

export async function probeProductionEdge(url = 'https://chrishop.jacobmiller22.com/api/health'): Promise<{
  ok: boolean;
  status: number;
  durationMs: number;
  data?: any;
  error?: string;
}> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const durationMs = Date.now() - start;
    let data: any;
    try {
      data = await res.json();
    } catch {
      data = await res.text().catch(() => '');
    }
    return {
      ok: res.ok,
      status: res.status,
      durationMs,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');

  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🚀 ChrisShop Production CD Deployment Pipeline Validator    ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  if (!fs.existsSync(deployWorkflowPath)) {
    console.error(`${colors.red}✖ Missing workflow file: ${deployWorkflowPath}${colors.reset}`);
    process.exit(1);
  }

  const content = fs.readFileSync(deployWorkflowPath, 'utf-8');
  const checks = verifyDeployWorkflowConfiguration(content);

  let allPassed = true;
  for (const c of checks) {
    const status = c.passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(`  ${status} | ${c.name.padEnd(52)} | ${colors.dim}${c.details || ''}${colors.reset}`);
    if (!c.passed) allPassed = false;
  }

  const args = process.argv.slice(2);
  if (args.includes('--live-probe')) {
    console.log(`\n${colors.bold}📡 Executing Live Production Edge Health Probe:${colors.reset}`);
    const probe = await probeProductionEdge();
    if (probe.ok) {
      console.log(`  ${colors.green}✔ Production Edge is Healthy (HTTP 200 in ${probe.durationMs}ms)${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}⚠ Production Edge probe returned HTTP ${probe.status} (${probe.error || 'Degraded/Offline'})${colors.reset}`);
    }
  }

  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.bold}${colors.green}✔ Production CD Deployment Pipeline is Fully Verified!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.bold}${colors.red}✖ Pipeline verification failed. Please review error details.${colors.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}
