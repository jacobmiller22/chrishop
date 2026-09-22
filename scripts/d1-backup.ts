#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare D1 Automated Database Snapshot & PITR Tool
 *
 * Automates offline snapshot generation, Cloudflare R2 backup archiving,
 * and Point-in-Time Recovery (PITR) per docs/HIGH_LEVEL_DESIGN.md Section 8.3
 * and docs/deps/DEP_CLOUDFLARE_D1.md.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface D1BackupTarget {
  database: string;
  environment: 'production' | 'staging' | 'preview';
  isLocal: boolean;
  isRemote: boolean;
  bucketName: string;
}

export interface PitrWindowInfo {
  now: string;
  retentionDays: number;
  earliestRestoreTimestamp: string;
  latestRestoreTimestamp: string;
}

export const ENV_DB_MAP: Record<string, string> = {
  production: 'chrishop-prod-db',
  staging: 'chrishop-staging-db',
  preview: 'chrishop-preview-db',
};

export const ENV_R2_MAP: Record<string, string> = {
  production: 'chrishop-backups',
  staging: 'chrishop-media-staging',
  preview: 'chrishop-media-preview',
};

/**
 * Resolves database, environment, and backup storage targets from arguments
 */
export function resolveBackupTarget(args: string[]): D1BackupTarget {
  const isLocal = args.includes('--local');
  const isRemote = args.includes('--remote');
  let environment: 'production' | 'staging' | 'preview' = 'production';
  let database: string | undefined;

  const envIdx = args.indexOf('--env');
  if (envIdx !== -1 && args[envIdx + 1]) {
    const val = args[envIdx + 1].toLowerCase();
    if (val === 'staging' || val === 'production' || val === 'preview') {
      environment = val;
    }
  }

  const dbIdx = args.indexOf('--database');
  if (dbIdx !== -1 && args[dbIdx + 1]) {
    database = args[dbIdx + 1];
  }

  if (!database) {
    database = ENV_DB_MAP[environment] || 'chrishop-prod-db';
  }

  const bucketName = ENV_R2_MAP[environment] || 'chrishop-backups';

  return {
    database,
    environment,
    isLocal: isLocal || (!isLocal && !isRemote),
    isRemote: isRemote,
    bucketName,
  };
}

/**
 * Formats a clean date string for snapshot filenames: YYYYMMDDTHHMMSSZ
 */
export function formatSnapshotTimestamp(date: Date = new Date()): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Generates an isolated snapshot filename
 */
export function generateSnapshotFilename(database: string, date: Date = new Date()): string {
  const ts = formatSnapshotTimestamp(date);
  return `${database}-snapshot-${ts}.sql`;
}

/**
 * Builds the wrangler d1 export command string
 */
export function buildExportCommand(target: D1BackupTarget, outputPath: string): string {
  let cmd = `wrangler d1 export ${target.database} --output="${outputPath}"`;
  if (target.isLocal) {
    cmd += ' --local';
  } else if (target.isRemote) {
    cmd += ' --remote';
    if (target.environment) {
      cmd += ` --env ${target.environment}`;
    }
  }
  return cmd;
}

/**
 * Builds the AWS S3 CLI command to upload a snapshot to Cloudflare R2
 */
export function buildR2UploadCommand(
  filePath: string,
  bucketName: string,
  accountId: string = '${CLOUDFLARE_ACCOUNT_ID}'
): string {
  const filename = path.basename(filePath);
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  return `aws --endpoint-url ${endpoint} s3 cp "${filePath}" "s3://${bucketName}/backups/${filename}"`;
}

/**
 * Computes the 30-day continuous Point-in-Time Recovery (PITR) window
 */
export function calculatePitrWindow(now: Date = new Date()): PitrWindowInfo {
  const retentionDays = 30;
  const thirtyDaysMs = retentionDays * 24 * 60 * 60 * 1000;
  const earliestDate = new Date(now.getTime() - thirtyDaysMs);

  return {
    now: now.toISOString(),
    retentionDays,
    earliestRestoreTimestamp: earliestDate.toISOString(),
    latestRestoreTimestamp: now.toISOString(),
  };
}

/**
 * Builds the Point-in-Time Recovery restore command
 */
