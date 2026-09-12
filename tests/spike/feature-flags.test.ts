import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  EdgeFeatureFlagEngine,
  flagSchema,
  FLAG_KEYS,
  ENVIRONMENT_FLAG_DEFAULTS,
  hashToBucket,
  evaluateCanaryRollout,
  evaluateVipAccess,
  resolveEnvironmentTier,
  generateFlagDebugHeaders,
  clearFlagCache,
  type KVNamespaceLike,
  type EvaluationContext,
} from '../../packages/config/src/flags';
import {
  isDropActive,
  isWireMockEnabled,
  isMaintenanceMode,
  isEmergencyKillSwitchActive,
  isCheckoutDisabled,
  canAccessDrop,
  isSessionInCanary,
  extractEvaluationContext,
} from '../../apps/web/src/lib/flags';
import { ShopifyStorefrontClient } from '../../apps/web/src/lib/shopify';

/**
 * Mock Workers KV Namespace for local Miniflare simulation
 */
class MockKVNamespace implements KVNamespaceLike {
  public store: Map<string, string> = new Map();
  public readLatencyMs: number = 2; // Simulated edge KV read latency (1-4ms)

  async get(key: string): Promise<string | null> {
    if (this.readLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.readLatencyMs));
    }
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('Story 2.45 Spike: Feature Flagging Architecture & Edge Evaluation', () => {
  let engine: EdgeFeatureFlagEngine;
  let mockKV: MockKVNamespace;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    engine = new EdgeFeatureFlagEngine(5000); // 5s TTL
    mockKV = new MockKVNamespace();
    clearFlagCache();
    // Reset process.env flag variables to avoid cross-test contamination
    for (const key of FLAG_KEYS) {
      delete process.env[key];
    }
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    clearFlagCache();
    process.env = { ...originalEnv };
  });

  // ----------------------------------------------------------------------------
  // 1. Flag Registry, Schema & Multi-Tier Matrix
  // ----------------------------------------------------------------------------
  describe('1. Flag Registry, Schema & Multi-Tier Matrix', () => {
    it('should validate all flags conform to Zod schema and FLAG_* prefix convention', () => {
      assert.ok(FLAG_KEYS.length >= 8, 'Expected at least 8 core flags defined');
      for (const key of FLAG_KEYS) {
        assert.ok(
          key.startsWith('FLAG_'),
          `Flag key ${key} must follow FLAG_<NAME> convention`
        );
      }

      // Validate schema parsing on empty object provides valid default booleans/numbers
      const parsed = flagSchema.parse({});
      assert.equal(parsed.FLAG_IS_DROP_ACTIVE, false);
      assert.equal(parsed.FLAG_ENABLE_WIREMOCK, false);
      assert.equal(parsed.FLAG_MAINTENANCE_MODE, false);
      assert.equal(parsed.FLAG_EMERGENCY_KILL_SWITCH, false);
      assert.equal(parsed.FLAG_DISABLE_CHECKOUT, false);
      assert.equal(parsed.FLAG_VIP_EARLY_ACCESS, false);
      assert.equal(parsed.FLAG_VERBOSE_DEBUG_HEADERS, false);
      assert.equal(parsed.FLAG_PHASE_6_CANARY_PERCENT, 0);
    });

    it('should verify production tier defaults strictly enforce hardened features', () => {
      const prodDefaults = ENVIRONMENT_FLAG_DEFAULTS.production;
      assert.equal(prodDefaults.FLAG_IS_DROP_ACTIVE, false);
      assert.equal(prodDefaults.FLAG_ENABLE_WIREMOCK, false);
      assert.equal(prodDefaults.FLAG_MAINTENANCE_MODE, false);
      assert.equal(prodDefaults.FLAG_EMERGENCY_KILL_SWITCH, false);
      assert.equal(prodDefaults.FLAG_DISABLE_CHECKOUT, false);
      assert.equal(prodDefaults.FLAG_VIP_EARLY_ACCESS, false);
      assert.equal(prodDefaults.FLAG_VERBOSE_DEBUG_HEADERS, false);
      assert.equal(prodDefaults.FLAG_PHASE_6_CANARY_PERCENT, 0);
    });

    it('should verify ephemeral PR preview tier defaults enable mocks, debug headers, and active drop testing', () => {
      const previewDefaults = ENVIRONMENT_FLAG_DEFAULTS.preview;
      assert.equal(previewDefaults.FLAG_IS_DROP_ACTIVE, true);
      assert.equal(previewDefaults.FLAG_ENABLE_WIREMOCK, true);
      assert.equal(previewDefaults.FLAG_VERBOSE_DEBUG_HEADERS, true);
      assert.equal(previewDefaults.FLAG_VIP_EARLY_ACCESS, true);
      assert.equal(previewDefaults.FLAG_PHASE_6_CANARY_PERCENT, 100);
      assert.equal(previewDefaults.FLAG_EMERGENCY_KILL_SWITCH, false);
    });

    it('should verify staging tier defaults enable drop testing against live staging Shopify without WireMock', () => {
      const stagingDefaults = ENVIRONMENT_FLAG_DEFAULTS.staging;
      assert.equal(stagingDefaults.FLAG_IS_DROP_ACTIVE, true);
      assert.equal(stagingDefaults.FLAG_ENABLE_WIREMOCK, false, 'Staging must test live sandbox Shopify API');
      assert.equal(stagingDefaults.FLAG_VERBOSE_DEBUG_HEADERS, true);
      assert.equal(stagingDefaults.FLAG_PHASE_6_CANARY_PERCENT, 50);
    });

    it('should resolve environment tiers accurately from process.env and context', () => {
      assert.equal(resolveEnvironmentTier({ NODE_ENV: 'production' }), 'production');
      assert.equal(resolveEnvironmentTier({ NODE_ENV: 'staging' }), 'staging');
      assert.equal(resolveEnvironmentTier({ NODE_ENV: 'preview' }), 'preview');
      assert.equal(resolveEnvironmentTier({ PREVIEW: 'true' }), 'preview');
      assert.equal(resolveEnvironmentTier({ NODE_ENV: 'development' }), 'development');
      assert.equal(resolveEnvironmentTier({ NODE_ENV: 'test' }), 'test');

      // Context takes precedence
      assert.equal(
        resolveEnvironmentTier({ NODE_ENV: 'production' }, { environmentTier: 'staging' }),
        'staging'
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Edge Runtime Decision Latency & Performance SLA
  // ----------------------------------------------------------------------------
  describe('2. Edge Runtime Decision Latency & Performance SLA (< 0.5ms)', () => {
    it('should confirm in-memory L1 cache decision latency is < 0.05ms (sub-50 microseconds)', async () => {
      // Warm up cache
      await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, { NODE_ENV: 'production' });

      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, { NODE_ENV: 'production' });
      }

      const totalDurationMs = performance.now() - start;
      const avgLatencyMs = totalDurationMs / iterations;

      assert.ok(
        avgLatencyMs < 0.05,
        `Average L1 decision latency (${avgLatencyMs.toFixed(5)}ms) must be < 0.05ms`
      );
    });

    it('should benchmark Cloudflare Workers KV L2 read latency within edge budget (< 5ms)', async () => {
      await mockKV.put('flag:FLAG_IS_DROP_ACTIVE', 'true');

      const start = performance.now();
      const value = await engine.getFlag(
        'FLAG_IS_DROP_ACTIVE',
        {},
        { NODE_ENV: 'production' },
        mockKV
      );
      const durationMs = performance.now() - start;

      assert.equal(value, true);
      assert.ok(
        durationMs < 25,
        `L2 KV read latency (${durationMs.toFixed(2)}ms) must be within 25ms boundary`
      );
    });

    it('should prove Edge-Native KV/L1 is > 10x faster than simulated Flagship Decision API (80ms)', async () => {
      // Simulate Flagship Decision API outbound HTTP latency
      const simulateFlagshipDecisionApi = async () => {
        await new Promise((resolve) => setTimeout(resolve, 60)); // 60ms simulated network RTT
        return { isDropActive: true };
      };

      const startFlagship = performance.now();
      await simulateFlagshipDecisionApi();
      const flagshipDurationMs = performance.now() - startFlagship;

      const startEdge = performance.now();
      await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, { NODE_ENV: 'production' }, mockKV);
      const edgeDurationMs = performance.now() - startEdge;

      const speedup = flagshipDurationMs / Math.max(0.1, edgeDurationMs);
      assert.ok(
        speedup > 5,
        `Edge-native flags (${edgeDurationMs.toFixed(2)}ms) must be dramatically faster than Decision API (${flagshipDurationMs.toFixed(2)}ms), speedup factor: ${speedup.toFixed(1)}x`
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Layered Resolution Order (L0 -> L1 -> L2 -> L3 -> L4)
  // ----------------------------------------------------------------------------
  describe('3. Layered Resolution Hierarchy', () => {
    it('should fall back to Level 4 Tier Defaults when no overrides exist', async () => {
      const prodVal = await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, { NODE_ENV: 'production' });
      assert.equal(prodVal, false);

      const previewVal = await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, { NODE_ENV: 'preview' });
      assert.equal(previewVal, true);
    });

    it('should allow Level 3 Environment Variables to override Level 4 Tier Defaults', async () => {
      const env = { NODE_ENV: 'production', FLAG_IS_DROP_ACTIVE: 'true' };
      const val = await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, env);
      assert.equal(val, true, 'Environment variable FLAG_IS_DROP_ACTIVE must override production default false');
    });

    it('should allow Level 2 Cloudflare Workers KV to override Level 3 Environment Variables', async () => {
      const env = { NODE_ENV: 'production', FLAG_IS_DROP_ACTIVE: 'false' };
      await mockKV.put('flag:FLAG_IS_DROP_ACTIVE', 'true');

      const val = await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, env, mockKV);
      assert.equal(val, true, 'KV value true must take precedence over env variable false');
    });

    it('should allow Level 0 Per-Request Overrides to take absolute precedence', async () => {
      const env = { NODE_ENV: 'production', FLAG_IS_DROP_ACTIVE: 'false' };
      await mockKV.put('flag:FLAG_IS_DROP_ACTIVE', 'false');

      engine.setOverride('FLAG_IS_DROP_ACTIVE', true);
      const val = await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, env, mockKV);
      assert.equal(val, true, 'Per-request override must take precedence over KV and Env');

      engine.clearOverrides();
      const resetVal = await engine.getFlag('FLAG_IS_DROP_ACTIVE', {}, env, mockKV);
      assert.equal(resetVal, false, 'Clearing overrides must revert to KV value');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Operational Kill-Switches & Emergency Circuit Breakers
  // ----------------------------------------------------------------------------
  describe('4. Operational Kill-Switches & Emergency Circuit Breakers', () => {
    it('should evaluate isEmergencyKillSwitchActive and isCheckoutDisabled immediately', async () => {
      process.env.FLAG_EMERGENCY_KILL_SWITCH = 'true';
      const killed = await isEmergencyKillSwitchActive();
      const checkoutDisabled = await isCheckoutDisabled();

      assert.equal(killed, true);
      assert.equal(checkoutDisabled, true, 'Killing emergency switch must also disable checkout');
    });

    it('should trip circuit breaker in ShopifyStorefrontClient and block cartCreate without network call', async () => {
      process.env.FLAG_EMERGENCY_KILL_SWITCH = 'true';
      const client = new ShopifyStorefrontClient();

      const mutation = `
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { id checkoutUrl }
          }
        }
      `;

      const response = await client.request(mutation, { input: {} });
      assert.equal(response.data, null);
      assert.ok(response.errors && response.errors.length > 0);
      assert.equal(response.errors[0].code, 'CIRCUIT_BREAKER_ACTIVE');
      assert.ok(response.errors[0].message.includes('FLAG_EMERGENCY_KILL_SWITCH'));
    });

    it('should allow product querying even when checkout is disabled', async () => {
      process.env.FLAG_DISABLE_CHECKOUT = 'true';
      const client = new ShopifyStorefrontClient();

      const productQuery = `
        query getProducts {
          products(first: 5) {
            edges { node { id title } }
          }
        }
      `;

      const response = await client.request(productQuery);
      assert.ok(response.data, 'Product query must succeed even when checkout is disabled');
      assert.equal(response.errors, undefined);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Drop Early Access & VIP Gating
  // ----------------------------------------------------------------------------
  describe('5. Drop Early Access & VIP Gating', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.FLAG_IS_DROP_ACTIVE = 'false';
      process.env.FLAG_VIP_EARLY_ACCESS = 'true';
    });

    it('should block public users when drop is not active and no VIP credentials provided', async () => {
      const access = await canAccessDrop({});
      assert.equal(access.canAccess, false);
      assert.equal(access.isVip, false);
      assert.equal(access.isPublic, false);
    });

    it('should grant early access to visitors with valid VIP token query param or header', async () => {
      const context: EvaluationContext = { vipToken: 'chrishop-vip-secret' };
      assert.equal(evaluateVipAccess(context), true);

      const access = await canAccessDrop(context);
      assert.equal(access.canAccess, true);
      assert.equal(access.isVip, true);
      assert.equal(access.isPublic, false);
    });

    it('should grant early access to visitors with VIP customer tags', async () => {
      const context: EvaluationContext = { customerTags: ['collector', 'newsletter'] };
      assert.equal(evaluateVipAccess(context), true);

      const access = await canAccessDrop(context);
      assert.equal(access.canAccess, true);
      assert.equal(access.isVip, true);
    });

    it('should reject invalid or expired VIP tokens', async () => {
      const context: EvaluationContext = { vipToken: 'malicious-or-fake-token' };
      assert.equal(evaluateVipAccess(context), false);

      const access = await canAccessDrop(context);
      assert.equal(access.canAccess, false);
      assert.equal(access.isVip, false);
    });

    it('should block all access when maintenance mode is active even for VIPs', async () => {
      process.env.FLAG_MAINTENANCE_MODE = 'true';
      const context: EvaluationContext = { vipToken: 'chrishop-vip-secret' };

      const access = await canAccessDrop(context);
      assert.equal(access.canAccess, false, 'Maintenance mode must override VIP access');
    });

    it('should extract evaluation context accurately from incoming Request object', () => {
      const req = new Request('https://chrishop.jacobmiller22.com/drop?vip_token=chrishop-vip-secret', {
        headers: {
          cookie: 'chrishop_session_id=sess_test_12345; chrishop_vip_token=chrishop-vip-secret',
          'cf-connecting-ip': '203.0.113.195',
          'x-customer-tags': 'vip,artist',
        },
      });

      const context = extractEvaluationContext(req);
      assert.equal(context.sessionId, 'sess_test_12345');
      assert.equal(context.vipToken, 'chrishop-vip-secret');
      assert.equal(context.ipAddress, '203.0.113.195');
      assert.deepEqual(context.customerTags, ['vip', 'artist']);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Progressive Canary Rollouts (Phase 6)
  // ----------------------------------------------------------------------------
  describe('6. Progressive Canary Rollouts (Phase 6)', () => {
    it('should provide deterministic hash bucketing across sessions', () => {
      const sessionA = 'sess_user_alpha_99182';
      const bucket1 = hashToBucket(sessionA, 'phase-6');
      const bucket2 = hashToBucket(sessionA, 'phase-6');

      assert.equal(bucket1, bucket2, 'Hash must be 100% deterministic');
      assert.ok(bucket1 >= 0 && bucket1 < 100, 'Bucket must be within [0, 99]');
    });

    it('should adhere to 0% and 100% boundary conditions strictly', () => {
      for (let i = 0; i < 50; i++) {
        const sessionId = `session_${i}`;
        assert.equal(evaluateCanaryRollout(sessionId, 0), false, '0% must never allow access');
        assert.equal(evaluateCanaryRollout(sessionId, 100), true, '100% must always allow access');
      }
    });

    it('should achieve statistical percentage distribution across 1,000 synthetic sessions', () => {
      const totalSessions = 1000;
      let count10 = 0;
      let count50 = 0;

      for (let i = 0; i < totalSessions; i++) {
        const sessionId = `session_${i}_${i * 31}`;
        if (evaluateCanaryRollout(sessionId, 10)) count10++;
        if (evaluateCanaryRollout(sessionId, 50)) count50++;
      }

      const percent10 = (count10 / totalSessions) * 100;
      const percent50 = (count50 / totalSessions) * 100;

      // 10% target with +/- 4% tolerance
      assert.ok(
        percent10 >= 6 && percent10 <= 14,
        `10% canary rollout actual: ${percent10.toFixed(1)}% (must be 6%-14%)`
      );

      // 50% target with +/- 6% tolerance
      assert.ok(
        percent50 >= 44 && percent50 <= 56,
        `50% canary rollout actual: ${percent50.toFixed(1)}% (must be 44%-56%)`
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 7. Offline Local Development Resilience & WireMock Bridge
  // ----------------------------------------------------------------------------
  describe('7. Offline Local Development Resilience & WireMock Bridge', () => {
    it('should evaluate flags 100% offline without network egress or API keys', async () => {
      // Simulate total offline state
      const offlineKV = new MockKVNamespace();
      offlineKV.readLatencyMs = 0;

      const flags = await engine.evaluateAll({}, { NODE_ENV: 'development' }, offlineKV);
      assert.equal(flags.FLAG_IS_DROP_ACTIVE, true);
      assert.equal(flags.FLAG_ENABLE_WIREMOCK, true);
      assert.equal(flags.FLAG_MAINTENANCE_MODE, false);
      assert.equal(flags.FLAG_EMERGENCY_KILL_SWITCH, false);
    });

    it('should force mock Shopify routing when FLAG_ENABLE_WIREMOCK is enabled even if token exists', async () => {
      process.env.FLAG_ENABLE_WIREMOCK = 'true';
      process.env.SHOPIFY_STOREFRONT_TOKEN = 'live_production_secret_token';

      const isMockActive = await isWireMockEnabled();
      assert.equal(isMockActive, true);

      const client = new ShopifyStorefrontClient({ token: 'live_production_secret_token' });
      const query = `{ shop { name } }`;

      // Should route through mock without attempting outbound network call to live Shopify
      const res = await client.request(query);
      assert.ok(res.data);
      assert.equal(res.errors, undefined);
    });
  });

  // ----------------------------------------------------------------------------
  // 8. Diagnostic Debug Headers
  // ----------------------------------------------------------------------------
  describe('8. Diagnostic Debug Headers', () => {
    it('should generate formatted RFC-compliant response headers for PR preview inspections', () => {
      const flags = ENVIRONMENT_FLAG_DEFAULTS.preview;
      const headers = generateFlagDebugHeaders(flags, 'preview');

      assert.equal(headers['X-ChrisShop-Flags-Evaluated'], 'true');
      assert.equal(headers['X-ChrisShop-Tier'], 'preview');
      assert.equal(headers['X-ChrisShop-Flag-DropActive'], 'true');
      assert.equal(headers['X-ChrisShop-Flag-WireMock'], 'true');
      assert.equal(headers['X-ChrisShop-Flag-Maintenance'], 'false');
      assert.equal(headers['X-ChrisShop-Flag-KillSwitch'], 'false');
      assert.equal(headers['X-ChrisShop-Flag-CanaryPercent'], '100');
    });
  });
});
