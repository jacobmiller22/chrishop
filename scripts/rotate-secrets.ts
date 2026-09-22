#!/usr/bin/env tsx
/**
 * ChrisShop Production Edge Secret Rotation CLI
 *
 * Operational rollover utility for Cloudflare Workers encrypted secrets.
 * Implements Story 2.29 and aligns with docs/runbooks/SECRET_ROTATION.md:
 * - Supports dry-run validation and simulation
 * - Auto-generates high-entropy 256-bit cryptographic keys for PAYLOAD_SECRET
 * - Validates format of third-party API credentials (Shopify, Resend, Turnstile)
 * - Probes edge health (/api/health) pre- and post-rotation
 * - Produces standardized audit trail records
 *
 * Usage:
 *   pnpm run secrets:rotate --secret PAYLOAD_SECRET --dry-run
 *   pnpm run secrets:rotate --secret PAYLOAD_SECRET --generate --env staging
 *   pnpm run secrets:rotate --secret RESEND_API_KEY --value re_12345 --env staging
 *   pnpm run secrets:rotate --list --env staging
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type TargetEnvironment = 'staging' | 'production' | 'preview';

export interface SecretDefinition {
  id: string;
  description: string;
  supportedEnvs: TargetEnvironment[];
  defaultCadenceDays: number;
  autoGeneratable?: boolean;
  generateFn?: () => string;
  validateValue?: (val: string) => { valid: boolean; error?: string };
}

export interface RotateSecretOptions {
  secretName: string;
  secretValue?: string;
  environment: TargetEnvironment;
  dryRun?: boolean;
  generate?: boolean;
  reason?: string;
  operator?: string;
  skipHealthCheck?: boolean;
  healthUrl?: string;
  runner?: (cmd: string, input?: string) => string;
}

export interface RotationAuditRecord {
  timestamp: string;
  operator: string;
  targetSecret: string;
  environment: TargetEnvironment;
  reason: string;
  dryRun: boolean;
  healthCheckPre: 'PASS' | 'FAIL' | 'SKIPPED';
  healthCheckPost: 'PASS' | 'FAIL' | 'SKIPPED';
  previousTokenRevocationRequired: boolean;
  markdown: string;
}

// ============================================================================
// Supported Secret Definitions Registry
// ============================================================================

export const SECRET_REGISTRY: Record<string, SecretDefinition> = {
  PAYLOAD_SECRET: {
    id: 'PAYLOAD_SECRET',
    description: 'Payload CMS session encryption & JWT signing key (32+ bytes)',
    supportedEnvs: ['staging', 'production', 'preview'],
    defaultCadenceDays: 90,
    autoGeneratable: true,
    generateFn: () => crypto.randomBytes(32).toString('hex'),
    validateValue: (val: string) => {
      if (!val || val.trim().length < 32) {
        return { valid: false, error: 'PAYLOAD_SECRET must be at least 32 characters long' };
      }
      return { valid: true };
    },
  },
  SHOPIFY_ADMIN_TOKEN: {
    id: 'SHOPIFY_ADMIN_TOKEN',
    description: 'Shopify Admin API access token for catalog & inventory sync',
    supportedEnvs: ['staging', 'production'],
    defaultCadenceDays: 90,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || val.trim().length < 16) {
        return { valid: false, error: 'SHOPIFY_ADMIN_TOKEN must be at least 16 characters' };
      }
      return { valid: true };
    },
  },
  SHOPIFY_STOREFRONT_TOKEN: {
    id: 'SHOPIFY_STOREFRONT_TOKEN',
    description: 'Shopify Headless Storefront API token for cart & checkout',
    supportedEnvs: ['staging', 'production'],
    defaultCadenceDays: 180,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || val.trim().length < 16) {
        return { valid: false, error: 'SHOPIFY_STOREFRONT_TOKEN must be at least 16 characters' };
      }
      return { valid: true };
    },
  },
  SHOPIFY_WEBHOOK_SECRET: {
    id: 'SHOPIFY_WEBHOOK_SECRET',
    description: 'Shopify HMAC-SHA256 order webhook signature verification secret',
    supportedEnvs: ['staging', 'production'],
    defaultCadenceDays: 180,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || val.trim().length < 16) {
        return { valid: false, error: 'SHOPIFY_WEBHOOK_SECRET must be at least 16 characters' };
      }
      return { valid: true };
    },
  },
  RESEND_API_KEY: {
    id: 'RESEND_API_KEY',
    description: 'Resend API key for transactional order receipts and customer notices',
    supportedEnvs: ['staging', 'production'],
    defaultCadenceDays: 180,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || (!val.startsWith('re_') && val.length < 16)) {
        return { valid: false, error: 'RESEND_API_KEY should start with "re_" and have valid length' };
      }
      return { valid: true };
    },
  },
  OPS_ALERT_WEBHOOK_URL: {
    id: 'OPS_ALERT_WEBHOOK_URL',
    description: 'Operational alerts webhook URL (Discord, Slack, or PagerDuty)',
    supportedEnvs: ['staging', 'production'],
    defaultCadenceDays: 365,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || !val.startsWith('http')) {
        return { valid: false, error: 'OPS_ALERT_WEBHOOK_URL must be a valid HTTP/HTTPS URL' };
      }
      return { valid: true };
    },
  },
  TURNSTILE_SECRET_KEY: {
    id: 'TURNSTILE_SECRET_KEY',
    description: 'Cloudflare Turnstile server-side secret key for bot verification',
    supportedEnvs: ['staging', 'production', 'preview'],
    defaultCadenceDays: 180,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || val.trim().length < 10) {
        return { valid: false, error: 'TURNSTILE_SECRET_KEY must be at least 10 characters' };
      }
      return { valid: true };
    },
  },
  CLOUDFLARE_API_TOKEN: {
    id: 'CLOUDFLARE_API_TOKEN',
    description: 'Cloudflare API token for Workers deployment, D1, KV, and DNS routing',
    supportedEnvs: ['staging', 'production', 'preview'],
    defaultCadenceDays: 90,
    autoGeneratable: false,
    validateValue: (val: string) => {
      if (!val || val.trim().length < 32) {
        return { valid: false, error: 'CLOUDFLARE_API_TOKEN must be at least 32 characters' };
      }
      return { valid: true };
    },
  },
};

// ============================================================================
// Environment Endpoints
// ============================================================================

export const ENV_HEALTH_URLS: Record<TargetEnvironment, string> = {
  staging: 'https://staging-chrishop.jacobmiller22.com/api/health',
  production: 'https://chrishop.jacobmiller22.com/api/health',
  preview: 'https://staging-chrishop.jacobmiller22.com/api/health',
};

// ============================================================================
// Helpers & Probes
// ============================================================================

export function defaultExec(cmd: string, input?: string): string {
  return execSync(cmd, {
    input: input !== undefined ? Buffer.from(input, 'utf-8') : undefined,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

export async function probeHealth(
  url: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'http:' ? http : https;
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, data: json });
          } catch {
            resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, data: body.slice(0, 100) });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ ok: false, status: 0, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0, error: 'Request timed out' });
      });
    } catch (err: any) {
      resolve({ ok: false, status: 0, error: err.message });
    }
  });
}

export function formatAuditRecord(
  record: Omit<RotationAuditRecord, 'markdown'>
): string {
  return [
    '```markdown',
    '### Secret Rotation Audit Record',
    `- **Date & Time (UTC)**: ${record.timestamp}`,
    `- **Operator**: ${record.operator}`,
    `- **Target Secret**: ${record.targetSecret}`,
    `- **Environment**: ${record.environment}`,
    `- **Mode**: ${record.dryRun ? 'DRY-RUN (Simulated)' : 'LIVE EXECUTION'}`,
    `- **Reason**: ${record.reason}`,
    `- **Pre-Rotation Health**: ${record.healthCheckPre}`,
    `- **Post-Rotation Health**: ${record.healthCheckPost}`,
    `- **Previous Token Revoked in Provider Console**: ${
      record.previousTokenRevocationRequired ? 'PENDING (Action Required)' : 'N/A (Symmetric Key)'
    }`,
    '```',
  ].join('\n');
}

// ============================================================================
// Core Secret Rotation Operation
// ============================================================================

export async function rotateSecret(
  options: RotateSecretOptions
): Promise<RotationAuditRecord> {
  const {
    secretName,
    environment,
    dryRun = false,
    generate = false,
    reason = 'Scheduled 90-Day Rotation',
    skipHealthCheck = false,
    runner = defaultExec,
  } = options;

  const definition = SECRET_REGISTRY[secretName];
  if (!definition) {
    throw new Error(
      `Unknown secret "${secretName}". Supported secrets: ${Object.keys(SECRET_REGISTRY).join(', ')}`
    );
  }

  if (!definition.supportedEnvs.includes(environment)) {
    throw new Error(
      `Secret "${secretName}" is not supported in environment "${environment}". Supported: ${definition.supportedEnvs.join(', ')}`
    );
  }

  // 1. Resolve & Validate Secret Value
  let finalValue = options.secretValue;

  if (generate) {
    if (!definition.autoGeneratable || !definition.generateFn) {
      throw new Error(`Secret "${secretName}" does not support automatic generation. Provide an explicit value.`);
    }
    finalValue = definition.generateFn();
  } else if (!finalValue && definition.autoGeneratable && definition.generateFn) {
    // If auto-generatable and no value provided, auto-generate by default
    finalValue = definition.generateFn();
  }

  if (!finalValue) {
    throw new Error(
      `No value provided for secret "${secretName}". Provide via --value or use --generate if supported.`
    );
  }

  if (definition.validateValue) {
    const validation = definition.validateValue(finalValue);
    if (!validation.valid) {
      throw new Error(`Invalid value for secret "${secretName}": ${validation.error}`);
    }
  }

  // 2. Pre-Rotation Health Probe
  let healthPre: 'PASS' | 'FAIL' | 'SKIPPED' = 'SKIPPED';
  const healthUrl = options.healthUrl || ENV_HEALTH_URLS[environment];

  if (!skipHealthCheck && healthUrl) {
    const probe = await probeHealth(healthUrl);
    healthPre = probe.ok ? 'PASS' : 'FAIL';
  }

  // 3. Execute or Simulate Wrangler Secret Put
  const wranglerEnvFlag = environment === 'production' ? '' : ` --env ${environment}`;
  const cmd = `wrangler secret put ${secretName}${wranglerEnvFlag}`;

  if (!dryRun) {
    runner(cmd, finalValue);
  }

  // 4. Post-Rotation Health Probe
  let healthPost: 'PASS' | 'FAIL' | 'SKIPPED' = 'SKIPPED';
  if (!skipHealthCheck && !dryRun && healthUrl) {
    // Give worker edge isolate brief moment to pick up configuration if needed
    const probe = await probeHealth(healthUrl);
    healthPost = probe.ok ? 'PASS' : 'FAIL';
  } else if (dryRun) {
    healthPost = healthPre; // In dry run, post mirrors pre
  }

  // 5. Operator Resolution
  let operator = options.operator;
  if (!operator) {
    try {
      operator = runner('git config user.name') || runner('whoami') || 'Platform Engineer';
    } catch {
      operator = 'Platform Engineer';
    }
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const requiresRevocation =
    secretName.includes('TOKEN') || secretName.includes('KEY');

  const baseRecord = {
    timestamp,
    operator,
    targetSecret: secretName,
    environment,
    reason,
    dryRun,
    healthCheckPre: healthPre,
    healthCheckPost: healthPost,
    previousTokenRevocationRequired: requiresRevocation,
  };

  const markdown = formatAuditRecord(baseRecord);

  return {
    ...baseRecord,
    markdown,
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ChrisShop Production Edge Secret Rotation CLI

Options:
  --secret <NAME>        Secret identifier to rotate (${Object.keys(SECRET_REGISTRY).join(', ')})
  --env <ENV>            Target environment (staging [default], production, preview)
  --value <VALUE>        Explicit secret value
  --generate             Auto-generate value (supported for PAYLOAD_SECRET)
  --dry-run              Simulate rotation without updating Cloudflare secrets
  --skip-health-check    Skip pre- and post-rotation /api/health probes
  --reason <REASON>      Reason for rotation (default: "Scheduled 90-Day Rotation")
  --operator <NAME>      Operator identifier for audit log
  --list                 List supported secrets and rotation cadences
  --json                 Output JSON audit record
    `);
    process.exit(0);
  }

  if (args.includes('--list')) {
    console.log('\nMaster Secret Inventory & Rotation Cadences:\n');
    for (const [key, def] of Object.entries(SECRET_REGISTRY)) {
      console.log(`- ${key}:`);
      console.log(`    Description: ${def.description}`);
      console.log(`    Supported Environments: ${def.supportedEnvs.join(', ')}`);
      console.log(`    Cadence: Every ${def.defaultCadenceDays} days`);
      console.log(`    Auto-Generatable: ${def.autoGeneratable ? 'YES' : 'NO'}`);
    }
    console.log('');
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const generate = args.includes('--generate');
  const skipHealthCheck = args.includes('--skip-health-check');
  const jsonOutput = args.includes('--json');

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const secretName = getArg('--secret');
  const environment = (getArg('--env') || 'staging') as TargetEnvironment;
  const secretValue = getArg('--value') || process.env.SECRET_VALUE;
  const reason = getArg('--reason') || 'Scheduled 90-Day Rotation';
  const operator = getArg('--operator');

  if (!secretName) {
    console.error('❌ Error: --secret <NAME> is required. Run with --list to view available secrets.');
    process.exit(1);
  }

  try {
    if (!jsonOutput) {
      console.log('\n================================================================');
      console.log('   🔐 ChrisShop Edge Secret Rotation Manager');
      console.log('================================================================\n');
      console.log(`Target Secret: ${secretName}`);
      console.log(`Environment:   ${environment}`);
      console.log(`Mode:          ${dryRun ? 'DRY-RUN (No changes applied)' : 'LIVE ROTATION'}`);
      console.log('');
    }

    const result = await rotateSecret({
      secretName,
      secretValue,
      environment,
      dryRun,
      generate,
      reason,
      operator,
      skipHealthCheck,
    });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('✔ Operation Completed Successfully!\n');
      console.log(result.markdown);
      console.log('\nAudit record printed above. Copy into team security changelog.\n');
    }
  } catch (err: any) {
    console.error(`\n❌ Secret rotation failed: ${err.message}\n`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  void main();
}