export function buildPitrRestoreCommand(
  database: string,
  target: { timestamp?: string; bookmark?: string }
): string {
  if (target.bookmark && target.bookmark.trim().length > 0) {
    return `wrangler d1 time-travel restore ${database} --bookmark="${target.bookmark.trim()}"`;
  }
  if (target.timestamp && target.timestamp.trim().length > 0) {
    return `wrangler d1 time-travel restore ${database} --timestamp="${target.timestamp.trim()}"`;
  }
  throw new Error('Either timestamp or bookmark must be provided for PITR restore.');
}

/**
 * Main CLI execution logic
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ChrisShop Cloudflare D1 Automated Database Snapshot & PITR Tool

Usage:
  tsx scripts/d1-backup.ts [options]

Options:
  --local                 Execute against local Miniflare D1 emulator (default)
  --remote                Execute against Cloudflare remote D1 database
  --env <env>             Target environment: 'production' | 'staging' (default: production)
  --database <name>       Explicit database name (e.g. chrishop-prod-db)
  --output <path>         Specific destination file path for SQL dump
  --upload-r2             Sync generated snapshot to Cloudflare R2 bucket
  --verify-pitr           Display 30-day PITR restoration window and time-travel syntax
  --dry-run               Print the planned backup commands without executing
  -h, --help              Show this help menu
`);
    return;
  }

  const target = resolveBackupTarget(args);

  if (args.includes('--verify-pitr')) {
    const window = calculatePitrWindow();
    console.log('================================================================');
    console.log('   ⏱️  Cloudflare D1 Continuous Point-in-Time Recovery (PITR)  ');
    console.log('================================================================');
    console.log(`Target Database:            ${target.database}`);
    console.log(`Retention SLA Window:       ${window.retentionDays} Days Continuous WAL`);
    console.log(`Earliest Restore Timestamp: ${window.earliestRestoreTimestamp}`);
    console.log(`Latest Restore Timestamp:   ${window.latestRestoreTimestamp}`);
    console.log('\nExample Time-Travel Command:');
    console.log(`  ${buildPitrRestoreCommand(target.database, { timestamp: window.earliestRestoreTimestamp })}`);
    return;
  }

  const outputDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let outputPath = '';
  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outputPath = path.resolve(process.cwd(), args[outIdx + 1]);
  } else {
    const filename = generateSnapshotFilename(target.database);
    outputPath = path.join(outputDir, filename);
  }

  const exportCmd = buildExportCommand(target, outputPath);
  const r2Cmd = buildR2UploadCommand(
    outputPath,
    target.bucketName,
    process.env.CLOUDFLARE_ACCOUNT_ID || '<CLOUDFLARE_ACCOUNT_ID>'
  );

  console.log('================================================================');
  console.log('   💾 ChrisShop Cloudflare D1 Automated Snapshot Tool          ');
  console.log('================================================================');
  console.log(`Target Database: ${target.database} (${target.isLocal ? 'Local Miniflare' : `Remote: ${target.environment}`})`);
  console.log(`Snapshot Target: ${outputPath}`);
  console.log(`R2 Archive:      s3://${target.bucketName}/backups/`);
  console.log(`Export Command:  ${exportCmd}`);
  console.log('');

  if (args.includes('--dry-run')) {
    console.log('🔍 [DRY RUN] Commands:');
    console.log(`   1. D1 Export:  pnpm exec ${exportCmd}`);
    if (args.includes('--upload-r2')) {
      console.log(`   2. R2 Upload:  ${r2Cmd}`);
    }
    console.log('\n✅ Dry-run completed successfully.');
    return;
  }

  console.log('▶ 1. Exporting D1 database snapshot...');
  try {
    execSync(`pnpm exec ${exportCmd}`, { stdio: 'inherit' });
    console.log(`✅ Snapshot successfully exported to: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Snapshot export failed: ${(error as Error).message}`);
    process.exit(1);
  }

  if (args.includes('--upload-r2')) {
    console.log('\n▶ 2. Uploading snapshot to Cloudflare R2...');
    try {
      execSync(r2Cmd, { stdio: 'inherit' });
      console.log('✅ Snapshot successfully uploaded to Cloudflare R2.');
    } catch (error) {
      console.error(`❌ R2 upload failed: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 D1 database backup procedure completed successfully!');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error in d1-backup:', err);
    process.exit(1);
  });
}
