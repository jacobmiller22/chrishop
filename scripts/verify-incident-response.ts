#!/usr/bin/env tsx
/**
 * ChrisShop Incident Response & On-Call Paging Verification Script
 *
 * Story 4.17 (#169): Incident Response & On-Call Paging Spike
 *
 * Verifies:
 * 1. Alert condition definitions across P0, P1, and P2 severity tiers
 * 2. Automated evaluation engine with multi-scenario telemetry snapshots
 * 3. Payload compilation for Voice, SMS, and Discord channels
 * 4. Comparative evaluation report integrity (docs/analysis/ONCALL_PAGING_EVALUATION.md)
 * 5. Turnkey incident response runbook integrity (docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  INCIDENT_ALERT_RULES,
  evaluateTelemetrySnapshot,
  compilePagingPayload,
  type TelemetrySignalSnapshot,
} from '../apps/web/src/lib/incident-response';

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
  console.log(`${colors.bold}${colors.cyan}   🚨 ChrisShop Incident Response & On-Call Verification         ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let failures = 0;

  // 1. Canonical Alert Rules
  console.log(`${colors.bold}1. Canonical Alert Rules & Severity Tiers:${colors.reset}`);
  const p0Rules = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P0_CRITICAL');
  const p1Rules = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P1_HIGH');
  const p2Rules = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P2_WARNING');

  console.log(`  • P0 (Critical - Voice/SMS Paging): ${p0Rules.length} rules defined`);
  console.log(`  • P1 (High - Urgent Push & Discord): ${p1Rules.length} rules defined`);
  console.log(`  • P2 (Warning - Passive Discord):    ${p2Rules.length} rules defined`);

  if (p0Rules.length < 4 || p1Rules.length < 3 || p2Rules.length < 2) {
    console.error(`  ${colors.red}✖ Deficient rule count across severity tiers${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} All severity tiers have sufficient rule coverage.`);
  }

  for (const rule of INCIDENT_ALERT_RULES) {
    if (!rule.id || !rule.name || !rule.remedyAction || rule.channels.length === 0) {
      console.error(`  ${colors.red}✖ Malformed alert rule: ${rule.id}${colors.reset}`);
      failures++;
    }
  }

  // 2. Telemetry Evaluation Simulation Drills
  console.log(`\n${colors.bold}2. Telemetry Evaluation Simulation Drills:${colors.reset}`);

  // Drill A: Nominal / Healthy System
  const healthySnapshot: TelemetrySignalSnapshot = {
    edge5xxRatePercent: 0.05,
    apiHealthFailingConsecutiveCycles: 0,
    shopifyCheckoutFailures: 0,
    d1ErrorsCount: 0,
    edgeLatencyP99Ms: 250,
    webhookQueueBacklog: 2,
    wafBlockRatePercent: 1.2,
    sentryUnresolvedErrors: 1,
    kvCacheHitRatioPercent: 94.5,
  };
  const healthyResult = evaluateTelemetrySnapshot(healthySnapshot);
  if (healthyResult.triggeredSeverity !== null || healthyResult.triggeredAlerts.length !== 0) {
    console.error(`  ${colors.red}✖ Healthy snapshot triggered false positive alert${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Drill A: Healthy Snapshot → Nominal state (0 alerts triggered).`);
  }

  // Drill B: P0 Critical - 5xx Spike & Health Failure
  const p0Snapshot: TelemetrySignalSnapshot = {
    ...healthySnapshot,
    edge5xxRatePercent: 3.2,
    apiHealthFailingConsecutiveCycles: 2,
  };
  const p0Result = evaluateTelemetrySnapshot(p0Snapshot);
  if (
    p0Result.triggeredSeverity !== 'P0_CRITICAL' ||
    !p0Result.channelsToNotify.includes('voice_call') ||
    !p0Result.channelsToNotify.includes('sms')
  ) {
    console.error(`  ${colors.red}✖ P0 snapshot failed to trigger Voice/SMS paging${colors.reset}`);
    failures++;
  } else {
    console.log(
      `  ${colors.green}✔${colors.reset} Drill B: P0 5xx Spike Snapshot → Triggered ${p0Result.triggeredSeverity} ` +
      `(${p0Result.triggeredAlerts.length} rules, Channels: ${p0Result.channelsToNotify.join(', ')})`
    );
  }

  // Drill C: P1 High - Latency Degradation
  const p1Snapshot: TelemetrySignalSnapshot = {
    ...healthySnapshot,
    edgeLatencyP99Ms: 2450,
    webhookQueueBacklog: 75,
  };
  const p1Result = evaluateTelemetrySnapshot(p1Snapshot);
  if (
    p1Result.triggeredSeverity !== 'P1_HIGH' ||
    !p1Result.channelsToNotify.includes('urgent_push') ||
    p1Result.channelsToNotify.includes('voice_call')
  ) {
    console.error(`  ${colors.red}✖ P1 snapshot failed expected push/discord channels${colors.reset}`);
    failures++;
  } else {
    console.log(
      `  ${colors.green}✔${colors.reset} Drill C: P1 Latency Degradation → Triggered ${p1Result.triggeredSeverity} ` +
      `(${p1Result.triggeredAlerts.length} rules, Channels: ${p1Result.channelsToNotify.join(', ')})`
    );
  }

  // Drill D: P2 Warning - Cache Hit Depletion
  const p2Snapshot: TelemetrySignalSnapshot = {
    ...healthySnapshot,
    kvCacheHitRatioPercent: 58.0,
  };
  const p2Result = evaluateTelemetrySnapshot(p2Snapshot);
  if (
    p2Result.triggeredSeverity !== 'P2_WARNING' ||
    !p2Result.channelsToNotify.includes('discord_dev_alerts') ||
    p2Result.channelsToNotify.includes('voice_call')
  ) {
    console.error(`  ${colors.red}✖ P2 snapshot failed expected passive discord channel${colors.reset}`);
    failures++;
  } else {
    console.log(
      `  ${colors.green}✔${colors.reset} Drill D: P2 Cache Depletion → Triggered ${p2Result.triggeredSeverity} ` +
      `(${p2Result.triggeredAlerts.length} rules, Channels: ${p2Result.channelsToNotify.join(', ')})`
    );
  }

  // 3. Multi-Channel Paging Payload Compilation
  console.log(`\n${colors.bold}3. Multi-Channel Paging Payload Compilation:${colors.reset}`);
  const sampleP0Rule = p0Rules[0];
  const payload = compilePagingPayload('INC-88910', sampleP0Rule, p0Snapshot);

  if (
    !payload.voiceScript.includes('ChrisShop Alert') ||
    !payload.smsMessage.includes('docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md') ||
    !payload.discordPayload.fields.some((f) => f.name === 'Incident ID')
  ) {
    console.error(`  ${colors.red}✖ Malformed multi-channel paging payload${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Voice Script: "${payload.voiceScript.slice(0, 50)}..."`);
    console.log(`  ${colors.green}✔${colors.reset} SMS Message: "${payload.smsMessage.slice(0, 50)}..."`);
    console.log(`  ${colors.green}✔${colors.reset} Discord Embed: "${payload.discordPayload.embedTitle}" (${payload.discordPayload.fields.length} fields)`);
  }

  // 4. Comparative Evaluation Report Validation
  console.log(`\n${colors.bold}4. Comparative Evaluation Report Validation:${colors.reset}`);
  const evalPath = path.resolve(__dirname, '../docs/analysis/ONCALL_PAGING_EVALUATION.md');
  if (!fs.existsSync(evalPath)) {
    console.error(`  ${colors.red}✖ Report missing at ${evalPath}${colors.reset}`);
    failures++;
  } else {
    const evalContent = fs.readFileSync(evalPath, 'utf8');
    const requiredSections = [
      '# Comparative Evaluation: On-Call Paging',
      'Executive Summary & Tooling Decision',
      'On-Call Tooling Comparative Matrix',
      'Escalation Tier Hierarchy & Alerting Policies',
      'Multi-Channel Escalation Architecture',
      'Acceptance Criteria Verification',
    ];

    let missing = 0;
    for (const sec of requiredSections) {
      if (!evalContent.includes(sec)) {
        console.error(`  ${colors.red}✖ Missing section: "${sec}"${colors.reset}`);
        missing++;
      }
    }
    if (missing === 0) {
      console.log(`  ${colors.green}✔${colors.reset} Evaluation report verified (${evalContent.length} bytes, all sections present).`);
    } else {
      failures += missing;
    }
  }

  // 5. Turnkey Incident Response Runbook Validation
  console.log(`\n${colors.bold}5. Turnkey Operational Runbook Validation:${colors.reset}`);
  const runbookPath = path.resolve(__dirname, '../docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md');
  if (!fs.existsSync(runbookPath)) {
    console.error(`  ${colors.red}✖ Runbook missing at ${runbookPath}${colors.reset}`);
    failures++;
  } else {
    const runbookContent = fs.readFileSync(runbookPath, 'utf8');
    const requiredRunbookSections = [
      '# Incident Response & On-Call Operational Runbook',
      'Scope & Escalation Hierarchy',
      'Step-by-Step Triage Protocol When Paged',
      'Immediate Mitigation Playbooks',
      'Playbook A: Bad Deployment / Worker Edge Crash',
      'Playbook B: Cloudflare D1 Database Contention',
      'Playbook C: Shopify Checkout Handshake Failure',
      'Playbook D: Distributed Bot Attack',
      'Communication Runbook: Status Page & Creator Notifications',
      'Post-Incident Review (PIR) Procedure',
    ];

    let missing = 0;
    for (const sec of requiredRunbookSections) {
      if (!runbookContent.includes(sec)) {
        console.error(`  ${colors.red}✖ Runbook missing section: "${sec}"${colors.reset}`);
        missing++;
      }
    }
    if (missing === 0) {
      console.log(`  ${colors.green}✔${colors.reset} Operational runbook verified (${runbookContent.length} bytes, all playbooks present).`);
    } else {
      failures += missing;
    }
  }

  // Final Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (failures > 0) {
    console.error(`${colors.red}${colors.bold}✖ Incident response verification failed with ${failures} error(s).${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✔ ALL INCIDENT RESPONSE VERIFICATION CHECKS PASSED!${colors.reset}\n`);
    process.exit(0);
  }
}

main();
