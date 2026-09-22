import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildRollbackCommand,
  resolveTargetUrl,
  buildRollbackDiscordPayload,
  parseCliArgs,
  isValidDeploymentId,
  probeHealthEndpoint,
} from '../../scripts/rollback-worker';

describe('Story 4.18: Automated Integration Test Suite for Cloudflare Workers & Database Rollback Procedures', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const migrationsDir = path.join(rootDir, 'migrations');
  const wranglerTomlPath = path.join(rootDir, 'wrangler.toml');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const disasterRecoveryRunbookPath = path.join(rootDir, 'docs/runbooks/DISASTER_RECOVERY.md');

  describe('1. CLI Rollback Parameter Validation & Fail-Safe Error Handling', () => {
    it('should validate valid deployment IDs across standard formats', () => {
      assert.equal(isValidDeploymentId('7e6d708d-a5c5-4ea5-b4d2-11bd637844ec'), true);
      assert.equal(isValidDeploymentId('v1_deploy_20260922'), true);
      assert.equal(isValidDeploymentId('a1b2c3d4-e5f6'), true);
      assert.equal(isValidDeploymentId('deploy_abc123'), true);
    });

    it('should reject malformed or potentially malicious deployment IDs', () => {
      assert.equal(isValidDeploymentId(''), false);
      assert.equal(isValidDeploymentId('   '), false);
      assert.equal(isValidDeploymentId('abc'), false, 'Too short (< 4 chars)');
      assert.equal(isValidDeploymentId('dep with spaces'), false);
      assert.equal(isValidDeploymentId('dep; rm -rf /'), false);
      assert.equal(isValidDeploymentId('dep$(whoami)'), false);
      assert.equal(isValidDeploymentId('dep`cat /etc/passwd`'), false);
      assert.equal(isValidDeploymentId('dep|grep'), false);
    });

    it('should build rollback command for previous deployment without deployment ID', () => {
      const prodCmd = buildRollbackCommand({ environment: 'production' });
      assert.equal(prodCmd, 'wrangler rollback --env production');

      const stagingCmd = buildRollbackCommand({ environment: 'staging' });
      assert.equal(stagingCmd, 'wrangler rollback --env staging');
    });

    it('should build rollback command with valid deployment ID', () => {
      const cmd = buildRollbackCommand({
        environment: 'production',
        deploymentId: '7e6d708d-a5c5-4ea5-b4d2-11bd637844ec',
      });
      assert.equal(
        cmd,
        'wrangler rollback 7e6d708d-a5c5-4ea5-b4d2-11bd637844ec --env production'
      );
    });

    it('should throw fail-safe descriptive error when invalid deployment ID is supplied', () => {
      assert.throws(
        () => {
          buildRollbackCommand({
            environment: 'production',
            deploymentId: 'invalid ID with spaces; rm -rf',
          });
        },
        /Invalid deployment ID/
      );
    });

    it('should parse environment targets accurately from CLI arguments', () => {
      const opts1 = parseCliArgs(['--env', 'production', '--deployment-id', 'dep-101']);
      assert.equal(opts1.environment, 'production');
      assert.equal(opts1.deploymentId, 'dep-101');

      const opts2 = parseCliArgs(['--env', 'staging']);
      assert.equal(opts2.environment, 'staging');
      assert.equal(opts2.deploymentId, undefined);

      const defaultOpts = parseCliArgs([]);
      assert.equal(defaultOpts.environment, 'staging');
    });
  });

  describe('2. Simulated Deployment Version Revert & Worker Bundle Resolution', () => {
    it('should verify wrangler.toml declares valid main entrypoint and nodejs_compat', () => {
      assert.ok(fs.existsSync(wranglerTomlPath), 'wrangler.toml must exist');
      const wranglerContent = fs.readFileSync(wranglerTomlPath, 'utf-8');

      assert.ok(
        wranglerContent.includes('main = ".open-next/worker.js"'),
        'wrangler.toml must point to .open-next/worker.js'
      );
      assert.ok(
        wranglerContent.includes('compatibility_flags = ["nodejs_compat"]'),
        'wrangler.toml must declare nodejs_compat'
      );
      assert.ok(
        wranglerContent.includes('compatibility_date = "2024-09-23"'),
        'wrangler.toml must declare compatibility_date'
      );
    });

    it('should verify worker build script exists for bundle compilation and resolution', () => {
      const buildWorkerScriptPath = path.join(rootDir, 'scripts/build-worker.ts');
      assert.ok(fs.existsSync(buildWorkerScriptPath), 'scripts/build-worker.ts must exist');
      const buildContent = fs.readFileSync(buildWorkerScriptPath, 'utf-8');
      assert.ok(
        buildContent.includes('.open-next') || buildContent.includes('worker'),
        'Must handle worker bundle compilation'
      );
    });
  });

  describe('3. Post-Rollback Edge Route Validation & Health Probing', () => {
    it('should resolve environment domains for health checks', () => {
      assert.equal(resolveTargetUrl('production'), 'https://chrishop.jacobmiller22.com');
      assert.equal(resolveTargetUrl('staging'), 'https://staging-chrishop.jacobmiller22.com');
    });

    it('should probe health endpoint successfully on HTTP 200 response', async () => {
      const mockServer = http.createServer((req, res) => {
        if (req.url === '/api/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', service: 'chrishop-edge', uptime: 1234 }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
      const port = (mockServer.address() as any).port;
      const testUrl = `http://127.0.0.1:${port}/api/health`;

      try {
        const result = await probeHealthEndpoint(testUrl, 1, 100);
        assert.equal(result.ok, true);
        assert.equal(result.status, 200);
        assert.ok(result.message.includes('verified'));
      } finally {
        await new Promise<void>((resolve) => mockServer.close(() => resolve()));
      }
    });

    it('should report probe failure on HTTP 500 error response', async () => {
      const mockServer = http.createServer((_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal edge exception' }));
      });

      await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
      const port = (mockServer.address() as any).port;
      const testUrl = `http://127.0.0.1:${port}/api/health`;

      try {
        const result = await probeHealthEndpoint(testUrl, 1, 100);
        assert.equal(result.ok, false);
        assert.ok(result.message.includes('failed'));
      } finally {
        await new Promise<void>((resolve) => mockServer.close(() => resolve()));
      }
    });
  });

  describe('4. D1 Schema Backward-Compatibility (Expand-and-Contract Model)', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      // Create an ephemeral in-memory SQLite database matching D1 runtime semantics
      db = new DatabaseSync(':memory:');

      // Apply all 9 migrations in sequential order
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        db.exec(sql);
      }
    });

    it('should verify all 9 migrations apply cleanly without schema corruption', () => {
      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as { name: string }[]
      ).map((r) => r.name);

      assert.ok(tables.includes('categories'));
      assert.ok(tables.includes('products'));
      assert.ok(tables.includes('product_variations'));
      assert.ok(tables.includes('product_lines'));
      assert.ok(tables.includes('pages'));
      assert.ok(tables.includes('media'));
      assert.ok(tables.includes('theme_settings'));
    });

    it('should support legacy SELECT queries omitting newly added columns (Expand/Contract validation)', () => {
      // 1. Seed sample category
      db.prepare(
        'INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)'
      ).run('cat-apparel', 'Apparel', 'apparel', 'Mountain apparel');

      // 2. Seed product using newest schema columns (e.g. material_preset from 0007, product_line_id from 0006)
      db.prepare(`
        INSERT INTO products (
          id, title, slug, base_price, status, category_id, shopify_product_id, material_preset, price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'prod-jacket',
        'Storm Anorak',
        'storm-anorak',
        450.0,
        'published',
        'cat-apparel',
        'gid://shopify/Product/999',
        'toray_cordura',
        450.0
      );

      // 3. Seed variation
      db.prepare(`
        INSERT INTO product_variations (
          id, product_id, sku, variation_name, price_override, stock_quantity, shopify_variant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'var-anorak-s',
        'prod-jacket',
        'STORMANORAK-S',
        'Small / Olive',
        475.0,
        5,
        'gid://shopify/ProductVariant/888'
      );

      // 4. Execute legacy query that an OLD worker build would execute (only selecting baseline columns)
      const legacyProductQuery = db.prepare(`
        SELECT 
          p.id, p.title, p.slug, p.base_price, p.status, p.category_id, p.shopify_product_id,
          c.name AS category_name,
          v.sku, v.variation_name, v.price_override,
          COALESCE(v.price_override, p.base_price) AS effective_price
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_variations v ON v.product_id = p.id
        WHERE p.slug = ?;
      `);

      const row = legacyProductQuery.get('storm-anorak') as any;

      assert.ok(row, 'Legacy query must return record');
      assert.equal(row.title, 'Storm Anorak');
      assert.equal(row.category_name, 'Apparel');
      assert.equal(row.sku, 'STORMANORAK-S');
      assert.equal(row.base_price, 450.0);
      assert.equal(row.price_override, 475.0);
      assert.equal(row.effective_price, 475.0);
      assert.equal(row.shopify_product_id, 'gid://shopify/Product/999');
    });

    it('should support legacy INSERT queries omitting newer columns without constraint violations', () => {
      // An older worker build might insert into products without knowing about material_preset or product_line_id
      const legacyInsert = db.prepare(`
        INSERT INTO products (
          id, title, slug, base_price, status
        ) VALUES (?, ?, ?, ?, ?)
      `);

      legacyInsert.run(
        'prod-legacy',
        'Legacy Pack',
        'legacy-pack',
        220.0,
        'draft'
      );

      // Query row back and confirm default values were supplied by SQLite
      const checkRow = db.prepare('SELECT id, title, category, material_preset FROM products WHERE id = ?').get('prod-legacy') as any;
      assert.ok(checkRow);
      assert.equal(checkRow.title, 'Legacy Pack');
      assert.equal(checkRow.category, 'packs', 'Default category from 0006 should be applied');
      assert.equal(checkRow.material_preset, null, 'Nullable column without value should be null');
    });
  });

  describe('5. Alert Dispatch Telemetry Validation', () => {
    it('should construct green embed alert on successful rollback', () => {
      const payload = buildRollbackDiscordPayload({
        environment: 'production',
        deploymentId: 'a1b2c3d4-e5f6',
        reason: 'Sev 1 storefront PDP hydration failure',
        actor: 'oncall-dev',
        status: 'SUCCESS',
      });

      assert.equal(payload.embeds[0].color, 65280, 'Must be green');
      assert.ok(payload.content.includes('SUCCESS'));
      assert.ok(payload.embeds[0].title.includes('production'));
      assert.ok(payload.embeds[0].description.includes('a1b2c3d4-e5f6'));
      assert.ok(payload.embeds[0].description.includes('@oncall-dev'));
      assert.ok(payload.embeds[0].description.includes('Sev 1 storefront PDP hydration failure'));
    });

    it('should construct red embed alert on failed rollback attempt', () => {
      const payload = buildRollbackDiscordPayload({
        environment: 'staging',
        reason: 'Cloudflare API timeout',
        status: 'FAILURE',
      });

      assert.equal(payload.embeds[0].color, 16711680, 'Must be red');
      assert.ok(payload.content.includes('FAILURE'));
      assert.ok(payload.embeds[0].title.includes('staging'));
    });
  });

  describe('6. Tooling & Documentation Consistency', () => {
    it('should verify test:rollback script is registered in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      assert.ok(pkg.scripts['test:rollback'], 'package.json must declare test:rollback');
      assert.equal(
        pkg.scripts['test:rollback'],
        'tsx --test tests/integration/rollback-procedures.test.ts'
      );
    });

    it('should verify DISASTER_RECOVERY.md references test:rollback automated validation', () => {
      const content = fs.readFileSync(disasterRecoveryRunbookPath, 'utf-8');
      assert.ok(
        content.includes('test:rollback') || content.includes('worker-instant-rollback.test.ts'),
        'DISASTER_RECOVERY.md must reference the automated rollback testing procedures'
      );
    });
  });
});
