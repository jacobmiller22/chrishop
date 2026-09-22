import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveBackupTarget,
  formatSnapshotTimestamp,
  generateSnapshotFilename,
  buildExportCommand,
  buildR2UploadCommand,
  calculatePitrWindow,
  buildPitrRestoreCommand,
} from '../../scripts/d1-backup';

describe('Story 4.4: Automated Cloudflare D1 Point-in-Time Recovery & R2 Snapshots', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const backupWorkflowPath = path.join(rootDir, '.github/workflows/d1-backup.yml');
  const disasterRecoveryRunbookPath = path.join(rootDir, 'docs/runbooks/DISASTER_RECOVERY.md');
  const packageJsonPath = path.join(rootDir, 'package.json');

  describe('1. D1 Snapshot Export & Backup Tooling (scripts/d1-backup.ts)', () => {
    it('should resolve default local backup target', () => {
      const target = resolveBackupTarget([]);
      assert.equal(target.isLocal, true);
      assert.equal(target.isRemote, false);
      assert.equal(target.database, 'chrishop-prod-db');
      assert.equal(target.bucketName, 'chrishop-backups');
    });

    it('should resolve remote staging backup target', () => {
      const target = resolveBackupTarget(['--remote', '--env', 'staging']);
      assert.equal(target.isLocal, false);
      assert.equal(target.isRemote, true);
      assert.equal(target.environment, 'staging');
      assert.equal(target.database, 'chrishop-staging-db');
      assert.equal(target.bucketName, 'chrishop-media-staging');
    });

    it('should resolve remote production backup target', () => {
      const target = resolveBackupTarget(['--remote', '--env', 'production']);
      assert.equal(target.isLocal, false);
      assert.equal(target.isRemote, true);
      assert.equal(target.environment, 'production');
      assert.equal(target.database, 'chrishop-prod-db');
      assert.equal(target.bucketName, 'chrishop-backups');
    });

    it('should generate valid timestamped snapshot filenames', () => {
      const fixedDate = new Date('2026-09-22T14:30:00.000Z');
      const filename = generateSnapshotFilename('chrishop-prod-db', fixedDate);
      assert.equal(filename, 'chrishop-prod-db-snapshot-20260922T143000Z.sql');
    });

    it('should construct accurate wrangler d1 export commands', () => {
      const localTarget = resolveBackupTarget(['--local']);
      const localCmd = buildExportCommand(localTarget, './backups/test.sql');
      assert.equal(
        localCmd,
        'wrangler d1 export chrishop-prod-db --output="./backups/test.sql" --local'
      );

      const remoteTarget = resolveBackupTarget(['--remote', '--env', 'production']);
      const remoteCmd = buildExportCommand(remoteTarget, './backups/prod.sql');
      assert.equal(
        remoteCmd,
        'wrangler d1 export chrishop-prod-db --output="./backups/prod.sql" --remote --env production'
      );
    });

    it('should construct valid AWS S3 CLI command for Cloudflare R2 upload', () => {
      const cmd = buildR2UploadCommand(
        './backups/test-snapshot.sql',
        'chrishop-backups',
        'test-account-123'
      );
      assert.ok(cmd.includes('aws --endpoint-url https://test-account-123.r2.cloudflarestorage.com'));
      assert.ok(cmd.includes('s3 cp "./backups/test-snapshot.sql" "s3://chrishop-backups/backups/test-snapshot.sql"'));
    });

    it('should execute scripts/d1-backup.ts in --dry-run mode without errors', () => {
      const output = execSync('pnpm run d1:backup --dry-run', {
        cwd: rootDir,
        encoding: 'utf-8',
      });
      assert.ok(output.includes('ChrisShop Cloudflare D1 Automated Snapshot Tool'));
      assert.ok(output.includes('[DRY RUN] Commands:'));
      assert.ok(output.includes('wrangler d1 export chrishop-prod-db'));
      assert.ok(output.includes('Dry-run completed successfully'));
    });
  });

  describe('2. Point-in-Time Recovery (PITR) Window & Time-Travel Commands', () => {
    it('should calculate 30-day continuous restoration window', () => {
      const now = new Date('2026-09-22T12:00:00.000Z');
      const window = calculatePitrWindow(now);

      assert.equal(window.retentionDays, 30);
      assert.equal(window.now, '2026-09-22T12:00:00.000Z');
      assert.equal(window.latestRestoreTimestamp, '2026-09-22T12:00:00.000Z');

      const earliest = new Date(window.earliestRestoreTimestamp);
      const diffDays = Math.round((now.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000));
      assert.equal(diffDays, 30);
    });

    it('should construct time-travel restore command with timestamp', () => {
      const cmd = buildPitrRestoreCommand('chrishop-prod-db', {
        timestamp: '2026-09-22T11:45:00Z',
      });
      assert.equal(
        cmd,
        'wrangler d1 time-travel restore chrishop-prod-db --timestamp="2026-09-22T11:45:00Z"'
      );
    });

    it('should construct time-travel restore command with bookmark hash', () => {
      const cmd = buildPitrRestoreCommand('chrishop-prod-db', {
        bookmark: '00000001-0000-0000-0000-000000000000',
      });
      assert.equal(
        cmd,
        'wrangler d1 time-travel restore chrishop-prod-db --bookmark="00000001-0000-0000-0000-000000000000"'
      );
    });

    it('should execute scripts/d1-backup.ts in --verify-pitr mode without errors', () => {
      const output = execSync('pnpm run d1:backup --verify-pitr', {
        cwd: rootDir,
        encoding: 'utf-8',
      });
      assert.ok(output.includes('Cloudflare D1 Continuous Point-in-Time Recovery (PITR)'));
      assert.ok(output.includes('30 Days Continuous WAL'));
      assert.ok(output.includes('wrangler d1 time-travel restore chrishop-prod-db'));
    });
  });

  describe('3. Scheduled Automated Backup Workflow (.github/workflows/d1-backup.yml)', () => {
    it('should verify d1-backup.yml exists and defines daily schedule and workflow_dispatch', () => {
      assert.ok(fs.existsSync(backupWorkflowPath), '.github/workflows/d1-backup.yml must exist');
      const content = fs.readFileSync(backupWorkflowPath, 'utf-8');

      assert.ok(content.includes("cron: '0 3 * * *'"), 'Must declare daily cron schedule at 03:00 UTC');
      assert.ok(content.includes('workflow_dispatch:'), 'Must support manual workflow_dispatch');
      assert.ok(content.includes('upload_r2:'), 'Must include upload_r2 input');
    });

    it('should verify least-privilege secrets boundary in d1-backup.yml', () => {
      const content = fs.readFileSync(backupWorkflowPath, 'utf-8');

      assert.ok(content.includes('CLOUDFLARE_API_TOKEN'), 'Must use CLOUDFLARE_API_TOKEN');
      assert.ok(content.includes('CLOUDFLARE_ACCOUNT_ID'), 'Must use CLOUDFLARE_ACCOUNT_ID');
      assert.ok(!content.includes('PAYLOAD_SECRET'), 'Must not expose PAYLOAD_SECRET');
      assert.ok(!content.includes('SHOPIFY_ADMIN_TOKEN'), 'Must not expose SHOPIFY_ADMIN_TOKEN');
      assert.ok(!content.includes('RESEND_API_KEY'), 'Must not expose RESEND_API_KEY');
    });

    it('should verify R2 upload and Discord dev-alerts telemetry steps', () => {
      const content = fs.readFileSync(backupWorkflowPath, 'utf-8');

      assert.ok(content.includes('Upload Snapshot to Cloudflare R2'), 'Must declare R2 upload step');
      assert.ok(content.includes('chrishop-backups'), 'Must target chrishop-backups bucket');
      assert.ok(content.includes('Dispatch Backup Alert to Discord'), 'Must declare Discord alert step');
      assert.ok(content.includes('DISCORD_WEBHOOK_DEV_ALERTS'), 'Must reference DISCORD_WEBHOOK_DEV_ALERTS');
    });
  });

  describe('4. Cold SQL Snapshot Roundtrip Verification', () => {
    it('should export and re-import sample dataset into SQLite cleanly', () => {
      // 1. Setup source DB
      const sourceDb = new DatabaseSync(':memory:');
      sourceDb.exec(`
        CREATE TABLE test_products (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          price REAL NOT NULL
        );
        INSERT INTO test_products (id, title, price) VALUES ('p1', 'Alpine Shell', 320.0);
        INSERT INTO test_products (id, title, price) VALUES ('p2', 'Trail Cap', 45.0);
      `);

      // 2. Generate simulated SQL dump
      const rows = sourceDb.prepare('SELECT id, title, price FROM test_products').all() as any[];
      const sqlStatements = [
        'CREATE TABLE IF NOT EXISTS test_products (id TEXT PRIMARY KEY, title TEXT NOT NULL, price REAL NOT NULL);',
        ...rows.map(
          (r) =>
            `INSERT INTO test_products (id, title, price) VALUES ('${r.id}', '${r.title}', ${r.price});`
        ),
      ].join('\n');

      // 3. Restore into fresh destination DB
      const targetDb = new DatabaseSync(':memory:');
      targetDb.exec(sqlStatements);

      const targetRows = targetDb.prepare('SELECT id, title, price FROM test_products').all() as any[];
      assert.equal(targetRows.length, 2);
      assert.equal(targetRows[0].title, 'Alpine Shell');
      assert.equal(targetRows[1].price, 45.0);
    });
  });

  describe('5. Package.json & Runbook Consistency', () => {
    it('should verify d1:backup scripts are defined in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      assert.ok(pkg.scripts['d1:backup'], 'package.json must declare d1:backup');
      assert.equal(pkg.scripts['d1:backup'], 'tsx scripts/d1-backup.ts');
      assert.ok(pkg.scripts['d1:backup:prod'], 'package.json must declare d1:backup:prod');
      assert.equal(
        pkg.scripts['d1:backup:prod'],
        'tsx scripts/d1-backup.ts --remote --env production'
      );
    });

    it('should verify DISASTER_RECOVERY.md documents PITR and R2 backup procedures', () => {
      const content = fs.readFileSync(disasterRecoveryRunbookPath, 'utf-8');
      assert.ok(content.includes('chrishop-backups'), 'Must mention chrishop-backups');
      assert.ok(content.includes('pnpm run d1:backup:prod'), 'Must mention d1:backup:prod');
      assert.ok(content.includes('time-travel restore'), 'Must mention time-travel restore');
      assert.ok(content.includes('d1-backup.yml'), 'Must mention d1-backup.yml');
      assert.ok(content.includes('30 days continuous WAL replication'), 'Must document 30-day retention');
    });
  });
});
