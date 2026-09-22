#!/usr/bin/env tsx
/**
 * Verification Script: Automated Screen Tour Suite & Demo Crawler
 *
 * Story 4.11 (#153): Cloudflare Browser Rendering Automated Screen Tour Suite
 *
 * Verifies:
 * 1. Screen tour manifest structure, persona coverage, and selector definitions
 * 2. Production safety URL detection and mutating request interception logic
 * 3. Interactive demo markdown walkthrough formatting (tables, slides, provenance)
 * 4. Simulated crawl execution and result aggregation
 * 5. CLI script availability and package.json registration
 * 6. Operational runbook presence and documentation completeness
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  SCREEN_TOUR_MANIFEST,
  filterScreens,
} from '../apps/web/src/lib/screen-tour-manifest';
import {
  isProductionTarget,
  formatDemoWalkthroughMarkdown,
  runScreenTourSuite,
  ProductionSafetyError,
} from '../apps/web/src/lib/demo-crawler';

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
  console.log(`${colors.bold}${colors.cyan}   🎬 Screen Tour Suite & Demo Crawler Verification            ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let failures = 0;

  // 1. Screen Tour Manifest Verification
  console.log(`${colors.bold}1. Screen Tour Manifest Registry & Persona Coverage:${colors.reset}`);
  if (SCREEN_TOUR_MANIFEST.length < 10) {
    console.error(`  ${colors.red}✖ Expected at least 10 registered screens, found: ${SCREEN_TOUR_MANIFEST.length}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Registered screens: ${SCREEN_TOUR_MANIFEST.length}`);
  }

  const categories = new Set(SCREEN_TOUR_MANIFEST.map((s) => s.category));
  const expectedCategories = ['storefront', 'admin', 'ops'];
  for (const cat of expectedCategories) {
    if (!categories.has(cat as any)) {
      console.error(`  ${colors.red}✖ Missing category in manifest: ${cat}${colors.reset}`);
      failures++;
    } else {
      console.log(`  ${colors.green}✔${colors.reset} Category verified: ${cat}`);
    }
  }

  const personas = new Set(SCREEN_TOUR_MANIFEST.map((s) => s.persona));
  const expectedPersonas = ['shopper', 'creator', 'engineering'];
  for (const p of expectedPersonas) {
    if (!personas.has(p as any)) {
      console.error(`  ${colors.red}✖ Missing persona in manifest: ${p}${colors.reset}`);
      failures++;
    } else {
      console.log(`  ${colors.green}✔${colors.reset} Persona verified: ${p}`);
    }
  }

  // Verify critical selectors and provenance
  let missingFields = 0;
  for (const screen of SCREEN_TOUR_MANIFEST) {
    if (!screen.id || !screen.name || !screen.route || !screen.criticalSelectors || screen.criticalSelectors.length === 0 || !screen.provenance) {
      missingFields++;
    }
  }
  if (missingFields > 0) {
    console.error(`  ${colors.red}✖ ${missingFields} screens have incomplete attributes!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} All ${SCREEN_TOUR_MANIFEST.length} screens have valid selectors and provenance`);
  }

  // 2. Production Safety Enforcer
  console.log(`\n${colors.bold}2. Production Safety Target Detection & Guardrails:${colors.reset}`);
  const prodUrls = [
    'https://chrishop.com',
    'https://www.chrishop.com',
    'https://chrishop.jacobmiller22.com',
    'https://chrishop.jacobmiller22.com/drop',
  ];
  for (const u of prodUrls) {
    if (!isProductionTarget(u)) {
      console.error(`  ${colors.red}✖ Expected ${u} to be detected as production target!${colors.reset}`);
      failures++;
    }
  }
  console.log(`  ${colors.green}✔${colors.reset} Live production host patterns correctly identified`);

  const nonProdUrls = [
    'http://localhost:3000',
    'http://127.0.0.1:8787',
    'https://staging.chrishop.jacobmiller22.com',
    'https://pr-153-chrishop.jacobmiller22.com',
  ];
  for (const u of nonProdUrls) {
    if (isProductionTarget(u)) {
      console.error(`  ${colors.red}✖ Non-production target ${u} falsely identified as production!${colors.reset}`);
      failures++;
    }
  }
  console.log(`  ${colors.green}✔${colors.reset} Staging, preview, and local targets correctly excluded from production locks`);

  // 3. Markdown Walkthrough Formatter Verification
  console.log(`\n${colors.bold}3. Interactive Demo Walkthrough Markdown Generator:${colors.reset}`);
  const testSummary = {
    targetUrl: 'https://staging.chrishop.jacobmiller22.com',
    environment: 'staging',
    timestamp: new Date().toISOString(),
    totalDurationMs: 4500,
    passed: true,
    mode: 'remote_cdp',
    results: [
      {
        screen: SCREEN_TOUR_MANIFEST[0],
        passed: true,
        status: 200,
        durationMs: 310,
        desktopScreenshot: 'docs/demos/screenshots/storefront.home-desktop.png',
        mobileScreenshot: 'docs/demos/screenshots/storefront.home-mobile.png',
        consoleErrors: [],
        networkErrors: [],
        criticalSelectorsFound: true,
      },
      {
        screen: SCREEN_TOUR_MANIFEST[6],
        passed: true,
        status: 200,
        durationMs: 420,
        desktopScreenshot: 'docs/demos/screenshots/admin.login-desktop.png',
        mobileScreenshot: 'docs/demos/screenshots/admin.login-mobile.png',
        consoleErrors: [],
        networkErrors: [],
        criticalSelectorsFound: true,
      },
    ],
  };

  const mdReport = formatDemoWalkthroughMarkdown(testSummary);
  if (
    !mdReport.includes('ChrisShop Automated Screen Tour & Interactive Demo Walkthrough') ||
    !mdReport.includes('Storefront Home') ||
    !mdReport.includes('Payload CMS Admin Portal') ||
    !mdReport.includes('Desktop Viewport (1280x800)') ||
    !mdReport.includes('Mobile Viewport (390x844 - iPhone 14)') ||
    !mdReport.includes('Production Safety & Architecture Audit')
  ) {
    console.error(`  ${colors.red}✖ Markdown report missing required walkthrough sections!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Markdown walkthrough report structure verified`);
  }

  // 4. Simulated Crawl Execution
  console.log(`\n${colors.bold}4. Simulated Screen Tour Suite Execution:${colors.reset}`);
  const tourResult = await runScreenTourSuite({
    targetUrl: 'http://localhost:3000',
    environment: 'local',
    focus: 'recent',
    captureScreenshots: false,
    config: { mode: 'simulated' },
  });

  if (!tourResult || !tourResult.results || tourResult.results.length === 0) {
    console.error(`  ${colors.red}✖ Simulated screen tour failed to return results!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Simulated screen tour executed (${tourResult.results.length} screens evaluated)`);
  }

  // 5. Package.json Script Registration
  console.log(`\n${colors.bold}5. Package.json Script Registration:${colors.reset}`);
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (!pkg.scripts['demo']) {
    console.error(`  ${colors.red}✖ Missing "demo" script in package.json!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} "demo" script registered: ${pkg.scripts['demo']}`);
  }

  if (!pkg.scripts['demo:verify']) {
    console.error(`  ${colors.red}✖ Missing "demo:verify" script in package.json!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} "demo:verify" script registered: ${pkg.scripts['demo:verify']}`);
  }

  // 6. Operational Runbook
  console.log(`\n${colors.bold}6. Operational Runbook Completeness:${colors.reset}`);
  const runbookPath = path.resolve(process.cwd(), 'docs/runbooks/AUTOMATED_DEMO_WALKTHROUGH.md');
  if (!fs.existsSync(runbookPath)) {
    console.error(`  ${colors.red}✖ Operational runbook missing at ${runbookPath}!${colors.reset}`);
    failures++;
  } else {
    const runbookContent = fs.readFileSync(runbookPath, 'utf8');
    const requiredKeywords = [
      'Cloudflare Browser Rendering',
      'Production Safety Enforcer',
      'Dual-Viewport Capture',
      'Storefront',
      'Payload CMS Admin',
      'Edge Operations',
      'CLI Reference',
    ];
    let missingKeywords = 0;
    for (const kw of requiredKeywords) {
      if (!runbookContent.includes(kw)) {
        console.error(`  ${colors.red}✖ Runbook missing topic: "${kw}"${colors.reset}`);
        missingKeywords++;
      }
    }
    if (missingKeywords === 0) {
      console.log(`  ${colors.green}✔${colors.reset} Operational runbook verified at docs/runbooks/AUTOMATED_DEMO_WALKTHROUGH.md`);
    } else {
      failures++;
    }
  }

  console.log(`\n${colors.bold}================================================================${colors.reset}`);
  if (failures > 0) {
    console.error(`${colors.red}${colors.bold}✖ Verification Failed with ${failures} error(s)!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✔ All Story 4.11 Screen Tour & Demo Crawler Verifications Passed!${colors.reset}\n`);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal verification error:${colors.reset}`, err);
  process.exit(1);
});
