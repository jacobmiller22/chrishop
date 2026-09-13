import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Cloudflare Workers Project & Staging Setup (wrangler.toml & Workflows)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const wranglerPath = path.join(rootDir, 'wrangler.toml');
  const deployWorkflowPath = path.join(rootDir, '.github/workflows/deploy.yml');
  const previewWorkflowPath = path.join(rootDir, '.github/workflows/preview-deploy.yml');
  const ciWorkflowPath = path.join(rootDir, '.github/workflows/ci.yml');

  it('should verify wrangler.toml exists at monorepo root', () => {
    assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml must exist at root');
  });

  it('should verify production environment configuration, bindings, and routes', () => {
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    // Basic worker settings
    assert.match(content, /^name\s*=\s*"chrishop"/m, 'Production worker name must be "chrishop"');
    assert.match(content, /main\s*=\s*"\.open-next\/worker\.js"/, 'Main entrypoint must be .open-next/worker.js');
    assert.match(content, /compatibility_date\s*=\s*"2024-09-23"/, 'Compatibility date must be set');
    assert.ok(content.includes('"nodejs_compat"'), 'Compatibility flags must include nodejs_compat');
    assert.ok(
      content.includes('assets = { directory = ".open-next/assets", binding = "ASSETS" }'),
      'Production must declare assets binding ASSETS'
    );

    // Production Custom Domain Routes
    assert.ok(
      content.includes('pattern = "chrishop.jacobmiller22.com/*"') && content.includes('zone_name = "jacobmiller22.com"'),
      'Production route chrishop.jacobmiller22.com/* must be configured with zone jacobmiller22.com'
    );
    assert.ok(
      content.includes('pattern = "shop.jacobmiller22.com/*"') && content.includes('zone_name = "jacobmiller22.com"'),
      'Production route shop.jacobmiller22.com/* must be configured with zone jacobmiller22.com'
    );

    // Production D1, KV, R2 Bindings
    assert.ok(content.includes('[[d1_databases]]'), 'Must declare [[d1_databases]]');
    assert.match(content, /binding\s*=\s*"DB"/, 'D1 binding must be DB');
    assert.match(content, /database_name\s*=\s*"chrishop-prod-db"/, 'D1 database name must be chrishop-prod-db');

    assert.ok(content.includes('[[kv_namespaces]]'), 'Must declare [[kv_namespaces]]');
    assert.match(content, /binding\s*=\s*"NEXT_CACHE_WORKERS_KV"/, 'KV binding must be NEXT_CACHE_WORKERS_KV');

    assert.ok(content.includes('[[r2_buckets]]'), 'Must declare [[r2_buckets]]');
    assert.match(content, /binding\s*=\s*"BUCKET"/, 'R2 binding must be BUCKET');
    assert.match(content, /bucket_name\s*=\s*"chrishop-media-prod"/, 'R2 bucket name must be chrishop-media-prod');

    // Production Vars
    assert.match(content, /NODE_ENV\s*=\s*"production"/, 'NODE_ENV must be production');
    assert.match(content, /SITE_URL\s*=\s*"https:\/\/chrishop\.jacobmiller22\.com"/, 'SITE_URL must be chrishop.jacobmiller22.com');
    assert.match(content, /NEXT_PUBLIC_SITE_URL\s*=\s*"https:\/\/chrishop\.jacobmiller22\.com"/, 'NEXT_PUBLIC_SITE_URL must be chrishop.jacobmiller22.com');
    assert.match(content, /CMS_URL\s*=\s*"https:\/\/chrishop\.jacobmiller22\.com"/, 'CMS_URL must be chrishop.jacobmiller22.com');
  });

  it('should verify staging environment configuration, bindings, and routes', () => {
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    // Staging block
    assert.ok(content.includes('[env.staging]'), 'Must declare [env.staging]');
    assert.match(content, /name\s*=\s*"chrishop-staging"/, 'Staging worker name must be chrishop-staging');
    assert.ok(
      content.includes('[env.staging]\nname = "chrishop-staging"\nassets = { directory = ".open-next/assets", binding = "ASSETS" }') ||
      (content.includes('[env.staging]') && content.includes('assets = { directory = ".open-next/assets", binding = "ASSETS" }')),
      'Staging must configure assets binding'
    );

    // Staging Custom Domain Routes (2-tier subdomains)
    assert.ok(
      content.includes('pattern = "staging-chrishop.jacobmiller22.com/*"') && content.includes('zone_name = "jacobmiller22.com"'),
      'Staging route staging-chrishop.jacobmiller22.com/* must be configured with zone jacobmiller22.com'
    );
    assert.ok(
      content.includes('pattern = "staging-shop.jacobmiller22.com/*"') && content.includes('zone_name = "jacobmiller22.com"'),
      'Staging route staging-shop.jacobmiller22.com/* must be configured with zone jacobmiller22.com'
    );

    // Staging D1, KV, R2 Bindings
    assert.ok(content.includes('[[env.staging.d1_databases]]'), 'Must declare [[env.staging.d1_databases]]');
    assert.match(content, /database_name\s*=\s*"chrishop-staging-db"/, 'Staging D1 database name must be chrishop-staging-db');

    assert.ok(content.includes('[[env.staging.kv_namespaces]]'), 'Must declare [[env.staging.kv_namespaces]]');

    assert.ok(content.includes('[[env.staging.r2_buckets]]'), 'Must declare [[env.staging.r2_buckets]]');
    assert.match(content, /bucket_name\s*=\s*"chrishop-media-staging"/, 'Staging R2 bucket name must be chrishop-media-staging');

    // Staging Vars
    assert.match(content, /NODE_ENV\s*=\s*"staging"/, 'Staging NODE_ENV must be staging');
    assert.match(
      content,
      /NEXT_PUBLIC_SITE_URL\s*=\s*"https:\/\/staging-chrishop\.jacobmiller22\.com"/,
      'Staging NEXT_PUBLIC_SITE_URL must be staging-chrishop.jacobmiller22.com'
    );
    assert.match(
      content,
      /SITE_URL\s*=\s*"https:\/\/staging-chrishop\.jacobmiller22\.com"/,
      'Staging SITE_URL must be staging-chrishop.jacobmiller22.com'
    );
  });

  it('should verify production environment section [env.production] for explicit --env deployments', () => {
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    assert.ok(content.includes('[env.production]'), 'Must declare [env.production] for explicit --env production deployments');
    assert.ok(content.includes('[[env.production.d1_databases]]'), 'Must declare [[env.production.d1_databases]]');
    assert.ok(content.includes('[[env.production.kv_namespaces]]'), 'Must declare [[env.production.kv_namespaces]]');
    assert.ok(content.includes('[[env.production.r2_buckets]]'), 'Must declare [[env.production.r2_buckets]]');
  });

  it('should verify ephemeral PR preview environment section [env.preview]', () => {
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    assert.ok(content.includes('[env.preview]'), 'Must declare [env.preview]');
    assert.match(content, /name\s*=\s*"chrishop-preview"/, 'Preview worker name must be chrishop-preview');
    assert.ok(content.includes('[[env.preview.d1_databases]]'), 'Must declare [[env.preview.d1_databases]]');
    assert.ok(content.includes('[[env.preview.kv_namespaces]]'), 'Must declare [[env.preview.kv_namespaces]]');
    assert.ok(content.includes('[[env.preview.r2_buckets]]'), 'Must declare [[env.preview.r2_buckets]]');
  });

  it('should validate wrangler types generation across all target environments', () => {
    const targets = ['', '--env production', '--env staging', '--env preview'];
    for (const target of targets) {
      const cmd = `pnpm exec wrangler types ${target}`.trim();
      const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8' });
      assert.ok(
        output.includes('Generating project types') || output.includes('interface Env'),
        `Wrangler types must succeed for ${target || 'default'}`
      );
    }

    // Clean up any generated types artifact to maintain worktree hygiene
    const generatedTypes = path.join(rootDir, 'worker-configuration.d.ts');
    if (fs.existsSync(generatedTypes)) {
      fs.unlinkSync(generatedTypes);
    }
  });

  it('should verify deploy workflow triggers and declares 5-stage staged promotion pipeline', () => {
    assert.ok(fs.existsSync(deployWorkflowPath), 'deploy.yml must exist');
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // Trigger branches
    assert.ok(content.includes('staging'), 'Deploy workflow must trigger on staging');
    assert.ok(content.includes('production'), 'Deploy workflow must trigger on production');

    // 5 orchestrated jobs
    assert.ok(content.includes('build-and-validate:'), 'Must declare build-and-validate job');
    assert.ok(content.includes('deploy-staging:'), 'Must declare deploy-staging job');
    assert.ok(content.includes('test-staging:'), 'Must declare test-staging job');
    assert.ok(content.includes('deploy-production:'), 'Must declare deploy-production job');
    assert.ok(content.includes('verify-production:'), 'Must declare verify-production job');

    // Dependency orchestration
    assert.ok(content.includes('needs: [build-and-validate]'), 'deploy-staging must depend on build-and-validate');
    assert.ok(content.includes('needs: [deploy-staging]'), 'test-staging must depend on deploy-staging');
    assert.ok(
      content.includes('needs: [build-and-validate, deploy-staging, test-staging]'),
      'deploy-production must depend on build-and-validate, deploy-staging, and test-staging'
    );
    assert.ok(content.includes('needs: [deploy-production]'), 'verify-production must depend on deploy-production');
  });

  it('should verify staging edge health probe and production human approval gate in deploy workflow', () => {
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // Staging health probe
    assert.ok(
      content.includes('staging-chrishop.jacobmiller22.com') || content.includes('staging.chrishop.jacobmiller22.com'),
      'test-staging job must probe staging edge health URL'
    );
    assert.ok(content.includes('/api/health'), 'test-staging job must probe /api/health');

    // Production environment human gate
    assert.ok(content.includes('environment: production'), 'deploy-production must declare environment: production');
    assert.ok(content.includes('deploy --env production'), 'deploy-production must deploy with --env production');

    // Production post-deployment verification
    assert.ok(
      content.includes('chrishop.jacobmiller22.com') && content.includes('/api/health'),
      'verify-production job must probe production health at chrishop.jacobmiller22.com/api/health'
    );
  });

  it('should verify CI workflow enforces promotion rules for PRs targeting production', () => {
    assert.ok(fs.existsSync(ciWorkflowPath), 'ci.yml must exist');
    const content = fs.readFileSync(ciWorkflowPath, 'utf-8');

    // Trigger branches
    assert.ok(content.includes('production'), 'CI must trigger on production branch');
    assert.ok(content.includes('staging'), 'CI must trigger on staging branch');

    // Enforce promotion rules job
    assert.ok(content.includes('enforce-promotion-rules:'), 'CI must declare enforce-promotion-rules job');
    assert.ok(content.includes('base_ref }}" = "production"'), 'Must check if base branch is production');
    assert.ok(content.includes('head_ref }}" != "staging"'), 'Must reject if head branch is not staging');
    assert.ok(
      content.includes('Only the \'staging\' branch is permitted to merge into \'production\''),
      'Must output explanatory error message when non-staging branch targets production'
    );
  });

  it('should verify ephemeral PR preview deploy workflow triggers and notifications', () => {
    assert.ok(fs.existsSync(previewWorkflowPath), 'preview-deploy.yml must exist');
    const content = fs.readFileSync(previewWorkflowPath, 'utf-8');

    // Pull request trigger
    assert.ok(content.includes('pull_request:'), 'Must trigger on pull_request');
    assert.ok(content.includes('types: [opened, synchronize, reopened]'), 'Must trigger on opened, synchronize, reopened');

    // Preview deploy command
    assert.ok(content.includes('deploy --env preview'), 'Must deploy with --env preview');

    // Preview URL comment
    assert.ok(content.includes('Ephemeral PR Preview'), 'Must comment preview status on PR');
    assert.ok(content.includes('pr-${PR_NUM}-chrishop.jacobmiller22.com'), 'Must construct preview URL');
  });

  it('should verify ephemeral PR preview teardown workflow destroys stack on all closed PRs', () => {
    const teardownWorkflowPath = path.join(rootDir, '.github/workflows/preview-teardown.yml');
    assert.ok(fs.existsSync(teardownWorkflowPath), 'preview-teardown.yml must exist');
    const content = fs.readFileSync(teardownWorkflowPath, 'utf-8');

    // Trigger on closed PRs
    assert.ok(content.includes('pull_request:'), 'Must trigger on pull_request');
    assert.ok(content.includes('types: [closed]'), 'Must trigger on closed');

    // Deletion steps
    assert.ok(content.includes('wrangler-action@v3'), 'Must use wrangler-action for teardown');
    assert.ok(content.includes('delete --name chrishop-preview-pr-'), 'Must delete preview worker script');
    assert.ok(content.includes('terraform destroy -auto-approve'), 'Must destroy Terraform preview state');

    // Must NOT be restricted to unmerged PRs only
    assert.ok(
      !content.includes('github.event.pull_request.merged == false'),
      'Teardown must execute for both merged and unmerged PRs (no merged == false gate)'
    );

    // PR comment update
    assert.ok(content.includes('Comment Teardown Status on PR'), 'Must post teardown status to PR');
  });

  it('should verify preview cleanup workflow and script configuration', () => {
    const cleanupWorkflowPath = path.join(rootDir, '.github/workflows/preview-cleanup.yml');
    assert.ok(fs.existsSync(cleanupWorkflowPath), 'preview-cleanup.yml must exist');
    const workflowContent = fs.readFileSync(cleanupWorkflowPath, 'utf-8');

    assert.ok(workflowContent.includes('schedule:'), 'Must configure scheduled cron');
    assert.ok(workflowContent.includes('workflow_dispatch:'), 'Must configure workflow_dispatch');
    assert.ok(workflowContent.includes('preview:cleanup'), 'Must invoke preview:cleanup script');

    const pkgJsonPath = path.join(rootDir, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    assert.ok(pkgJson.scripts['preview:cleanup'], 'package.json must declare preview:cleanup script');
  });

  it('should verify wrangler CLI supports local emulation dev command', () => {
    const output = execSync('pnpm exec wrangler dev --help', { cwd: rootDir, encoding: 'utf-8' });
    assert.ok(output.includes('wrangler dev'), 'Wrangler CLI must support dev command');
    assert.ok(output.includes('--env'), 'Wrangler dev must support --env flag');
    assert.ok(output.includes('--port'), 'Wrangler dev must support --port flag');
  });
});
