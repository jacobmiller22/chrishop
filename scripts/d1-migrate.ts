#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare D1 Declarative Migration Runner & Rollback Helper
 *
 * Enforces non-destructive additive schema evolution and Point-in-Time Recovery (PITR)
 * per docs/HIGH_LEVEL_DESIGN.md Section 8.3 and docs/deps/DEP_CLOUDFLARE_D1.md.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface MigrationValidationOptions {
  migrationsDir?: string;
  baselineMigration?: string;
  checkAll?: boolean;
}

export interface MigrationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  filesAnalyzed: string[];
  baselineFiles: string[];
  additiveFiles: string[];
}

export interface D1TargetConfig {
  database: string;
  isLocal: boolean;
  isRemote: boolean;
  env?: 'staging' | 'production' | 'preview';
}

export const ENV_DATABASE_MAP: Record<string, string> = {
  production: 'chrishop-prod-db',
  staging: 'chrishop-staging-db',
  preview: 'chrishop-preview-db',
};

/**
 * Baseline migration boundary representing initial database bootstrapping.
 * All subsequent migrations must strictly follow additive schema evolution rules.
 */
export const DEFAULT_BASELINE_MIGRATION = '0005_payload_locked_documents_order_parent.sql';

/**
 * Strips SQL comments (both single-line dashes and multi-line block comments)
 */
export function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
}

/**
 * Validates that SQL migrations adhere to strictly additive schema evolution rules:
 * 1. File naming follows XXXX_name.sql convention
 * 2. Forward migrations (post-baseline) prohibit destructive operations:
 *    - DROP TABLE
 *    - DROP VIEW
 *    - DROP COLUMN
 *    - TRUNCATE TABLE
 * 3. Any ALTER TABLE ... ADD COLUMN with NOT NULL must define a DEFAULT value (SQLite constraint)
 */
