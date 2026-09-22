import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildRollbackCommand,
  resolveTargetUrl,
  buildRollbackDiscordPayload,
  parseCliArgs,
} from '../../scripts/rollback-worker';

describe('Story 4.5: Cloudflare Workers Instant Rollback & Disaster Recovery Runbook', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const rollbackWorkflowPath = path.join(rootDir, '.github/workflows/rollback.yml');
  const disasterRecoveryRunbookPath = path.join(rootDir, 'docs/runbooks/DISASTER_RECOVERY.md');
  const packageJsonPath = path.join(rootDir, 'package.json');

  describe('1. Emergency Rollback GitHub Actions Workflow (.github/workflows/rollback.yml)', () => {
    it('should verify rollback.yml exists and defines workflow_dispatch with required inputs', () => {
      assert.ok(fs.existsSync(rollbackWorkflowPath), '.github/workflows/rollback.yml must exist');
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');

      assert.ok(content.includes('workflow_dispatch:'), 'Must be triggered via workflow_dispatch');
      assert.ok(content.includes('environment:'), 'Must declare environment input');
      assert.ok(content.includes('deployment_id:'), 'Must declare deployment_id input');
      assert.ok(content.includes('reason:'), 'Must declare reason input');
      assert.ok(content.includes('production'), 'Must support production environment');
      assert.ok(content.includes('staging'), 'Must support staging environment');
    });

    it('should verify rollback job binds to the target GitHub environment', () => {
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');
      assert.ok(
        content.includes('environment: ${{ inputs.environment }}'),
        'Job must dynamically bind to inputs.environment'
      );
    });

    it('should verify rollback step executes wrangler rollback with conditional deployment ID', () => {
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');
      assert.ok(
        content.includes('pnpm exec wrangler rollback "${{ inputs.deployment_id }}" --env "${{ inputs.environment }}"'),
        'Must support rolling back to a specific deployment ID'
      );
      assert.ok(
        content.includes('pnpm exec wrangler rollback --env "${{ inputs.environment }}"'),
        'Must support rolling back to previous deployment when deployment_id is empty'
      );
    });

    it('should verify least-privilege secret boundary for rollback workflow', () => {
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');

      // Allowed infrastructure credentials
      assert.ok(
        content.includes('CLOUDFLARE_API_TOKEN'),
        'Must use CLOUDFLARE_API_TOKEN'
      );
      assert.ok(
        content.includes('CLOUDFLARE_ACCOUNT_ID'),
        'Must use CLOUDFLARE_ACCOUNT_ID'
      );

      // Prohibited application secrets
      assert.ok(
        !content.includes('PAYLOAD_SECRET'),
        'rollback.yml must not expose PAYLOAD_SECRET'
      );
      assert.ok(
        !content.includes('SHOPIFY_ADMIN_TOKEN'),
        'rollback.yml must not expose SHOPIFY_ADMIN_TOKEN'
      );
      assert.ok(
        !content.includes('RESEND_API_KEY'),
        'rollback.yml must not expose RESEND_API_KEY'
      );
    });

    it('should verify post-rollback automated edge health check probe', () => {
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');
      assert.ok(
        content.includes('Verify Post-Rollback Edge Health'),
        'Must include health verification step'
      );
      assert.ok(
        content.includes('/api/health'),
        'Must probe the /api/health endpoint'
      );
      assert.ok(
        content.includes('chrishop.jacobmiller22.com'),
        'Must probe production edge target'
      );
      assert.ok(
        content.includes('staging-chrishop.jacobmiller22.com'),
        'Must probe staging edge target'
      );
    });

    it('should verify Discord notification dispatch to #dev-alerts', () => {
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');
      assert.ok(
        content.includes('Dispatch Rollback Alert to Discord'),
        'Must include Discord alert dispatch step'
      );
      assert.ok(
        content.includes('DISCORD_WEBHOOK_DEV_ALERTS'),
        'Must support DISCORD_WEBHOOK_DEV_ALERTS secret'
      );
      assert.ok(
        content.includes('Cloudflare Worker Rollback'),
        'Must include descriptive alert title'
      );
    });
  });

  describe('2. CLI Rollback Helper Tooling (scripts/rollback-worker.ts)', () => {
    it('should build command for previous deployment rollback', () => {
      const cmdProd = buildRollbackCommand({ environment: 'production' });
      assert.equal(cmdProd, 'wrangler rollback --env production');

      const cmdStaging = buildRollbackCommand({ environment: 'staging' });
      assert.equal(cmdStaging, 'wrangler rollback --env staging');
    });

    it('should build command for specific deployment ID rollback', () => {
      const cmd = buildRollbackCommand({
        environment: 'production',
        deploymentId: 'a1b2c3d4-e5f6',
      });
      assert.equal(cmd, 'wrangler rollback a1b2c3d4-e5f6 --env production');
    });

    it('should resolve environment edge URLs accurately', () => {
      assert.equal(
        resolveTargetUrl('production'),
        'https://chrishop.jacobmiller22.com'
      );
      assert.equal(
        resolveTargetUrl('staging'),
        'https://staging-chrishop.jacobmiller22.com'
      );
    });

    it('should build Discord notification payloads with correct colors and metadata', () => {
      const successPayload = buildRollbackDiscordPayload({
        environment: 'production',
        deploymentId: 'dep-789',
        reason: 'Regressed storefront checkout',
        actor: 'test-admin',
        status: 'SUCCESS',
      });

      assert.ok(successPayload.content.includes('SUCCESS'));
      assert.equal(successPayload.embeds[0].color, 65280, 'Green for SUCCESS');
      assert.ok(successPayload.embeds[0].description.includes('production'));
      assert.ok(successPayload.embeds[0].description.includes('dep-789'));
      assert.ok(successPayload.embeds[0].description.includes('Regressed storefront checkout'));
      assert.ok(successPayload.embeds[0].description.includes('@test-admin'));
      assert.ok(successPayload.embeds[0].description.includes('/api/health'));

      const failPayload = buildRollbackDiscordPayload({
        environment: 'staging',
        status: 'FAILURE',
      });
      assert.ok(failPayload.content.includes('FAILURE'));
      assert.equal(failPayload.embeds[0].color, 16711680, 'Red for FAILURE');
    });

    it('should parse CLI arguments correctly', () => {
      const options = parseCliArgs([
        '--env',
        'production',
        '--deployment-id',
        'dep-custom-01',
        '--reason',
        'Sev 1 outage',
        '--dry-run',
        '--check-health',
      ]);

      assert.equal(options.environment, 'production');
      assert.equal(options.deploymentId, 'dep-custom-01');
      assert.equal(options.reason, 'Sev 1 outage');
      assert.equal(options.dryRun, true);
      assert.equal(options.checkHealth, true);
    });

    it('should execute scripts/rollback-worker.ts in --dry-run mode without mutating state', () => {
      const output = execSync('pnpm run rollback --dry-run', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('ChrisShop Cloudflare Workers Instant Rollback Helper'));
      assert.ok(output.includes('[DRY RUN] Simulated execution details'));
      assert.ok(output.includes('wrangler rollback --env staging'));
      assert.ok(output.includes('Discord Payload Preview'));
      assert.ok(output.includes('Dry-run completed successfully'));
    });
  });

  describe('3. Operational Runbook (docs/runbooks/DISASTER_RECOVERY.md)', () => {
    it('should verify DISASTER_RECOVERY.md exists and specifies required recovery targets', () => {
      assert.ok(fs.existsSync(disasterRecoveryRunbookPath), 'DISASTER_RECOVERY.md must exist');
      const content = fs.readFileSync(disasterRecoveryRunbookPath, 'utf-8');

      // SLOs
      assert.ok(content.includes('Recovery Time Objective (RTO)'), 'Must document RTO');
      assert.ok(content.includes('< 5 Minutes'), 'Must specify RTO < 5 min');
      assert.ok(content.includes('Recovery Point Objective (RPO)'), 'Must document RPO');
      assert.ok(content.includes('< 1 Minute'), 'Must specify RPO < 1 min');

      // Incident Severity Matrix
      assert.ok(content.includes('Sev 1 (Critical)'), 'Must define Sev 1');
      assert.ok(content.includes('Sev 2 (Major)'), 'Must define Sev 2');
      assert.ok(content.includes('Sev 3 (Minor)'), 'Must define Sev 3');

      // Procedures
      assert.ok(content.includes('gh workflow run rollback.yml'), 'Must document GitHub Actions CLI rollback');
      assert.ok(content.includes('pnpm run rollback'), 'Must document rollback helper CLI');
      assert.ok(content.includes('wrangler rollback'), 'Must document direct wrangler rollback');
      assert.ok(content.includes('time-travel restore chrishop-prod-db'), 'Must document D1 PITR');
      assert.ok(content.includes('#dev-alerts'), 'Must document Discord #dev-alerts');
      assert.ok(content.includes('Incident Post-Mortem Protocol'), 'Must document post-mortem protocol');
    });
  });

  describe('4. Package.json Script Integrity', () => {
    it('should define the rollback script in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      assert.ok(pkg.scripts['rollback'], 'package.json must declare rollback script');
      assert.equal(pkg.scripts['rollback'], 'tsx scripts/rollback-worker.ts');
    });
  });
});
