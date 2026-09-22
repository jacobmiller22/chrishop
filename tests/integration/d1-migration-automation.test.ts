import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateAdditiveMigrations,
  resolveTargetConfig,
  buildMigrationCommand,
  buildVerificationCommand,
  generatePitrInstructions,
  stripSqlComments,
  DEFAULT_BASELINE_MIGRATION,
} from '../../scripts/d1-migrate';

describe('Story 4.3: Cloudflare D1 Migration Automation & Rollback Strategy', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const d1MigrationsRunbookPath = path.join(rootDir, 'docs/runbooks/D1_MIGRATIONS.md');
  const disasterRecoveryRunbookPath = path.join(rootDir, 'docs/runbooks/DISASTER_RECOVERY.md');
  const packageJsonPath = path.join(rootDir, 'package.json');

  describe('1. Additive Schema Evolution & Static Analysis', () => {
    it('should validate that all current repo migrations adhere to additive standards', () => {
      const result = validateAdditiveMigrations({
        migrationsDir: path.join(rootDir, 'migrations'),
      });

      assert.equal(result.valid, true, `Validation failed with errors: ${result.errors.join(', ')}`);
      assert.ok(result.filesAnalyzed.length >= 9, 'Should have analyzed at least 9 migration files');
      assert.equal(result.baselineFiles.length, 5, 'Should identify 5 baseline bootstrap migrations');
      assert.ok(result.additiveFiles.length >= 4, 'Should identify 4+ additive forward migrations');
    });

    it('should strip SQL comments accurately', () => {
      const sqlWithComments = `
        -- Single line comment
        SELECT * FROM products; /* Inline block comment */
        /* Multi-line
           block comment */
        ALTER TABLE products ADD COLUMN test TEXT;
      `;
      const cleaned = stripSqlComments(sqlWithComments);
      assert.ok(!cleaned.includes('Single line comment'));
      assert.ok(!cleaned.includes('Inline block comment'));
      assert.ok(!cleaned.includes('Multi-line'));
      assert.ok(cleaned.includes('SELECT * FROM products;'));
      assert.ok(cleaned.includes('ALTER TABLE products ADD COLUMN test TEXT;'));
    });

    it('should detect and reject prohibited destructive statements in forward migrations', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-test-destructive-'));

      try {
        // Create a mock forward migration with destructive SQL
        fs.writeFileSync(
          path.join(tmpDir, '0010_bad_drop_table.sql'),
          'DROP TABLE users;'
        );
        fs.writeFileSync(
          path.join(tmpDir, '0011_bad_drop_column.sql'),
          'ALTER TABLE products DROP COLUMN legacy_price;'
        );
        fs.writeFileSync(
          path.join(tmpDir, '0012_bad_truncate.sql'),
          'TRUNCATE TABLE sessions;'
        );
        fs.writeFileSync(
          path.join(tmpDir, '0013_bad_not_null.sql'),
          'ALTER TABLE products ADD COLUMN urgent_field TEXT NOT NULL;'
        );

        const result = validateAdditiveMigrations({
          migrationsDir: tmpDir,
          baselineMigration: '0000_baseline.sql',
        });

        assert.equal(result.valid, false, 'Should fail validation on destructive migrations');
        assert.ok(
          result.errors.some((e) => e.includes('DROP TABLE')),
          'Should report DROP TABLE error'
        );
        assert.ok(
          result.errors.some((e) => e.includes('DROP COLUMN')),
          'Should report DROP COLUMN error'
        );
        assert.ok(
          result.errors.some((e) => e.includes('TRUNCATE TABLE')),
          'Should report TRUNCATE TABLE error'
        );
        assert.ok(
          result.errors.some((e) => e.includes('Adding NOT NULL column without a DEFAULT value')),
          'Should report NOT NULL without DEFAULT error'
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should allow valid additive ALTER TABLE statements with DEFAULT values', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-test-additive-'));

      try {
        fs.writeFileSync(
          path.join(tmpDir, '0010_good_additive.sql'),
          `
            CREATE TABLE IF NOT EXISTS product_reviews (
              id TEXT PRIMARY KEY NOT NULL,
              rating INTEGER NOT NULL
            );
            ALTER TABLE products ADD COLUMN rating_avg REAL DEFAULT 0.0;
            ALTER TABLE products ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;
            CREATE INDEX IF NOT EXISTS idx_products_rating ON products (rating_avg);
          `
        );

        const result = validateAdditiveMigrations({
          migrationsDir: tmpDir,
          baselineMigration: '0000_baseline.sql',
        });

        assert.equal(result.valid, true, `Should accept valid additive migration: ${result.errors.join('; ')}`);
        assert.equal(result.errors.length, 0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should enforce file naming convention XXXX_name.sql', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-test-naming-'));

      try {
        fs.writeFileSync(path.join(tmpDir, 'invalid-migration.sql'), 'SELECT 1;');

        const result = validateAdditiveMigrations({
          migrationsDir: tmpDir,
          baselineMigration: '0000_baseline.sql',
        });

        assert.equal(result.valid, false);
        assert.ok(
          result.errors.some((e) => e.includes('violates naming convention')),
          'Should report naming convention violation'
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('2. Target Configuration & Wrangler Command Generation', () => {
    it('should resolve local target by default', () => {
      const config = resolveTargetConfig([]);
      assert.equal(config.isLocal, true);
      assert.equal(config.isRemote, false);
      assert.equal(config.database, 'chrishop-prod-db');
    });

    it('should resolve remote staging target', () => {
      const config = resolveTargetConfig(['--remote', '--env', 'staging']);
      assert.equal(config.isLocal, false);
      assert.equal(config.isRemote, true);
      assert.equal(config.env, 'staging');
      assert.equal(config.database, 'chrishop-staging-db');
    });

    it('should resolve remote production target', () => {
      const config = resolveTargetConfig(['--remote', '--env', 'production']);
      assert.equal(config.isLocal, false);
      assert.equal(config.isRemote, true);
      assert.equal(config.env, 'production');
      assert.equal(config.database, 'chrishop-prod-db');
    });

    it('should resolve remote preview target', () => {
      const config = resolveTargetConfig(['--remote', '--env', 'preview']);
      assert.equal(config.isLocal, false);
      assert.equal(config.isRemote, true);
      assert.equal(config.env, 'preview');
      assert.equal(config.database, 'chrishop-preview-db');
    });

    it('should construct correct migration apply command', () => {
      const localCmd = buildMigrationCommand({
        database: 'chrishop-prod-db',
        isLocal: true,
        isRemote: false,
      });
      assert.equal(localCmd, 'wrangler d1 migrations apply chrishop-prod-db --local');

      const stagingCmd = buildMigrationCommand({
        database: 'chrishop-staging-db',
        isLocal: false,
        isRemote: true,
        env: 'staging',
      });
      assert.equal(stagingCmd, 'wrangler d1 migrations apply chrishop-staging-db --remote --env staging');
    });

    it('should construct schema verification query command', () => {
      const cmd = buildVerificationCommand({
        database: 'chrishop-prod-db',
        isLocal: true,
        isRemote: false,
      });
      assert.ok(cmd.includes('wrangler d1 execute chrishop-prod-db --local'));
      assert.ok(cmd.includes('sqlite_master'));
      assert.ok(cmd.includes('--json'));
    });
  });

  describe('3. Local Miniflare Migration Execution & Schema State', () => {
    it('should successfully run d1:migrate:check CLI', () => {
      const output = execSync('pnpm run d1:migrate:check', {
        cwd: rootDir,
        encoding: 'utf-8',
      });
      assert.ok(output.includes('Pre-Flight Additive Schema Validation'));
      assert.ok(output.includes('All forward migrations adhere to non-destructive additive standards'));
      assert.ok(output.includes('Pre-flight check completed successfully'));
    });

    it('should execute migrations and verify schema state in Miniflare D1', () => {
      const output = execSync('pnpm run d1:migrate', {
        cwd: rootDir,
        encoding: 'utf-8',
      });
      assert.ok(output.includes('Applying D1 Migrations to chrishop-prod-db'));
      assert.ok(output.includes('Verifying Post-Migration Schema State'));
      assert.ok(output.includes('D1 migration execution and validation finished successfully'));
    });

    it('should verify that Miniflare D1 contains core tables and 9 migration records', () => {
      const tablesJson = execSync(
        'pnpm exec wrangler d1 execute chrishop-prod-db --local --command "SELECT name FROM sqlite_master WHERE type=\'table\';" --json',
        { cwd: rootDir, encoding: 'utf-8' }
      );
      const parsedTables = JSON.parse(tablesJson.match(/\[\s*\{[\s\S]*\}\s*\]/)![0]);
      const tableNames = (parsedTables[0].results as { name: string }[]).map((r) => r.name);

      assert.ok(tableNames.includes('categories'), 'categories table must exist');
      assert.ok(tableNames.includes('products'), 'products table must exist');
      assert.ok(tableNames.includes('product_variations'), 'product_variations table must exist');
      assert.ok(tableNames.includes('media'), 'media table must exist');
      assert.ok(tableNames.includes('d1_migrations'), 'd1_migrations tracking table must exist');

      const migrationsJson = execSync(
        'pnpm exec wrangler d1 execute chrishop-prod-db --local --command "SELECT count(*) as count FROM d1_migrations;" --json',
        { cwd: rootDir, encoding: 'utf-8' }
      );
      const parsedMigrations = JSON.parse(migrationsJson.match(/\[\s*\{[\s\S]*\}\s*\]/)![0]);
      const count = parsedMigrations[0].results[0].count;
      assert.equal(count, 9, 'All 9 migrations must be recorded in d1_migrations');
    });
  });

  describe('4. Point-in-Time Recovery (PITR) & Runbook Documentation', () => {
    it('should generate accurate PITR CLI instructions', () => {
      const instructions = generatePitrInstructions('chrishop-prod-db');
      assert.ok(instructions.includes('wrangler d1 time-travel restore chrishop-prod-db --timestamp='));
      assert.ok(instructions.includes('wrangler d1 time-travel restore chrishop-prod-db --bookmark='));
      assert.ok(instructions.includes('wrangler d1 execute chrishop-prod-db --file='));
      assert.ok(instructions.includes('SELECT count(*) FROM products;'));
    });

    it('should execute d1:rollback:info CLI without error', () => {
      const output = execSync('pnpm run d1:rollback:info', {
        cwd: rootDir,
        encoding: 'utf-8',
      });
      assert.ok(output.includes('Point-in-Time Recovery (PITR) Rollback Protocol'));
      assert.ok(output.includes('time-travel restore chrishop-prod-db'));
    });

    it('should verify docs/runbooks/D1_MIGRATIONS.md exists and specifies required protocols', () => {
      assert.ok(fs.existsSync(d1MigrationsRunbookPath), 'D1_MIGRATIONS.md must exist');
      const content = fs.readFileSync(d1MigrationsRunbookPath, 'utf-8');

      assert.ok(content.includes('Expand / Contract'), 'Must document Expand/Contract pattern');
      assert.ok(content.includes('DROP TABLE'), 'Must document DROP TABLE prohibition');
      assert.ok(content.includes('Point-in-Time Recovery (PITR)'), 'Must document PITR');
      assert.ok(content.includes('wrangler d1 time-travel restore'), 'Must document time-travel restore');
      assert.ok(content.includes('chrishop-prod-db'), 'Must reference chrishop-prod-db');
      assert.ok(content.includes('chrishop-staging-db'), 'Must reference chrishop-staging-db');
    });

    it('should verify docs/runbooks/DISASTER_RECOVERY.md references correct D1 PITR commands', () => {
      assert.ok(fs.existsSync(disasterRecoveryRunbookPath), 'DISASTER_RECOVERY.md must exist');
      const content = fs.readFileSync(disasterRecoveryRunbookPath, 'utf-8');

      assert.ok(content.includes('time-travel restore chrishop-prod-db'), 'Must use correct db name in PITR');
      assert.ok(content.includes('--bookmark='), 'Must document bookmark restoration');
      assert.ok(content.includes('D1_MIGRATIONS.md'), 'Must link to D1_MIGRATIONS.md');
      assert.ok(content.includes('pnpm run d1:rollback:info'), 'Must reference rollback info CLI');
    });
  });

  describe('5. Package.json Script Integrity', () => {
    it('should declare all required d1 migration scripts in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      assert.ok(pkg.scripts['d1:migrate'], 'package.json must declare d1:migrate');
      assert.ok(pkg.scripts['d1:migrate:check'], 'package.json must declare d1:migrate:check');
      assert.ok(pkg.scripts['d1:migrate:local'], 'package.json must declare d1:migrate:local');
      assert.ok(pkg.scripts['d1:migrate:staging'], 'package.json must declare d1:migrate:staging');
      assert.ok(pkg.scripts['d1:migrate:prod'], 'package.json must declare d1:migrate:prod');
      assert.ok(pkg.scripts['d1:rollback:info'], 'package.json must declare d1:rollback:info');
    });
  });
});
