import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  verifyDeployWorkflowConfiguration,
  probeProductionEdge,
} from '../../scripts/verify-production-cd';

describe('Story 4.1: Production CD Deployment Pipeline with Wrangler & Production Cutover Verification', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
  const promotionRunbookPath = path.join(rootDir, 'docs/runbooks/PRODUCTION_PROMOTION.md');
  const devopsSkillPath = path.join(rootDir, '.agents/skills/devops/SKILL.md');
  const hldPath = path.join(rootDir, 'docs/HIGH_LEVEL_DESIGN.md');

  it('should verify deploy.yml exists and defines the full 6-stage continuous deployment pipeline', () => {
    assert.ok(fs.existsSync(deployWorkflowPath), '.github/workflows/deploy.yml must exist');
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // 6 Orchestrated Jobs
    assert.ok(content.includes('build-and-validate:'), 'Must declare build-and-validate job');
    assert.ok(content.includes('deploy-staging:'), 'Must declare deploy-staging job');
    assert.ok(content.includes('test-staging:'), 'Must declare test-staging job');
    assert.ok(content.includes('deploy-production:'), 'Must declare deploy-production job');
    assert.ok(content.includes('verify-production:'), 'Must declare verify-production job');
    assert.ok(content.includes('notify-deployment:'), 'Must declare notify-deployment job');
  });

  it('should verify deployment concurrency groups and non-overlapping locks', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    assert.ok(content.includes('concurrency:'), 'Must configure concurrency block');
    assert.ok(
      content.includes('group: deploy-${{ github.ref }}'),
      'Must partition concurrency by git ref'
    );
    assert.ok(
      content.includes('cancel-in-progress: false'),
      'cancel-in-progress must be false to prevent overlapping or half-deployed states'
    );
  });

  it('should verify staged promotion hierarchy and production environment protection gate', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // deploy-production must require all staging jobs
    assert.ok(
      content.includes('needs: [build-and-validate, deploy-staging, test-staging]'),
      'deploy-production must gate on build-and-validate, deploy-staging, and test-staging'
    );

    // Production environment gate requiring human reviewer
    assert.ok(
      content.includes('environment: production'),
      'deploy-production must require environment: production gate'
    );

    // Only triggers on production, main, or manual dispatch targeting production
    assert.ok(
      content.includes("github.ref == 'refs/heads/production'"),
      'deploy-production must check for production branch ref'
    );
  });

  it('should verify automated D1 database migrations execute strictly before production worker deployment', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    const deployProdIdx = content.indexOf('deploy-production:');
    assert.ok(deployProdIdx !== -1, 'deploy-production job must be present');
    const prodSection = content.slice(deployProdIdx);

    const migrationIdx = prodSection.indexOf('Apply D1 Migrations to Production Database');
    const workerDeployIdx = prodSection.indexOf('Deploy to Cloudflare Workers (Production)');

    assert.ok(migrationIdx !== -1, 'Must include Apply D1 Migrations to Production Database');
    assert.ok(workerDeployIdx !== -1, 'Must include Deploy to Cloudflare Workers (Production)');
    assert.ok(
      migrationIdx < workerDeployIdx,
      'D1 migrations must execute strictly prior to Worker deployment to prevent schema desync'
    );
    assert.ok(
      prodSection.includes('wrangler d1 migrations apply chrishop-prod-db --remote'),
      'D1 migration must target chrishop-prod-db remotely'
    );
  });

  it('should verify post-deployment production edge health probe loop on /api/health', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    const verifyProdIdx = content.indexOf('verify-production:');
    assert.ok(verifyProdIdx !== -1, 'verify-production job must be present');
    const verifySection = content.slice(verifyProdIdx);

    assert.ok(
      verifySection.includes('https://chrishop.jacobmiller22.com'),
      'verify-production must target production hostname'
    );
    assert.ok(
      verifySection.includes('/api/health'),
      'verify-production must probe /api/health endpoint'
    );
    assert.ok(
      verifySection.includes('HTTP_STATUS') && verifySection.includes('"200"'),
      'verify-production must assert HTTP 200'
    );
    assert.ok(
      verifySection.includes('MAX_ATTEMPTS'),
      'verify-production must execute resilient retry loop'
    );
  });

  it('should verify automated Discord #dev-alerts notification dispatch on deployment status', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    const notifyIdx = content.indexOf('notify-deployment:');
    assert.ok(notifyIdx !== -1, 'notify-deployment job must be present');
    const notifySection = content.slice(notifyIdx);

    assert.ok(
      notifySection.includes('if: always()'),
      'notify-deployment must execute unconditionally (if: always()) to catch failures'
    );
    assert.ok(
      notifySection.includes('DISCORD_WEBHOOK_DEV_ALERTS') ||
        notifySection.includes('DISCORD_WEBHOOK'),
      'notify-deployment must bind Discord webhook'
    );
    assert.ok(
      notifySection.includes('STATUS="SUCCESS"') && notifySection.includes('STATUS="FAILURE"'),
      'notify-deployment must support both SUCCESS and FAILURE notifications'
    );
    assert.ok(
      notifySection.includes('embeds'),
      'notify-deployment must format Discord rich embed'
    );
  });

  it('should verify verifyDeployWorkflowConfiguration helper accurately evaluates pipeline health', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');
    const checks = verifyDeployWorkflowConfiguration(content);

    assert.equal(checks.length, 6, 'Must evaluate all 6 core pipeline attributes');
    const allPassed = checks.every((c) => c.passed);
    assert.equal(allPassed, true, 'All automated configuration checks must pass');
  });

  it('should verify probeProductionEdge gracefully handles mock or unreachable endpoints', async () => {
    // Probe mock unreachable port
    const result = await probeProductionEdge('http://127.0.0.1:59999/api/health');
    assert.equal(result.ok, false);
    assert.ok(result.durationMs >= 0);
  });

  it('should verify runbooks and skills document production CD pipeline and Discord notifications', () => {
    assert.ok(fs.existsSync(promotionRunbookPath), 'PRODUCTION_PROMOTION.md must exist');
    const runbookContent = fs.readFileSync(promotionRunbookPath, 'utf-8');
    assert.ok(
      runbookContent.includes('PRODUCTION_PROMOTION.md') || runbookContent.includes('Production Promotion'),
      'Runbook title confirmed'
    );
    assert.ok(
      runbookContent.includes('deploy-production') && runbookContent.includes('verify-production'),
      'Runbook must document production deployment jobs'
    );

    assert.ok(fs.existsSync(devopsSkillPath), '.agents/skills/devops/SKILL.md must exist');
    const devopsContent = fs.readFileSync(devopsSkillPath, 'utf-8');
    assert.ok(
      devopsContent.includes('deploy.yml') || devopsContent.includes('production'),
      'DevOps skill must document production deployment'
    );

    assert.ok(fs.existsSync(hldPath), 'docs/HIGH_LEVEL_DESIGN.md must exist');
    const hldContent = fs.readFileSync(hldPath, 'utf-8');
    assert.ok(
      hldContent.includes('wrangler deploy --env production') || hldContent.includes('Production Deployment'),
      'HLD must document production deployment'
    );
  });
});
