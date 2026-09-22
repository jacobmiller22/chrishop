#!/usr/bin/env tsx
/**
 * Verification Script: Cloudflare Browser Rendering Ephemeral Preview Smoke Harness
 *
 * Story 4.21 (#210): Cloudflare Browser Rendering Ephemeral Preview Smoke & Screen Tour Harness
 *
 * Verifies:
 * 1. Remote CDP WebSocket endpoint generation
 * 2. Cloudflare Access Zero Trust Service Token header compilation
 * 3. Ephemeral preview smoke assertion engine execution
 * 4. Markdown summary formatter and performance timing capture
 * 5. CI/CD integration in .github/workflows/preview-deploy.yml
 * 6. Package.json script registration
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildCloudflareCdpUrl,
  buildBrowserHeaders,
  runPreviewSmokeSuite,
  formatSmokeSummaryMarkdown,
  type CloudflareBrowserConfig,
  type SmokeScreenResult,
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
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🌐 Cloudflare Browser Rendering Preview Smoke Verification   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let failures = 0;

  // 1. Remote CDP URL Construction
  console.log(`${colors.bold}1. Remote CDP WebSocket URL Construction:${colors.reset}`);
  const testAccount = 'cf-acc-12345';
  const cdpUrl = buildCloudflareCdpUrl(testAccount, 300000);
  const expectedPrefix = `wss://api.cloudflare.com/client/v4/accounts/${testAccount}/browser-rendering/devtools/browser?keep_alive=300000`;
  if (cdpUrl !== expectedPrefix) {
    console.error(`  ${colors.red}✖ Incorrect CDP URL: ${cdpUrl}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} CDP WebSocket URL validated: ${cdpUrl}`);
  }

  // 2. Cloudflare Access Headers Compilation
  console.log(`\n${colors.bold}2. Cloudflare Access Zero Trust Headers Compilation:${colors.reset}`);
  const config: CloudflareBrowserConfig = {
    apiToken: 'test-cf-token',
    cfAccessClientId: 'access-client-id-123',
    cfAccessClientSecret: 'access-client-secret-xyz',
  };
  const headers = buildBrowserHeaders(config);

  if (
    headers['Authorization'] !== 'Bearer test-cf-token' ||
    headers['CF-Access-Client-Id'] !== 'access-client-id-123' ||
    headers['CF-Access-Client-Secret'] !== 'access-client-secret-xyz'
  ) {
    console.error(`  ${colors.red}✖ Malformed browser headers:${colors.reset}`, headers);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Authorization and CF-Access headers verified.`);
  }

  // 3. Smoke Suite Execution in Simulated Mode
  console.log(`\n${colors.bold}3. Ephemeral Preview Smoke Suite Execution (Simulated Mode):${colors.reset}`);
  try {
    const summary = await runPreviewSmokeSuite({
      targetUrl: 'https://preview-smoke-test.local',
      config: { mode: 'simulated' },
    });

    console.log(`  • Execution Mode:   ${summary.mode}`);
    console.log(`  • Total Duration:   ${summary.totalDurationMs}ms`);
    console.log(`  • Screens Audited:  ${summary.screens.length}`);

    if (summary.screens.length !== 3) {
      console.error(`  ${colors.red}✖ Expected 3 audited screens, found ${summary.screens.length}${colors.reset}`);
      failures++;
    } else {
      console.log(`  ${colors.green}✔${colors.reset} All 3 core routes (Storefront, Admin, Health) evaluated.`);
    }

    const screenNames = summary.screens.map((s) => s.name);
    if (
      !screenNames.includes('Storefront Home') ||
      !screenNames.includes('Payload Admin Portal') ||
      !screenNames.includes('Edge Health Synthetic Probe')
    ) {
      console.error(`  ${colors.red}✖ Missing expected screen names in summary${colors.reset}`);
      failures++;
    } else {
      console.log(`  ${colors.green}✔${colors.reset} Screen names conform to specifications.`);
    }
  } catch (err) {
    console.error(`  ${colors.red}✖ Smoke suite threw unexpected error:${colors.reset} ${(err as Error).message}`);
    failures++;
  }

  // 4. Markdown Formatter Integrity
  console.log(`\n${colors.bold}4. Markdown Summary Formatter Integrity:${colors.reset}`);
  const sampleScreens: SmokeScreenResult[] = [
    { name: 'Storefront Home', route: '/', status: 200, passed: true, durationMs: 450, metrics: { lcpMs: 520, domReadyMs: 380 } },
    { name: 'Payload Admin', route: '/admin', status: 200, passed: true, durationMs: 620, metrics: { lcpMs: 710, domReadyMs: 510 } },
  ];
  const markdown = formatSmokeSummaryMarkdown('https://pr-99.chrishop.com', 'remote_cdp', sampleScreens, 1070, true);
  if (!markdown.includes('### ✔ Ephemeral Preview Smoke') || !markdown.includes('https://pr-99.chrishop.com')) {
    console.error(`  ${colors.red}✖ Markdown summary missing expected title or target URL${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Markdown summary table formatted successfully (${markdown.length} bytes).`);
  }

  // 5. GitHub Actions Workflow Integration
  console.log(`\n${colors.bold}5. GitHub Actions Workflow Integration (.github/workflows/preview-deploy.yml):${colors.reset}`);
  const wfPath = path.resolve(__dirname, '../.github/workflows/preview-deploy.yml');
  if (!fs.existsSync(wfPath)) {
    console.error(`  ${colors.red}✖ Workflow file missing at ${wfPath}${colors.reset}`);
    failures++;
  } else {
    const wfContent = fs.readFileSync(wfPath, 'utf8');
    if (!wfContent.includes('Run Cloudflare Browser Rendering Ephemeral Preview Smoke')) {
      console.error(`  ${colors.red}✖ Workflow missing browser rendering smoke step${colors.reset}`);
      failures++;
    } else if (!wfContent.includes('pnpm run test:preview-smoke')) {
      console.error(`  ${colors.red}✖ Workflow does not invoke test:preview-smoke command${colors.reset}`);
      failures++;
    } else {
      console.log(`  ${colors.green}✔${colors.reset} preview-deploy.yml contains browser rendering smoke step and test:preview-smoke invocation.`);
    }
  }

  // 6. Package.json Script Verification
  console.log(`\n${colors.bold}6. Root package.json Script Registration:${colors.reset}`);
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.scripts['test:preview-smoke']) {
    console.error(`  ${colors.red}✖ package.json missing "test:preview-smoke" script${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} package.json contains "test:preview-smoke": "${pkg.scripts['test:preview-smoke']}"`);
  }

  // Final Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (failures > 0) {
    console.error(`${colors.red}${colors.bold}✖ Verification failed with ${failures} error(s).${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✔ ALL CLOUDFLARE BROWSER RENDERING VERIFICATION CHECKS PASSED!${colors.reset}\n`);
    process.exit(0);
  }
}

main();
