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

    // Production Custom Domain Routes
    assert.ok(
      content.includes('pattern = "chrishop.com/*"') && content.includes('zone_name = "chrishop.com"'),
      'Production route chrishop.com/* must be configured with zone chrishop.com'
    );
    assert.ok(
      content.includes('pattern = "www.chrishop.com/*"') && content.includes('zone_name = "chrishop.com"'),
      'Production route www.chrishop.com/* must be configured with zone chrishop.com'
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
    assert.match(content, /NEXT_PUBLIC_SITE_URL\s*=\s*"https:\/\/chrishop\.com"/, 'NEXT_PUBLIC_SITE_URL must be chrishop.com');
  });

  it('should verify staging environment configuration, bindings, and routes', () => {
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    // Staging block
    assert.ok(content.includes('[env.staging]'), 'Must declare [env.staging]');
    assert.match(content, /name\s*=\s*"chrishop-staging"/, 'Staging worker name must be chrishop-staging');

    // Staging Custom Domain Routes
    assert.ok(
      content.includes('pattern = "staging.chrishop.com/*"') && content.includes('zone_name = "chrishop.com"'),
      'Staging route staging.chrishop.com/* must be configured with zone chrishop.com'
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
      /NEXT_PUBLIC_SITE_URL\s*=\s*"https:\/\/staging\.chrishop\.com"/,
      'Staging NEXT_PUBLIC_SITE_URL must be staging.chrishop.com'
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

  it('should verify deploy workflow triggers and targets staging vs production', () => {
    assert.ok(fs.existsSync(deployWorkflowPath), 'deploy.yml must exist');
    const content = fs.readFileSync(deployWorkflowPath, 'utf-8');

    // Trigger branches
    assert.match(content, /branches:\s*\n\s*-\s*main\s*\n\s*-\s*staging/, 'Deploy workflow must trigger on main and staging');

    // Environment determination
    assert.ok(content.includes('target=production'), 'Must target production on main branch');
    assert.ok(content.includes('target=staging'), 'Must target staging on staging branch');
    assert.ok(content.includes('deploy --env ${{ steps.env.outputs.target }}'), 'Must deploy with determined env');
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
    assert.ok(content.includes('Ephemeral PR Preview Ready!'), 'Must comment preview ready on PR');
    assert.ok(content.includes('pr-${PR_NUM}.preview.chrishop.com'), 'Must construct preview URL');
  });

  it('should verify wrangler CLI supports local emulation dev command', () => {
    const output = execSync('pnpm exec wrangler dev --help', { cwd: rootDir, encoding: 'utf-8' });
    assert.ok(output.includes('wrangler dev'), 'Wrangler CLI must support dev command');
    assert.ok(output.includes('--env'), 'Wrangler dev must support --env flag');
    assert.ok(output.includes('--port'), 'Wrangler dev must support --port flag');
  });
});
