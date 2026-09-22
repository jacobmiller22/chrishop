#!/usr/bin/env tsx
/**
 * ChrisShop Dashboard Architecture Evaluation Verification Script
 *
 * Story 4.16 (#168): Dashboard Architecture Spike — SaaS vs In-House vs Hybrid
 *
 * Verifies:
 * 1. Platform evaluation completeness across all 6 candidate platforms
 * 2. Persona requirement modeling for Jacob and Chris
 * 3. Cost calculation models and surge pricing resilience
 * 4. Hybrid Tri-Layer architecture specification
 * 5. 100% coverage of Story 4.15 metrics (12 engineering + 11 creator KPIs)
 * 6. Markdown Architectural Decision Record (ADR) completeness
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  PLATFORM_EVALUATIONS,
  PERSONA_REQUIREMENTS,
  HYBRID_LAYER_SPECS,
  calculateMonthlyCost,
  getArchitectureSpikeSummary,
  type PlatformId,
} from '../apps/web/src/lib/dashboard-architecture';
import {
  ENGINEERING_OPERATIONAL_METRICS,
  CREATOR_BUSINESS_METRICS,
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

function main(): void {
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   📊 ChrisShop Dashboard Architecture Spike Verification       ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let failures = 0;

  // 1. Candidate Platform Evaluations
  console.log(`${colors.bold}1. Candidate Platform Evaluations (6 Platforms):${colors.reset}`);
  const expectedPlatforms: PlatformId[] = [
    'datadog',
    'grafana_cloud',
    'better_stack',
    'cloudflare_native',
    'custom_in_house',
    'hybrid_recommended',
  ];

  for (const id of expectedPlatforms) {
    const platform = PLATFORM_EVALUATIONS[id];
    if (!platform) {
      console.error(`  ${colors.red}✖ Missing evaluation for platform:${colors.reset} ${id}`);
      failures++;
      continue;
    }

    if (!platform.name || !platform.category || platform.setupTimeHours <= 0) {
      console.error(`  ${colors.red}✖ Incomplete metadata for platform:${colors.reset} ${id}`);
      failures++;
    } else {
      console.log(
        `  ${colors.green}✔${colors.reset} [${platform.id}] ${colors.bold}${platform.name}${colors.reset} ` +
        `(${platform.category}) | Setup: ${platform.setupTimeHours}h | Jacob: ${platform.personaFitnessJacob}/10 | Chris: ${platform.personaFitnessChris}/10`
      );
    }
  }

  // 2. Persona Requirement Specifications
  console.log(`\n${colors.bold}2. Persona Requirement Specifications (Jacob vs Chris):${colors.reset}`);
  const personas = Object.keys(PERSONA_REQUIREMENTS) as ('engineering' | 'creator')[];
  if (personas.length !== 2) {
    console.error(`  ${colors.red}✖ Expected 2 personas, found ${personas.length}${colors.reset}`);
    failures++;
  }

  for (const p of personas) {
    const req = PERSONA_REQUIREMENTS[p];
    if (!req.primaryUser || req.keyGoals.length < 3 || !req.authMethod) {
      console.error(`  ${colors.red}✖ Deficient persona specification for:${colors.reset} ${p}`);
      failures++;
    } else {
      console.log(
        `  ${colors.green}✔${colors.reset} Persona: ${colors.bold}${req.persona.toUpperCase()}${colors.reset} ` +
        `(${req.primaryUser}) | Auth: ${req.authMethod.slice(0, 35)}... | Goals: ${req.keyGoals.length}`
      );
    }
  }

  // 3. Cost & Surge Simulation
  console.log(`\n${colors.bold}3. Cost & Surge Simulation (Baseline vs 1M Request Drop Spike):${colors.reset}`);
  const summary = getArchitectureSpikeSummary();

  for (const id of expectedPlatforms) {
    const baseline = summary.costComparison.lowVolumeMonthlyCostUsd[id];
    const spike = summary.costComparison.highVolumeDropSpikeCostUsd[id];
    console.log(
      `  • ${id.padEnd(20)} | Baseline: $${baseline.toFixed(2).padStart(6)}/mo | Drop Spike: $${spike.toFixed(2).padStart(7)}/mo`
    );
  }

  // Assert Datadog is much more expensive than Hybrid during drop spike
  const datadogSpike = summary.costComparison.highVolumeDropSpikeCostUsd['datadog'];
  const hybridSpike = summary.costComparison.highVolumeDropSpikeCostUsd['hybrid_recommended'];
  if (datadogSpike < 50 || hybridSpike > 1.0) {
    console.error(`  ${colors.red}✖ Cost surge calculations failed assertions (Datadog: $${datadogSpike}, Hybrid: $${hybridSpike})${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Surge pricing economics validated: Datadog ($${datadogSpike}) vs Hybrid ($${hybridSpike})`);
  }

  // 4. Hybrid Tri-Layer Specifications
  console.log(`\n${colors.bold}4. Hybrid Architecture Tri-Layer Specifications:${colors.reset}`);
  if (HYBRID_LAYER_SPECS.length !== 3) {
    console.error(`  ${colors.red}✖ Expected exactly 3 hybrid layers, found ${HYBRID_LAYER_SPECS.length}${colors.reset}`);
    failures++;
  }

  for (const layer of HYBRID_LAYER_SPECS) {
    console.log(
      `  ${colors.green}✔${colors.reset} Layer: ${colors.bold}${layer.layer}${colors.reset} ` +
      `(${layer.targetAudience}) | Target: ${layer.latencyTargetMs}ms | Route: ${layer.hostLocation} | Metrics: ${layer.metricIds.length}`
    );
  }

  // 5. Metric Catalog Coverage (Integration with Story 4.15)
  console.log(`\n${colors.bold}5. Metric Catalog Coverage (Story 4.15 Integration):${colors.reset}`);
  console.log(
    `  • Engineering Metrics: ${summary.metricsCoverage.engineeringMapped}/${summary.metricsCoverage.engineeringTotal} mapped`
  );
  console.log(
    `  • Creator Drop KPIs:   ${summary.metricsCoverage.creatorMapped}/${summary.metricsCoverage.creatorTotal} mapped`
  );

  if (summary.metricsCoverage.engineeringMapped !== summary.metricsCoverage.engineeringTotal) {
    console.error(`  ${colors.red}✖ Incomplete engineering metric coverage${colors.reset}`);
    failures++;
  }
  if (summary.metricsCoverage.creatorMapped !== summary.metricsCoverage.creatorTotal) {
    console.error(`  ${colors.red}✖ Incomplete creator metric coverage${colors.reset}`);
    failures++;
  }

  // 6. Architectural Decision Record (ADR) Document Validation
  console.log(`\n${colors.bold}6. Architectural Decision Record (ADR) Document Validation:${colors.reset}`);
  const adrPath = path.resolve(__dirname, '../docs/analysis/DASHBOARD_ARCHITECTURE_EVALUATION.md');
  if (!fs.existsSync(adrPath)) {
    console.error(`  ${colors.red}✖ ADR document missing at ${adrPath}${colors.reset}`);
    failures++;
  } else {
    const adrContent = fs.readFileSync(adrPath, 'utf8');
    const requiredSections = [
      '# Architectural Decision Record',
      'Executive Summary & Decision',
      'Problem Statement & Operational Personas',
      'Platform Comparison Matrix',
      'Deep-Dive Trade-Off Analysis',
      'Detailed Architecture Specification: The 3 Layers',
      'Implementation Roadmap & Backlog Recommendations',
      'Acceptance Criteria Verification',
    ];

    let missingSections = 0;
    for (const section of requiredSections) {
      if (!adrContent.includes(section)) {
        console.error(`  ${colors.red}✖ ADR missing required section: "${section}"${colors.reset}`);
        missingSections++;
      }
    }

    if (missingSections === 0) {
      console.log(`  ${colors.green}✔${colors.reset} ADR markdown document structurally verified (${adrContent.length} bytes, all sections present).`);
    } else {
      failures += missingSections;
    }
  }

  // Final Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (failures > 0) {
    console.error(`${colors.red}${colors.bold}✖ Verification failed with ${failures} error(s).${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✔ ALL DASHBOARD ARCHITECTURE VERIFICATION CHECKS PASSED!${colors.reset}\n`);
    process.exit(0);
  }
}

main();
