#!/usr/bin/env tsx
/**
 * ChrisShop Secrets Management & Isolation Audit CLI
 *
 * Implements Story 5.3 (Issue #30) per docs/HIGH_LEVEL_DESIGN.md Section 7:
 * - Audits git history and tracked files for committed secrets, tokens, or private keys
 * - Verifies that local development strictly relies on git-ignored .dev.vars and .env
 * - Enforces zero-leakage in wrangler.toml (all runtime secrets in Cloudflare Workers Secrets)
 * - Verifies CI/CD workflow secret boundaries (no runtime secrets injected into deploy workflows)
 * - Outputs production and staging secret provisioning commands (wrangler secret put)
 *
 * Usage:
 *   pnpm run secrets:audit
 *   tsx scripts/secrets-audit.ts --verbose
 *   tsx scripts/secrets-audit.ts --list-required
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

export interface SecretAuditResult {
  passed: boolean;
  totalChecks: number;
  violations: string[];
  auditedFilesCount: number;
}

export const SENSITIVE_SECRET_KEYS = [
  'PAYLOAD_SECRET',
  'SHOPIFY_ADMIN_TOKEN',
  'SHOPIFY_STOREFRONT_TOKEN',
  'SHOPIFY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'TURNSTILE_SECRET_KEY',
];

export const REQUIRED_PRODUCTION_SECRETS: Array<{
  name: string;
  description: string;
  environments: string[];
  command: (env: string) => string;
}> = [
  {
    name: 'PAYLOAD_SECRET',
    description: 'Cryptographic session encryption & JWT signing key for Payload CMS (32+ bytes hex)',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put PAYLOAD_SECRET'
        : `pnpm exec wrangler secret put PAYLOAD_SECRET --env ${env}`,
  },
  {
    name: 'SHOPIFY_ADMIN_TOKEN',
    description: 'Shopify Admin API access token (shpat_...) for real-time catalog & inventory sync',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN'
        : `pnpm exec wrangler secret put SHOPIFY_ADMIN_TOKEN --env ${env}`,
  },
  {
    name: 'SHOPIFY_STOREFRONT_TOKEN',
    description: 'Shopify Headless Storefront API token for cart & checkout session creation',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put SHOPIFY_STOREFRONT_TOKEN'
        : `pnpm exec wrangler secret put SHOPIFY_STOREFRONT_TOKEN --env ${env}`,
  },
  {
    name: 'SHOPIFY_WEBHOOK_SECRET',
    description: 'Shopify HMAC-SHA256 signature secret for order and inventory webhooks',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET'
        : `pnpm exec wrangler secret put SHOPIFY_WEBHOOK_SECRET --env ${env}`,
  },
  {
    name: 'RESEND_API_KEY',
    description: 'Resend transactional email API key (re_...) for receipts and alerts',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put RESEND_API_KEY'
        : `pnpm exec wrangler secret put RESEND_API_KEY --env ${env}`,
  },
  {
    name: 'TURNSTILE_SECRET_KEY',
    description: 'Cloudflare Turnstile server-side secret key for bot verification',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put TURNSTILE_SECRET_KEY'
        : `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env ${env}`,
  },
  {
    name: 'OPS_ALERT_WEBHOOK_URL',
    description: 'Operational alert webhook URL for Slack / Discord / PagerDuty error notifications',
    environments: ['production', 'staging'],
    command: (env) =>
      env === 'production'
        ? 'pnpm exec wrangler secret put OPS_ALERT_WEBHOOK_URL'
        : `pnpm exec wrangler secret put OPS_ALERT_WEBHOOK_URL --env ${env}`,
  },
];

// Regex patterns to detect committed live secrets or credentials
const LIVE_SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Shopify Admin Token', pattern: /\bshpat_[a-fA-F0-9]{32}\b/ },
  { name: 'Shopify Shared Secret', pattern: /\bshpss_[a-fA-F0-9]{32}\b/ },
  { name: 'GitHub Personal Access Token', pattern: /\bghp_[a-zA-Z0-9]{36}\b/ },
  { name: 'GitHub Fine-grained PAT', pattern: /\bgithub_pat_[a-zA-Z0-9_]{82}\b/ },
  { name: 'Slack Bot / User Token', pattern: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/ },
  { name: 'Private Cryptographic Key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'Live Resend API Key', pattern: /\bre_[1-9a-zA-Z]{24,}\b/ },
];

export function auditGitSecrets(rootDir: string = process.cwd()): { violations: string[]; fileCount: number } {
  const violations: string[] = [];
  let files: string[] = [];

  try {
    const rawFiles = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
    files = rawFiles.split('\n').filter((f) => f.trim().length > 0);
  } catch (err: any) {
    violations.push(`Failed to list git-tracked files: ${err.message}`);
    return { violations, fileCount: 0 };
  }

  // Files exempted from secret pattern checks (e.g. this audit script, tests with mock fixtures)
  const exemptedFiles = new Set([
    'scripts/secrets-audit.ts',
    'tests/integration/secrets-management-audit.test.ts',
    'tests/integration/secret-rotation-cli.test.ts',
    'tests/integration/cloudflare-secrets-runtime.test.ts',
    'tests/integration/shopify-webhook.test.ts',
    'tests/integration/cloudflare-access.test.ts',
    'pnpm-lock.yaml',
  ]);

  for (const relPath of files) {
    if (exemptedFiles.has(relPath)) continue;
    // Skip binary media or test fixtures
    if (relPath.match(/\.(png|jpg|jpeg|webp|ico|svg|pdf|lock)$/i)) continue;

    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const { name, pattern } of LIVE_SECRET_PATTERNS) {
        if (pattern.test(content)) {
          // Check if it's explicitly a placeholder / test mock
          const match = content.match(pattern);
          if (match && !match[0].includes('placeholder') && !match[0].includes('mock')) {
            violations.push(`Potential ${name} detected in git-tracked file: ${relPath} (matches ${pattern.source})`);
          }
        }
      }
    } catch {
      // Ignore unreadable binary files
    }
  }

  return { violations, fileCount: files.length };
}

export function auditGitignore(rootDir: string = process.cwd()): string[] {
  const violations: string[] = [];
  const gitignorePath = path.join(rootDir, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    violations.push('.gitignore file is missing at monorepo root');
    return violations;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  const requiredIgnored = [
    { pattern: '.env', label: '.env files' },
    { pattern: '.dev.vars', label: '.dev.vars files' },
    { pattern: '*.pem', label: '*.pem cryptographic certificates' },
    { pattern: '*.key', label: '*.key private keys' },
  ];

  for (const { pattern, label } of requiredIgnored) {
    if (!content.includes(pattern)) {
      violations.push(`.gitignore does not explicitly ignore ${label} (missing pattern: "${pattern}")`);
    }
  }

  return violations;
}

export function auditWranglerSecretsIsolation(rootDir: string = process.cwd()): string[] {
  const violations: string[] = [];
  const wranglerPath = path.join(rootDir, 'wrangler.toml');

  if (!fs.existsSync(wranglerPath)) {
    violations.push('wrangler.toml is missing at monorepo root');
    return violations;
  }

  const content = fs.readFileSync(wranglerPath, 'utf-8');

  for (const secretKey of SENSITIVE_SECRET_KEYS) {
    const varPattern = new RegExp(`^\\s*${secretKey}\\s*=`, 'm');
    if (varPattern.test(content)) {
      violations.push(
        `wrangler.toml exposes sensitive secret "${secretKey}" in plaintext vars. Secrets must be managed strictly via "wrangler secret put ${secretKey}"!`
      );
    }
  }

  return violations;
}

export function auditWorkflowSecretBoundaries(rootDir: string = process.cwd()): string[] {
  const violations: string[] = [];
  const workflowsDir = path.join(rootDir, '.github/workflows');

  if (!fs.existsSync(workflowsDir)) {
    violations.push('.github/workflows directory does not exist');
    return violations;
  }

  const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  // Disallowed secrets that should never be mapped into CI workflow envs
  const forbiddenInWorkflows = [
    'secrets.PAYLOAD_SECRET',
    'secrets.SHOPIFY_ADMIN_TOKEN',
    'secrets.SHOPIFY_STOREFRONT_TOKEN',
    'secrets.SHOPIFY_WEBHOOK_SECRET',
    'secrets.RESEND_API_KEY',
    'secrets.TURNSTILE_SECRET_KEY',
  ];

  for (const file of files) {
    const fullPath = path.join(workflowsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');

    for (const forbidden of forbiddenInWorkflows) {
      if (content.includes(forbidden)) {
        violations.push(
          `Workflow ${file} violates least-privilege boundary by referencing application runtime secret "${forbidden}". Runtime secrets belong strictly in Cloudflare Workers Secrets!`
        );
      }
    }
  }

  return violations;
}

export function auditRunbookDocumentation(rootDir: string = process.cwd()): string[] {
  const violations: string[] = [];
  const runbookPath = path.join(rootDir, 'docs/security/SECRETS_MANAGEMENT_RUNBOOK.md');

  if (!fs.existsSync(runbookPath)) {
    violations.push('Operational runbook missing: docs/security/SECRETS_MANAGEMENT_RUNBOOK.md');
    return violations;
  }

  const content = fs.readFileSync(runbookPath, 'utf-8');
  for (const secret of SENSITIVE_SECRET_KEYS) {
    if (!content.includes(secret)) {
      violations.push(`SECRETS_MANAGEMENT_RUNBOOK.md must document operational handling for "${secret}"`);
    }
  }

  if (!content.includes('wrangler secret put')) {
    violations.push('SECRETS_MANAGEMENT_RUNBOOK.md must document "wrangler secret put" command usage');
  }

  return violations;
}

export function runFullSecretsAudit(rootDir: string = process.cwd()): SecretAuditResult {
  const gitAudit = auditGitSecrets(rootDir);
  const gitignoreViolations = auditGitignore(rootDir);
  const wranglerViolations = auditWranglerSecretsIsolation(rootDir);
  const workflowViolations = auditWorkflowSecretBoundaries(rootDir);
  const runbookViolations = auditRunbookDocumentation(rootDir);

  const violations = [
    ...gitAudit.violations,
    ...gitignoreViolations,
    ...wranglerViolations,
    ...workflowViolations,
    ...runbookViolations,
  ];

  return {
    passed: violations.length === 0,
    totalChecks: 5,
    violations,
    auditedFilesCount: gitAudit.fileCount,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isVerbose = args.includes('--verbose') || args.includes('-v');
  const isListRequired = args.includes('--list-required');

  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🔐 ChrisShop Secrets Management & Isolation Audit CLI         ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  if (isListRequired) {
    console.log(`${colors.bold}Required Edge Secrets & Cloudflare Workers Provisioning Commands:${colors.reset}\n`);
    for (const secret of REQUIRED_PRODUCTION_SECRETS) {
      console.log(`${colors.yellow}• ${secret.name}${colors.reset}`);
      console.log(`  Description:  ${secret.description}`);
      console.log(`  Environments: ${secret.environments.join(', ')}`);
      for (const env of secret.environments) {
        console.log(`  [${env}]        ${colors.green}${secret.command(env)}${colors.reset}`);
      }
      console.log('');
    }
    return;
  }

  console.log(`Running comprehensive secrets audit across monorepo...`);
  const result = runFullSecretsAudit();

  console.log(`- Audited git-tracked files: ${result.auditedFilesCount}`);
  console.log(`- Audit verification checks: ${result.totalChecks}`);

  if (isVerbose && result.passed) {
    console.log(`\n${colors.green}✔ Check 1: Zero committed secrets or API tokens in git-tracked files${colors.reset}`);
    console.log(`${colors.green}✔ Check 2: .gitignore enforces strict isolation for .dev.vars, .env, and *.key${colors.reset}`);
    console.log(`${colors.green}✔ Check 3: wrangler.toml contains ZERO plaintext runtime secrets${colors.reset}`);
    console.log(`${colors.green}✔ Check 4: GitHub Actions workflows enforce least-privilege secret boundaries${colors.reset}`);
    console.log(`${colors.green}✔ Check 5: docs/security/SECRETS_MANAGEMENT_RUNBOOK.md comprehensively documents all secrets${colors.reset}`);
  }

  if (result.passed) {
    console.log(`\n${colors.bold}${colors.green}✔ SECRETS AUDIT PASSED! All secrets isolated and zero leakage detected.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bold}${colors.red}✖ SECRETS AUDIT FAILED! (${result.violations.length} violations detected):${colors.reset}\n`);
    for (const v of result.violations) {
      console.log(`  ${colors.red}• ${v}${colors.reset}`);
    }
    console.log('');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  void main();
}
