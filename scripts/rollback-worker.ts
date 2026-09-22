#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare Workers Instant Rollback CLI Helper
 *
 * Orchestrates emergency worker deployment rollbacks, health verification,
 * and operational Discord alerts per docs/runbooks/DISASTER_RECOVERY.md.
 */

import { execSync } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';

export interface RollbackOptions {
  environment: 'production' | 'staging';
  deploymentId?: string;
  reason?: string;
  dryRun?: boolean;
  checkHealth?: boolean;
  notify?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
}

export interface DiscordPayload {
  content: string;
  embeds: DiscordEmbed[];
}

export const ENV_URL_MAP: Record<string, string> = {
  production: 'https://chrishop.jacobmiller22.com',
  staging: 'https://staging-chrishop.jacobmiller22.com',
};

/**
 * Resolves the edge URL for a target environment
 */
export function resolveTargetUrl(environment: 'production' | 'staging'): string {
  return ENV_URL_MAP[environment] || ENV_URL_MAP.production;
}

/**
 * Validates whether a deployment ID conforms to Cloudflare deployment ID formats.
 * Prevents command injection and malformed identifiers.
 */
export function isValidDeploymentId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 4 || trimmed.length > 64) return false;
  // Alphanumeric with hyphens and underscores only
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Builds the wrangler rollback command string
 */
export function buildRollbackCommand(options: {
  environment: 'production' | 'staging';
  deploymentId?: string;
}): string {
  if (options.deploymentId && options.deploymentId.trim().length > 0) {
    const trimmed = options.deploymentId.trim();
    if (!isValidDeploymentId(trimmed)) {
      throw new Error(
        `Invalid deployment ID: '${trimmed}'. Deployment IDs must be 4-64 alphanumeric characters, hyphens, or underscores.`
      );
    }
    return `wrangler rollback ${trimmed} --env ${options.environment}`;
  }
  return `wrangler rollback --env ${options.environment}`;
}

/**
 * Builds the Discord alert notification payload for a rollback event
 */
export function buildRollbackDiscordPayload(options: {
  environment: 'production' | 'staging';
  deploymentId?: string;
  reason?: string;
  actor?: string;
  status?: 'SUCCESS' | 'FAILURE';
}): DiscordPayload {
  const status = options.status || 'SUCCESS';
  const isSuccess = status === 'SUCCESS';
  const color = isSuccess ? 65280 : 16711680;
  const icon = isSuccess ? '↩️' : '🚨';
  const actor = options.actor || process.env.GITHUB_ACTOR || process.env.USER || 'operator';
  const targetUrl = resolveTargetUrl(options.environment);
  const targetDeployment = options.deploymentId || 'Previous Deployment';
  const reason = options.reason || 'Emergency rollback due to operational regression or error';

  const title = `${icon} Cloudflare Worker Rollback ${status}: ${options.environment}`;
  const description = [
    '**ChrisShop Emergency Rollback Execution**',
    '',
    `• **Environment**: \`${options.environment}\``,
    `• **Status**: \`${status}\``,
    `• **Deployment Target**: \`${targetDeployment}\``,
    `• **Reason**: ${reason}`,
    `• **Triggered by**: @${actor}`,
    `• **Edge URL**: ${targetUrl}`,
    `• **Health Probe**: ${targetUrl}/api/health`,
  ].join('\n');

  return {
    content: `${icon} **[Worker Rollback]** ${options.environment} rollback ${status}`,
    embeds: [
      {
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Probes the edge health endpoint
 */
export async function probeHealthEndpoint(
  url: string,
  maxRetries = 3,
  delayMs = 2000
): Promise<{ ok: boolean; status: number; message: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise<{ ok: boolean; status: number; body: string }>(
        (resolve, reject) => {
          const client = url.startsWith('https') ? https : http;
          const req = client.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              resolve({
                ok: res.statusCode === 200,
                status: res.statusCode || 0,
                body: data,
              });
            });
          });
          req.on('error', (err) => reject(err));
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Health probe timeout after 5000ms'));
          });
        }
      );

      if (result.ok) {
        return { ok: true, status: result.status, message: 'Health probe verified (HTTP 200)' };
      }
    } catch (err) {
      if (attempt === maxRetries) {
        return { ok: false, status: 0, message: (err as Error).message };
      }
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { ok: false, status: 0, message: 'Health probe failed after max retries' };
}

/**
 * Dispatches an alert payload to Discord webhook URL
 */
