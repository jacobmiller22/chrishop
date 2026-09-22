import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {
  resolveTargetConfig,
  extractLocalBaselineSchema,
  compareD1Schema,
  runSyntheticEdgeProbes,
  verifyParity,
  generateParityMarkdownReport,
  parseCliArgs,
  CRITICAL_TABLES,
  CRITICAL_INDEXES,
  type TargetSchemaResult,
  type LocalBaselineSchema,
} from '../../scripts/verify-parity';

describe('Story 2.32: Staging & Ephemeral Preview Parity Verification Engine (Issue #144)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('1. CLI Argument & Target Configuration Resolution', () => {
    it('should resolve default staging configuration when no options passed', () => {
      const config = resolveTargetConfig({});
      assert.equal(config.target, 'staging');
      assert.equal(config.env, 'staging');
      assert.equal(config.url, 'https://staging-chrishop.jacobmiller22.com');
      assert.equal(config.d1Database, 'chrishop-staging-db');
    });

    it('should resolve production target configuration', () => {
      const config = resolveTargetConfig({ target: 'production' });
      assert.equal(config.target, 'production');
      assert.equal(config.env, 'production');
      assert.equal(config.url, 'https://chrishop.jacobmiller22.com');
      assert.equal(config.d1Database, 'chrishop-prod-db');
    });

    it('should dynamically infer ephemeral preview PR database from preview URL', () => {
      const config = resolveTargetConfig({
        url: 'https://pr-42-chrishop.jacobmiller22.com',
        env: 'preview',
      });
      assert.equal(config.target, 'preview');
      assert.equal(config.env, 'preview');
      assert.equal(config.url, 'https://pr-42-chrishop.jacobmiller22.com');
      assert.equal(config.d1Database, 'chrishop-preview-pr-42-db');
    });

    it('should permit explicit database override via --d1 flag', () => {
      const config = resolveTargetConfig({
        target: 'staging',
        d1Database: 'custom-isolated-db',
      });
      assert.equal(config.d1Database, 'custom-isolated-db');
    });

    it('should parse CLI arguments correctly', () => {
      const parsed = parseCliArgs([
        '--target', 'preview',
        '--url', 'https://pr-99.preview.chrishop.com',
        '--env', 'preview',
        '--d1', 'chrishop-preview-pr-99-db',
        '--max-latency', '350',
        '--mock',
        '--dry-run',
        '--skip-d1',
        '--skip-probes',
        '--report', '/tmp/report.md',
        '--verbose',
      ]);

      assert.equal(parsed.target, 'preview');
      assert.equal(parsed.url, 'https://pr-99.preview.chrishop.com');
      assert.equal(parsed.env, 'preview');
      assert.equal(parsed.d1Database, 'chrishop-preview-pr-99-db');
      assert.equal(parsed.maxLatencyMs, 350);
      assert.equal(parsed.mock, true);
      assert.equal(parsed.dryRun, true);
      assert.equal(parsed.skipD1, true);
      assert.equal(parsed.skipProbes, true);
      assert.equal(parsed.reportFile, '/tmp/report.md');
      assert.equal(parsed.verbose, true);
    });
  });

  describe('2. Local Baseline Schema Extraction (SQLite node:sqlite)', () => {
    let baseline: LocalBaselineSchema;

    it('should extract baseline tables, indexes, and migrations from local repository', () => {
      baseline = extractLocalBaselineSchema(rootDir);
      assert.ok(baseline, 'Baseline schema extraction must succeed');
      assert.ok(baseline.migrationFiles.length >= 9, 'Must find at least 9 migration files');
      assert.ok(baseline.tables.length >= 25, 'Must extract at least 25 database tables');
      assert.ok(baseline.indexes.length >= 70, 'Must extract index definitions');
    });

    it('should verify all mandatory core tables exist in baseline', () => {
      const tableSet = new Set(baseline.tables);
      for (const table of CRITICAL_TABLES) {
        assert.ok(tableSet.has(table), `Baseline schema must include critical table: "${table}"`);
      }
    });

    it('should verify all critical indexes exist in baseline', () => {
      const indexSet = new Set(baseline.indexes.map((i) => i.name));
      for (const idx of CRITICAL_INDEXES) {
        assert.ok(indexSet.has(idx), `Baseline schema must include critical index: "${idx}"`);
      }
    });

    it('should extract table column metadata for products and categories', () => {
      assert.ok(baseline.tableColumns.products, 'Must have column metadata for products table');
      const prodCols = baseline.tableColumns.products.map((c) => c.name);
      assert.ok(prodCols.includes('id'), 'products must have id');
      assert.ok(prodCols.includes('slug'), 'products must have slug');
      assert.ok(prodCols.includes('title'), 'products must have title');
      assert.ok(prodCols.includes('base_price'), 'products must have base_price');

      assert.ok(baseline.tableColumns.categories, 'Must have column metadata for categories table');
      const catCols = baseline.tableColumns.categories.map((c) => c.name);
      assert.ok(catCols.includes('id'), 'categories must have id');
      assert.ok(catCols.includes('slug'), 'categories must have slug');
    });
  });

  describe('3. D1 Database Schema & Migration Comparison Engine', () => {
    const mockBaseline: LocalBaselineSchema = {
      migrationFiles: ['0001_initial.sql', '0002_payload_tables.sql', '0003_catalog.sql'],
      tables: [...CRITICAL_TABLES, 'extra_table'],
      indexes: CRITICAL_INDEXES.map((name) => ({ name, table: 'products' })),
      tableColumns: {},
    };

    it('should pass when target schema is an exact parity match with baseline', () => {
      const target: TargetSchemaResult = {
        tables: [...mockBaseline.tables],
        indexes: [...mockBaseline.indexes],
        appliedMigrations: [...mockBaseline.migrationFiles],
        source: 'remote-api',
      };

      const results = compareD1Schema(mockBaseline, target);
      const failed = results.filter((r) => r.status === 'failed');
      assert.equal(failed.length, 0, 'No checks should fail on full parity match');

      const tablesCheck = results.find((r) => r.id === 'd1-tables-parity');
      assert.ok(tablesCheck, 'Must emit tables-parity check');
      assert.equal(tablesCheck.status, 'passed');

      const migrationsCheck = results.find((r) => r.id === 'd1-migrations-parity');
      assert.ok(migrationsCheck, 'Must emit migrations-parity check');
      assert.equal(migrationsCheck.status, 'passed');
    });

    it('should fail when target is missing critical core tables', () => {
      const target: TargetSchemaResult = {
        tables: ['users', 'media'], // Missing products, categories, etc.
        indexes: [...mockBaseline.indexes],
        appliedMigrations: [...mockBaseline.migrationFiles],
        source: 'remote-api',
      };

      const results = compareD1Schema(mockBaseline, target);
      const criticalCheck = results.find((r) => r.id === 'd1-critical-tables');
      assert.ok(criticalCheck, 'Must detect missing critical tables');
      assert.equal(criticalCheck.status, 'failed');
      assert.ok(criticalCheck.message.includes('missing'));
    });

    it('should fail when target is missing critical indexes', () => {
      const target: TargetSchemaResult = {
        tables: [...mockBaseline.tables],
        indexes: [{ name: 'unrelated_idx', table: 'users' }],
        appliedMigrations: [...mockBaseline.migrationFiles],
        source: 'remote-api',
      };

      const results = compareD1Schema(mockBaseline, target);
      const indexCheck = results.find((r) => r.id === 'd1-critical-indexes');
      assert.ok(indexCheck, 'Must detect missing critical indexes');
      assert.equal(indexCheck.status, 'failed');
    });

    it('should fail when target D1 database is behind on applied migrations', () => {
      const target: TargetSchemaResult = {
        tables: [...mockBaseline.tables],
        indexes: [...mockBaseline.indexes],
        appliedMigrations: ['0001_initial.sql'], // Missing 0002 and 0003
        source: 'remote-api',
      };

      const results = compareD1Schema(mockBaseline, target);
      const migrationCheck = results.find((r) => r.id === 'd1-migrations-parity');
      assert.ok(migrationCheck, 'Must detect unapplied migrations');
      assert.equal(migrationCheck.status, 'failed');
      assert.ok(migrationCheck.details?.unappliedMigrations.includes('0002_payload_tables.sql'));
      assert.ok(migrationCheck.details?.unappliedMigrations.includes('0003_catalog.sql'));
    });

    it('should gracefully warn when target schema source is unavailable', () => {
      const target: TargetSchemaResult = {
        tables: [],
        indexes: [],
        appliedMigrations: [],
        source: 'unavailable',
        error: 'Connection timeout to Cloudflare API',
      };

      const results = compareD1Schema(mockBaseline, target);
      assert.equal(results.length, 1);
      assert.equal(results[0].status, 'warning');
      assert.ok(results[0].message.includes('Skipped remote D1 schema inspection'));
    });
  });

  describe('4. Synthetic Edge Probes Matrix (Mock HTTP Server)', () => {
    let server: http.Server;
    let serverUrl: string;
    let serverPort: number;

    it('should start test server simulating Cloudflare worker edge runtime', async () => {
      server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);

        if (url.pathname === '/api/health') {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(
            JSON.stringify({
              status: 'healthy',
              service: '@chrishop/web',
              runtime: 'cloudflare-workers',
              timestamp: new Date().toISOString(),
              bindings: {
                d1: true,
                kv: true,
                r2: true,
                assets: true,
                site: true,
                cms: true,
              },
            })
          );
        } else if (url.pathname === '/products') {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, s-maxage=10',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end('<html><head><title>ChrisShop Catalog</title></head><body><h1>Products</h1></body></html>');
        } else if (url.pathname === '/admin') {
          res.writeHead(302, {
            Location: '/admin/login',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end();
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          serverPort = addr.port;
          serverUrl = `http://127.0.0.1:${serverPort}`;
          resolve();
        });
      });

      assert.ok(serverPort > 0, 'Test server must bind to local port');
    });

    it('should probe live edge server and verify health, products, admin, headers, and latency', async () => {
      const config = resolveTargetConfig({ url: serverUrl, env: 'preview' });
      const results = await runSyntheticEdgeProbes(config, {
        url: serverUrl,
        maxLatencyMs: 500,
      });

      const failed = results.filter((r) => r.status === 'failed');
      assert.equal(failed.length, 0, `All synthetic probes must pass: ${failed.map((f) => f.message).join(', ')}`);

      const healthProbe = results.find((r) => r.id === 'edge-health-probe');
      assert.ok(healthProbe);
      assert.equal(healthProbe.status, 'passed');

      const prodProbe = results.find((r) => r.id === 'edge-products-probe');
      assert.ok(prodProbe);
      assert.equal(prodProbe.status, 'passed');

      const adminProbe = results.find((r) => r.id === 'edge-admin-probe');
      assert.ok(adminProbe);
      assert.equal(adminProbe.status, 'passed');

      const headersProbe = results.find((r) => r.id === 'edge-health-headers');
      assert.ok(headersProbe);
      assert.equal(headersProbe.status, 'passed');

      const latencyProbe = results.find((r) => r.id === 'edge-latency-sla');
      assert.ok(latencyProbe);
      assert.equal(latencyProbe.status, 'passed');
    });

    it('should fail health probe if bindings are missing or false', async () => {
      const badFetch: typeof fetch = async (input: any) => {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            runtime: 'cloudflare-workers',
            timestamp: new Date().toISOString(),
            bindings: { d1: false, kv: true, r2: true }, // d1 is down
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          }
        );
      };

      const config = resolveTargetConfig({ url: 'http://dummy.url' });
      const results = await runSyntheticEdgeProbes(config, {
        url: 'http://dummy.url',
        fetchFn: badFetch,
      });

      const healthProbe = results.find((r) => r.id === 'edge-health-probe');
      assert.ok(healthProbe);
      assert.equal(healthProbe.status, 'failed');
      assert.ok(healthProbe.message.includes('Unsatisfied bindings'));
    });

    it('should tear down mock HTTP test server', async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });

  describe('5. Full End-to-End Parity Verification Runner & Reports', () => {
    it('should run verifyParity in hermetic mock mode and confirm all checks pass', async () => {
      const report = await verifyParity({
        mock: true,
        target: 'staging',
        rootDir,
      });

      assert.equal(report.allPassed, true);
      assert.equal(report.summary.failed, 0);
      assert.ok(report.summary.passed >= 8);
      assert.equal(report.target, 'staging');
    });

    it('should run verifyParity with skip flags', async () => {
      const report = await verifyParity({
        mock: true,
        skipD1: true,
        skipProbes: true,
        rootDir,
      });

      assert.equal(report.allPassed, true);
      assert.equal(report.results.length, 1);
      assert.equal(report.results[0].id, 'baseline-extraction');
    });

    it('should generate formatted GitHub Flavored Markdown parity audit report', async () => {
      const report = await verifyParity({
        mock: true,
        target: 'staging',
        rootDir,
      });

      const md = generateParityMarkdownReport(report);
      assert.ok(md.includes('# 🌐 Environment Parity Verification Report'));
      assert.ok(md.includes('Target Environment'));
      assert.ok(md.includes('D1 Database'));
      assert.ok(md.includes('PASSED (Parity Confirmed)'));
      assert.ok(md.includes('| Check | Status | Duration | Diagnostic Summary |'));
      assert.ok(md.includes('GET /api/health'));
    });
  });
});
