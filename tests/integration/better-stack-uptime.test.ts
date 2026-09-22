import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET as healthRouteHandler } from '../../apps/web/src/app/api/health/route';
import {
  getProductionMonitorConfig,
  getStagingMonitorConfig,
  generateBetterStackMonitorPayload,
  generateBetterStackStatusPagePayload,
  formatBetterStackDiscordAlert,
  dispatchBetterStackAlertToDiscord,
  BetterStackIncidentWebhook,
  DEFAULT_CHECK_FREQUENCY_SECONDS,
  DEFAULT_TIMEOUT_SECONDS,
  EXPECTED_KEYWORD,
} from '../../apps/web/src/lib/better-stack';
import { verifyUptimeSetup } from '../../scripts/better-stack-uptime';

describe('Story 4.7: Better Stack Uptime Monitoring & Heartbeat Probes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. Better Stack Monitor Configuration Matrix
  // ==========================================================================
  describe('1. Monitor Configurations and REST API Payloads', () => {
    it('should generate valid production monitor configuration with 60s cadence and multi-region probes', () => {
      const config = getProductionMonitorConfig('chrishop.jacobmiller22.com');

      assert.equal(config.url, 'https://chrishop.jacobmiller22.com/api/health');
      assert.equal(config.checkFrequencySeconds, DEFAULT_CHECK_FREQUENCY_SECONDS);
      assert.equal(config.checkFrequencySeconds, 60);
      assert.equal(config.requestTimeoutSeconds, DEFAULT_TIMEOUT_SECONDS);
      assert.equal(config.httpMethod, 'GET');
      assert.equal(config.expectedStatusCode, 200);
      assert.equal(config.keywordToFind, EXPECTED_KEYWORD);
      assert.deepEqual(config.regions, ['us', 'eu', 'as']);

      const payload = generateBetterStackMonitorPayload(config);
      assert.equal(payload.url, 'https://chrishop.jacobmiller22.com/api/health');
      assert.equal(payload.monitor_type, 'status');
      assert.equal(payload.check_frequency, 60);
      assert.equal(payload.request_timeout, 5);
      assert.deepEqual(payload.expected_status_codes, [200]);
      assert.equal(payload.required_keyword, '"status":"healthy"');
      assert.equal(payload.paused, false);
      assert.equal(payload.follow_redirects, true);
    });

    it('should generate valid staging monitor configuration targeting staging domain', () => {
      const config = getStagingMonitorConfig('staging-chrishop.jacobmiller22.com');

      assert.equal(config.url, 'https://staging-chrishop.jacobmiller22.com/api/health');
      assert.equal(config.checkFrequencySeconds, 60);
      assert.equal(config.expectedStatusCode, 200);
      assert.equal(config.keywordToFind, EXPECTED_KEYWORD);
      assert.deepEqual(config.regions, ['us']);

      const payload = generateBetterStackMonitorPayload(config);
      assert.equal(payload.url, 'https://staging-chrishop.jacobmiller22.com/api/health');
      assert.equal(payload.check_frequency, 60);
    });
  });

  // ==========================================================================
  // 2. Simulated Downtime Drill (/api/health?simulate=500)
  // ==========================================================================
  describe('2. Simulated Outage Drills & Health Endpoint Gating', () => {
    it('should return HTTP 500 when ?simulate=500 query parameter is present', async () => {
      const req = new NextRequest('https://chrishop.jacobmiller22.com/api/health?simulate=500');
      const res = await healthRouteHandler(req);

      assert.equal(res.status, 500);
      assert.equal(res.headers.get('x-simulated-outage'), 'true');
      assert.equal(res.headers.get('cache-control'), 'no-store');

      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.simulated, true);
      assert.ok(body.error.includes('Simulated downtime drill'));
      assert.equal(body.probes.d1.status, 'unhealthy');
    });

    it('should return HTTP 500 when ?simulate=downtime query parameter is present', async () => {
      const req = new NextRequest('https://chrishop.jacobmiller22.com/api/health?simulate=downtime');
      const res = await healthRouteHandler(req);

      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.simulated, true);
    });

    it('should return HTTP 500 when x-simulate-health-status header is set to 500', async () => {
      const req = new NextRequest('https://chrishop.jacobmiller22.com/api/health', {
        headers: { 'x-simulate-health-status': '500' },
      });
      const res = await healthRouteHandler(req);

      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.status, 'unhealthy');
      assert.equal(body.simulated, true);
    });
  });

  // ==========================================================================
  // 3. Incident Webhook Parsing & Discord #dev-alerts Formatting
  // ==========================================================================
  describe('3. Incident Webhooks and Discord Alerts', () => {
    it('should format incident.started down alert with red embed and outage details', () => {
      const webhook: BetterStackIncidentWebhook = {
        event: 'incident.started',
        incident: {
          id: 'inc-999',
          name: 'ChrisShop Production Edge Health (/api/health)',
          url: 'https://chrishop.jacobmiller22.com/api/health',
          started_at: '2026-09-22T12:00:00.000Z',
          http_status_code: 500,
          region: 'us-east',
          cause: 'Connection reset by peer on Cloudflare Worker',
        },
      };

      const discordPayload = formatBetterStackDiscordAlert(webhook);

      assert.ok(discordPayload.content.includes('🚨'));
      assert.ok(discordPayload.content.includes('DOWN'));
      assert.equal(discordPayload.embeds.length, 1);

      const embed = discordPayload.embeds[0];
      assert.equal(embed.color, 0xef4444); // Red
      assert.ok(embed.title.includes('DOWN'));
      assert.ok(embed.description.includes('External heartbeat monitor detected outage'));

      const fieldsMap = new Map(embed.fields?.map((f) => [f.name, f.value]));
      assert.ok(fieldsMap.get('Monitor')?.includes('ChrisShop Production Edge Health'));
      assert.ok(fieldsMap.get('Status')?.includes('DOWN'));
      assert.ok(fieldsMap.get('HTTP Status')?.includes('500'));
      assert.ok(fieldsMap.get('Probe Region')?.includes('US-EAST'));
      assert.ok(fieldsMap.get('Incident Cause')?.includes('Connection reset'));
    });

    it('should format incident.resolved alert with green embed and calculated downtime duration', () => {
      const webhook: BetterStackIncidentWebhook = {
        event: 'incident.resolved',
        incident: {
          id: 'inc-999',
          name: 'ChrisShop Production Edge Health (/api/health)',
          url: 'https://chrishop.jacobmiller22.com/api/health',
          started_at: '2026-09-22T12:00:00.000Z',
          resolved_at: '2026-09-22T12:04:30.000Z', // 4.5 minutes
          http_status_code: 200,
          region: 'us-east',
        },
      };

      const discordPayload = formatBetterStackDiscordAlert(webhook);

      assert.ok(discordPayload.content.includes('✅'));
      assert.ok(discordPayload.content.includes('RESOLVED'));

      const embed = discordPayload.embeds[0];
      assert.equal(embed.color, 0x10b981); // Emerald Green
      assert.ok(embed.title.includes('RESOLVED'));

      const fieldsMap = new Map(embed.fields?.map((f) => [f.name, f.value]));
      assert.ok(fieldsMap.get('Status')?.includes('RESOLVED'));
      assert.equal(fieldsMap.get('Downtime Duration'), '`4.5 minutes`');
    });

    it('should safely return false when no Discord webhook URL is configured', async () => {
      delete process.env.DISCORD_WEBHOOK_DEV_ALERTS;
      delete process.env.DISCORD_WEBHOOK_ALERTS;
      delete process.env.OPS_ALERT_WEBHOOK_URL;

      const webhook: BetterStackIncidentWebhook = {
        event: 'incident.started',
        incident: {
          id: 'inc-test',
          name: 'Test Monitor',
          url: 'https://chrishop.jacobmiller22.com',
          started_at: new Date().toISOString(),
        },
      };

      const dispatched = await dispatchBetterStackAlertToDiscord(webhook);
      assert.equal(dispatched, false);
    });

    it('should dispatch alert to custom webhook URL successfully', async () => {
      const originalFetch = globalThis.fetch;
      let requestedUrl = '';
      let sentBody: any = null;

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = String(url);
        sentBody = JSON.parse(String(init?.body));
        return { ok: true, status: 200 } as Response;
      }) as typeof fetch;

      try {
        const webhook: BetterStackIncidentWebhook = {
          event: 'incident.started',
          incident: {
            id: 'inc-drill-test',
            name: 'Drill Monitor',
            url: 'https://chrishop.jacobmiller22.com/api/health',
            started_at: new Date().toISOString(),
          },
        };

        const result = await dispatchBetterStackAlertToDiscord(
          webhook,
          'https://discord.com/api/webhooks/mock/test'
        );

        assert.equal(result, true);
        assert.equal(requestedUrl, 'https://discord.com/api/webhooks/mock/test');
        assert.ok(sentBody.content.includes('Drill Monitor'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ==========================================================================
  // 4. Public Status Page Configuration (status.chrishop.com)
  // ==========================================================================
  describe('4. Status Page Configuration Specification', () => {
    it('should define status page resources for storefront, infrastructure, and admin systems', () => {
      const statusPage = generateBetterStackStatusPagePayload('status.chrishop.com');

      assert.equal(statusPage.company_name, 'ChrisShop (BankBeaters Adventure Gear)');
      assert.equal(statusPage.custom_domain, 'status.chrishop.com');
      assert.equal(statusPage.timezone, 'America/New_York');
      assert.equal(statusPage.sections.length, 3);

      const sectionNames = statusPage.sections.map((s) => s.name);
      assert.ok(sectionNames.includes('Storefront & Customer Services'));
      assert.ok(sectionNames.includes('Core Infrastructure & Dependencies'));
      assert.ok(sectionNames.includes('Administrative & Security Systems'));

      const coreSection = statusPage.sections.find((s) => s.name === 'Core Infrastructure & Dependencies');
      const coreResources = coreSection?.resources.map((r) => r.name);
      assert.ok(coreResources?.includes('Edge Worker Runtime (Cloudflare Workers)'));
      assert.ok(coreResources?.includes('Edge Database (Cloudflare D1 SQLite)'));
      assert.ok(coreResources?.includes('Global KV Cache (Workers KV)'));
      assert.ok(coreResources?.includes('Shopify Storefront API Integration'));
    });
  });

  // ==========================================================================
  // 5. CLI Verification & Package Scripts
  // ==========================================================================
  describe('5. CLI Tooling and Verification Scripts', () => {
    it('should execute verifyUptimeSetup() and pass all checks', async () => {
      const ok = await verifyUptimeSetup({ dispatchMockAlert: false });
      assert.equal(ok, true);
    });

    it('should define uptime:verify and uptime:sync in root package.json', () => {
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');
      const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      assert.ok(content.scripts['uptime:verify'], 'Missing uptime:verify script');
      assert.ok(content.scripts['uptime:sync'], 'Missing uptime:sync script');
      assert.equal(content.scripts['uptime:verify'], 'tsx scripts/better-stack-uptime.ts verify');
      assert.equal(content.scripts['uptime:sync'], 'tsx scripts/better-stack-uptime.ts sync');
    });
  });

  // ==========================================================================
  // 6. Operational Runbook Existence & Completeness
  // ==========================================================================
  describe('6. Operational Runbook Documentation', () => {
    it('should have docs/observability/BETTER_STACK_UPTIME_RUNBOOK.md with all required sections', () => {
      const runbookPath = path.resolve(process.cwd(), 'docs/observability/BETTER_STACK_UPTIME_RUNBOOK.md');
      assert.ok(fs.existsSync(runbookPath), 'Runbook must exist at docs/observability/BETTER_STACK_UPTIME_RUNBOOK.md');

      const content = fs.readFileSync(runbookPath, 'utf8');
      assert.ok(content.includes('Better Stack Uptime Monitoring Operational Runbook'));
      assert.ok(content.includes('Architectural Overview & Objectives'));
      assert.ok(content.includes('Monitor Configuration Matrix'));
      assert.ok(content.includes('Discord `#dev-alerts` Escalation Format'));
      assert.ok(content.includes('Public Status Page Specification'));
      assert.ok(content.includes('Simulated Downtime Drill & On-Call Testing'));
      assert.ok(content.includes('CLI Automation Commands'));
      assert.ok(content.includes('Incident Response Playbook'));
      assert.ok(content.includes('/api/health?simulate=500'));
    });
  });
});
