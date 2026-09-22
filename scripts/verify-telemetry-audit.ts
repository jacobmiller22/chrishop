#!/usr/bin/env tsx
/**
 * ChrisShop Telemetry & Observability Gap Audit Verification Script
 *
 * Story 4.14 (#166): Telemetry & Observability Gap Audit
 *
 * Validates the completeness, schema adherence, and codebase alignment of
 * the telemetry audit catalog and gap remediation plan.
 *
 * Usage:
 *   pnpm run telemetry:verify
 *   tsx scripts/verify-telemetry-audit.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  AUDITED_TELEMETRY_SIGNALS,
  TELEMETRY_GAPS,
  TELEMETRY_TIERS,
  validateTelemetryAuditCatalog,
  type SystemTier,
} from '../apps/web/src/lib/telemetry-audit';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export async function verifyTelemetryAudit(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   📊 ChrisShop Telemetry & Observability Gap Audit Validator   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let allPassed = true;

  // 1. Programmatic Catalog Validation
  console.log(`${colors.bold}1. Audited Signal Catalog Integrity & Schema Check:${colors.reset}`);
  const catalogResult = validateTelemetryAuditCatalog();

  if (catalogResult.valid) {
    console.log(`  ✔ Master catalog schema valid (${colors.green}${catalogResult.totalSignals} signals cataloged${colors.reset})`);
    console.log(`    • Active:  ${colors.green}${catalogResult.activeCount}${colors.reset}`);
    console.log(`    • Partial: ${colors.yellow}${catalogResult.partialCount}${colors.reset}`);
    console.log(`    • Missing: ${colors.red}${catalogResult.missingCount}${colors.reset} (Identified Gaps)`);
  } else {
    console.log(`  ✖ Catalog validation failed with ${catalogResult.errors.length} errors:`);
    for (const err of catalogResult.errors) {
      console.log(`    - ${err}`);
    }
    allPassed = false;
  }

  // 2. System Tier Coverage Check (All 6 tiers)
  console.log(`\n${colors.bold}2. System Tier Observability Coverage:${colors.reset}`);
  const requiredTiers: SystemTier[] = [
    'edge-runtime',
    'storefront-app',
    'data-tier',
    'storage-tier',
    'third-party-integrations',
    'webhook-pipeline',
  ];

  for (const tierKey of requiredTiers) {
    const tierMeta = TELEMETRY_TIERS[tierKey];
    const count = catalogResult.tierCoverage[tierKey] || 0;
    if (count >= 3) {
      console.log(`  ✔ [${colors.green}${tierKey.padEnd(26)}${colors.reset}] ${count} signals cataloged — ${tierMeta.name}`);
    } else {
      console.log(`  ✖ [${colors.red}${tierKey.padEnd(26)}${colors.reset}] Insufficient signals (${count} < 3)`);
      allPassed = false;
    }
  }

  // 3. Gap Analysis & Follow-Up Issues Check
  console.log(`\n${colors.bold}3. Observability Gap Triage & Follow-Up GitHub Issues:${colors.reset}`);
  console.log(`  Total High-Priority Gaps Triaged: ${colors.cyan}${TELEMETRY_GAPS.length}${colors.reset}`);

  const expectedFollowUps = [330, 331, 332, 333, 334];
  const registeredFollowUps = new Set(TELEMETRY_GAPS.map((g) => g.followUpIssueId));

  for (const expectedId of expectedFollowUps) {
    if (registeredFollowUps.has(expectedId)) {
      const gap = TELEMETRY_GAPS.find((g) => g.followUpIssueId === expectedId);
      console.log(`  ✔ Linked Issue #${colors.green}${expectedId}${colors.reset}: ${gap?.title} [${gap?.tier}]`);
    } else {
      console.log(`  ✖ Missing follow-up issue assignment for #${expectedId}`);
      allPassed = false;
    }
  }

  // 4. Markdown Audit Documentation Verification
  console.log(`\n${colors.bold}4. Documentation Verification (docs/analysis/TELEMETRY_DATA_POINTS_AND_GAPS.md):${colors.reset}`);
  const docPath = path.resolve(process.cwd(), 'docs/analysis/TELEMETRY_DATA_POINTS_AND_GAPS.md');

  if (fs.existsSync(docPath)) {
    const docContent = fs.readFileSync(docPath, 'utf-8');
    console.log(`  ✔ Audit document exists: ${colors.dim}${docPath}${colors.reset}`);

    // Check required sections
    const requiredSections = [
      'Executive Summary & Audit Objectives',
      'Observability Topology Architecture',
      'Comprehensive Telemetry Audit Matrix',
      'In-Depth Observability Gap Analysis',
      'Shovel-Ready Follow-Up Action Matrix',
      'Continuous Verification & Audit Automation',
    ];

    for (const section of requiredSections) {
      if (docContent.includes(section)) {
        console.log(`  ✔ Contains section: "${colors.cyan}${section}${colors.reset}"`);
      } else {
        console.log(`  ✖ Missing section in document: "${section}"`);
        allPassed = false;
      }
    }

    // Check that all 5 follow-up issues are referenced in markdown
    for (const issueNum of expectedFollowUps) {
      if (docContent.includes(`#${issueNum}`)) {
        console.log(`  ✔ References follow-up issue #${colors.green}${issueNum}${colors.reset}`);
      } else {
        console.log(`  ✖ Document does not reference issue #${issueNum}`);
        allPassed = false;
      }
    }

    // Check Mermaid diagram syntax
    if (docContent.includes('```mermaid') && docContent.includes('flowchart')) {
      console.log(`  ✔ Architecture flow diagram embedded`);
    } else {
      console.log(`  ✖ Missing Mermaid architecture flow diagram`);
      allPassed = false;
    }
  } else {
    console.log(`  ✖ Documentation file not found at: ${docPath}`);
    allPassed = false;
  }

  // 5. Codebase Active Telemetry Implementation Verification
  console.log(`\n${colors.bold}5. Codebase Active Telemetry Implementation Verification:${colors.reset}`);
  const activeCodeFiles = [
    { file: 'apps/web/src/lib/health-monitoring.ts', check: 'performHealthCheck', label: 'Edge Health Synthetic Probes' },
    { file: 'apps/web/src/lib/sentry.ts', check: 'captureException', label: 'Sentry Runtime Error Tracking' },
    { file: 'apps/web/src/lib/better-stack.ts', check: 'getProductionMonitorConfig', label: 'Better Stack External Probing' },
    { file: 'apps/web/src/lib/edge-timeout.ts', check: 'generateTimeoutJsonResponse', label: 'Edge Timeout Watchdog' },
    { file: 'apps/web/src/lib/turnstile.ts', check: 'verifyTurnstileToken', label: 'Cloudflare Turnstile Bot Defense' },
    { file: 'apps/web/src/lib/order-consumer.ts', check: 'verifyShopifyWebhookHmacSubtle', label: 'Webhook HMAC Verification' },
    { file: 'apps/web/src/app/api/webhooks/shopify/route.ts', check: 'checkAndSetIdempotency', label: 'Workers KV Webhook Idempotency' },
  ];

  for (const item of activeCodeFiles) {
    const fullPath = path.resolve(process.cwd(), item.file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes(item.check)) {
        console.log(`  ✔ [${colors.green}ACTIVE${colors.reset}] ${item.label} in ${colors.dim}${item.file}${colors.reset}`);
      } else {
        console.log(`  ✖ Missing symbol "${item.check}" in ${item.file}`);
        allPassed = false;
      }
    } else {
      console.log(`  ✖ File not found: ${item.file}`);
      allPassed = false;
    }
  }

  // Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✔ ALL TELEMETRY AUDIT VERIFICATION GATES PASSED!${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}${colors.bold}✖ TELEMETRY AUDIT VERIFICATION FAILED — INSPECT ERRORS ABOVE.${colors.reset}\n`);
    return false;
  }
}

// Direct execution CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyTelemetryAudit().then((passed) => {
    process.exit(passed ? 0 : 1);
  }).catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}
