import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateServerEnv } from '@chrishop/config';

describe('Cloudflare Workers Secrets vs GitHub Secrets Evaluation (Story 2.35)', () => {
  const rootDir = process.cwd();

  describe('1. @opennextjs/cloudflare Runtime Environment Propagation', () => {
    it('should simulate populateProcessEnv and verify edge secrets map to process.env without build-time baking', () => {
      // Mock Cloudflare Worker env passed to fetch handler
      const mockCloudflareEnv: Record<string, any> = {
        PAYLOAD_SECRET: 'live-edge-payload-secret-at-least-32-chars-long',
        SHOPIFY_STORE_DOMAIN: 'chrishop-live.myshopify.com',
        SHOPIFY_STOREFRONT_TOKEN: 'shpat_live_edge_storefront_token',
        SHOPIFY_ADMIN_TOKEN: 'shpat_live_edge_admin_token',
        SHOPIFY_WEBHOOK_SECRET: 'shpss_live_edge_webhook_secret',
        RESEND_API_KEY: 're_live_edge_resend_key',
        DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/12345/abcdef',
        DB: { prepare: () => ({}) }, // D1 database object binding
        NEXT_CACHE_WORKERS_KV: { get: () => null }, // KV namespace object binding
      };

      // Emulate @opennextjs/cloudflare init.js: populateProcessEnv
      const simulatedProcessEnv: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(mockCloudflareEnv)) {
        if (typeof value === 'string') {
          simulatedProcessEnv[key] = value;
        }
      }

      assert.equal(simulatedProcessEnv.PAYLOAD_SECRET, 'live-edge-payload-secret-at-least-32-chars-long');
      assert.equal(simulatedProcessEnv.SHOPIFY_ADMIN_TOKEN, 'shpat_live_edge_admin_token');
      assert.equal(simulatedProcessEnv.DB, undefined, 'Non-string bindings like D1 DB must not be assigned as string env');

      // Validate that @chrishop/config parses the dynamically populated edge environment
      const validated = validateServerEnv(simulatedProcessEnv);
      assert.equal(validated.PAYLOAD_SECRET, 'live-edge-payload-secret-at-least-32-chars-long');
      assert.equal(validated.SHOPIFY_STORE_DOMAIN, 'chrishop-live.myshopify.com');
      assert.equal(validated.SHOPIFY_ADMIN_TOKEN, 'shpat_live_edge_admin_token');
      assert.equal(validated.SHOPIFY_WEBHOOK_SECRET, 'shpss_live_edge_webhook_secret');
      assert.equal(validated.RESEND_API_KEY, 're_live_edge_resend_key');
      assert.equal(validated.DISCORD_WEBHOOK_URL, 'https://discord.com/api/webhooks/12345/abcdef');
    });

    it('should allow safe hermetic builds and tests when edge secrets are omitted (CI fallback mode)', () => {
      // In CI, GitHub Actions does not have live runtime secrets
      const emptyEnv: Record<string, string | undefined> = {};
      const validated = validateServerEnv(emptyEnv);

      // Verify safe development/build fallbacks kick in
      assert.ok(validated.PAYLOAD_SECRET.length >= 32, 'Default PAYLOAD_SECRET meets 32 char minimum');
      assert.equal(validated.SHOPIFY_STORE_DOMAIN, 'chrishop-dev.myshopify.com');
      assert.equal(validated.RESEND_API_KEY, undefined, 'Optional secrets default to undefined');
      assert.equal(validated.DISCORD_WEBHOOK_URL, undefined, 'Optional secrets default to undefined');
    });
  });

  describe('2. Secret Hygiene & wrangler.toml Zero-Leakage Audit', () => {
    it('should assert that wrangler.toml does not contain plaintext sensitive secrets in vars', () => {
      const wranglerPath = path.join(rootDir, 'wrangler.toml');
      assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml must exist');
      const content = fs.readFileSync(wranglerPath, 'utf-8');

      const sensitiveKeys = [
        'PAYLOAD_SECRET',
        'SHOPIFY_ADMIN_TOKEN',
        'SHOPIFY_STOREFRONT_TOKEN',
        'SHOPIFY_WEBHOOK_SECRET',
        'RESEND_API_KEY',
        'DISCORD_WEBHOOK_URL',
        'CLOUDFLARE_API_TOKEN',
      ];

      for (const key of sensitiveKeys) {
        // Assert sensitive keys are never defined under [vars] or [env.*.vars]
        const varPattern = new RegExp(`^\\s*${key}\\s*=`, 'm');
        assert.ok(
          !varPattern.test(content),
          `wrangler.toml must NOT define sensitive secret "${key}" in plaintext vars!`
        );
      }
    });

    it('should confirm .env.example documents secrets with local .dev.vars instructions', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
      const content = fs.readFileSync(envExamplePath, 'utf-8');

      assert.ok(content.includes('PAYLOAD_SECRET='), '.env.example must document PAYLOAD_SECRET');
      assert.ok(content.includes('SHOPIFY_ADMIN_TOKEN='), '.env.example must document SHOPIFY_ADMIN_TOKEN');
      assert.ok(content.includes('SHOPIFY_STOREFRONT_TOKEN='), '.env.example must document SHOPIFY_STOREFRONT_TOKEN');
      assert.ok(content.includes('SHOPIFY_WEBHOOK_SECRET='), '.env.example must document SHOPIFY_WEBHOOK_SECRET');
    });
  });

  describe('3. CI/CD Pipeline Least-Privilege & Boundary Verification', () => {
    it('should verify deploy.yml only grants Cloudflare API credentials to GitHub Actions', () => {
      const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
      assert.ok(fs.existsSync(deployWorkflowPath), 'deploy.yml must exist');
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

      assert.ok(content.includes('secrets.CLOUDFLARE_API_TOKEN'), 'deploy.yml must use CLOUDFLARE_API_TOKEN');
      assert.ok(content.includes('secrets.CLOUDFLARE_ACCOUNT_ID'), 'deploy.yml must use CLOUDFLARE_ACCOUNT_ID');

      // Verify no application secrets are referenced in deploy.yml
      assert.ok(!content.includes('secrets.PAYLOAD_SECRET'), 'deploy.yml must not require PAYLOAD_SECRET');
      assert.ok(!content.includes('secrets.SHOPIFY_ADMIN_TOKEN'), 'deploy.yml must not require SHOPIFY_ADMIN_TOKEN');
      assert.ok(!content.includes('secrets.RESEND_API_KEY'), 'deploy.yml must not require RESEND_API_KEY');
    });

    it('should verify preview-deploy.yml adheres to least-privilege boundary', () => {
      const previewWorkflowPath = path.join(rootDir, '.github/workflows/preview-deploy.yml');
      assert.ok(fs.existsSync(previewWorkflowPath), 'preview-deploy.yml must exist');
      const content = fs.readFileSync(previewWorkflowPath, 'utf-8');

      assert.ok(content.includes('CLOUDFLARE_API_TOKEN'), 'preview-deploy.yml must use CLOUDFLARE_API_TOKEN');
      assert.ok(content.includes('CLOUDFLARE_ACCOUNT_ID'), 'preview-deploy.yml must use CLOUDFLARE_ACCOUNT_ID');
      assert.ok(!content.includes('secrets.PAYLOAD_SECRET'), 'preview-deploy.yml must not require PAYLOAD_SECRET');
      assert.ok(!content.includes('secrets.SHOPIFY_ADMIN_TOKEN'), 'preview-deploy.yml must not require SHOPIFY_ADMIN_TOKEN');
    });
  });

  describe('4. Documentation & Operational Runbook Verification', () => {
    it('should verify ADR_CLOUDFLARE_SECRETS_EVALUATION.md exists and documents GO recommendation', () => {
      const adrPath = path.join(rootDir, 'docs/decisions/ADR_CLOUDFLARE_SECRETS_EVALUATION.md');
      assert.ok(fs.existsSync(adrPath), 'ADR must exist at docs/decisions/ADR_CLOUDFLARE_SECRETS_EVALUATION.md');
      const content = fs.readFileSync(adrPath, 'utf-8');

      assert.ok(
        content.includes('ACCEPTED (GO Recommendation)'),
        'ADR must state ACCEPTED (GO Recommendation)'
      );
      assert.ok(content.includes('Threat Vectors'), 'ADR must analyze threat vectors');
      assert.ok(content.includes('populateProcessEnv'), 'ADR must evaluate @opennextjs/cloudflare populateProcessEnv');
      assert.ok(content.includes('Ephemeral PR Preview Environments'), 'ADR must address ephemeral PR previews');
      assert.ok(content.includes('.dev.vars'), 'ADR must evaluate .dev.vars local parity');
    });

    it('should verify SECRET_ROTATION.md exists with comprehensive rollover procedures', () => {
      const runbookPath = path.join(rootDir, 'docs/runbooks/SECRET_ROTATION.md');
      assert.ok(fs.existsSync(runbookPath), 'Secret rotation runbook must exist');
      const content = fs.readFileSync(runbookPath, 'utf-8');

      const requiredSecrets = [
        'PAYLOAD_SECRET',
        'SHOPIFY_ADMIN_TOKEN',
        'SHOPIFY_STOREFRONT_TOKEN',
        'SHOPIFY_WEBHOOK_SECRET',
        'RESEND_API_KEY',
        'DISCORD_WEBHOOK_URL',
        'CLOUDFLARE_API_TOKEN',
      ];

      for (const secret of requiredSecrets) {
        assert.ok(content.includes(secret), `SECRET_ROTATION.md must document procedure for "${secret}"`);
      }

      assert.ok(content.includes('Emergency Credential Revocation Protocol'), 'Must document emergency revocation');
      assert.ok(content.includes('wrangler secret put'), 'Must document wrangler secret put syntax');
    });
  });
});
