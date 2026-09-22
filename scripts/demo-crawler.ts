#!/usr/bin/env tsx
/**
 * ChrisShop Automated Screen Tour & Interactive Demo Walkthrough CLI
 *
 * Story 4.11 (#153): Cloudflare Browser Rendering Automated Screen Tour Suite
 *
 * Traverses core routes across Storefront, Payload CMS Admin, and Edge Operations,
 * capturing dual-viewport screenshots (Desktop & Mobile) via Cloudflare Browser
 * Rendering over CDP and generating an interactive demo report in docs/demos/DEMO_LATEST.md.
 *
 * Usage:
 *   pnpm run demo --env local --mock
 *   pnpm run demo --url https://staging.chrishop.jacobmiller22.com --focus storefront
 *   pnpm run demo --url https://chrishop.com --read-only
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  runScreenTourSuite,
  type ScreenTourOptions,
} from '../apps/web/src/lib/demo-crawler';
import { SCREEN_TOUR_MANIFEST } from '../apps/web/src/lib/screen-tour-manifest';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m',
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
  const isReadOnly = args.includes('--read-only');
  const noScreenshots = args.includes('--no-screenshots');
  const envTarget = (getArgValue('--env') || 'local') as 'local' | 'preview' | 'staging' | 'production';
  const focus = (getArgValue('--focus') || 'all') as 'all' | 'storefront' | 'admin' | 'ops' | 'recent';
  const reportOut = getArgValue('--out') || path.resolve(process.cwd(), 'docs/demos/DEMO_LATEST.md');
  const screenshotsDir = getArgValue('--output-dir') || path.resolve(process.cwd(), 'docs/demos/screenshots');

  let targetUrl = getArgValue('--url');
  if (!targetUrl) {
    if (process.env.PREVIEW_URL) {
      targetUrl = process.env.PREVIEW_URL;
    } else if (envTarget === 'production') {
      targetUrl = 'https://chrishop.jacobmiller22.com';
    } else if (envTarget === 'staging') {
      targetUrl = 'https://staging.chrishop.jacobmiller22.com';
    } else {
      targetUrl = 'http://localhost:3000';
    }
  }

  console.log(`${colors.bold}${colors.magenta}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}   🎬 ChrisShop Automated Screen Tour & Interactive Demo       ${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}================================================================${colors.reset}`);
  console.log(`Target URL:     ${colors.cyan}${targetUrl}${colors.reset}`);
  console.log(`Environment:    ${colors.yellow}${envTarget}${colors.reset}`);
  console.log(`Focus Area:     ${colors.bold}${focus}${colors.reset}`);
  console.log(`Safety Mode:    ${isReadOnly ? colors.green + 'STRICT READ-ONLY' : colors.dim + 'STANDARD'}${colors.reset}`);
  console.log(`Screenshots:    ${!noScreenshots ? colors.green + 'ENABLED' : colors.dim + 'DISABLED'}${colors.reset}`);
  console.log(`Manifest Count: ${colors.bold}${SCREEN_TOUR_MANIFEST.length} registered screens${colors.reset}\n`);

  const tourOptions: ScreenTourOptions = {
    targetUrl,
    environment: envTarget,
    focus,
    readOnly: isReadOnly,
    captureScreenshots: !noScreenshots && !isMock,
    outputDir: screenshotsDir,
    config: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
      cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
      headless: true,
      mode: isMock ? 'simulated' : undefined,
    },
  };

  const startTime = Date.now();
  const summary = await runScreenTourSuite(tourOptions);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // Write Markdown Report
  const outDir = path.dirname(reportOut);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(reportOut, summary.markdownReport, 'utf8');

  console.log(`\n${colors.bold}Screen Tour Results Summary (${elapsed}s elapsed):${colors.reset}`);
  console.log(`Mode: ${colors.cyan}${summary.mode}${colors.reset}`);

  for (const r of summary.results) {
    const icon = r.passed ? `${colors.green}✔ PASS` : `${colors.red}✖ FAIL`;
    const details = r.details || (r.passed ? 'Healthy' : 'Errors detected');
    console.log(`  ${icon}${colors.reset} [${r.screen.persona.toUpperCase()}] ${colors.bold}${r.screen.name}${colors.reset} (${r.screen.route}) - HTTP ${r.status} (${r.durationMs}ms) - ${details}`);
    if (r.consoleErrors.length > 0) {
      console.log(`     ${colors.yellow}Console Errors: ${r.consoleErrors.join(', ')}${colors.reset}`);
    }
  }

  console.log(`\n${colors.bold}Interactive Walkthrough Artifact Written:${colors.reset} ${reportOut}`);

  if (!summary.passed && !isMock) {
    console.error(`\n${colors.red}${colors.bold}✖ Tour failed: One or more screen assertions failed!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}✔ Screen Tour & Interactive Demo Walkthrough successfully completed!${colors.reset}\n`);
  }
}

main().catch((err) => {
  console.error(`\n${colors.red}${colors.bold}Fatal Demo Crawler Error:${colors.reset}`, err);
  process.exit(1);
});
