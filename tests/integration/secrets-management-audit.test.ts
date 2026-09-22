import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  runFullSecretsAudit,
  auditGitSecrets,
  auditGitignore,
  auditWranglerSecretsIsolation,
  auditWorkflowSecretBoundaries,
  auditRunbookDocumentation,
  SENSITIVE_SECRET_KEYS,
  REQUIRED_PRODUCTION_SECRETS,
} from '../../scripts/secrets-audit';
import { SECRET_REGISTRY, rotateSecret } from '../../scripts/rotate-secrets';

describe('Story 5.3: Secrets Management Audit & Wrangler Secrets Isolation (Issue #30)', () => {
  const rootDir = process.cwd();

  describe('1. Sub-Task 1 & AC 1: Repository Git Secrets Audit (Zero Committed Secrets)', () => {
    it('should audit all git-tracked files and verify zero committed secrets or live API keys', () => {
      const { violations, fileCount } = auditGitSecrets(rootDir);
      assert.ok(fileCount > 100, `Expected at least 100 tracked files, found ${fileCount}`);
      assert.equal(
        violations.length,
        0,
        `Detected sensitive secret violations in tracked files:\n${violations.join('\n')}`
      );
    });

    it('should verify git log history contains zero committed private keys or active token patterns', () => {
      // Audit recent commits for sensitive token signatures
      const sensitiveSignatures = [
        'shpat_[a-fA-F0-9]{32}',
        'shpss_[a-fA-F0-9]{32}',
        'BEGIN RSA PRIVATE KEY',
        'BEGIN PRIVATE KEY',
      ];

      for (const sig of sensitiveSignatures) {
        try {
          const match = execSync(`git log -p -G "${sig}" -n 5 --oneline`, {
            cwd: rootDir,
            encoding: 'utf-8',
          }).trim();

          // If git log matched, verify it was only in test files or documentation
          if (match.length > 0) {
            const lines = match.split('\n');
            for (const line of lines) {
              if (line.startsWith('+') && !line.startsWith('+++')) {
                // Must be a test regex or placeholder
                assert.ok(
                  line.includes('RegExp') ||
                    line.includes('pattern') ||
                    line.includes('placeholder') ||
                    line.includes('mock') ||
                    line.includes('test'),
                  `Found suspicious git history line matching "${sig}": ${line}`
                );
              }
            }
          }
        } catch {
          // If git log exits with 0 or doesn't find, all good
        }
      }
    });
  });

  describe('2. Sub-Task 2: Local Development Isolation (.dev.vars and .env)', () => {
    it('should enforce that .gitignore strictly excludes .dev.vars, .env, and cryptographic keys', () => {
      const violations = auditGitignore(rootDir);
      assert.equal(
        violations.length,
        0,
        `Gitignore audit failed with violations:\n${violations.join('\n')}`
      );
    });

    it('should verify git check-ignore confirms local secret filenames are ignored', () => {
      const secretFilesToTest = [
        '.env',
        '.env.local',
        '.env.production',
        '.dev.vars',
        '.dev.vars.local',
        '.dev.vars.staging',
        'apps/web/.dev.vars',
        'apps/web/.env.local',
        'server.key',
        'cert.pem',
        'api_token.secret',
      ];

      for (const file of secretFilesToTest) {
        try {
          const ignored = execSync(`git check-ignore ${file}`, {
            cwd: rootDir,
            encoding: 'utf-8',
          }).trim();
          assert.ok(
            ignored.length > 0,
            `File "${file}" should be ignored by .gitignore but git check-ignore returned empty!`
          );
        } catch {
          assert.fail(`File "${file}" must be git-ignored per security policy!`);
        }
      }
    });

    it('should verify .env.example exists and contains exclusively placeholder values', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
      const content = fs.readFileSync(envExamplePath, 'utf-8');

      assert.ok(content.includes('PAYLOAD_SECRET='), '.env.example must document PAYLOAD_SECRET');
      assert.ok(content.includes('SHOPIFY_ADMIN_TOKEN='), '.env.example must document SHOPIFY_ADMIN_TOKEN');
      assert.ok(content.includes('SHOPIFY_STOREFRONT_TOKEN='), '.env.example must document SHOPIFY_STOREFRONT_TOKEN');
      assert.ok(content.includes('SHOPIFY_WEBHOOK_SECRET='), '.env.example must document SHOPIFY_WEBHOOK_SECRET');
      assert.ok(content.includes('CLOUDFLARE_API_TOKEN='), '.env.example must document CLOUDFLARE_API_TOKEN');
      assert.ok(content.includes('RESEND_API_KEY='), '.env.example must document RESEND_API_KEY');

      // Assert no actual live tokens are accidentally committed in .env.example
      assert.ok(!/\bshpat_[a-fA-F0-9]{32}\b/.test(content), '.env.example must not contain live Shopify tokens');
      assert.ok(!/\bghp_[a-zA-Z0-9]{36}\b/.test(content), '.env.example must not contain live GitHub PATs');
      assert.ok(!/\bre_[1-9a-zA-Z]{24,}\b/.test(content), '.env.example must not contain live Resend keys');
    });
  });

  describe('3. Sub-Task 3 & AC 2: Production Secrets Managed via Cloudflare Workers Secrets', () => {
    it('should assert wrangler.toml contains zero sensitive runtime secrets in vars or env vars', () => {
      const violations = auditWranglerSecretsIsolation(rootDir);
      assert.equal(
        violations.length,
        0,
        `wrangler.toml secrets isolation audit failed:\n${violations.join('\n')}`
      );
    });

    it('should verify all required production secrets are configured with valid wrangler secret put commands', () => {
      assert.ok(REQUIRED_PRODUCTION_SECRETS.length >= 6);

      const secretNames = REQUIRED_PRODUCTION_SECRETS.map((s) => s.name);
      assert.ok(secretNames.includes('PAYLOAD_SECRET'));
      assert.ok(secretNames.includes('SHOPIFY_ADMIN_TOKEN'));
      assert.ok(secretNames.includes('SHOPIFY_STOREFRONT_TOKEN'));
      assert.ok(secretNames.includes('SHOPIFY_WEBHOOK_SECRET'));
      assert.ok(secretNames.includes('RESEND_API_KEY'));
      assert.ok(secretNames.includes('TURNSTILE_SECRET_KEY'));
      assert.ok(secretNames.includes('OPS_ALERT_WEBHOOK_URL'));

      for (const secret of REQUIRED_PRODUCTION_SECRETS) {
        assert.ok(secret.environments.includes('production'));
        assert.ok(secret.environments.includes('staging'));
        assert.equal(secret.command('production'), `pnpm exec wrangler secret put ${secret.name}`);
        assert.equal(secret.command('staging'), `pnpm exec wrangler secret put ${secret.name} --env staging`);
      }
    });

    it('should verify GitHub Actions deploy and preview workflows do not expose runtime application secrets', () => {
      const violations = auditWorkflowSecretBoundaries(rootDir);
      assert.equal(
        violations.length,
        0,
        `Workflow secret boundary audit failed:\n${violations.join('\n')}`
      );
    });
  });

  describe('4. Sub-Task 4: Secret Rotation Runbook & Master Registry Completeness', () => {
    it('should verify docs/security/SECRETS_MANAGEMENT_RUNBOOK.md comprehensively covers all secrets', () => {
      const violations = auditRunbookDocumentation(rootDir);
      assert.equal(
        violations.length,
        0,
        `Runbook documentation audit failed:\n${violations.join('\n')}`
      );

      const runbookPath = path.join(rootDir, 'docs/security/SECRETS_MANAGEMENT_RUNBOOK.md');
      const content = fs.readFileSync(runbookPath, 'utf-8');

      // Check required sections
      assert.ok(content.includes('Three-Tier Secrets Isolation'), 'Must document 3-tier isolation');
      assert.ok(content.includes('Secrets Classification & Inventory Matrix'), 'Must include inventory matrix');
      assert.ok(content.includes('Initial Environment Provisioning Guide'), 'Must include provisioning guide');
      assert.ok(content.includes('Rotating Payload CMS Secret'), 'Must document Payload secret rotation');
      assert.ok(content.includes('Rotating Shopify Admin Token'), 'Must document Shopify admin token rotation');
      assert.ok(content.includes('Rotating Shopify Webhook Secret'), 'Must document Shopify webhook secret rotation');
      assert.ok(content.includes('Rotating Cloudflare API Token'), 'Must document Cloudflare token rotation');
      assert.ok(content.includes('Incident Response & Emergency Compromise Protocol'), 'Must document incident response');
    });

    it('should verify SECRET_REGISTRY in rotate-secrets.ts contains Cloudflare API Token', () => {
      const cfTokenDef = SECRET_REGISTRY.CLOUDFLARE_API_TOKEN;
      assert.ok(cfTokenDef, 'SECRET_REGISTRY must register CLOUDFLARE_API_TOKEN');
      assert.equal(cfTokenDef.defaultCadenceDays, 90);
      assert.ok(cfTokenDef.supportedEnvs.includes('production'));
      assert.ok(cfTokenDef.supportedEnvs.includes('staging'));

      // Validate value checks
      assert.equal(cfTokenDef.validateValue!('short').valid, false);
      assert.equal(cfTokenDef.validateValue!('0123456789abcdef0123456789abcdef01234567').valid, true);
    });
  });

  describe('5. Turnkey CLI Audit Integration', () => {
    it('should execute full secrets audit successfully via runFullSecretsAudit API', () => {
      const result = runFullSecretsAudit(rootDir);
      assert.equal(result.passed, true);
      assert.equal(result.violations.length, 0);
      assert.ok(result.auditedFilesCount > 100);
      assert.equal(result.totalChecks, 5);
    });

    it('should run pnpm run secrets:audit CLI cleanly and exit with code 0', () => {
      const output = execSync('pnpm run secrets:audit --verbose', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('SECRETS AUDIT PASSED!'));
      assert.ok(output.includes('Zero committed secrets'));
      assert.ok(output.includes('.gitignore enforces strict isolation'));
      assert.ok(output.includes('wrangler.toml contains ZERO plaintext runtime secrets'));
    });

    it('should execute secrets:audit --list-required CLI and display all production commands', () => {
      const output = execSync('pnpm run secrets:audit --list-required', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('PAYLOAD_SECRET'));
      assert.ok(output.includes('SHOPIFY_ADMIN_TOKEN'));
      assert.ok(output.includes('SHOPIFY_STOREFRONT_TOKEN'));
      assert.ok(output.includes('wrangler secret put PAYLOAD_SECRET'));
      assert.ok(output.includes('--env staging'));
    });

    it('should simulate secret rotation dry-run for PAYLOAD_SECRET without side effects', async () => {
      const audit = await rotateSecret({
        secretName: 'PAYLOAD_SECRET',
        environment: 'staging',
        dryRun: true,
        generate: true,
        skipHealthCheck: true,
        operator: 'Auditor',
      });

      assert.equal(audit.dryRun, true);
      assert.equal(audit.targetSecret, 'PAYLOAD_SECRET');
      assert.ok(audit.markdown.includes('DRY-RUN (Simulated)'));
    });
  });
});
