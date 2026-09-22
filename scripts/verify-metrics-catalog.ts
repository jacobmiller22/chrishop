#!/usr/bin/env tsx
/**
 * ChrisShop Metrics, Visualizations & Alerting Catalog Verification CLI
 *
 * Story 4.15 (#167): Metrics, Visualizations & Alerting Catalog Definition
 *
 * Usage:
 *   pnpm run metrics:verify
 *   tsx scripts/verify-metrics-catalog.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ENGINEERING_METRICS,
  CREATOR_METRICS,
  ALL_METRIC_DEFINITIONS,
  validateMetricsCatalog,
  type MetricSubsystem,
} from '../apps/web/src/lib/metrics-catalog';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export async function verifyMetricsCatalog(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   📈 ChrisShop Metrics, Visuals & Alerting Catalog Validator   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let allPassed = true;

  // 1. Programmatic Catalog Integrity Check
  console.log(`${colors.bold}1. Master Metrics Catalog Schema & Validation:${colors.reset}`);
  const result = validateMetricsCatalog();

  if (result.valid) {
    console.log(`  ✔ Catalog schema valid (${colors.green}${result.totalMetrics} metrics defined${colors.reset})`);
    console.log(`    • Engineering Metrics: ${colors.cyan}${result.engineeringCount}${colors.reset}`);
    console.log(`    • Creator Business KPIs: ${colors.cyan}${result.creatorCount}${colors.reset}`);
    console.log(`    • Critical (P1) Alerts:  ${colors.red}${result.criticalAlertCount}${colors.reset}`);
    console.log(`    • Warning (P2) Alerts:   ${colors.yellow}${result.warningAlertCount}${colors.reset}`);
    console.log(`    • Milestone (P3) Alerts: ${colors.green}${result.infoAlertCount}${colors.reset}`);
  } else {
    console.log(`  ✖ Catalog validation failed with ${result.errors.length} errors:`);
    for (const err of result.errors) {
      console.log(`    - ${err}`);
    }
    allPassed = false;
  }

  // 2. Engineering Operational Metrics Coverage
  console.log(`\n${colors.bold}2. Engineering Operational Subsystem Coverage:${colors.reset}`);
  const engSubsystems: MetricSubsystem[] = [
    'edge-performance',
    'data-storage',
    'reliability',
    'security',
  ];

  for (const sub of engSubsystems) {
    const metrics = ENGINEERING_METRICS.filter((m) => m.subsystem === sub);
    if (metrics.length >= 2) {
      console.log(`  ✔ [${colors.green}${sub.padEnd(20)}${colors.reset}] ${metrics.length} metrics defined`);
    } else {
      console.log(`  ✖ [${colors.red}${sub.padEnd(20)}${colors.reset}] Insufficient metrics (${metrics.length} < 2)`);
      allPassed = false;
    }
  }

  // 3. Creator Business KPI Coverage
  console.log(`\n${colors.bold}3. Creator Business KPI Subsystem Coverage:${colors.reset}`);
  const creatorSubsystems: MetricSubsystem[] = [
    'traffic',
    'funnel',
    'inventory',
    'revenue',
  ];

  for (const sub of creatorSubsystems) {
    const metrics = CREATOR_METRICS.filter((m) => m.subsystem === sub);
    if (metrics.length >= 2) {
      console.log(`  ✔ [${colors.green}${sub.padEnd(20)}${colors.reset}] ${metrics.length} metrics defined`);
    } else {
      console.log(`  ✖ [${colors.red}${sub.padEnd(20)}${colors.reset}] Insufficient metrics (${metrics.length} < 2)`);
      allPassed = false;
    }
  }

  // 4. Critical Alerting Rules Validation
  console.log(`\n${colors.bold}4. Critical Alerting Rules & Thresholds:${colors.reset}`);
  const criticalMetrics = ALL_METRIC_DEFINITIONS.filter((m) =>
    m.thresholds.some((t) => t.severity === 'critical')
  );

  for (const m of criticalMetrics) {
    const crit = m.thresholds.find((t) => t.severity === 'critical')!;
    console.log(
      `  ✔ [${colors.red}CRITICAL P1${colors.reset}] ${m.id.padEnd(30)} ${crit.operator} ${crit.thresholdValue}${m.unit} ➔ ${crit.channel} (${crit.message.slice(0, 45)}...)`
    );
  }

  // 5. Documentation Verification
  console.log(`\n${colors.bold}5. Specification Documentation Verification:${colors.reset}`);
  const docPath = path.resolve(process.cwd(), 'docs/analysis/METRICS_VISUALS_AND_ALERTS_CATALOG.md');

  if (fs.existsSync(docPath)) {
    const content = fs.readFileSync(docPath, 'utf-8');
    const requiredSections = [
      'Executive Summary & Persona Architecture',
      'Engineering & Operations Dashboard Specification',
      'Creator & Business Drop Performance Dashboard Specification',
      'Visual Widget & Chart Selection Taxonomy',
      'Unified Alerting Rules & Escalation Matrix',
      'Continuous Verification & Tooling',
    ];

    let missing = 0;
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        console.log(`  ✖ Missing section: "${section}"`);
        missing++;
        allPassed = false;
      }
    }

    if (missing === 0) {
      console.log(`  ✔ Document contains all ${requiredSections.length} required sections`);
      console.log(`  ✔ Includes both Jacob's Engineering view and Chris's Creator view layouts`);
    }
  } else {
    console.log(`  ✖ File not found: ${docPath}`);
    allPassed = false;
  }

  // Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✔ ALL METRICS, VISUALS & ALERTS CATALOG VERIFICATIONS PASSED!${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}${colors.bold}✖ VERIFICATION FAILED — PLEASE REVIEW THE LOGGED ERRORS.${colors.reset}\n`);
    return false;
  }
}

// Direct execution CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyMetricsCatalog().then((passed) => {
    process.exit(passed ? 0 : 1);
  }).catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}
