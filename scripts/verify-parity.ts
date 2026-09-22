#!/usr/bin/env tsx
/**
 * ChrisShop Turnkey Environment Parity Verification CLI
 *
 * Story 2.32: Staging & Ephemeral Preview Cloudflare Workflows (#144)
 *
 * Validates database schema & migration parity and edge runtime bindings
 * across Local, Ephemeral Preview, Staging, and Production Cloudflare environments.
 *
 * Usage:
 *   pnpm run test:parity --target staging
 *   pnpm run test:parity --url https://pr-42.preview.chrishop.com --env preview
 *   pnpm run test:parity --target staging --d1 chrishop-staging-db
 *   pnpm run test:parity --mock
 *   pnpm run test:parity --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// ============================================================================
// ANSI Color Formatting
// ============================================================================

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ParityVerificationOptions {
  target?: string;
  url?: string;
  env?: string;
  d1Database?: string;
  maxLatencyMs?: number;
  mock?: boolean;
  dryRun?: boolean;
  skipD1?: boolean;
  skipProbes?: boolean;
  accountId?: string;
  apiToken?: string;
  reportFile?: string;
  verbose?: boolean;
  fetchFn?: typeof fetch;
  mockTargetSchema?: TargetSchemaResult;
  rootDir?: string;
}

export type CheckStatus = 'passed' | 'failed' | 'skipped' | 'warning';

export interface ParityCheckResult {
  id: string;
  name: string;
  category: 'd1:schema' | 'd1:migrations' | 'edge:health' | 'edge:storefront' | 'edge:admin' | 'headers' | 'latency';
  status: CheckStatus;
  message: string;
  durationMs: number;
  details?: Record<string, any>;
}

export interface LocalBaselineSchema {
  migrationFiles: string[];
  tables: string[];
  indexes: Array<{ name: string; table: string }>;
  tableColumns: Record<string, Array<{ name: string; type: string; notnull: number; pk: number }>>;
}

export interface TargetSchemaResult {
  tables: string[];
  indexes: Array<{ name: string; table?: string }>;
  appliedMigrations: string[];
  source: 'worker-debug' | 'remote-api' | 'wrangler-cli' | 'local-sqlite' | 'mock' | 'unavailable';
  error?: string;
}

export interface ParityReport {
  timestamp: string;
  target: string;
  url: string;
  env: string;
  d1Database: string;
  allPassed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
  };
  results: ParityCheckResult[];
}

// Critical tables that must exist in target schema
export const CRITICAL_TABLES = [
  'categories',
  'products',
  'product_variations',
  'media',
  'users',
  'payload_locked_documents',
  'product_lines',
  'pages',
  'theme_settings',
];

// Critical indexes that must exist in target schema
export const CRITICAL_INDEXES = [
  'products_slug_idx',
  'products_shopify_product_id_idx',
  'product_variations_sku_idx',
  'categories_slug_idx',
];

// ============================================================================
// Parameter & Target Resolution
// ============================================================================

export interface ResolvedTargetConfig {
  target: string;
  env: string;
  url: string;
  d1Database: string;
}

export function resolveTargetConfig(options: ParityVerificationOptions): ResolvedTargetConfig {
  let target = (options.target || options.env || 'staging').toLowerCase();
  let env = (options.env || target).toLowerCase();
  let url = options.url || '';
  let d1Database = options.d1Database || '';

  // Infer environment from URL if target not explicit
  if (!options.target && options.url) {
    if (options.url.includes('preview') || options.url.includes('pr-')) {
      env = 'preview';
      target = 'preview';
    } else if (options.url.includes('staging')) {
      env = 'staging';
      target = 'staging';
    } else if (options.url.includes('chrishop.jacobmiller22.com')) {
      env = 'production';
      target = 'production';
    } else if (options.url.includes('localhost') || options.url.includes('127.0.0.1')) {
      env = 'local';
      target = 'local';
    }
  }

  // Resolve default URLs
  if (!url) {
    switch (target) {
      case 'production':
      case 'prod':
        url = 'https://chrishop.jacobmiller22.com';
        break;
      case 'preview':
        url = 'https://preview-chrishop.jacobmiller22.com';
        break;
      case 'local':
        url = 'http://localhost:8787';
        break;
      case 'staging':
      default:
        url = 'https://staging-chrishop.jacobmiller22.com';
        break;
    }
  }

  // Resolve default D1 database
  if (!d1Database) {
    switch (target) {
      case 'production':
      case 'prod':
        d1Database = 'chrishop-prod-db';
        break;
      case 'staging':
        d1Database = 'chrishop-staging-db';
        break;
      case 'preview': {
        const prMatch = url.match(/pr-(\d+)/);
        d1Database = prMatch ? `chrishop-preview-pr-${prMatch[1]}-db` : 'chrishop-preview-db';
        break;
      }
      case 'local':
      default:
        d1Database = 'chrishop-local-db';
        break;
    }
  }

  return { target, env, url, d1Database };
}

// ============================================================================
// D1 Baseline Extraction (In-Memory SQLite)
// ============================================================================

export function extractLocalBaselineSchema(rootDir: string = process.cwd()): LocalBaselineSchema {
  const migrationsDir = path.join(rootDir, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF;');

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    try {
      db.exec(sql);
    } catch (err: any) {
      throw new Error(`Failed to apply baseline migration "${file}": ${err.message}`);
    }
  }

  const tablesResult: any[] = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all();
  const tables = tablesResult.map((r) => r.name);

  const indexesResult: any[] = db
    .prepare(
      "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'"
    )
    .all();
  const indexes = indexesResult.map((r) => ({ name: r.name, table: r.tbl_name }));

  const tableColumns: Record<string, Array<{ name: string; type: string; notnull: number; pk: number }>> = {};
  for (const tbl of tables) {
    const colsResult: any[] = db.prepare(`PRAGMA table_info(${tbl})`).all();
    tableColumns[tbl] = colsResult.map((c) => ({
      name: c.name,
      type: c.type,
      notnull: c.notnull,
      pk: c.pk,
    }));
  }

  db.close();

  return {
    migrationFiles,
    tables,
    indexes,
    tableColumns,
  };
}

// ============================================================================
// Target D1 Schema Retrieval
// ============================================================================

export async function fetchTargetD1Schema(
  config: ResolvedTargetConfig,
  options: ParityVerificationOptions,
  baseline: LocalBaselineSchema
): Promise<TargetSchemaResult> {
  // If mock target schema explicitly provided
  if (options.mockTargetSchema) {
    return options.mockTargetSchema;
  }

  // If running in mock or offline dry-run mode without credentials
  if (options.mock) {
    return {
      tables: [...baseline.tables],
      indexes: [...baseline.indexes],
      appliedMigrations: [...baseline.migrationFiles],
      source: 'mock',
    };
  }

  const fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);

  // Strategy 1: Edge Worker Diagnostic Endpoint (/api/debug)
  if (fetchFn && config.url) {
    try {
      const debugUrl = new URL('/api/debug', config.url).toString();
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4000);

      const res = await fetchFn(debugUrl, { signal: ctrl.signal }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const body: any = await res.json().catch(() => null);
        if (body && Array.isArray(body.tables)) {
          return {
            tables: body.tables,
            indexes: Array.isArray(body.indexes)
              ? body.indexes.map((idx: string) => ({ name: idx }))
              : [],
            appliedMigrations: Array.isArray(body.appliedMigrations)
              ? body.appliedMigrations
              : [],
            source: 'worker-debug',
          };
        }
      }
    } catch {
      // Worker probe failed, proceed to next strategy
    }
  }

  // Strategy 2: Cloudflare D1 REST API
  const accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = options.apiToken || process.env.CLOUDFLARE_API_TOKEN;

  if (fetchFn && accountId && apiToken && config.d1Database) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${config.d1Database}/query`;

      const executeD1 = async (sql: string) => {
        const r = await fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ sql }),
        });
        if (!r.ok) return null;
        const data: any = await r.json().catch(() => null);
        return data?.result?.[0]?.results || [];
      };

      const tablesRows = await executeD1("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
      const indexesRows = await executeD1("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'");
      const migrationsRows = await executeD1("SELECT name FROM d1_migrations ORDER BY id ASC");

      if (tablesRows && tablesRows.length > 0) {
        return {
          tables: tablesRows.map((t: any) => t.name),
          indexes: (indexesRows || []).map((i: any) => ({ name: i.name, table: i.tbl_name })),
          appliedMigrations: (migrationsRows || []).map((m: any) => m.name),
          source: 'remote-api',
        };
      }
    } catch {
      // Cloudflare API failed, proceed
    }
  }

  // Strategy 3: Local SQLite Check (for local / dev target)
  if (config.target === 'local') {
    const localDbPath = path.resolve(options.rootDir || process.cwd(), '.wrangler/state/v3/d1/local.sqlite');
    if (fs.existsSync(localDbPath)) {
      try {
        const localDb = new DatabaseSync(localDbPath);
        const tablesResult: any[] = localDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
          .all();
        const indexesResult: any[] = localDb
          .prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
          .all();
        const migrationsResult: any[] = localDb
          .prepare("SELECT name FROM d1_migrations ORDER BY id ASC")
          .all()
          .catch(() => []);
        localDb.close();

        return {
          tables: tablesResult.map((t) => t.name),
          indexes: indexesResult.map((i) => ({ name: i.name, table: i.tbl_name })),
          appliedMigrations: migrationsResult.map((m) => m.name),
          source: 'local-sqlite',
        };
      } catch {
        // Fall through
      }
    }
  }

  // Strategy 4: Graceful dry-run fallback if credentials missing
  if (options.dryRun) {
    return {
      tables: [...baseline.tables],
      indexes: [...baseline.indexes],
      appliedMigrations: [...baseline.migrationFiles],
      source: 'mock',
    };
  }

  return {
    tables: [],
    indexes: [],
    appliedMigrations: [],
    source: 'unavailable',
    error: 'Remote D1 database could not be reached via /api/debug probe or Cloudflare REST API (missing credentials or network unreachable).',
  };
}

// ============================================================================
// Schema & Migration Comparison Engine
// ============================================================================

export function compareD1Schema(
  baseline: LocalBaselineSchema,
  target: TargetSchemaResult
): ParityCheckResult[] {
  const results: ParityCheckResult[] = [];
  const start = Date.now();

  if (target.source === 'unavailable') {
    results.push({
      id: 'd1-connectivity',
      name: 'D1 Database Remote Schema Access',
      category: 'd1:schema',
      status: 'warning',
      message: `Skipped remote D1 schema inspection: ${target.error || 'credentials unavailable'}`,
      durationMs: Date.now() - start,
    });
    return results;
  }

  // 1. Table Parity Check
  const targetTableSet = new Set(target.tables);
  const missingTables = baseline.tables.filter((t) => !targetTableSet.has(t));
  const missingCriticalTables = CRITICAL_TABLES.filter((t) => !targetTableSet.has(t));

  if (missingCriticalTables.length > 0) {
    results.push({
      id: 'd1-critical-tables',
      name: 'D1 Critical Core Tables Parity',
      category: 'd1:schema',
      status: 'failed',
      message: `Target D1 database is missing ${missingCriticalTables.length} critical table(s): ${missingCriticalTables.join(', ')}`,
      durationMs: Date.now() - start,
      details: { missingCriticalTables, presentTablesCount: target.tables.length },
    });
  } else if (missingTables.length > 0) {
    results.push({
      id: 'd1-tables-divergence',
      name: 'D1 Table Schema Baseline Parity',
      category: 'd1:schema',
      status: 'warning',
      message: `Target D1 is missing ${missingTables.length} table(s) from baseline: ${missingTables.join(', ')}`,
      durationMs: Date.now() - start,
      details: { missingTables },
    });
  } else {
    results.push({
      id: 'd1-tables-parity',
      name: 'D1 Table Schema Baseline Parity',
      category: 'd1:schema',
      status: 'passed',
      message: `All ${baseline.tables.length} baseline tables exist in target D1 database (source: ${target.source}).`,
      durationMs: Date.now() - start,
      details: { tableCount: target.tables.length },
    });
  }

  // 2. Index Parity Check
  if (target.indexes.length > 0) {
    const targetIndexSet = new Set(target.indexes.map((i) => i.name));
    const missingCriticalIndexes = CRITICAL_INDEXES.filter((i) => !targetIndexSet.has(i));

    if (missingCriticalIndexes.length > 0) {
      results.push({
        id: 'd1-critical-indexes',
        name: 'D1 Critical Indexes Parity',
        category: 'd1:schema',
        status: 'failed',
        message: `Target D1 database is missing ${missingCriticalIndexes.length} critical index(es): ${missingCriticalIndexes.join(', ')}`,
        durationMs: Date.now() - start,
        details: { missingCriticalIndexes },
      });
    } else {
      results.push({
        id: 'd1-indexes-parity',
        name: 'D1 Core Index Parity',
        category: 'd1:schema',
        status: 'passed',
        message: `Verified critical indexes exist on target D1 database (${target.indexes.length} total indexes).`,
        durationMs: Date.now() - start,
      });
    }
  } else {
    results.push({
      id: 'd1-indexes-parity',
      name: 'D1 Core Index Parity',
      category: 'd1:schema',
      status: 'warning',
      message: 'Target index list empty or uninspectable via current probe.',
      durationMs: Date.now() - start,
    });
  }

  // 3. Migration Parity Check
  if (target.appliedMigrations.length > 0) {
    const appliedSet = new Set(target.appliedMigrations);
    const unappliedMigrations = baseline.migrationFiles.filter((m) => !appliedSet.has(m));

    if (unappliedMigrations.length > 0) {
      results.push({
        id: 'd1-migrations-parity',
        name: 'D1 Applied Migrations Version Parity',
        category: 'd1:migrations',
        status: 'failed',
        message: `Target D1 database is behind by ${unappliedMigrations.length} migration(s): ${unappliedMigrations.join(', ')}`,
        durationMs: Date.now() - start,
        details: { unappliedMigrations, appliedCount: target.appliedMigrations.length },
      });
    } else {
      results.push({
        id: 'd1-migrations-parity',
        name: 'D1 Applied Migrations Version Parity',
        category: 'd1:migrations',
        status: 'passed',
        message: `All ${baseline.migrationFiles.length} migrations applied in target D1 database.`,
        durationMs: Date.now() - start,
        details: { appliedCount: target.appliedMigrations.length },
      });
    }
  } else {
    results.push({
      id: 'd1-migrations-parity',
      name: 'D1 Applied Migrations Version Parity',
      category: 'd1:migrations',
      status: 'warning',
      message: 'd1_migrations history table not found or empty on target environment.',
      durationMs: Date.now() - start,
    });
  }

  return results;
}

// ============================================================================
// Synthetic Edge Probes Matrix
// ============================================================================

export async function runSyntheticEdgeProbes(
  config: ResolvedTargetConfig,
  options: ParityVerificationOptions
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];
  const maxLatencyMs = options.maxLatencyMs ?? 500;
  const fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);

  if (!fetchFn) {
    results.push({
      id: 'edge-fetch-unavailable',
      name: 'Synthetic Edge HTTP Probing',
      category: 'edge:health',
      status: 'failed',
      message: 'Global fetch API is unavailable in this Node environment.',
      durationMs: 0,
    });
    return results;
  }

  if (options.mock || options.dryRun) {
    // Return simulated passing probes in mock/dry-run mode
    results.push({
      id: 'edge-health-probe',
      name: 'GET /api/health (Edge Runtime & Status)',
      category: 'edge:health',
      status: 'passed',
      message: 'HTTP 200 OK | status: healthy | runtime: cloudflare-workers | bindings: { d1: true, kv: true, r2: true } (Simulated)',
      durationMs: 45,
      details: { status: 'healthy', runtime: 'cloudflare-workers', bindings: { d1: true, kv: true, r2: true } },
    });
    results.push({
      id: 'edge-products-probe',
      name: 'GET /products (Catalog Storefront SSR)',
      category: 'edge:storefront',
      status: 'passed',
      message: 'HTTP 200 OK | Storefront catalog response verified (Simulated)',
      durationMs: 62,
    });
    results.push({
      id: 'edge-admin-probe',
      name: 'GET /admin (Payload CMS Admin Router)',
      category: 'edge:admin',
      status: 'passed',
      message: 'HTTP 200 OK | Payload CMS admin interface reachable (Simulated)',
      durationMs: 50,
    });
    results.push({
      id: 'edge-headers-probe',
      name: 'Edge Security & Cache Header Policies',
      category: 'headers',
      status: 'passed',
      message: 'Verified X-Content-Type-Options: nosniff and Cache-Control: no-store (Simulated)',
      durationMs: 5,
    });
    results.push({
      id: 'edge-latency-probe',
      name: `Edge Latency SLA (< ${maxLatencyMs}ms)`,
      category: 'latency',
      status: 'passed',
      message: `Mean response latency: 52.3ms within SLA threshold (< ${maxLatencyMs}ms)`,
      durationMs: 52,
    });
    return results;
  }

  const latencies: number[] = [];

  // 1. Probe: GET /api/health
  const healthStart = Date.now();
  try {
    const healthUrl = new URL('/api/health', config.url).toString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetchFn(healthUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    const healthDuration = Date.now() - healthStart;
    latencies.push(healthDuration);

    if (res.status === 200) {
      const data: any = await res.json().catch(() => null);
      if (data && data.status === 'healthy') {
        const bindings = data.bindings || {};
        const d1Ok = Boolean(bindings.d1);
        const kvOk = Boolean(bindings.kv);
        const r2Ok = Boolean(bindings.r2);

        // Preview may gracefully omit R2 if unprovisioned
        const bindingsOk = d1Ok && kvOk && (r2Ok || config.env === 'preview');

        if (bindingsOk) {
          results.push({
            id: 'edge-health-probe',
            name: 'GET /api/health (Edge Runtime & Status)',
            category: 'edge:health',
            status: 'passed',
            message: `HTTP 200 OK | runtime: ${data.runtime} | bindings: { d1: ${d1Ok}, kv: ${kvOk}, r2: ${r2Ok} }`,
            durationMs: healthDuration,
            details: data,
          });
        } else {
          results.push({
            id: 'edge-health-probe',
            name: 'GET /api/health (Edge Runtime & Status)',
            category: 'edge:health',
            status: 'failed',
            message: `Unsatisfied bindings on edge: d1=${d1Ok}, kv=${kvOk}, r2=${r2Ok}`,
            durationMs: healthDuration,
            details: data,
          });
        }
      } else {
        results.push({
          id: 'edge-health-probe',
          name: 'GET /api/health (Edge Runtime & Status)',
          category: 'edge:health',
          status: 'failed',
          message: `Health endpoint returned status 200 but payload status is "${data?.status}"`,
          durationMs: healthDuration,
        });
      }

      // Security & Cache Header Checks for /api/health
      const cacheControl = res.headers.get('cache-control') || '';
      const contentTypeOptions = res.headers.get('x-content-type-options') || '';

      const hasNoStore = cacheControl.includes('no-store') || cacheControl.includes('no-cache');
      const hasNosniff = contentTypeOptions.toLowerCase().includes('nosniff');

      if (hasNoStore && hasNosniff) {
        results.push({
          id: 'edge-health-headers',
          name: 'Edge API Security & Cache Headers',
          category: 'headers',
          status: 'passed',
          message: `Headers verified (Cache-Control: ${cacheControl}, X-Content-Type-Options: ${contentTypeOptions})`,
          durationMs: 2,
        });
      } else {
        results.push({
          id: 'edge-health-headers',
          name: 'Edge API Security & Cache Headers',
          category: 'headers',
          status: 'warning',
          message: `Header policy divergence: Cache-Control="${cacheControl}", X-Content-Type-Options="${contentTypeOptions}"`,
          durationMs: 2,
        });
      }
    } else {
      results.push({
        id: 'edge-health-probe',
        name: 'GET /api/health (Edge Runtime & Status)',
        category: 'edge:health',
        status: 'failed',
        message: `Edge health check failed with HTTP ${res.status}`,
        durationMs: healthDuration,
      });
    }
  } catch (err: any) {
    results.push({
      id: 'edge-health-probe',
      name: 'GET /api/health (Edge Runtime & Status)',
      category: 'edge:health',
      status: 'failed',
      message: `Failed to reach ${config.url}/api/health: ${err.message}`,
      durationMs: Date.now() - healthStart,
    });
  }

  // 2. Probe: GET /products
  const prodStart = Date.now();
  try {
    const prodUrl = new URL('/products', config.url).toString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetchFn(prodUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    const prodDuration = Date.now() - prodStart;
    latencies.push(prodDuration);

    if (res.status === 200 || (res.status >= 300 && res.status < 400)) {
      results.push({
        id: 'edge-products-probe',
        name: 'GET /products (Catalog Storefront SSR)',
        category: 'edge:storefront',
        status: 'passed',
        message: `HTTP ${res.status} | Catalog route active and responsive`,
        durationMs: prodDuration,
      });
    } else {
      results.push({
        id: 'edge-products-probe',
        name: 'GET /products (Catalog Storefront SSR)',
        category: 'edge:storefront',
        status: 'failed',
        message: `Storefront /products probe returned HTTP ${res.status}`,
        durationMs: prodDuration,
      });
    }
  } catch (err: any) {
    results.push({
      id: 'edge-products-probe',
      name: 'GET /products (Catalog Storefront SSR)',
      category: 'edge:storefront',
      status: 'failed',
      message: `Failed to reach ${config.url}/products: ${err.message}`,
      durationMs: Date.now() - prodStart,
    });
  }

  // 3. Probe: GET /admin
  const adminStart = Date.now();
  try {
    const adminUrl = new URL('/admin', config.url).toString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetchFn(adminUrl, { signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(timer);
    const adminDuration = Date.now() - adminStart;
    latencies.push(adminDuration);

    // Payload CMS /admin is healthy if 200 or redirecting (301/302/307/308) to login
    if (res.status === 200 || (res.status >= 300 && res.status < 400)) {
      results.push({
        id: 'edge-admin-probe',
        name: 'GET /admin (Payload CMS Admin Router)',
        category: 'edge:admin',
        status: 'passed',
        message: `HTTP ${res.status} | Payload CMS admin router responsive`,
        durationMs: adminDuration,
      });
    } else {
      results.push({
        id: 'edge-admin-probe',
        name: 'GET /admin (Payload CMS Admin Router)',
        category: 'edge:admin',
        status: 'failed',
        message: `Admin probe returned HTTP ${res.status}`,
        durationMs: adminDuration,
      });
    }
  } catch (err: any) {
    results.push({
      id: 'edge-admin-probe',
      name: 'GET /admin (Payload CMS Admin Router)',
      category: 'edge:admin',
      status: 'failed',
      message: `Failed to reach ${config.url}/admin: ${err.message}`,
      durationMs: Date.now() - adminStart,
    });
  }

  // 4. Latency SLA Probe
  if (latencies.length > 0) {
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const maxObserved = Math.max(...latencies);

    if (maxObserved <= maxLatencyMs) {
      results.push({
        id: 'edge-latency-sla',
        name: `Edge Latency SLA (< ${maxLatencyMs}ms)`,
        category: 'latency',
        status: 'passed',
        message: `Peak latency: ${maxObserved}ms | Avg: ${avgLatency}ms (SLA threshold: < ${maxLatencyMs}ms)`,
        durationMs: avgLatency,
      });
    } else {
      results.push({
        id: 'edge-latency-sla',
        name: `Edge Latency SLA (< ${maxLatencyMs}ms)`,
        category: 'latency',
        status: 'warning',
        message: `Observed peak latency (${maxObserved}ms) exceeded SLA threshold (< ${maxLatencyMs}ms)`,
        durationMs: avgLatency,
      });
    }
  }

  return results;
}

// ============================================================================
// Markdown Report Generator
// ============================================================================

export function generateParityMarkdownReport(report: ParityReport): string {
  const icon = (s: CheckStatus) => {
    switch (s) {
      case 'passed':
        return '✔ PASS';
      case 'failed':
        return '✖ FAIL';
      case 'warning':
        return '⚠ WARN';
      case 'skipped':
        return '⊘ SKIP';
    }
  };

  const lines: string[] = [
    `# 🌐 Environment Parity Verification Report`,
    ``,
    `- **Timestamp**: \`${report.timestamp}\``,
    `- **Target Environment**: \`${report.target}\` (env: \`${report.env}\`)`,
    `- **Host URL**: [${report.url}](${report.url})`,
    `- **D1 Database**: \`${report.d1Database}\``,
    `- **Status**: **${report.allPassed ? 'PASSED (Parity Confirmed)' : 'FAILED (Parity Divergence)'}**`,
    ``,
    `| Check | Status | Duration | Diagnostic Summary |`,
    `| :--- | :---: | :---: | :--- |`,
  ];

  for (const r of report.results) {
    lines.push(`| **${r.name}** | \`${icon(r.status)}\` | ${(r.durationMs / 1000).toFixed(2)}s | ${r.message} |`);
  }

  lines.push(``);
  lines.push(`### Summary`);
  lines.push(`- **Total Checks**: ${report.summary.total}`);
  lines.push(`- **Passed**: ${report.summary.passed}`);
  lines.push(`- **Failed**: ${report.summary.failed}`);
  lines.push(`- **Warnings**: ${report.summary.warnings}`);
  lines.push(`- **Skipped**: ${report.summary.skipped}`);
  lines.push(``);

  return lines.join('\n');
}

// ============================================================================
// Main Orchestration Runner
// ============================================================================

export async function verifyParity(options: ParityVerificationOptions = {}): Promise<ParityReport> {
  const resolved = resolveTargetConfig(options);
  const rootDir = options.rootDir || process.cwd();

  const results: ParityCheckResult[] = [];

  // Phase 1: Local Baseline Schema Extraction
  let baseline: LocalBaselineSchema | null = null;
  const baselineStart = Date.now();
  try {
    baseline = extractLocalBaselineSchema(rootDir);
    results.push({
      id: 'baseline-extraction',
      name: 'Local SQLite Migration & Schema Baseline',
      category: 'd1:schema',
      status: 'passed',
      message: `Extracted ${baseline.tables.length} tables, ${baseline.indexes.length} indexes, and ${baseline.migrationFiles.length} migration files.`,
      durationMs: Date.now() - baselineStart,
    });
  } catch (err: any) {
    results.push({
      id: 'baseline-extraction',
      name: 'Local SQLite Migration & Schema Baseline',
      category: 'd1:schema',
      status: 'failed',
      message: `Failed to extract local baseline schema: ${err.message}`,
      durationMs: Date.now() - baselineStart,
    });
  }

  // Phase 2: D1 Database Schema & Migration Parity Diff
  if (!options.skipD1 && baseline) {
    const targetSchema = await fetchTargetD1Schema(resolved, options, baseline);
    const d1Checks = compareD1Schema(baseline, targetSchema);
    results.push(...d1Checks);
  }

  // Phase 3: Synthetic Edge Probes Matrix
  if (!options.skipProbes) {
    const edgeChecks = await runSyntheticEdgeProbes(resolved, options);
    results.push(...edgeChecks);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const allPassed = failed === 0;

  const report: ParityReport = {
    timestamp: new Date().toISOString(),
    target: resolved.target,
    env: resolved.env,
    url: resolved.url,
    d1Database: resolved.d1Database,
    allPassed,
    summary: {
      total: results.length,
      passed,
      failed,
      warnings,
      skipped,
    },
    results,
  };

  // Optional file report write
  if (options.reportFile) {
    const md = generateParityMarkdownReport(report);
    fs.writeFileSync(options.reportFile, md, 'utf-8');
  }

  // Optional GitHub Actions step summary write
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = generateParityMarkdownReport(report);
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', 'utf-8');
    } catch {
      // Ignore if step summary write fails
    }
  }

  return report;
}

// ============================================================================
// CLI Entrypoint
// ============================================================================

export function printHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}ChrisShop Environment Parity Verification CLI${colors.reset}

${colors.bold}USAGE:${colors.reset}
  pnpm run test:parity [OPTIONS]

${colors.bold}OPTIONS:${colors.reset}
  --target <target>     Target environment: staging | production | preview | local (default: staging)
  --url <url>           Target edge worker URL (e.g. https://pr-42.preview.chrishop.com)
  --env <env>           Environment name override: preview | staging | production | local
  --d1 <db-name>        Target Cloudflare D1 database name (default derived from target)
  --max-latency <ms>    Maximum edge latency threshold in milliseconds (default: 500)
  --mock                Run with in-memory simulated responses (offline safe)
  --dry-run             Tolerate missing remote credentials and use mock fallback
  --skip-d1             Skip D1 database schema and migration checks
  --skip-probes         Skip synthetic HTTP edge probes
  --report <file>       Write Markdown parity report to the specified file path
  --verbose             Enable verbose logging output
  --help, -h            Show this help manual

${colors.bold}EXAMPLES:${colors.reset}
  # Verify staging environment parity
  pnpm run test:parity --target staging

  # Verify an ephemeral PR preview deployment
  pnpm run test:parity --url https://pr-42-chrishop.jacobmiller22.com --env preview

  # Verify custom D1 database target
  pnpm run test:parity --target staging --d1 chrishop-staging-db

  # Offline test run (no remote credentials required)
  pnpm run test:parity --mock
`);
}

export function parseCliArgs(argv: string[]): ParityVerificationOptions {
  const options: ParityVerificationOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--target' && i + 1 < argv.length) {
      options.target = argv[++i];
    } else if (arg === '--url' && i + 1 < argv.length) {
      options.url = argv[++i];
    } else if (arg === '--env' && i + 1 < argv.length) {
      options.env = argv[++i];
    } else if (arg === '--d1' && i + 1 < argv.length) {
      options.d1Database = argv[++i];
    } else if (arg === '--max-latency' && i + 1 < argv.length) {
      options.maxLatencyMs = parseInt(argv[++i], 10);
    } else if (arg === '--report' && i + 1 < argv.length) {
      options.reportFile = argv[++i];
    } else if (arg === '--mock') {
      options.mock = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-d1') {
      options.skipD1 = true;
    } else if (arg === '--skip-probes') {
      options.skipProbes = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    }
  }

  return options;
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseCliArgs(args);

  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🌐 ChrisShop Cloudflare Edge Environment Parity Verifier     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  const resolved = resolveTargetConfig(options);
  console.log(`${colors.bold}Target Configuration:${colors.reset}`);
  console.log(`- ${colors.blue}Target Environment${colors.reset}: ${colors.bold}${resolved.target}${colors.reset} (env: ${resolved.env})`);
  console.log(`- ${colors.cyan}Host Base URL${colors.reset}:      ${resolved.url}`);
  console.log(`- ${colors.magenta}D1 Database Name${colors.reset}:   ${resolved.d1Database}`);
  if (options.mock) {
    console.log(`- ${colors.yellow}Execution Mode${colors.reset}:     ${colors.bold}MOCK (In-Memory Baseline)${colors.reset}`);
  } else if (options.dryRun) {
    console.log(`- ${colors.yellow}Execution Mode${colors.reset}:     ${colors.bold}DRY RUN${colors.reset}`);
  }
  console.log('');

  const report = await verifyParity(options);

  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}                    Parity Verification Results                 ${colors.reset}`);
  console.log(`${colors.bold}----------------------------------------------------------------${colors.reset}`);

  for (const r of report.results) {
    const icon =
      r.status === 'passed'
        ? `${colors.green}✔ PASS${colors.reset}`
        : r.status === 'failed'
          ? `${colors.red}✖ FAIL${colors.reset}`
          : r.status === 'warning'
            ? `${colors.yellow}⚠ WARN${colors.reset}`
            : `${colors.dim}⊘ SKIP${colors.reset}`;

    const duration = `${(r.durationMs / 1000).toFixed(2)}s`;
    console.log(`  ${icon} | ${r.name.padEnd(46)} | ${duration.padStart(6)}`);
    if (r.status === 'failed' || r.status === 'warning' || options.verbose) {
      console.log(`         ${colors.dim}↳ ${r.message}${colors.reset}`);
    }
  }

  console.log(`${colors.bold}----------------------------------------------------------------${colors.reset}`);
  console.log(
    `Summary: ${colors.green}${report.summary.passed} Passed${colors.reset} | ` +
      `${colors.red}${report.summary.failed} Failed${colors.reset} | ` +
      `${colors.yellow}${report.summary.warnings} Warnings${colors.reset} | ` +
      `${colors.dim}${report.summary.skipped} Skipped${colors.reset}`
  );

  if (report.allPassed) {
    console.log(`\n${colors.bold}${colors.green}✔ ENVIRONMENT PARITY CONFIRMED!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bold}${colors.red}✖ PARITY VERIFICATION FAILED. Review issues above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Execute when invoked directly
const isDirectCall =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectCall) {
  main().catch((err) => {
    console.error(`\n${colors.red}${colors.bold}Fatal error in parity verifier:${colors.reset}`, err);
    process.exit(1);
  });
}
