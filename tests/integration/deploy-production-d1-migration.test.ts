import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Story 4.1a: Automated Production Cloudflare D1 Database Migration Step in CI/CD Deploy Pipeline', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
  const promotionRunbookPath = path.join(rootDir, 'docs/runbooks/PRODUCTION_PROMOTION.md');
  const devopsSkillPath = path.join(rootDir, '.agents/skills/devops/SKILL.md');

  it('should verify deploy.yml exists and declares deploy-production job', () => {
    assert.ok(fs.existsSync(deployWorkflowPath), '.github/workflows/deploy.yml must exist');
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    assert.ok(content.includes('deploy-production:'), 'deploy.yml must declare deploy-production job');
    assert.ok(content.includes('environment: production'), 'deploy-production must declare environment: production');
  });

  it('should verify deploy-production job includes Apply D1 Migrations to Production Database step', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // Extract deploy-production job block
    const deployProdIndex = content.indexOf('deploy-production:');
    assert.ok(deployProdIndex !== -1, 'deploy-production job not found');
    const afterDeployProd = content.slice(deployProdIndex);
    const nextJobIndex = afterDeployProd.indexOf('verify-production:');
    const deployProdSection = nextJobIndex !== -1 ? afterDeployProd.slice(0, nextJobIndex) : afterDeployProd;

    // Step name assertion
    assert.ok(
      deployProdSection.includes('- name: Apply D1 Migrations to Production Database'),
      'deploy-production must contain "Apply D1 Migrations to Production Database" step'
    );

    // Conditional execution with Cloudflare API credentials
    assert.ok(
      deployProdSection.includes("if: env.CLOUDFLARE_API_TOKEN != '' && env.CLOUDFLARE_ACCOUNT_ID != ''"),
      'Migration step must check for CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID'
    );

    // Command invocation targeting chrishop-prod-db non-interactively
    assert.ok(
      deployProdSection.includes('pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote || true'),
      'Migration step must run "pnpm exec wrangler d1 migrations apply chrishop-prod-db --remote || true"'
    );
  });

  it('should verify migrations execute strictly prior to Worker deployment in deploy-production', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');
    const deployProdIndex = content.indexOf('deploy-production:');
    const afterDeployProd = content.slice(deployProdIndex);
    const nextJobIndex = afterDeployProd.indexOf('verify-production:');
    const deployProdSection = nextJobIndex !== -1 ? afterDeployProd.slice(0, nextJobIndex) : afterDeployProd;

    const migrationStepIndex = deployProdSection.indexOf('name: Apply D1 Migrations to Production Database');
    const workerDeployStepIndex = deployProdSection.indexOf('name: Deploy to Cloudflare Workers (Production)');

    assert.ok(migrationStepIndex !== -1, 'Migration step must exist in deploy-production');
    assert.ok(workerDeployStepIndex !== -1, 'Worker deployment step must exist in deploy-production');
    assert.ok(
      migrationStepIndex < workerDeployStepIndex,
      'D1 migrations must execute BEFORE Worker deployment to prevent schema-code desynchronization'
    );
  });

  it('should verify structural parity between deploy-staging and deploy-production migration steps', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // Both jobs should apply migrations before deploying workers
    assert.ok(
      content.includes('wrangler d1 migrations apply chrishop-staging-db --remote'),
      'deploy-staging must apply migrations to chrishop-staging-db'
    );
    assert.ok(
      content.includes('wrangler d1 migrations apply chrishop-prod-db --remote'),
      'deploy-production must apply migrations to chrishop-prod-db'
    );
  });

  it('should verify documentation in PRODUCTION_PROMOTION.md and devops skill reflect automated migrations', () => {
    assert.ok(fs.existsSync(promotionRunbookPath), 'PRODUCTION_PROMOTION.md must exist');
    const runbookContent = fs.readFileSync(promotionRunbookPath, 'utf-8');
    assert.ok(
      runbookContent.includes('chrishop-prod-db') && runbookContent.includes('wrangler d1 migrations apply'),
      'PRODUCTION_PROMOTION.md must document automated D1 migration execution'
    );

    assert.ok(fs.existsSync(devopsSkillPath), '.agents/skills/devops/SKILL.md must exist');
    const skillContent = fs.readFileSync(devopsSkillPath, 'utf-8');
    assert.ok(
      skillContent.includes('chrishop-prod-db') && skillContent.includes('wrangler d1 migrations apply'),
      'devops skill must document automated D1 migration execution'
    );
  });
});
