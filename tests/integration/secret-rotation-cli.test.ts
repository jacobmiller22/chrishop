import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECRET_REGISTRY,
  rotateSecret,
  formatAuditRecord,
  type TargetEnvironment,
} from '../../scripts/rotate-secrets';

describe('Story 2.29: Production Edge Secret Rotation Procedures & CLI (Issue #140)', () => {
  describe('1. Secret Registry & Cryptographic Validation', () => {
    it('should register all mandatory ChrisShop production edge secrets', () => {
      const requiredSecrets = [
        'PAYLOAD_SECRET',
        'SHOPIFY_ADMIN_TOKEN',
        'SHOPIFY_STOREFRONT_TOKEN',
        'SHOPIFY_WEBHOOK_SECRET',
        'RESEND_API_KEY',
        'OPS_ALERT_WEBHOOK_URL',
        'TURNSTILE_SECRET_KEY',
      ];

      for (const secretId of requiredSecrets) {
        assert.ok(SECRET_REGISTRY[secretId], `Secret "${secretId}" must be registered in SECRET_REGISTRY`);
        assert.ok(SECRET_REGISTRY[secretId].supportedEnvs.length > 0, `Secret "${secretId}" must have supported environments`);
        assert.ok(SECRET_REGISTRY[secretId].defaultCadenceDays > 0, `Secret "${secretId}" must define a rotation cadence`);
      }
    });

    it('should auto-generate cryptographically secure PAYLOAD_SECRET with >= 32 bytes entropy', () => {
      const payloadDef = SECRET_REGISTRY.PAYLOAD_SECRET;
      assert.equal(payloadDef.autoGeneratable, true);
      assert.ok(typeof payloadDef.generateFn === 'function');

      const generated = payloadDef.generateFn!();
      assert.equal(typeof generated, 'string');
      // 32 random bytes in hex encoding = 64 hex characters
      assert.equal(generated.length, 64);
      assert.match(generated, /^[0-9a-f]{64}$/i);

      // Validate that the generated secret satisfies validation requirements
      const validation = payloadDef.validateValue!(generated);
      assert.equal(validation.valid, true);
    });

    it('should reject invalid values for registered secrets', () => {
      // Short PAYLOAD_SECRET
      const payloadDef = SECRET_REGISTRY.PAYLOAD_SECRET;
      const invalidPayload = payloadDef.validateValue!('too-short');
      assert.equal(invalidPayload.valid, false);

      // Short SHOPIFY_ADMIN_TOKEN
      const shopifyAdminDef = SECRET_REGISTRY.SHOPIFY_ADMIN_TOKEN;
      const invalidShopify = shopifyAdminDef.validateValue!('short_token');
      assert.equal(invalidShopify.valid, false);

      // Invalid webhook URL
      const opsWebhookDef = SECRET_REGISTRY.OPS_ALERT_WEBHOOK_URL;
      const invalidWebhook = opsWebhookDef.validateValue!('invalid-url');
      assert.equal(invalidWebhook.valid, false);
    });
  });

  describe('2. Dry-Run Rollover Simulation & Audit Record Formatting', () => {
    it('should simulate secret rotation without executing live write commands in dry-run mode', async () => {
      const executedCommands: Array<{ cmd: string; input?: string }> = [];
      const mockRunner = (cmd: string, input?: string): string => {
        executedCommands.push({ cmd, input });
        return '';
      };

      const result = await rotateSecret({
        secretName: 'PAYLOAD_SECRET',
        environment: 'staging',
        dryRun: true,
        generate: true,
        skipHealthCheck: true,
        reason: 'Scheduled 90-Day Rotation',
        operator: 'Test Engineer',
        runner: mockRunner,
      });

      // Assert no mutating wrangler commands were dispatched
      assert.equal(executedCommands.length, 0, 'Dry run must not invoke execution runner');

      // Assert audit record properties
      assert.equal(result.dryRun, true);
      assert.equal(result.targetSecret, 'PAYLOAD_SECRET');
      assert.equal(result.environment, 'staging');
      assert.equal(result.operator, 'Test Engineer');
      assert.equal(result.previousTokenRevocationRequired, false);

      // Assert markdown audit trail formatting
      assert.ok(result.markdown.includes('### Secret Rotation Audit Record'));
      assert.ok(result.markdown.includes('DRY-RUN (Simulated)'));
      assert.ok(result.markdown.includes('PAYLOAD_SECRET'));
      assert.ok(result.markdown.includes('staging'));
    });

    it('should mark external provider tokens as requiring revocation in console', async () => {
      const result = await rotateSecret({
        secretName: 'SHOPIFY_ADMIN_TOKEN',
        secretValue: 'shpat_valid_length_token_1234567890',
        environment: 'staging',
        dryRun: true,
        skipHealthCheck: true,
        operator: 'Test Engineer',
      });

      assert.equal(result.previousTokenRevocationRequired, true);
      assert.ok(result.markdown.includes('PENDING (Action Required)'));
    });
  });

  describe('3. Command Dispatch & Environment Targeting', () => {
    it('should dispatch correct wrangler secret command for staging environment', async () => {
      const executedCommands: Array<{ cmd: string; input?: string }> = [];
      const mockRunner = (cmd: string, input?: string): string => {
        executedCommands.push({ cmd, input });
        return '';
      };

      const result = await rotateSecret({
        secretName: 'RESEND_API_KEY',
        secretValue: 're_mock_test_key_123456789',
        environment: 'staging',
        dryRun: false,
        skipHealthCheck: true,
        operator: 'Test Engineer',
        runner: mockRunner,
      });

      assert.equal(executedCommands.length, 1);
      assert.equal(executedCommands[0].cmd, 'wrangler secret put RESEND_API_KEY --env staging');
      assert.equal(executedCommands[0].input, 're_mock_test_key_123456789');
      assert.equal(result.dryRun, false);
      assert.ok(result.markdown.includes('LIVE EXECUTION'));
    });

    it('should dispatch correct wrangler secret command for production environment without extra env flag', async () => {
      const executedCommands: Array<{ cmd: string; input?: string }> = [];
      const mockRunner = (cmd: string, input?: string): string => {
        executedCommands.push({ cmd, input });
        return '';
      };

      await rotateSecret({
        secretName: 'SHOPIFY_WEBHOOK_SECRET',
        secretValue: 'shpss_live_webhook_secret_12345',
        environment: 'production',
        dryRun: false,
        skipHealthCheck: true,
        operator: 'Test Engineer',
        runner: mockRunner,
      });

      assert.equal(executedCommands.length, 1);
      assert.equal(executedCommands[0].cmd, 'wrangler secret put SHOPIFY_WEBHOOK_SECRET');
      assert.equal(executedCommands[0].input, 'shpss_live_webhook_secret_12345');
    });
  });

  describe('4. Error Handling & Safety Guardrails', () => {
    it('should throw an error for unregistered or unknown secret names', async () => {
      await assert.rejects(
        async () => {
          await rotateSecret({
            secretName: 'UNKNOWN_SECRET_NAME',
            environment: 'staging',
            dryRun: true,
          });
        },
        {
          name: 'Error',
          message: /Unknown secret "UNKNOWN_SECRET_NAME"/,
        }
      );
    });

    it('should throw an error when attempting to rotate a secret in an unsupported environment', async () => {
      await assert.rejects(
        async () => {
          // SHOPIFY_ADMIN_TOKEN only supports staging and production, not preview
          await rotateSecret({
            secretName: 'SHOPIFY_ADMIN_TOKEN',
            secretValue: 'shpat_valid_token_1234567890',
            environment: 'preview',
            dryRun: true,
          });
        },
        {
          name: 'Error',
          message: /not supported in environment "preview"/,
        }
      );
    });

    it('should throw an error when no value is provided for non-auto-generatable secrets', async () => {
      await assert.rejects(
        async () => {
          await rotateSecret({
            secretName: 'RESEND_API_KEY',
            environment: 'staging',
            dryRun: true,
          });
        },
        {
          name: 'Error',
          message: /No value provided for secret "RESEND_API_KEY"/,
        }
      );
    });
  });
});
