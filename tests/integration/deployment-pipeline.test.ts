import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { GET } from '../../apps/web/src/app/api/health/route';

describe('Story 2.25: Cloudflare Workers CI/CD Deployment Pipeline & OpenNext Integration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const openNextConfigPath = path.join(rootDir, 'apps/web/open-next.config.ts');
  const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
  const rollbackWorkflowPath = path.join(rootDir, '.github/workflows/rollback.yml');

  describe('1. OpenNext Configuration & Route Splitting (apps/web/open-next.config.ts)', () => {
    it('should verify open-next.config.ts exists in apps/web', () => {
      assert.ok(fs.existsSync(openNextConfigPath), 'apps/web/open-next.config.ts must exist');
    });

    it('should configure default storefront function and isolated admin function', () => {
      const content = fs.readFileSync(openNextConfigPath, 'utf-8');

      // Default function
      assert.ok(
        content.includes('defineCloudflareConfig'),
        'Must import and use defineCloudflareConfig'
      );

      // Admin function splitting
      assert.ok(content.includes('functions ='), 'Must declare custom functions for route splitting');
      assert.ok(content.includes('admin:'), 'Must configure dedicated admin function');
      assert.ok(
        content.includes('app/(payload)/admin/[[...segments]]/page'),
        'Must isolate Payload admin pages'
      );
      assert.ok(
        content.includes('app/(payload)/api/[...slug]/route'),
        'Must isolate Payload REST API route'
      );
      assert.ok(
        content.includes('app/(payload)/api/graphql/route'),
        'Must isolate Payload GraphQL route'
      );
      assert.ok(
        content.includes("'admin/*'") && content.includes("'api/payload/*'"),
        'Must configure admin and api route patterns'
      );
    });
  });

  describe('2. Automated CI/CD Deployment Workflow (.github/workflows/deploy.yml)', () => {
    it('should verify deploy.yml triggers on main and staging push and manual dispatch', () => {
      assert.ok(fs.existsSync(deployWorkflowPath), 'deploy.yml must exist');
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

      assert.match(content, /branches:\s*\n\s*-\s*main\s*\n\s*-\s*staging/, 'Must trigger on main and staging');
      assert.ok(content.includes('workflow_dispatch:'), 'Must support workflow_dispatch manual trigger');
      assert.ok(content.includes('concurrency:'), 'Must define concurrency to prevent race conditions');
    });

    it('should enforce strict pre-deploy validation gates including unit and integration tests', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

      assert.ok(content.includes('pnpm audit --audit-level=high'), 'Must include security audit');
      assert.ok(content.includes('pnpm run check'), 'Must include typecheck and lint');
      assert.ok(content.includes('pnpm run test:unit'), 'Must run unit tests');
      assert.ok(content.includes('pnpm run test:integration'), 'Must run ephemeral integration tests');
      assert.ok(content.includes('pnpm run build'), 'Must build production application');
    });

    it('should execute pre-deploy dry-run gate with wrangler before deploying', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

      assert.ok(
        content.includes('pnpm exec wrangler deploy --dry-run --env ${{ steps.env.outputs.target }}'),
        'Must execute wrangler deploy --dry-run before deployment'
      );
    });

    it('should accurately resolve target environments for main vs staging', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

      assert.ok(content.includes('target=production'), 'Must set production target for main branch');
      assert.ok(content.includes('target=staging'), 'Must set staging target for staging branch');
      assert.ok(
        content.includes('command: deploy --env ${{ steps.env.outputs.target }}'),
        'Must deploy using resolved environment'
      );
    });

    it('should include zero-downtime edge health check validation with propagation retries', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

      assert.ok(
        content.includes('Verify Zero-Downtime Edge Health Check'),
        'Must define edge health check step'
      );
      assert.ok(
        content.includes('https://chrishop.com/api/health') &&
          content.includes('https://staging.chrishop.com/api/health'),
        'Must target production and staging health endpoints'
      );
      assert.ok(content.includes('MAX_RETRIES='), 'Must support retry loop for edge propagation');
    });
  });

  describe('3. Emergency Rollback Workflow (.github/workflows/rollback.yml)', () => {
    it('should verify rollback.yml supports manual dispatch with environment and deployment ID', () => {
      assert.ok(fs.existsSync(rollbackWorkflowPath), 'rollback.yml must exist');
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');

      assert.ok(content.includes('workflow_dispatch:'), 'Must trigger via workflow_dispatch');
      assert.ok(content.includes('deployment_id:'), 'Must accept deployment_id input');
      assert.ok(content.includes('environment:'), 'Must accept environment selection input');
      assert.ok(
        content.includes('command: rollback ${{ github.event.inputs.deployment_id }} --env ${{ github.event.inputs.environment }}'),
        'Must execute wrangler rollback with target environment and optional deployment ID'
      );
    });

    it('should include post-rollback health verification', () => {
      const content = fs.readFileSync(rollbackWorkflowPath, 'utf-8');
      assert.ok(
        content.includes('Verify Post-Rollback Health'),
        'Must verify health following rollback execution'
      );
    });
  });

  describe('4. Wrangler Deployment Dry-Run Execution Across Environments', () => {
    // Ensure worker bundle is built prior to dry-run testing
    it('should successfully build worker bundle for dry-run validation', () => {
      execSync('pnpm run build:worker', { cwd: rootDir, stdio: 'pipe' });
      assert.ok(fs.existsSync(path.join(rootDir, '.open-next/worker.js')));
    });

    it('should validate staging deployment dry-run with correct bindings and environment vars', () => {
      const output = execSync('pnpm exec wrangler deploy --dry-run --env staging', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('--dry-run: exiting now'), 'Staging dry-run must exit cleanly');
      assert.ok(output.includes('chrishop-staging-db'), 'Must bind staging D1 database');
      assert.ok(output.includes('NEXT_CACHE_WORKERS_KV'), 'Must bind staging KV cache namespace');
      assert.ok(output.includes('chrishop-media-staging'), 'Must bind staging R2 media bucket');
      assert.ok(output.includes('NODE_ENV: "staging"'), 'Must set NODE_ENV to staging');
      assert.ok(
        output.includes('NEXT_PUBLIC_SITE_URL: "https://staging.chrishop.com"'),
        'Must set site URL to staging.chrishop.com'
      );
    });

    it('should validate production deployment dry-run with correct bindings and environment vars', () => {
      const output = execSync('pnpm exec wrangler deploy --dry-run --env production', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('--dry-run: exiting now'), 'Production dry-run must exit cleanly');
      assert.ok(output.includes('chrishop-prod-db'), 'Must bind production D1 database');
      assert.ok(output.includes('NEXT_CACHE_WORKERS_KV'), 'Must bind production KV cache namespace');
      assert.ok(output.includes('chrishop-media-prod'), 'Must bind production R2 media bucket');
      assert.ok(output.includes('NODE_ENV: "production"'), 'Must set NODE_ENV to production');
      assert.ok(
        output.includes('NEXT_PUBLIC_SITE_URL: "https://chrishop.com"'),
        'Must set site URL to chrishop.com'
      );
    });
  });

  describe('5. Edge Health Probe Route & Worker Contract', () => {
    it('should return 200 OK with healthy status payload from /api/health route handler', async () => {
      const response = await GET();
      assert.equal(response.status, 200);

      const data = await response.json();
      assert.equal(data.status, 'healthy');
      assert.equal(data.service, '@chrishop/web');
      assert.ok(data.timestamp);
    });

    it('should verify worker bundle contains edge health probe and runtime bindings check', () => {
      const workerPath = path.join(rootDir, '.open-next/worker.js');
      const content = fs.readFileSync(workerPath, 'utf-8');

      assert.ok(content.includes('/api/health'), 'Worker must handle /api/health path');
      assert.ok(content.includes("status: 'healthy'"), 'Worker health check must report healthy');
      assert.ok(content.includes('d1: Boolean(env.DB)'), 'Worker health check must verify D1 binding');
      assert.ok(
        content.includes('kv: Boolean(env.NEXT_CACHE_WORKERS_KV)'),
        'Worker health check must verify KV binding'
      );
      assert.ok(
        content.includes('r2: Boolean(env.BUCKET)'),
        'Worker health check must verify R2 binding'
      );
    });
  });
});