export async function dispatchDiscordAlert(
  webhookUrl: string,
  payload: DiscordPayload
): Promise<boolean> {
  try {
    const data = JSON.stringify(payload);
    const parsedUrl = new URL(webhookUrl);

    return await new Promise<boolean>((resolve) => {
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.request(
        parsedUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          timeout: 5000,
        },
        (res) => {
          resolve((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300);
        }
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.write(data);
      req.end();
    });
  } catch {
    return false;
  }
}

/**
 * Parses CLI arguments
 */
export function parseCliArgs(args: string[]): RollbackOptions {
  let environment: 'production' | 'staging' = 'staging';
  let deploymentId: string | undefined;
  let reason: string | undefined;
  const dryRun = args.includes('--dry-run');
  const checkHealth = args.includes('--check-health');
  const notify = args.includes('--notify');

  const envIdx = args.indexOf('--env');
  if (envIdx !== -1 && args[envIdx + 1]) {
    const envVal = args[envIdx + 1].toLowerCase();
    if (envVal === 'production' || envVal === 'staging') {
      environment = envVal;
    }
  }

  const idIdx = args.indexOf('--deployment-id');
  if (idIdx !== -1 && args[idIdx + 1]) {
    deploymentId = args[idIdx + 1];
  }

  const reasonIdx = args.indexOf('--reason');
  if (reasonIdx !== -1 && args[reasonIdx + 1]) {
    reason = args[reasonIdx + 1];
  }

  return {
    environment,
    deploymentId,
    reason,
    dryRun,
    checkHealth,
    notify,
  };
}

/**
 * Main CLI entrypoint
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ChrisShop Cloudflare Workers Instant Rollback CLI Helper

Usage:
  tsx scripts/rollback-worker.ts [options]

Options:
  --env <staging|production>  Target environment to rollback (default: staging)
  --deployment-id <id>        Specific Cloudflare deployment ID to revert to (default: previous)
  --reason <text>             Operational justification for the rollback
  --dry-run                   Print the commands and webhook payload without executing
  --check-health              Verify the /api/health endpoint post-rollback
  --notify                    Dispatch Discord notification to #dev-alerts webhook
  -h, --help                  Show this help message
`);
    return;
  }

  const options = parseCliArgs(args);
  const cmd = buildRollbackCommand(options);
  const targetUrl = resolveTargetUrl(options.environment);

  console.log('================================================================');
  console.log('   🚨 ChrisShop Cloudflare Workers Instant Rollback Helper     ');
  console.log('================================================================');
  console.log(`Target Environment: ${options.environment}`);
  console.log(`Deployment ID:      ${options.deploymentId || 'Previous Deployment'}`);
  console.log(`Reason:             ${options.reason || 'Emergency rollback'}`);
  console.log(`Target Edge URL:    ${targetUrl}`);
  console.log(`Command:            ${cmd}`);
  console.log('');

  if (options.dryRun) {
    console.log('🔍 [DRY RUN] Simulated execution details:');
    console.log(`   Command to run: pnpm exec ${cmd}`);
    const payload = buildRollbackDiscordPayload({
      environment: options.environment,
      deploymentId: options.deploymentId,
      reason: options.reason,
      status: 'SUCCESS',
    });
    console.log('   Discord Payload Preview:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n✅ Dry-run completed successfully.');
    return;
  }

  let status: 'SUCCESS' | 'FAILURE' = 'SUCCESS';

  try {
    console.log(`▶ Executing: pnpm exec ${cmd}...`);
    execSync(`pnpm exec ${cmd}`, { stdio: 'inherit' });
    console.log('✅ Rollback command executed successfully.');
  } catch (error) {
    status = 'FAILURE';
    console.error(`❌ Rollback execution failed: ${(error as Error).message}`);
  }

  if (options.checkHealth && status === 'SUCCESS') {
    const healthUrl = `${targetUrl}/api/health`;
    console.log(`\n▶ Probing edge health: ${healthUrl}...`);
    const healthResult = await probeHealthEndpoint(healthUrl);
    if (healthResult.ok) {
      console.log(`✅ ${healthResult.message}`);
    } else {
      console.warn(`⚠️ Warning: ${healthResult.message}`);
    }
  }

  if (options.notify) {
    const webhookUrl =
      process.env.DISCORD_WEBHOOK_DEV_ALERTS ||
      process.env.DISCORD_WEBHOOK_ALERTS ||
      process.env.DISCORD_WEBHOOK_URL;

    if (webhookUrl) {
      console.log('\n▶ Dispatching Discord notification...');
      const payload = buildRollbackDiscordPayload({
        environment: options.environment,
        deploymentId: options.deploymentId,
        reason: options.reason,
        status,
      });
      const dispatched = await dispatchDiscordAlert(webhookUrl, payload);
      if (dispatched) {
        console.log('✅ Discord notification dispatched.');
      } else {
        console.warn('⚠️ Warning: Failed to dispatch Discord notification.');
      }
    } else {
      console.log('\nℹ️ No Discord webhook configured; skipping alert dispatch.');
    }
  }

  if (status === 'FAILURE') {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal rollback error:', err);
    process.exit(1);
  });
}
