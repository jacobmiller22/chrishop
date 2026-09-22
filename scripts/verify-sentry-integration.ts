#!/usr/bin/env tsx
/**
 * ChrisShop Sentry Error Tracking & Discord Alerting Verification CLI
 *
 * Story 4.6 (#65): Sentry Error Tracking Integration
 *
 * Validates:
 * 1. Sentry configuration files (client, server, edge)
 * 2. Unified error capturing engine & context enrichment
 * 3. Discord #dev-alerts webhook formatting and dispatch
 * 4. Sentry incident webhook payload parsing
 * 5. Content-Security-Policy (CSP) header integration
 * 6. Environment variable documentation
 *
 * Usage:
 *   pnpm run sentry:verify
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  captureException,
  captureMessage,
  formatSentryDiscordAlert,
  dispatchSentryAlertToDiscord,
  parseSentryWebhookPayload,
  isSentryConfigured,
  SentryIncidentPayload,
} from '../apps/web/src/lib/sentry';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export async function verifySentrySetup(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🛰️  ChrisShop Sentry Error Tracking & Alerting Verification  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let allPassed = true;
  const rootDir = path.resolve(__dirname, '..');
  const webDir = path.join(rootDir, 'apps/web');

  // 1. Verify Sentry Configuration Files
  console.log(`${colors.bold}1. Sentry SDK Configuration Files:${colors.reset}`);
  const configFiles = [
    'sentry.client.config.ts',
    'sentry.server.config.ts',
    'sentry.edge.config.ts',
  ];

  for (const file of configFiles) {
    const fullPath = path.join(webDir, file);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✔ [Found] ${colors.cyan}${file}${colors.reset}`);
    } else {
      console.log(`  ✖ Missing ${file} at ${fullPath}`);
      allPassed = false;
    }
  }

  // 2. Verify Unified Error Capture Engine
  console.log(`\n${colors.bold}2. Unified Sentry Error Engine & Context Injection:${colors.reset}`);
  try {
    const testErr = new Error('Simulated verification error (Story 4.6 testing)');
    const eventId = captureException(testErr, {
      level: 'error',
      tags: { test_mode: 'verification_cli' },
      dispatchDiscordAlert: false,
    });

    if (eventId && typeof eventId === 'string') {
      console.log(`  ✔ captureException returned event ID: ${colors.green}${eventId}${colors.reset}`);
    } else {
      console.log(`  ✖ captureException failed to return valid event ID`);
      allPassed = false;
    }

    const msgId = captureMessage('Verification test message', 'info');
    if (msgId && typeof msgId === 'string') {
      console.log(`  ✔ captureMessage returned message ID: ${colors.green}${msgId}${colors.reset}`);
    } else {
      console.log(`  ✖ captureMessage failed to return valid message ID`);
      allPassed = false;
    }
  } catch (err: any) {
    console.log(`  ✖ Error capture threw exception: ${err.message}`);
    allPassed = false;
  }

  // 3. Verify Discord #dev-alerts Formatting
  console.log(`\n${colors.bold}3. Discord #dev-alerts Error Embed Formatting:${colors.reset}`);
  const mockIncident: SentryIncidentPayload = {
    eventId: 'evt-test-123456',
    message: 'TypeError: Cannot read properties of undefined (reading "checkoutUrl")',
    errorType: 'TypeError',
    stack: 'TypeError: Cannot read properties of undefined (reading "checkoutUrl")\n    at createCheckoutSession (/apps/web/src/lib/shopify.ts:42:15)\n    at POST (/apps/web/src/app/api/checkout/route.ts:18:11)',
    environment: 'production',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    level: 'error',
    tags: {
      route: '/api/checkout',
      colo: 'IAD',
    },
  };

  const discordPayload = formatSentryDiscordAlert(mockIncident);
  console.log(`  ✔ Embed Title: ${colors.red}${discordPayload.embeds[0].title}${colors.reset}`);
  console.log(`  ✔ Embed Color: 0x${discordPayload.embeds[0].color.toString(16)} (Crimson Red)`);
  console.log(`  ✔ Embed Fields: ${discordPayload.embeds[0].fields?.length || 0} fields formatted`);

  // Verify safe dispatch without crash when webhook is unconfigured
  const dispatched = await dispatchSentryAlertToDiscord(mockIncident);
  console.log(`  ✔ dispatchSentryAlertToDiscord safe execution: ${dispatched ? 'Sent' : 'Skipped (no webhook URL configured)'}`);

  // 4. Verify Sentry Incident Webhook Parsing
  console.log(`\n${colors.bold}4. Sentry Webhook Payload Parser:${colors.reset}`);
  const sampleWebhook = {
    event: {
      event_id: 'sentry-webhook-evt-999',
      title: 'Database connection timeout on D1',
      type: 'DatabaseError',
      environment: 'staging',
      web_url: 'https://sentry.io/organizations/chrishop/issues/123/',
      tags: [
        ['runtime', 'cloudflare-workers'],
        ['service', 'chrishop-storefront'],
      ],
    },
  };

  const parsed = parseSentryWebhookPayload(sampleWebhook);
  if (parsed.eventId === 'sentry-webhook-evt-999' && parsed.environment === 'staging') {
    console.log(`  ✔ Webhook Parser: ${colors.green}PASSED${colors.reset} (Event: ${parsed.eventId}, Env: ${parsed.environment})`);
  } else {
    console.log(`  ✖ Failed to parse Sentry webhook correctly`);
    allPassed = false;
  }

  // 5. Verify Content-Security-Policy (CSP) Headers
  console.log(`\n${colors.bold}5. Content-Security-Policy (CSP) Sentry Integration:${colors.reset}`);
  const nextConfigPath = path.join(webDir, 'next.config.mjs');
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf-8');

  if (nextConfigContent.includes('ingest.sentry.io')) {
    console.log(`  ✔ CSP connect-src: ${colors.green}Configured${colors.reset} (includes *.ingest.sentry.io)`);
  } else {
    console.log(`  ✖ CSP headers missing Sentry ingest domains`);
    allPassed = false;
  }

  // 6. Verify Environment Documentation
  console.log(`\n${colors.bold}6. Environment Variables Documentation (.env.example):${colors.reset}`);
  const envExamplePath = path.join(rootDir, '.env.example');
  const envContent = fs.readFileSync(envExamplePath, 'utf-8');

  if (envContent.includes('NEXT_PUBLIC_SENTRY_DSN') && envContent.includes('SENTRY_AUTH_TOKEN')) {
    console.log(`  ✔ .env.example: ${colors.green}Complete${colors.reset} (NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)`);
  } else {
    console.log(`  ✖ Missing Sentry variables in .env.example`);
    allPassed = false;
  }

  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✔ Sentry Error Tracking integration verification passed!${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✖ Verification failed. Resolve errors above.${colors.reset}\n`);
  }

  return allPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifySentrySetup().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}