export function validateAdditiveMigrations(
  options: MigrationValidationOptions = {}
): MigrationValidationResult {
  const migrationsDir = options.migrationsDir || path.resolve(process.cwd(), 'migrations');
  const baseline = options.baselineMigration ?? DEFAULT_BASELINE_MIGRATION;
  const checkAll = options.checkAll ?? false;

  const errors: string[] = [];
  const warnings: string[] = [];
  const filesAnalyzed: string[] = [];
  const baselineFiles: string[] = [];
  const additiveFiles: string[] = [];

  if (!fs.existsSync(migrationsDir)) {
    return {
      valid: false,
      errors: [`Migrations directory not found: ${migrationsDir}`],
      warnings,
      filesAnalyzed,
      baselineFiles,
      additiveFiles,
    };
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const namingPattern = /^\d{4}_[a-z0-9_]+\.sql$/;

  for (const file of files) {
    filesAnalyzed.push(file);

    if (!namingPattern.test(file)) {
      errors.push(
        `File '${file}' violates naming convention. Expected format: 'XXXX_description.sql' (e.g. 0001_initial.sql).`
      );
    }

    const isBaseline = !checkAll && file <= baseline;
    if (isBaseline) {
      baselineFiles.push(file);
      continue;
    }
    additiveFiles.push(file);

    const filePath = path.join(migrationsDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const cleanSql = stripSqlComments(rawContent);

    // Destructive statement checks
    if (/\bDROP\s+TABLE\b/i.test(cleanSql)) {
      errors.push(`File '${file}' contains prohibited destructive statement: DROP TABLE.`);
    }
    if (/\bDROP\s+VIEW\b/i.test(cleanSql)) {
      errors.push(`File '${file}' contains prohibited destructive statement: DROP VIEW.`);
    }
    if (/\bALTER\s+TABLE\b[\s\S]+?\bDROP\s+COLUMN\b/i.test(cleanSql)) {
      errors.push(`File '${file}' contains prohibited destructive statement: DROP COLUMN.`);
    }
    if (/\bTRUNCATE\s+TABLE\b/i.test(cleanSql)) {
      errors.push(`File '${file}' contains prohibited destructive statement: TRUNCATE TABLE.`);
    }

    // SQLite constraint: Adding NOT NULL column requires DEFAULT
    const addColumnMatches = cleanSql.matchAll(
      /ALTER\s+TABLE\s+\w+\s+ADD\s+(?:COLUMN\s+)?(\w+)\s+([^;]+);/gi
    );
    for (const match of addColumnMatches) {
      const colDef = match[2];
      if (/\bNOT\s+NULL\b/i.test(colDef) && !/\bDEFAULT\b/i.test(colDef)) {
        errors.push(
          `File '${file}': Adding NOT NULL column without a DEFAULT value ('${match[0].trim()}') is prohibited in SQLite/D1.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    filesAnalyzed,
    baselineFiles,
    additiveFiles,
  };
}

/**
 * Resolves the target database and environment from CLI arguments
 */
export function resolveTargetConfig(args: string[]): D1TargetConfig {
  let isLocal = args.includes('--local');
  let isRemote = args.includes('--remote');
  let env: 'staging' | 'production' | 'preview' | undefined;
  let database: string | undefined;

  const envIdx = args.indexOf('--env');
  if (envIdx !== -1 && args[envIdx + 1]) {
    const val = args[envIdx + 1].toLowerCase();
    if (val === 'production' || val === 'staging' || val === 'preview') {
      env = val;
    }
  }

  const dbIdx = args.indexOf('--database');
  if (dbIdx !== -1 && args[dbIdx + 1]) {
    database = args[dbIdx + 1];
  }

  // Default target resolution: if neither --local nor --remote is specified, default to local Miniflare
  if (!isLocal && !isRemote) {
    isLocal = true;
  }

  if (!database) {
    if (env && ENV_DATABASE_MAP[env]) {
      database = ENV_DATABASE_MAP[env];
    } else if (isRemote) {
      database = 'chrishop-staging-db';
    } else {
      database = 'chrishop-prod-db';
    }
  }

  return {
    database,
    isLocal,
    isRemote,
    env,
  };
}

/**
 * Builds the wrangler d1 migrations apply command string
 */
export function buildMigrationCommand(target: D1TargetConfig): string {
  let cmd = `wrangler d1 migrations apply ${target.database}`;
  if (target.isLocal) {
    cmd += ' --local';
  } else if (target.isRemote) {
    cmd += ' --remote';
    if (target.env) {
      cmd += ` --env ${target.env}`;
    }
  }
  return cmd;
}

/**
 * Builds the verification query command
 */
export function buildVerificationCommand(target: D1TargetConfig): string {
  const sql = "SELECT type, name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY type, name;";
  let cmd = `wrangler d1 execute ${target.database}`;
  if (target.isLocal) {
    cmd += ' --local';
  } else if (target.isRemote) {
    cmd += ' --remote';
    if (target.env) {
      cmd += ` --env ${target.env}`;
    }
  }
  cmd += ` --command "${sql}" --json`;
  return cmd;
}

/**
 * Builds the migration history verification command
 */
export function buildMigrationHistoryCommand(target: D1TargetConfig): string {
  const sql = "SELECT id, name, applied_at FROM d1_migrations ORDER BY id ASC;";
  let cmd = `wrangler d1 execute ${target.database}`;
  if (target.isLocal) {
    cmd += ' --local';
  } else if (target.isRemote) {
    cmd += ' --remote';
    if (target.env) {
      cmd += ` --env ${target.env}`;
    }
  }
  cmd += ` --command "${sql}" --json`;
  return cmd;
}

/**
 * Generates Point-in-Time Recovery (PITR) documentation and CLI instructions
 */
export function generatePitrInstructions(database: string = 'chrishop-prod-db'): string {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  return `
================================================================================
  Cloudflare D1 Point-in-Time Recovery (PITR) Rollback Protocol
================================================================================
Target Database: ${database}

D1 provides continuous automated replication with up to 30 days of retention.
If an unexpected schema mutation or data corruption occurs, execute one of the
following recovery options:

1. Time-Travel Restore to Specific Timestamp (ISO 8601):
   ------------------------------------------------------
   pnpm exec wrangler d1 time-travel restore ${database} --timestamp="${tenMinutesAgo}"

2. Time-Travel Restore to a Specific Bookmark:
   -------------------------------------------
   # First check database info for the latest bookmark:
   pnpm exec wrangler d1 info ${database}
   
   # Restore to specific bookmark:
   pnpm exec wrangler d1 time-travel restore ${database} --bookmark="<bookmark-hash>"

3. Cold Backup Snapshot Import (Disaster Recovery Fallback):
   --------------------------------------------------------
   pnpm exec wrangler d1 execute ${database} --file="./backups/backup-snapshot.sql"

4. Post-Rollback Verification:
   ---------------------------
   pnpm exec wrangler d1 execute ${database} --command "SELECT count(*) FROM products;"
================================================================================
`;
}

/**
 * Main CLI execution logic
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ChrisShop Cloudflare D1 Migration Automation Runner

Usage:
  tsx scripts/d1-migrate.ts [options]

Options:
  --local                 Execute against local Miniflare D1 emulator (default)
  --remote                Execute against Cloudflare remote D1 database
  --env <env>             Target environment: 'staging' | 'production' | 'preview'
  --database <name>       Explicit database name (e.g. chrishop-prod-db)
  --check                 Run pre-flight additive validation only (no migrations executed)
  --all-migrations        Validate all migrations including initial baseline
  --allow-destructive     Bypass additive schema checks (emergency use only)
  --pitr-info             Display D1 Point-in-Time Recovery rollback instructions
  -h, --help              Show this help menu
`);
    return;
  }

  if (args.includes('--pitr-info')) {
    const target = resolveTargetConfig(args);
    console.log(generatePitrInstructions(target.database));
    return;
  }

  console.log('▶ 1. Running Pre-Flight Additive Schema Validation...');
  const checkAll = args.includes('--all-migrations');
  const validation = validateAdditiveMigrations({ checkAll });

  console.log(`   Scanned ${validation.filesAnalyzed.length} migration files in migrations/`);
  console.log(`   - Baseline bootstrap migrations: ${validation.baselineFiles.length}`);
  console.log(`   - Additive evolution migrations: ${validation.additiveFiles.length}`);

  if (!validation.valid) {
    console.error('\n❌ Pre-Flight Additive Schema Validation FAILED:');
    for (const err of validation.errors) {
      console.error(`   - ${err}`);
    }

    if (!args.includes('--allow-destructive')) {
      console.error('\nAborting migration execution. Use --allow-destructive to override if required.');
      process.exit(1);
    } else {
      console.warn('\n⚠️  Proceeding despite validation failures (--allow-destructive specified).');
    }
  } else {
    console.log('   ✅ All forward migrations adhere to non-destructive additive standards.');
  }

  if (args.includes('--check')) {
    console.log('\n✅ Pre-flight check completed successfully (--check mode).');
    return;
  }

  const target = resolveTargetConfig(args);
  const cmd = buildMigrationCommand(target);

  const targetDesc = target.isLocal ? 'Local Miniflare' : `Remote: ${target.env || 'staging'}`;
  console.log(`\n▶ 2. Applying D1 Migrations to ${target.database} (${targetDesc})...`);
  console.log(`   Command: ${cmd}`);

  try {
    // Auto-confirm wrangler migration prompt non-interactively
    execSync(`pnpm exec ${cmd}`, {
      input: 'y\n',
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, CI: 'true' },
    });
  } catch (error) {
    console.error(`\n❌ Failed to apply migrations via wrangler: ${(error as Error).message}`);
    process.exit(1);
  }

  console.log('\n▶ 3. Verifying Post-Migration Schema State...');
  try {
    const verifyCmd = buildVerificationCommand(target);
    const rawOutput = execSync(`pnpm exec ${verifyCmd}`, { encoding: 'utf-8' });
    const jsonMatch = rawOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const results = parsed[0]?.results || [];
      const tables = results.filter((r: any) => r.type === 'table').map((r: any) => r.name);
      const indexes = results.filter((r: any) => r.type === 'index').map((r: any) => r.name);

      console.log(`   ✅ Database verified: ${tables.length} tables, ${indexes.length} indexes present.`);
    } else {
      console.log('   ✅ Schema verification query completed.');
    }

    const historyCmd = buildMigrationHistoryCommand(target);
    const rawHistory = execSync(`pnpm exec ${historyCmd}`, { encoding: 'utf-8' });
    const historyMatch = rawHistory.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (historyMatch) {
      const historyParsed = JSON.parse(historyMatch[0]);
      const migrations = historyParsed[0]?.results || [];
      console.log(`   ✅ Applied migrations logged: ${migrations.length} recorded in d1_migrations.`);
    }
  } catch (err) {
    console.warn(`   ⚠️ Warning: Could not verify schema state automatically: ${(err as Error).message}`);
  }

  console.log('\n🎉 D1 migration execution and validation finished successfully!');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error in d1-migrate:', err);
    process.exit(1);
  });
}
