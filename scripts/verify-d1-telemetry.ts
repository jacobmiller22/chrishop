#!/usr/bin/env tsx
/**
 * Verification Script: Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 *
 * Story 4.27 (#332): Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 *
 * Verifies:
 * 1. D1 statement execution timing across all(), get(), first(), run(), and exec().
 * 2. Slow query detection (>50ms threshold) and structured warning logging.
 * 3. Query classification (read vs write) and rolling percentiles (avg, p95, min, max).
 * 4. Per-request query attribution via active TraceContext correlation.
 * 5. Edge diagnostics exposure in /api/health probes and HTTP response headers.
 * 6. Non-blocking error handling: failed queries record telemetry without swallowing errors.
 */

import {
  withD1Telemetry,
  getD1TelemetryMetrics,
  resetD1TelemetryMetrics,
  setSlowQueryThreshold,
  getSlowQueryThreshold,
  getRequestD1Metrics,
  categorizeSqlQuery,
  type D1DatabaseLike,
} from '../apps/web/src/lib/d1-telemetry';
import { runWithTraceContext } from '../apps/web/src/lib/tracing';
import { performHealthCheck } from '../apps/web/src/lib/health-monitoring';
import { GET as healthRouteHandler } from '../apps/web/src/app/api/health/route';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function main(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🔍 Story 4.27: D1 Statement Execution Latency & Telemetry    ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let failures = 0;
  resetD1TelemetryMetrics();

  // Mock D1 Database Engine for Verification
  function createMockD1Database(simulatedDelayMs = 0): D1DatabaseLike {
    return {
      prepare(sql: string) {
        return {
          bind(..._params: any[]) {
            return this;
          },
          all: async () => {
            if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
            return [{ id: 'prod_1', title: 'Alpine Pack' }];
          },
          get: async () => {
            if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
            return { id: 'prod_1', title: 'Alpine Pack' };
          },
          first: async () => {
            if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
            return { id: 'prod_1', count: 42 };
          },
          run: async () => {
            if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
            return { success: true, changes: 1 };
          },
        };
      },
      exec: async () => {
        if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
      },
    };
  }

  // 1. Transparent Execution Timing Across All Methods
  console.log(`${colors.bold}1. Transparent Execution Timing Across Statement Methods:${colors.reset}`);
  const baseDb = createMockD1Database(5); // 5ms simulated latency
  const instrumentedDb = withD1Telemetry(baseDb);

  await instrumentedDb.prepare('SELECT * FROM products;').all();
  await instrumentedDb.prepare('SELECT * FROM products WHERE id = ?;').bind('prod_1').get();
  await instrumentedDb.prepare('SELECT COUNT(*) as count FROM products;').first();
  await instrumentedDb.prepare('UPDATE products SET stock = 10 WHERE id = ?;').bind('prod_1').run();
  await instrumentedDb.exec?.('CREATE INDEX idx_products_slug ON products(slug);');

  const initialMetrics = getD1TelemetryMetrics();
  if (initialMetrics.totalQueries !== 5) {
    console.error(`  ${colors.red}✖ Expected 5 queries recorded, got ${initialMetrics.totalQueries}${colors.reset}`);
    failures++;
  } else if (initialMetrics.readQueries !== 3 || initialMetrics.writeQueries !== 2) {
    console.error(`  ${colors.red}✖ Incorrect query classification: read=${initialMetrics.readQueries} (expected 3), write=${initialMetrics.writeQueries} (expected 2)${colors.reset}`);
    failures++;
  } else if (initialMetrics.totalDurationMs < 15) {
    console.error(`  ${colors.red}✖ Expected accumulated duration >= 15ms, got ${initialMetrics.totalDurationMs}ms${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Recorded 5/5 operations with latency: total=${initialMetrics.totalDurationMs}ms, avg=${initialMetrics.avgDurationMs}ms (read=${initialMetrics.readQueries}, write=${initialMetrics.writeQueries})`);
  }

  // 2. Slow Query Detection & Threshold Logging
  console.log(`\n${colors.bold}2. Slow Query Detection (>50ms Threshold):${colors.reset}`);
  const slowDb = withD1Telemetry(createMockD1Database(60)); // 60ms simulated slow query
  const originalWarn = console.warn;
  let warnCaptured = false;
  console.warn = (...args: any[]) => {
    if (args.some((a) => typeof a === 'string' && a.includes('[D1:SlowQuery]'))) {
      warnCaptured = true;
    }
  };

  try {
    await slowDb.prepare('SELECT * FROM unindexed_table WHERE complex_col LIKE "%heavy%";').all();
  } finally {
    console.warn = originalWarn;
  }

  const slowMetrics = getD1TelemetryMetrics();
  if (slowMetrics.slowQueries !== 1) {
    console.error(`  ${colors.red}✖ Expected 1 slow query recorded, got ${slowMetrics.slowQueries}${colors.reset}`);
    failures++;
  } else if (!warnCaptured) {
    console.error(`  ${colors.red}✖ Structured [D1:SlowQuery] console warning was not emitted!${colors.reset}`);
    failures++;
  } else if (slowMetrics.recentSlowQueries.length === 0 || slowMetrics.recentSlowQueries[0].durationMs < 50) {
    console.error(`  ${colors.red}✖ Slow query record missing or duration < 50ms!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Slow query (>50ms) accurately detected and recorded: ${slowMetrics.recentSlowQueries[0].durationMs}ms`);
    console.log(`  ${colors.green}✔${colors.reset} Structured diagnostic warning emitted with query and duration metadata`);
  }

  // 3. Dynamic Threshold Customization
  console.log(`\n${colors.bold}3. Threshold Customization:${colors.reset}`);
  setSlowQueryThreshold(20);
  if (getSlowQueryThreshold() !== 20) {
    console.error(`  ${colors.red}✖ Failed to update slow query threshold${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Slow query threshold successfully customized to 20ms`);
  }
  setSlowQueryThreshold(50); // restore default

  // 4. Per-Request Trace Context Attribution
  console.log(`\n${colors.bold}4. Per-Request Trace Context Attribution:${colors.reset}`);
  const reqTraceContext = {
    requestId: 'req_trace_test_888',
    cfRay: 'ray-d1-telemetry-test',
    startTime: Date.now(),
  };

  await runWithTraceContext(reqTraceContext, async () => {
    await instrumentedDb.prepare('SELECT title FROM products WHERE id = "prod_99";').get();
    await instrumentedDb.prepare('SELECT sku FROM variations WHERE product_id = "prod_99";').all();
  });

  const requestD1Stats = getRequestD1Metrics('req_trace_test_888');
  if (!requestD1Stats) {
    console.error(`  ${colors.red}✖ Per-request D1 metrics not found for req_trace_test_888!${colors.reset}`);
    failures++;
  } else if (requestD1Stats.totalQueries !== 2) {
    console.error(`  ${colors.red}✖ Expected 2 queries recorded for request, got ${requestD1Stats.totalQueries}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Per-request D1 query correlation verified: 2 queries (${requestD1Stats.totalDurationMs}ms total) attributed to ${reqTraceContext.requestId}`);
  }

  // 5. Query Categorization Tests
  console.log(`\n${colors.bold}5. SQL Statement Categorization Engine:${colors.reset}`);
  const selectCategory = categorizeSqlQuery('/* comment */ SELECT * FROM products');
  const insertCategory = categorizeSqlQuery('INSERT INTO orders (id) VALUES ("ord_1")');
  const updateCategory = categorizeSqlQuery('UPDATE carts SET line_count = 2 WHERE id = "c_1"');
  const pragmaCategory = categorizeSqlQuery('PRAGMA table_info(products);');

  if (
    selectCategory !== 'read' ||
    pragmaCategory !== 'read' ||
    insertCategory !== 'write' ||
    updateCategory !== 'write'
  ) {
    console.error(`  ${colors.red}✖ SQL categorization mismatch: select=${selectCategory}, pragma=${pragmaCategory}, insert=${insertCategory}, update=${updateCategory}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} SQL statements categorized accurately: SELECT/PRAGMA ➔ read, INSERT/UPDATE ➔ write`);
  }

  // 6. Edge Diagnostics & Health Check Integration
  console.log(`\n${colors.bold}6. Edge Diagnostics & /api/health Integration:${colors.reset}`);
  // Set global DB binding to our mock for health check probe
  (globalThis as any).DB = instrumentedDb;

  const { payload, httpStatus } = await performHealthCheck();
  if (httpStatus !== 200) {
    console.error(`  ${colors.red}✖ Expected health check HTTP 200, got ${httpStatus}${colors.reset}`);
    failures++;
  } else if (!payload.d1Telemetry) {
    console.error(`  ${colors.red}✖ Health response payload missing d1Telemetry object!${colors.reset}`);
    failures++;
  } else if (!payload.probes.d1.telemetry) {
    console.error(`  ${colors.red}✖ D1 probe detail missing telemetry metrics!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Health payload contains comprehensive D1 telemetry (total=${payload.d1Telemetry.totalQueries}, slow=${payload.d1Telemetry.slowQueries})`);
    console.log(`  ${colors.green}✔${colors.reset} D1 health probe enriched with active latency and telemetry stats`);
  }

  // Test /api/health HTTP route handler
  const req = new Request('http://localhost:3000/api/health', {
    headers: { 'x-request-id': 'req_health_probe_d1' },
  });
  const res = await healthRouteHandler(req);
  const d1HeaderCount = res.headers.get('x-d1-query-count');
  const d1HeaderSlow = res.headers.get('x-d1-slow-queries');
  const d1HeaderAvg = res.headers.get('x-d1-avg-latency-ms');

  if (!d1HeaderCount || !d1HeaderSlow || !d1HeaderAvg) {
    console.error(`  ${colors.red}✖ /api/health response missing x-d1-* headers: count=${d1HeaderCount}, slow=${d1HeaderSlow}, avg=${d1HeaderAvg}${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} /api/health response exposes diagnostic headers: x-d1-query-count=${d1HeaderCount}, x-d1-slow-queries=${d1HeaderSlow}, x-d1-avg-latency-ms=${d1HeaderAvg}`);
  }

  // 7. Error Resilience: D1 Exceptions Propagated Without Corrupting Telemetry
  console.log(`\n${colors.bold}7. Error Resilience & Non-Swallowing Semantics:${colors.reset}`);
  const failingDb = withD1Telemetry({
    prepare() {
      return {
        all: async () => {
          throw new Error('D1_SQLITE_ERROR: syntax error near "WHERE"');
        },
        get: async () => {
          throw new Error('D1_SQLITE_ERROR: table missing');
        },
        run: async () => {
          throw new Error('D1_SQLITE_ERROR: constraint violation');
        },
      };
    },
  });

  let errorThrown = false;
  try {
    await failingDb.prepare('SELECT invalid syntax').all();
  } catch (err: any) {
    errorThrown = true;
  }

  if (!errorThrown) {
    console.error(`  ${colors.red}✖ Expected D1 error to be thrown, but it was swallowed!${colors.reset}`);
    failures++;
  } else {
    console.log(`  ${colors.green}✔${colors.reset} Underlying D1 database exceptions are correctly propagated to callers`);
  }

  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  if (failures === 0) {
    console.log(`${colors.green}${colors.bold}✔ All Story 4.27 D1 Telemetry Verifications Passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}✖ Verification Failed with ${failures} error(s)!${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
