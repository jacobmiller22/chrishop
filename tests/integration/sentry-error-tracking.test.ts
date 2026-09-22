import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  captureException,
  captureMessage,
  formatSentryDiscordAlert,
  dispatchSentryAlertToDiscord,
  parseSentryWebhookPayload,
  isSentryConfigured,
  SentryIncidentPayload,
} from '../../apps/web/src/lib/sentry';
import { verifySentrySetup } from '../../scripts/verify-sentry-integration';

describe('Story 4.6: Sentry Error Tracking Integration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const webDir = path.join(rootDir, 'apps/web');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. Sentry Configuration Files Matrix
  // ==========================================================================
  describe('1. Sentry Initialization Configuration Files', () => {
    it('should have sentry.client.config.ts targeting browser runtime', () => {
      const filePath = path.join(webDir, 'sentry.client.config.ts');
      assert.ok(fs.existsSync(filePath), 'sentry.client.config.ts must exist');

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('@sentry/nextjs'));
      assert.ok(content.includes('NEXT_PUBLIC_SENTRY_DSN'));
      assert.ok(content.includes('tracesSampleRate'));
    });

    it('should have sentry.server.config.ts targeting Node.js server runtime', () => {
      const filePath = path.join(webDir, 'sentry.server.config.ts');
      assert.ok(fs.existsSync(filePath), 'sentry.server.config.ts must exist');

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('@sentry/nextjs'));
      assert.ok(content.includes('SENTRY_DSN'));
      assert.ok(content.includes('tracesSampleRate'));
    });

    it('should have sentry.edge.config.ts targeting Cloudflare Workers edge runtime', () => {
      const filePath = path.join(webDir, 'sentry.edge.config.ts');
      assert.ok(fs.existsSync(filePath), 'sentry.edge.config.ts must exist');

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(content.includes('@sentry/nextjs'));
      assert.ok(content.includes('SENTRY_DSN'));
      assert.ok(content.includes('tracesSampleRate'));
    });
  });

  // ==========================================================================
  // 2. Unified Sentry Error Engine & Context Injection
  // ==========================================================================
  describe('2. Unified Error Capturing Engine', () => {
    it('should detect when Sentry DSN is placeholder vs live', () => {
      process.env.SENTRY_DSN = 'https://placeholder_sentry_dsn@o0.ingest.sentry.io/0';
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      assert.equal(isSentryConfigured(), false);

      process.env.SENTRY_DSN = 'https://real_key@o12345.ingest.sentry.io/999';
      assert.equal(isSentryConfigured(), true);
    });

    it('should capture exceptions and return event IDs with context tags', () => {
      const err = new Error('Test edge database failure');
      const eventId = captureException(err, {
        level: 'error',
        tags: { query: 'SELECT * FROM products', drop_id: 'drop-001' },
      });

      assert.ok(eventId, 'Must return non-empty eventId');
      assert.ok(typeof eventId === 'string');
    });

    it('should capture non-Error objects gracefully', () => {
      const eventId = captureException('String error message thrown', {
        level: 'warning',
      });
      assert.ok(eventId);
    });

    it('should capture messages and return message IDs', () => {
      const msgId = captureMessage('Edge cache invalidated for products', 'info', {
        tags: { cache_key: 'catalog:products' },
      });
      assert.ok(msgId);
    });
  });

  // ==========================================================================
  // 3. Discord #dev-alerts Error Formatting & Escalation
  // ==========================================================================
  describe('3. Discord #dev-alerts Escalation Formatting', () => {
    it('should format Sentry error incident into rich Discord embed', () => {
      const incident: SentryIncidentPayload = {
        eventId: 'evt-error-888',
        message: 'D1 connection dropped unexpectedly',
        errorType: 'DatabaseConnectionError',
        stack: 'Error: D1 connection dropped\n    at queryD1 (/src/lib/db.ts:12:5)',
        url: 'https://chrishop.jacobmiller22.com/api/products',
        environment: 'production',
        runtime: 'cloudflare-workers',
        timestamp: '2026-09-22T12:00:00.000Z',
        level: 'error',
        tags: { colo: 'IAD', method: 'GET' },
      };

      const alert = formatSentryDiscordAlert(incident);
      assert.ok(alert.content.includes('🚨'));
      assert.ok(alert.content.includes('evt-error-888'));
      assert.equal(alert.embeds.length, 1);

      const embed = alert.embeds[0];
      assert.equal(embed.color, 0xef4444); // Crimson Red
      assert.ok(embed.title.includes('DatabaseConnectionError'));

      const fieldsMap = new Map(embed.fields?.map((f) => [f.name, f.value]));
      assert.equal(fieldsMap.get('Event ID'), '`evt-error-888`');
      assert.equal(fieldsMap.get('Environment'), '`production`');
      assert.equal(fieldsMap.get('Runtime'), '`cloudflare-workers`');
      assert.ok(fieldsMap.get('Stack Trace')?.includes('queryD1'));
    });

    it('should format fatal errors with darker crimson color', () => {
      const incident: SentryIncidentPayload = {
        eventId: 'evt-fatal-999',
        message: 'Out of memory fatal crash',
        level: 'fatal',
      };

      const alert = formatSentryDiscordAlert(incident);
      assert.equal(alert.embeds[0].color, 0x991b1b); // Dark Red
    });

    it('should safely return false when Discord webhook URL is not configured', async () => {
      delete process.env.DISCORD_WEBHOOK_DEV_ALERTS;
      delete process.env.DISCORD_WEBHOOK_ALERTS;
      delete process.env.OPS_ALERT_WEBHOOK_URL;

      const incident: SentryIncidentPayload = {
        eventId: 'evt-test-noop',
        message: 'No-op test error',
      };

      const result = await dispatchSentryAlertToDiscord(incident);
      assert.equal(result, false);
    });

    it('should dispatch alert to custom webhook URL successfully', async () => {
      const originalFetch = globalThis.fetch;
      let requestedUrl = '';
      let sentPayload: any = null;

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = String(url);
        sentPayload = JSON.parse(String(init?.body));
        return { ok: true, status: 200 } as Response;
      }) as typeof fetch;

      try {
        const incident: SentryIncidentPayload = {
          eventId: 'evt-fetch-test',
          message: 'Simulated fetch alert',
        };

        const result = await dispatchSentryAlertToDiscord(
          incident,
          'https://discord.com/api/webhooks/mock/sentry'
        );

        assert.equal(result, true);
        assert.equal(requestedUrl, 'https://discord.com/api/webhooks/mock/sentry');
        assert.ok(sentPayload.content.includes('evt-fetch-test'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ==========================================================================
  // 4. Sentry Webhook Ingestion & Parsing
  // ==========================================================================
  describe('4. Sentry Incident Webhook Payload Parsing', () => {
    it('should parse incoming Sentry alert webhooks into structured incident data', () => {
      const rawWebhook = {
        event: {
          event_id: 'sentry-hook-1234',
          title: 'ReferenceError: window is not defined',
          type: 'ReferenceError',
          web_url: 'https://sentry.io/organizations/chrishop/issues/777/',
          environment: 'production',
          tags: [
            ['runtime', 'cloudflare-workers'],
            ['service', 'chrishop-storefront'],
          ],
        },
      };

      const incident = parseSentryWebhookPayload(rawWebhook);
      assert.equal(incident.eventId, 'sentry-hook-1234');
      assert.equal(incident.message, 'ReferenceError: window is not defined');
      assert.equal(incident.errorType, 'ReferenceError');
      assert.equal(incident.environment, 'production');
      assert.equal(incident.runtime, 'cloudflare-workers');
      assert.equal(incident.tags?.service, 'chrishop-storefront');
    });
  });

  // ==========================================================================
  // 5. Content-Security-Policy & Environment Documentation
  // ==========================================================================
  describe('5. CSP Headers and Environment Configuration', () => {
    it('should whitelist Sentry ingest endpoints in apps/web/next.config.mjs CSP', () => {
      const nextConfigPath = path.join(webDir, 'next.config.mjs');
      const content = fs.readFileSync(nextConfigPath, 'utf-8');

      assert.ok(
        content.includes('https://*.ingest.sentry.io'),
        'CSP connect-src must include https://*.ingest.sentry.io'
      );
      assert.ok(
        content.includes('https://*.ingest.us.sentry.io'),
        'CSP connect-src must include https://*.ingest.us.sentry.io'
      );
    });

    it('should document all Sentry variables in .env.example', () => {
      const envPath = path.join(rootDir, '.env.example');
      const content = fs.readFileSync(envPath, 'utf-8');

      assert.ok(content.includes('NEXT_PUBLIC_SENTRY_DSN'));
      assert.ok(content.includes('SENTRY_DSN'));
      assert.ok(content.includes('SENTRY_AUTH_TOKEN'));
      assert.ok(content.includes('SENTRY_ORG'));
      assert.ok(content.includes('SENTRY_PROJECT'));
    });
  });

  // ==========================================================================
  // 6. CLI Tooling & Operational Runbook
  // ==========================================================================
  describe('6. CLI Tooling & Runbook Documentation', () => {
    it('should execute verifySentrySetup() and pass all checks', async () => {
      const ok = await verifySentrySetup();
      assert.equal(ok, true);
    });

    it('should define sentry:verify in package.json', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      assert.ok(pkg.scripts['sentry:verify']);
      assert.equal(pkg.scripts['sentry:verify'], 'tsx scripts/verify-sentry-integration.ts');
    });

    it('should have docs/observability/SENTRY_ERROR_TRACKING_RUNBOOK.md with all required sections', () => {
      const runbookPath = path.join(rootDir, 'docs/observability/SENTRY_ERROR_TRACKING_RUNBOOK.md');
      assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');

      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(content.includes('Architectural Overview & Objectives'));
      assert.ok(content.includes('Configuration Files & Runtime Matrix'));
      assert.ok(content.includes('Discord `#dev-alerts` Error Escalation Policy'));
      assert.ok(content.includes('Content-Security-Policy (CSP) Integration'));
      assert.ok(content.includes('Incident Response & Triage Playbook'));
    });
  });
});
