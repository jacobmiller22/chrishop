/**
 * Integration Test Suite: Incident Response & On-Call Paging
 *
 * Story 4.17 (#169): Incident Response & On-Call Paging Spike
 *
 * Validates:
 * 1. P0, P1, and P2 canonical alert rules and escalation channels
 * 2. Real-time telemetry evaluation against threshold conditions
 * 3. Multi-channel paging payload compilation (Voice, SMS, Discord)
 * 4. Comparative evaluation report integrity (docs/analysis/ONCALL_PAGING_EVALUATION.md)
 * 5. Turnkey operational runbook integrity (docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INCIDENT_ALERT_RULES,
  evaluateTelemetrySnapshot,
  compilePagingPayload,
  type TelemetrySignalSnapshot,
} from '../../apps/web/src/lib/incident-response';

describe('Story 4.17: Incident Response & On-Call Paging Suite', () => {
  describe('Canonical Alert Rules & Severity Tiers', () => {
    it('should define exactly 9 canonical alert rules across P0, P1, and P2', () => {
      assert.equal(INCIDENT_ALERT_RULES.length, 9);

      const p0 = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P0_CRITICAL');
      const p1 = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P1_HIGH');
      const p2 = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P2_WARNING');

      assert.equal(p0.length, 4, 'Expected exactly 4 P0 rules');
      assert.equal(p1.length, 3, 'Expected exactly 3 P1 rules');
      assert.equal(p2.length, 2, 'Expected exactly 2 P2 rules');
    });

    it('should configure Voice Call and SMS on all P0 critical alert rules', () => {
      const p0Rules = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P0_CRITICAL');
      for (const rule of p0Rules) {
        assert.ok(rule.channels.includes('voice_call'), `${rule.id} must include voice_call`);
        assert.ok(rule.channels.includes('sms'), `${rule.id} must include sms`);
        assert.equal(rule.autoEscalateMinutes, 5, `${rule.id} must auto-escalate in 5 minutes`);
      }
    });

    it('should restrict P2 warning rules to passive discord notification', () => {
      const p2Rules = INCIDENT_ALERT_RULES.filter((r) => r.severity === 'P2_WARNING');
      for (const rule of p2Rules) {
        assert.ok(rule.channels.includes('discord_dev_alerts'));
        assert.ok(!rule.channels.includes('voice_call'));
        assert.ok(!rule.channels.includes('sms'));
      }
    });
  });

  describe('Telemetry Evaluation Engine', () => {
    const baseHealthy: TelemetrySignalSnapshot = {
      edge5xxRatePercent: 0.0,
      apiHealthFailingConsecutiveCycles: 0,
      shopifyCheckoutFailures: 0,
      d1ErrorsCount: 0,
      edgeLatencyP99Ms: 200,
      webhookQueueBacklog: 0,
      wafBlockRatePercent: 0.5,
      sentryUnresolvedErrors: 0,
      kvCacheHitRatioPercent: 95.0,
    };

    it('should report nominal health for clean telemetry signals', () => {
      const result = evaluateTelemetrySnapshot(baseHealthy);
      assert.equal(result.triggeredSeverity, null);
      assert.equal(result.triggeredAlerts.length, 0);
      assert.equal(result.channelsToNotify.length, 0);
      assert.ok(result.primaryEscalationRoute.includes('Healthy'));
    });

    it('should trigger P0 Critical when edge 5xx rate >= 2.0%', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        edge5xxRatePercent: 2.4,
      });

      assert.equal(result.triggeredSeverity, 'P0_CRITICAL');
      assert.ok(result.channelsToNotify.includes('voice_call'));
      assert.ok(result.channelsToNotify.includes('sms'));
      assert.ok(result.triggeredAlerts.some((a) => a.id === 'p0.edge_5xx_rate_spike'));
      assert.ok(result.primaryEscalationRoute.includes('Voice Call'));
    });

    it('should trigger P0 Critical when /api/health fails for 2 consecutive cycles', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        apiHealthFailingConsecutiveCycles: 2,
      });

      assert.equal(result.triggeredSeverity, 'P0_CRITICAL');
      assert.ok(result.triggeredAlerts.some((a) => a.id === 'p0.api_health_consecutive_failure'));
    });

    it('should trigger P0 Critical on excessive Shopify checkout failures (> 3)', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        shopifyCheckoutFailures: 4,
      });

      assert.equal(result.triggeredSeverity, 'P0_CRITICAL');
      assert.ok(result.triggeredAlerts.some((a) => a.id === 'p0.checkout_creation_failures'));
    });

    it('should trigger P0 Critical on D1 connectivity error spike (> 5/min)', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        d1ErrorsCount: 7,
      });

      assert.equal(result.triggeredSeverity, 'P0_CRITICAL');
      assert.ok(result.triggeredAlerts.some((a) => a.id === 'p0.d1_database_connectivity_errors'));
    });

    it('should trigger P1 High on edge p99 latency degradation (> 2000ms)', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        edgeLatencyP99Ms: 2500,
      });

      assert.equal(result.triggeredSeverity, 'P1_HIGH');
      assert.ok(result.channelsToNotify.includes('urgent_push'));
      assert.ok(result.channelsToNotify.includes('discord_emergency'));
      assert.ok(!result.channelsToNotify.includes('voice_call'));
    });

    it('should trigger P1 High on webhook backlog (> 50 messages)', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        webhookQueueBacklog: 60,
      });

      assert.equal(result.triggeredSeverity, 'P1_HIGH');
      assert.ok(result.triggeredAlerts.some((a) => a.id === 'p1.shopify_webhook_queue_backlog'));
    });

    it('should trigger P2 Warning on KV cache hit ratio drop (< 70%)', () => {
      const result = evaluateTelemetrySnapshot({
        ...baseHealthy,
        kvCacheHitRatioPercent: 62.0,
      });

      assert.equal(result.triggeredSeverity, 'P2_WARNING');
      assert.ok(result.channelsToNotify.includes('discord_dev_alerts'));
      assert.ok(!result.channelsToNotify.includes('voice_call'));
    });
  });

  describe('Multi-Channel Payload Compilation', () => {
    it('should compile rich voice, SMS, and Discord embed payloads for P0 incidents', () => {
      const sampleRule = INCIDENT_ALERT_RULES.find((r) => r.id === 'p0.edge_5xx_rate_spike')!;
      const payload = compilePagingPayload('INC-9911', sampleRule, {
        edge5xxRatePercent: 3.5,
        apiHealthFailingConsecutiveCycles: 0,
        shopifyCheckoutFailures: 0,
        d1ErrorsCount: 0,
        edgeLatencyP99Ms: 300,
        webhookQueueBacklog: 0,
        wafBlockRatePercent: 0,
        sentryUnresolvedErrors: 0,
        kvCacheHitRatioPercent: 90,
      });

      assert.equal(payload.severity, 'P0_CRITICAL');
      assert.ok(payload.voiceScript.includes('ChrisShop Alert'));
      assert.ok(payload.smsMessage.includes('P0 CRITICAL'));
      assert.ok(payload.discordPayload.content.includes('@everyone'));
      assert.equal(payload.discordPayload.embedColor, 0xff0033);
      assert.ok(payload.discordPayload.fields.some((f) => f.name === 'Incident ID' && f.value === '`INC-9911`'));
    });

    it('should compile appropriate @here tag for P1 incidents', () => {
      const sampleRule = INCIDENT_ALERT_RULES.find((r) => r.id === 'p1.edge_latency_p99_degradation')!;
      const payload = compilePagingPayload('INC-9912', sampleRule, {
        edge5xxRatePercent: 0,
        apiHealthFailingConsecutiveCycles: 0,
        shopifyCheckoutFailures: 0,
        d1ErrorsCount: 0,
        edgeLatencyP99Ms: 2200,
        webhookQueueBacklog: 0,
        wafBlockRatePercent: 0,
        sentryUnresolvedErrors: 0,
        kvCacheHitRatioPercent: 90,
      });

      assert.equal(payload.severity, 'P1_HIGH');
      assert.ok(payload.discordPayload.content.includes('@here'));
      assert.equal(payload.discordPayload.embedColor, 0xffaa00);
    });
  });

  describe('Documentation Integrity', () => {
    it('should verify docs/analysis/ONCALL_PAGING_EVALUATION.md exists and is complete', () => {
      const p = path.resolve(__dirname, '../../docs/analysis/ONCALL_PAGING_EVALUATION.md');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf8');
      assert.ok(content.includes('Executive Summary & Tooling Decision'));
      assert.ok(content.includes('Better Stack Incident / On-Call (Primary)'));
      assert.ok(content.includes('On-Call Tooling Comparative Matrix'));
      assert.ok(content.includes('Escalation Tier Hierarchy & Alerting Policies'));
      assert.ok(content.length > 3000);
    });

    it('should verify docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md exists and is complete', () => {
      const p = path.resolve(__dirname, '../../docs/runbooks/INCIDENT_RESPONSE_AND_ONCALL.md');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf8');
      assert.ok(content.includes('Incident Response & On-Call Operational Runbook'));
      assert.ok(content.includes('Step-by-Step Triage Protocol When Paged'));
      assert.ok(content.includes('Immediate Mitigation Playbooks'));
      assert.ok(content.includes('Playbook A: Bad Deployment / Worker Edge Crash'));
      assert.ok(content.includes('Communication Runbook: Status Page & Creator Notifications'));
      assert.ok(content.length > 3000);
    });
  });
});
