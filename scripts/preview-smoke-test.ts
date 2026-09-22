#!/usr/bin/env tsx
/**
 * ChrisShop Ephemeral Preview Smoke Test CLI
 *
 * Story 4.21 (#210): Cloudflare Browser Rendering Ephemeral Preview Smoke & Screen Tour Harness
 *
 * Runs edge-native smoke verification against deployed ephemeral PR previews,
 * staging, or local environments using Cloudflare Browser Rendering over CDP.
 *
 * Usage:
 *   pnpm run test:preview-smoke --url https://pr-123-chrishop.jacobmiller22.com
 *   pnpm run test:preview-smoke --env preview
 *   pnpm run test:preview-smoke --env local --mock
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  runPreviewSmokeSuite,
  type PreviewSmokeOptions,
  type CloudflareBrowserConfig,
} from '../apps/web/src/lib/browser-rendering';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  function getArgValue(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx < args.length - 1) {
      return args[idx + 1];
    }
    const prefix = `${flag}=`;
    const match = args.find((a) => a.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
  }

  const isMock = args.includes('--mock') || args.includes('--simulated');
  const noScreenshots = args.includes('--no-screenshots');
  const envTarget = getArgValue('--env') || 'preview';
  let targetUrl = getArgValue('--url');

  if (!targetUrl) {
    if (process.env.PREVIEW_URL) {
      targetUrl = process.env.PREVIEW_URL;
    } else if (envTarget === 'production') {
      targetUrl = 'https://chrishop.jacobmiller22.com';
    } else if (envTarget === 'staging') {
      targetUrl = 'https://staging.chrishop.jacobmiller22.com';
    } else if (envTarget === 'local') {
      targetUrl = 'http://localhost:3000';
    } else {
      const pr = process.env.PR_NUM || 'latest';
      targetUrl = `https://pr-${pr}-chrishop.jacobmiller22.com`;
    }
  }

  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🌐 Cloudflare Browser Rendering Ephemeral Preview Smoke      ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  console.log(`  • Target URL:     ${colors.bold}${targetUrl}${colors.reset}`);
  console.log(`  • Environment:    ${envTarget}`);
  console.log(`  • Mock Mode:      ${isMock ? 'YES' : 'AUTO'}`);
  console.log(`  • Screenshots:    ${noScreenshots ? 'OFF' : 'ON'}\n`);

  const config: CloudflareBrowserConfig = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
    mode: isMock ? 'simulated' : undefined,
  };

  const outputDir = path.resolve(process.cwd(), 'docs/demos/screenshots');

  const options: PreviewSmokeOptions = {
    targetUrl,
    outputDir,
    captureScreenshots: !noScreenshots && !isMock,
    config,
  };

  try {
    const summary = await runPreviewSmokeSuite(options);

    console.log(`${colors.bold}Smoke Test Execution Results (${summary.mode}):${colors.reset}`);
    for (const screen of summary.screens) {
      const statusIcon = screen.passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
      console.log(
        `  ${statusIcon} ${screen.name.padEnd(28)} | ${screen.route.padEnd(12)} | HTTP ${screen.status} ` +
        `| ${screen.durationMs}ms | ${screen.details || ''}`
      );
    }

    console.log(`\n  • Duration: ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`  • Overall Status: ${summary.passed ? `${colors.green}${colors.bold}PASSED${colors.reset}` : `${colors.red}${colors.bold}FAILED${colors.reset}`}`);

    // If running in GitHub Actions, append to GITHUB_STEP_SUMMARY
    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.summaryMarkdown + '\n');
      } catch (err) {
        console.warn(`Could not write to GITHUB_STEP_SUMMARY: ${(err as Error).message}`);
      }
    }

    if (!summary.passed) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n${colors.red}${colors.bold}✖ Preview smoke test execution failed:${colors.reset} ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
