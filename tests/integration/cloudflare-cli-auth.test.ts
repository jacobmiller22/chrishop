import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

describe('Cloudflare Platform Provisioning & Wrangler CLI Configuration (Story 2.28)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const wranglerPath = path.join(rootDir, 'wrangler.toml');
  const envExamplePath = path.join(rootDir, '.env.example');
  const r2CorsPath = path.join(rootDir, 'infra/r2/cors-media.json');
  const homeDir = os.homedir();
  const mcpConfigPath = path.join(homeDir, '.gemini/config/mcp_config.json');
  const globalSkillsDir = path.join(homeDir, '.agents/skills');

  it('should verify wrangler.toml declares parameterizable routes for jacobmiller22.com and chrishop.com', () => {
    assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml must exist');
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    // Route declarations for personal Cloudflare account (jacobmiller22.com)
    assert.ok(
      content.includes('pattern = "chrishop.jacobmiller22.com/*"') && content.includes('zone_name = "jacobmiller22.com"'),
      'Production routes must include chrishop.jacobmiller22.com'
    );
    assert.ok(
      content.includes('pattern = "staging.chrishop.jacobmiller22.com/*"') && content.includes('zone_name = "jacobmiller22.com"'),
      'Staging routes must include staging.chrishop.jacobmiller22.com'
    );

    // Primary domain routes
    assert.ok(
      content.includes('pattern = "chrishop.com/*"') && content.includes('zone_name = "chrishop.com"'),
      'Production routes must include chrishop.com'
    );
    assert.ok(
      content.includes('pattern = "staging.chrishop.com/*"') && content.includes('zone_name = "chrishop.com"'),
      'Staging routes must include staging.chrishop.com'
    );
  });

  it('should verify D1, KV, and R2 resource declarations in wrangler.toml', () => {
    const content = fs.readFileSync(wranglerPath, 'utf-8');

    // Production bindings
    assert.ok(content.includes('[[d1_databases]]'), 'Must declare [[d1_databases]]');
    assert.match(content, /binding\s*=\s*"DB"/, 'D1 binding must be DB');
    assert.match(content, /database_name\s*=\s*"chrishop-prod-db"/, 'D1 database name must be chrishop-prod-db');

    assert.ok(content.includes('[[kv_namespaces]]'), 'Must declare [[kv_namespaces]]');
    assert.match(content, /binding\s*=\s*"NEXT_CACHE_WORKERS_KV"/, 'KV binding must be NEXT_CACHE_WORKERS_KV');

    assert.ok(content.includes('[[r2_buckets]]'), 'Must declare [[r2_buckets]]');
    assert.match(content, /binding\s*=\s*"BUCKET"/, 'R2 binding must be BUCKET');
    assert.match(content, /bucket_name\s*=\s*"chrishop-media-prod"/, 'R2 bucket name must be chrishop-media-prod');

    // Staging bindings
    assert.ok(content.includes('[[env.staging.d1_databases]]'), 'Must declare [[env.staging.d1_databases]]');
    assert.match(content, /database_name\s*=\s*"chrishop-staging-db"/, 'Staging D1 database name must be chrishop-staging-db');
    assert.ok(content.includes('[[env.staging.kv_namespaces]]'), 'Must declare [[env.staging.kv_namespaces]]');
    assert.ok(content.includes('[[env.staging.r2_buckets]]'), 'Must declare [[env.staging.r2_buckets]]');
    assert.match(content, /bucket_name\s*=\s*"chrishop-media-staging"/, 'Staging R2 bucket name must be chrishop-media-staging');

    // Preview bindings
    assert.ok(content.includes('[[env.preview.d1_databases]]'), 'Must declare [[env.preview.d1_databases]]');
    assert.ok(content.includes('[[env.preview.kv_namespaces]]'), 'Must declare [[env.preview.kv_namespaces]]');
    assert.ok(content.includes('[[env.preview.r2_buckets]]'), 'Must declare [[env.preview.r2_buckets]]');
  });

  it('should verify R2 CORS policies allow custom subdomains and localhost', () => {
    assert.ok(fs.existsSync(r2CorsPath), 'infra/r2/cors-media.json must exist');
    const cors = JSON.parse(fs.readFileSync(r2CorsPath, 'utf-8'));

    assert.ok(Array.isArray(cors.CORSRules), 'CORSRules must be an array');
    const origins: string[] = cors.CORSRules[0]?.AllowedOrigins || [];

    assert.ok(origins.includes('https://chrishop.com'), 'Must allow https://chrishop.com');
    assert.ok(origins.includes('https://shop.jacobmiller22.com'), 'Must allow https://shop.jacobmiller22.com');
    assert.ok(origins.includes('http://localhost:3000'), 'Must allow http://localhost:3000');
  });

  it('should verify edge environment variables and secrets documented in .env.example', () => {
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    // Cloudflare credentials
    assert.match(content, /CLOUDFLARE_API_TOKEN=/, 'Must document CLOUDFLARE_API_TOKEN');
    assert.match(content, /CLOUDFLARE_ACCOUNT_ID=/, 'Must document CLOUDFLARE_ACCOUNT_ID');

    // Discord notification engine
    assert.match(content, /DISCORD_WEBHOOK_URL=/, 'Must document DISCORD_WEBHOOK_URL');

    // Shopify Headless credentials
    assert.match(content, /SHOPIFY_ADMIN_TOKEN=/, 'Must document SHOPIFY_ADMIN_TOKEN');
    assert.match(content, /SHOPIFY_WEBHOOK_SECRET=/, 'Must document SHOPIFY_WEBHOOK_SECRET');
  });

  it('should verify Antigravity global mcp_config.json registers Cloudflare MCP servers', (t) => {
    const cfDocs = fs.readFileSync(path.join(rootDir, 'docs/CLOUDFLARE_SETUP.md'), 'utf-8');
    assert.ok(cfDocs.includes('https://mcp.cloudflare.com/mcp'), 'CLOUDFLARE_SETUP.md must document cloudflare MCP URL');
    assert.ok(cfDocs.includes('https://docs.mcp.cloudflare.com/mcp'), 'CLOUDFLARE_SETUP.md must document cloudflare-docs MCP URL');

    if (!fs.existsSync(mcpConfigPath)) {
      t.diagnostic('Skipping home directory ~/.gemini/config/mcp_config.json verification in headless CI environment');
      return;
    }

    const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    assert.ok(config.mcpServers, 'mcpServers object must be present');
    assert.equal(config.mcpServers.cloudflare?.serverUrl, 'https://mcp.cloudflare.com/mcp');
    assert.equal(config.mcpServers['cloudflare-docs']?.serverUrl, 'https://docs.mcp.cloudflare.com/mcp');
    assert.equal(config.mcpServers['cloudflare-bindings']?.serverUrl, 'https://bindings.mcp.cloudflare.com/mcp');
    assert.equal(config.mcpServers['cloudflare-builds']?.serverUrl, 'https://builds.mcp.cloudflare.com/mcp');
    assert.equal(config.mcpServers['cloudflare-observability']?.serverUrl, 'https://observability.mcp.cloudflare.com/mcp');
  });

  it('should verify Cloudflare skills installed in global .agents/skills directory', (t) => {
    const cfDocs = fs.readFileSync(path.join(rootDir, 'docs/CLOUDFLARE_SETUP.md'), 'utf-8');
    assert.ok(cfDocs.includes('npx -y skills add cloudflare/skills'), 'CLOUDFLARE_SETUP.md must document skill install command');

    if (!fs.existsSync(globalSkillsDir)) {
      t.diagnostic('Skipping home directory ~/.agents/skills verification in headless CI environment');
      return;
    }

    assert.ok(fs.existsSync(path.join(globalSkillsDir, 'wrangler')), 'wrangler skill must be installed');
    assert.ok(fs.existsSync(path.join(globalSkillsDir, 'cloudflare')), 'cloudflare skill must be installed');
    assert.ok(fs.existsSync(path.join(globalSkillsDir, 'workers-best-practices')), 'workers-best-practices skill must be installed');
  });

  it('should verify wrangler CLI is operational and can generate environment types', () => {
    const version = execSync('pnpm exec wrangler --version', { cwd: rootDir, encoding: 'utf-8' });
    assert.match(version, /\d+\.\d+\.\d+/, 'Wrangler CLI must report version');

    // Verify types generation works cleanly across staging and preview
    for (const env of ['staging', 'preview']) {
      const output = execSync(`pnpm exec wrangler types --env ${env}`, { cwd: rootDir, encoding: 'utf-8' });
      assert.ok(
        output.includes('Generating project types') || output.includes('interface Env'),
        `Wrangler types must succeed for --env ${env}`
      );
    }

    // Maintain worktree hygiene by removing generated types artifact
    const typesFile = path.join(rootDir, 'worker-configuration.d.ts');
    if (fs.existsSync(typesFile)) {
      fs.unlinkSync(typesFile);
    }
  });

  it('should validate API credentials and provide graceful diagnostics if unauthenticated', () => {
    const hasToken = Boolean(process.env.CLOUDFLARE_API_TOKEN);
    const hasAccountId = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);

    if (hasToken && hasAccountId) {
      assert.ok(process.env.CLOUDFLARE_API_TOKEN!.length > 10, 'CLOUDFLARE_API_TOKEN must have valid token length');
      assert.ok(process.env.CLOUDFLARE_ACCOUNT_ID!.length > 10, 'CLOUDFLARE_ACCOUNT_ID must have valid hex length');
    } else {
      // In local or CI environments without active Cloudflare tokens, assert that wrangler whoami reports unauthenticated or guidance
      const whoamiOutput = execSync('pnpm exec wrangler whoami', { cwd: rootDir, encoding: 'utf-8' });
      assert.ok(
        whoamiOutput.includes('wrangler login') || whoamiOutput.includes('Account Name') || whoamiOutput.includes('Account ID'),
        'Wrangler whoami must report either authenticated status or login instructions'
      );
    }
  });
});
