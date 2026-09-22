/**
 * ChrisShop Integration Test Suite: Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 *
 * Story 4.27 (#332): Cloudflare D1 Statement Execution Latency & Slow Query Telemetry
 *
 * Verifies:
 * 1. Statement execution timing capture across all(), get(), first(), run(), and exec().
 * 2. Slow query detection (>50ms default threshold) and structured warning log generation.
 * 3. SQL categorization (read vs write) and rolling percentiles (avg, p95, min, max).
 * 4. Per-request query attribution and trace context correlation.
 * 5. Edge diagnostics exposure in /api/health and HTTP headers.
 * 6. Error resilience and non-swallowing semantics for D1 SQLite errors.
 * 7. Catalog layer integration with getDatabase() and setDatabase().
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  withD1Telemetry,
  getD1TelemetryMetrics,
  resetD1TelemetryMetrics,
  setSlowQueryThreshold,
  getSlowQueryThreshold,
  getRequestD1Metrics,
  categorizeSqlQuery,
  type D1DatabaseLike,
} from '../../apps/web/src/lib/d1-telemetry';
import { runWithTraceContext } from '../../apps/web/src/lib/tracing';
import { performHealthCheck } from '../../apps/web/src/lib/health-monitoring';
import { GET as healthRouteHandler } from '../../apps/web/src/app/api/health/route';
import { getDatabase, setDatabase, resetDatabase, getProductLines } from '../../apps/web/src/lib/catalog';

function createMockD1Database(simulatedDelayMs = 0): D1DatabaseLike {
  return {
    prepare(sql: string) {
      return {
        bind(..._params: any[]) {
          return this;
        },
        all: async () => {
          if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
          return [{ id: 'prod_1', title: 'Leadville Pack' }];
        },
        get: async () => {
          if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
          return { id: 'prod_1', title: 'Leadville Pack' };
        },
        first: async () => {
          if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
          return { count: 1 };
        },
        run: async () => {
          if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
          return { changes: 1 };
        },
      };
    },
    exec: async () => {
      if (simulatedDelayMs > 0) await new Promise((r) => setTimeout(r, simulatedDelayMs));
    },
  };
}

describe('Story 4.27: Cloudflare D1 Statement Execution Latency & Slow Query Telemetry', () => {
  beforeEach(() => {
    resetD1TelemetryMetrics();
    setSlowQueryThreshold(50);
    resetDatabase();
  });

  afterEach(() => {
    resetD1TelemetryMetrics();
    resetDatabase();
  });

  describe('1. Statement Execution Timing Capture', () => {
    it('should measure duration and record metrics for all(), get(), first(), run(), and exec()', async () => {
      const mockDb = createMockD1Database(10); // 10ms simulated latency
      const instrumentedDb = withD1Telemetry(mockDb);

      const allRes = await instrumentedDb.prepare('SELECT * FROM products;').all();
      assert.equal(Array.isArray(allRes), true);

      const getRes = await instrumentedDb.prepare('SELECT * FROM products WHERE id = ?;').bind('prod_1').get();
      assert.equal(getRes.id, 'prod_1');

      const firstRes = await instrumentedDb.prepare('SELECT count(*) as count FROM products;').first();
      assert.equal(firstRes.count, 1);

      const runRes = await instrumentedDb.prepare('UPDATE products SET stock = 5;').run();
      assert.equal(runRes.changes, 1);

      await instrumentedDb.exec?.('VACUUM;');

      const metrics = getD1TelemetryMetrics();
      assert.equal(metrics.totalQueries, 5);
      assert.equal(metrics.readQueries, 3); // 3 SELECTs
      assert.equal(metrics.writeQueries, 2); // 1 UPDATE, 1 VACUUM
      assert.ok(metrics.totalDurationMs >= 40, `totalDurationMs should be >= 40ms, got ${metrics.totalDurationMs}`);
      assert.ok(metrics.avgDurationMs >= 8, `avgDurationMs should be >= 8ms, got ${metrics.avgDurationMs}`);
      assert.ok(metrics.minDurationMs > 0);
      assert.ok(metrics.maxDurationMs >= metrics.minDurationMs);
    });

    it('should prevent redundant double-wrapping of D1 databases', () => {
      const mockDb = createMockD1Database();
      const wrappedOnce = withD1Telemetry(mockDb);
      const wrappedTwice = withD1Telemetry(wrappedOnce);
      assert.equal(wrappedOnce, wrappedTwice);
    });
  });

  describe('2. SQL Statement Categorization Engine', () => {
    it('should categorize SELECT, PRAGMA, and EXPLAIN as read operations', () => {
      assert.equal(categorizeSqlQuery('SELECT * FROM products'), 'read');
      assert.equal(categorizeSqlQuery('select id from categories'), 'read');
      assert.equal(categorizeSqlQuery('/* trace:req_123 */ SELECT 1'), 'read');
      assert.equal(categorizeSqlQuery('-- inline comment\nSELECT * FROM variations'), 'read');
      assert.equal(categorizeSqlQuery('PRAGMA table_info(products);'), 'read');
      assert.equal(categorizeSqlQuery('EXPLAIN QUERY PLAN SELECT * FROM products;'), 'read');
    });

    it('should categorize INSERT, UPDATE, DELETE, and DDL as write operations', () => {
      assert.equal(categorizeSqlQuery('INSERT INTO orders (id) VALUES ("o1")'), 'write');
      assert.equal(categorizeSqlQuery('UPDATE products SET stock = stock - 1 WHERE id = "p1"'), 'write');
      assert.equal(categorizeSqlQuery('DELETE FROM carts WHERE id = "c1"'), 'write');
      assert.equal(categorizeSqlQuery('CREATE TABLE test (id TEXT PRIMARY KEY)'), 'write');
      assert.equal(categorizeSqlQuery('DROP TABLE test'), 'write');
    });
  });

  describe('3. Slow Query Detection & Threshold Logging', () => {
    it('should detect queries exceeding 50ms and emit structured console warnings', async () => {
      const slowDb = withD1Telemetry(createMockD1Database(55)); // 55ms simulated latency
      const originalWarn = console.warn;
      const capturedWarnings: string[] = [];

      console.warn = (...args: any[]) => {
        capturedWarnings.push(args.join(' '));
      };

      try {
        await slowDb.prepare('SELECT * FROM large_table WHERE col = "test";').all();
      } finally {
        console.warn = originalWarn;
      }

      const metrics = getD1TelemetryMetrics();
      assert.equal(metrics.slowQueries, 1);
      assert.equal(metrics.recentSlowQueries.length, 1);
      assert.ok(metrics.recentSlowQueries[0].durationMs >= 50);
      assert.equal(metrics.recentSlowQueries[0].thresholdMs, 50);

      // Verify structured warning format
      const hasStructuredWarning = capturedWarnings.some(
        (w) => w.includes('[D1:SlowQuery]') && w.includes('Threshold: 50ms') && w.includes('Duration:')
      );
      assert.equal(hasStructuredWarning, true, 'Structured [D1:SlowQuery] warning log was not emitted');
    });

    it('should allow dynamic customization of the slow query threshold', async () => {
      setSlowQueryThreshold(25);
      assert.equal(getSlowQueryThreshold(), 25);

      const moderateDb = withD1Telemetry(createMockD1Database(30)); // 30ms latency (> 25ms threshold)
      await moderateDb.prepare('SELECT title FROM products;').all();

      const metrics = getD1TelemetryMetrics();
      assert.equal(metrics.slowQueries, 1);
      assert.equal(metrics.activeThresholdMs, 25);
      assert.equal(metrics.recentSlowQueries[0].thresholdMs, 25);
    });
  });

  describe('4. Per-Request Trace Context Attribution', () => {
    it('should attribute D1 query execution count and duration to the active request context', async () => {
      const testDb = withD1Telemetry(createMockD1Database(5));
      const traceContext = {
        requestId: 'req_trace_d1_test_999',
        cfRay: 'ray-d1-test-999',
        startTime: Date.now(),
      };

      await runWithTraceContext(traceContext, async () => {
        await testDb.prepare('SELECT * FROM products;').all();
        await testDb.prepare('SELECT * FROM variations WHERE product_id = "p1";').all();
        await testDb.prepare('UPDATE inventory SET reserved = 1 WHERE id = "i1";').run();
      });

      const requestMetrics = getRequestD1Metrics('req_trace_d1_test_999');
      assert.ok(requestMetrics, 'Request D1 metrics should be defined');
      assert.equal(requestMetrics.requestId, 'req_trace_d1_test_999');
      assert.equal(requestMetrics.totalQueries, 3);
      assert.equal(requestMetrics.readQueries, 2);
      assert.equal(requestMetrics.writeQueries, 1);
      assert.ok(requestMetrics.totalDurationMs >= 10);
      assert.equal(requestMetrics.queries.length, 3);
    });

    it('should automatically resolve active TraceContext when getRequestD1Metrics() is called without arguments', async () => {
      const testDb = withD1Telemetry(createMockD1Database(5));
      const traceContext = {
        requestId: 'req_ambient_lookup',
        cfRay: 'ray-ambient-lookup',
        startTime: Date.now(),
      };

      await runWithTraceContext(traceContext, async () => {
        await testDb.prepare('SELECT 1;').first();
        const ambientMetrics = getRequestD1Metrics();
        assert.ok(ambientMetrics);
        assert.equal(ambientMetrics.requestId, 'req_ambient_lookup');
        assert.equal(ambientMetrics.totalQueries, 1);
      });
    });
  });

  describe('5. Edge Diagnostics & /api/health Integration', () => {
    it('should expose D1 telemetry in performHealthCheck() payload and probe details', async () => {
      const mockDb = withD1Telemetry(createMockD1Database(5));
      (globalThis as any).DB = mockDb;

      const { payload, httpStatus } = await performHealthCheck();
      assert.equal(httpStatus, 200);
      assert.ok(payload.d1Telemetry, 'Payload must include d1Telemetry');
      assert.ok(payload.probes.d1.telemetry, 'probes.d1 must include telemetry');
      assert.ok(payload.d1Telemetry.totalQueries >= 1);
    });

    it('should expose x-d1-* headers on /api/health HTTP responses', async () => {
      const mockDb = withD1Telemetry(createMockD1Database(5));
      (globalThis as any).DB = mockDb;

      const req = new Request('http://localhost:3000/api/health', {
        headers: { 'x-request-id': 'req_health_diag_test' },
      });
      const res = await healthRouteHandler(req);

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('x-d1-query-count'), 'Response must have x-d1-query-count header');
      assert.ok(res.headers.get('x-d1-slow-queries'), 'Response must have x-d1-slow-queries header');
      assert.ok(res.headers.get('x-d1-avg-latency-ms'), 'Response must have x-d1-avg-latency-ms header');
      assert.equal(res.headers.get('x-request-id'), 'req_health_diag_test');
    });
  });

  describe('6. Error Resilience & Non-Swallowing Semantics', () => {
    it('should record execution timing while transparently propagating underlying database errors', async () => {
      const errorDb = withD1Telemetry({
        prepare() {
          return {
            all: async () => {
              throw new Error('D1_SQLITE_ERROR: syntax error near "FROM"');
            },
          };
        },
      });

      await assert.rejects(
        async () => {
          await errorDb.prepare('SELECT FROM;').all();
        },
        {
          name: 'Error',
          message: 'D1_SQLITE_ERROR: syntax error near "FROM"',
        }
      );

      const metrics = getD1TelemetryMetrics();
      assert.equal(metrics.totalQueries, 1);
      assert.ok(metrics.totalDurationMs >= 0);
    });
  });

  describe('7. Catalog Layer Integration', () => {
    it('should automatically instrument getDatabase() and setDatabase()', async () => {
      const mockDb = createMockD1Database(5);
      setDatabase(mockDb);

      const db = getDatabase();
      await db.prepare('SELECT * FROM categories;').all();

      const metrics = getD1TelemetryMetrics();
      assert.equal(metrics.totalQueries, 1);
      assert.equal(metrics.readQueries, 1);
    });

    it('should record D1 telemetry when catalog query functions execute', async () => {
      const mockDb = createMockD1Database(5);
      setDatabase(mockDb);

      const productLines = await getProductLines();
      assert.ok(Array.isArray(productLines));

      const metrics = getD1TelemetryMetrics();
      assert.ok(metrics.totalQueries >= 1);
    });
  });
});
