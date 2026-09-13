import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SingleFlightGroup, catalogSingleFlight } from '../src/lib/singleflight';
import { getProductBySlug } from '../src/lib/catalog';

describe('SingleFlight Request Coalescing Engine (Story 3.12)', () => {
  describe('1. SingleFlightGroup Unit Tests', () => {
    let group: SingleFlightGroup;

    beforeEach(() => {
      group = new SingleFlightGroup();
    });

    it('should execute upstream fetch once for concurrent requests on the same key', async () => {
      let upstreamExecutionCount = 0;

      const runWork = async () => {
        return group.do('test:drop:item-1', async () => {
          upstreamExecutionCount++;
          // Simulate network / D1 latency
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { data: 'drop-payload', timestamp: Date.now() };
        });
      };

      // Launch 25 concurrent requests simultaneously
      const results = await Promise.all(Array.from({ length: 25 }, () => runWork()));

      assert.equal(
        upstreamExecutionCount,
        1,
        'Upstream producer function must execute exactly ONCE across all concurrent requests'
      );
      assert.equal(results.length, 25);

      // Verify all callers received the exact same payload
      const firstTimestamp = results[0].timestamp;
      for (const res of results) {
        assert.equal(res.data, 'drop-payload');
        assert.equal(res.timestamp, firstTimestamp);
      }

      const metrics = group.getMetrics();
      assert.equal(metrics.totalRequests, 25);
      assert.equal(metrics.upstreamFetches, 1);
      assert.equal(metrics.coalescedRequests, 24);
      assert.ok(metrics.coalesceRatio >= 0.95);
      assert.equal(metrics.activeInFlight, 0);
    });

    it('should distinguish between different keys and execute independently', async () => {
      let keyAExecutions = 0;
      let keyBExecutions = 0;

      const fetchKeyA = () =>
        group.do('key-A', async () => {
          keyAExecutions++;
          await new Promise((r) => setTimeout(r, 15));
          return 'Result A';
        });

      const fetchKeyB = () =>
        group.do('key-B', async () => {
          keyBExecutions++;
          await new Promise((r) => setTimeout(r, 15));
          return 'Result B';
        });

      const results = await Promise.all([
        fetchKeyA(),
        fetchKeyA(),
        fetchKeyB(),
        fetchKeyB(),
        fetchKeyB(),
      ]);

      assert.equal(keyAExecutions, 1);
      assert.equal(keyBExecutions, 1);
      assert.equal(results[0], 'Result A');
      assert.equal(results[1], 'Result A');
      assert.equal(results[2], 'Result B');
      assert.equal(results[3], 'Result B');
      assert.equal(results[4], 'Result B');

      const metrics = group.getMetrics();
      assert.equal(metrics.totalRequests, 5);
      assert.equal(metrics.upstreamFetches, 2);
      assert.equal(metrics.coalescedRequests, 3);
    });

    it('should correctly report execution metadata (leader vs shared)', async () => {
      const results = await Promise.all([
        group.doWithMeta('meta-key', async () => {
          await new Promise((r) => setTimeout(r, 20));
          return 42;
        }),
        group.doWithMeta('meta-key', async () => {
          await new Promise((r) => setTimeout(r, 20));
          return 42;
        }),
        group.doWithMeta('meta-key', async () => {
          await new Promise((r) => setTimeout(r, 20));
          return 42;
        }),
      ]);

      // Exactly one leader (shared: false) and two followers (shared: true)
      const nonShared = results.filter((r) => !r.shared);
      const shared = results.filter((r) => r.shared);

      assert.equal(nonShared.length, 1, 'Only one request should be the leader');
      assert.equal(shared.length, 2, 'Two requests should be coalesced followers');
      assert.equal(results[0].result, 42);
      assert.equal(results[1].result, 42);
      assert.equal(results[2].result, 42);
    });

    it('should propagate upstream errors to all concurrent waiters and clear key', async () => {
      let errorExecutions = 0;

      const failingCall = () =>
        group.do('error-key', async () => {
          errorExecutions++;
          await new Promise((r) => setTimeout(r, 15));
          throw new Error('Database connection reset during spike');
        });

      // All 5 callers must reject with the same error
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          await assert.rejects(failingCall, {
            name: 'Error',
            message: 'Database connection reset during spike',
          });
        })
      );

      assert.equal(errorExecutions, 1);
      assert.equal(group.activeCount(), 0, 'In-flight map must be cleared after failure');

      // Subsequent call must retry and succeed
      const recovered = await group.do('error-key', async () => 'recovered-data');
      assert.equal(recovered, 'recovered-data');
    });

    it('should abort stuck requests upon timeout without leaving dangling in-flight locks', async () => {
      const fastTimeoutGroup = new SingleFlightGroup({ timeoutMs: 30 });

      await assert.rejects(
        async () => {
          await fastTimeoutGroup.do('hanging-key', async () => {
            // Hung Promise that takes 500ms
            await new Promise((r) => setTimeout(r, 500));
            return 'never-resolved';
          });
        },
        {
          name: 'Error',
          message: 'SingleFlight timeout exceeded (30ms) for key: "hanging-key"',
        }
      );

      assert.equal(fastTimeoutGroup.activeCount(), 0);
    });

    it('should allow manual forget() to invalidate in-flight key', async () => {
      let runCount = 0;

      const slowPromise = group.do('forget-key', async () => {
        runCount++;
        await new Promise((r) => setTimeout(r, 60));
        return 'run-1';
      });

      // Manually forget
      group.forget('forget-key');
      assert.equal(group.activeCount(), 0);

      const secondPromise = group.do('forget-key', async () => {
        runCount++;
        return 'run-2';
      });

      const [res1, res2] = await Promise.all([slowPromise, secondPromise]);
      assert.equal(runCount, 2);
      assert.equal(res1, 'run-1');
      assert.equal(res2, 'run-2');
    });
  });

  describe('2. Catalog SingleFlight Integration', () => {
    it('should coalesce simultaneous getProductBySlug queries into single execution', async () => {
      catalogSingleFlight.resetMetrics();

      const queries = Array.from({ length: 15 }, () =>
        getProductBySlug('bushwhack-storm-anorak')
      );

      const results = await Promise.all(queries);

      assert.equal(results.length, 15);
      for (const p of results) {
        assert.ok(p);
        assert.equal(p?.slug, 'bushwhack-storm-anorak');
        assert.equal(p?.base_price, 340);
      }

      const metrics = catalogSingleFlight.getMetrics();
      assert.equal(metrics.totalRequests, 15);
      assert.equal(metrics.upstreamFetches, 1);
      assert.equal(metrics.coalescedRequests, 14);
      assert.ok(metrics.coalesceRatio >= 0.9);
    });

    it('should support bypassSingleFlight option for forced revalidation', async () => {
      catalogSingleFlight.resetMetrics();

      const p = await getProductBySlug('bushwhack-storm-anorak', {
        bypassSingleFlight: true,
      });

      assert.ok(p);
      assert.equal(p?.slug, 'bushwhack-storm-anorak');

      // bypassSingleFlight does not touch catalogSingleFlight metrics
      const metrics = catalogSingleFlight.getMetrics();
      assert.equal(metrics.totalRequests, 0);
    });
  });
});
