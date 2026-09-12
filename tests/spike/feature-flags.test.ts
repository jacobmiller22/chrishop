import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  flagSchema,
  FLAG_KEYS,
  ENVIRONMENT_FLAG_DEFAULTS,
  evaluateFlag,
  isFeatureEnabled,
  getFeatureFlag,
  evaluateAllFlags,
  evaluateVipAccess,
  resolveEnvironmentTier,
  generateFlagDebugHeaders,
  type CloudflareFlagshipBinding,
  type EvaluationContext,
} from '../../packages/config/src/flags';
import {
  isDropActive,
  isWireMockEnabled,
  isMaintenanceMode,
  isEmergencyKillSwitchActive,
  isCheckoutDisabled,
  canAccessDrop,
  extractEvaluationContext,
  getFlagResponseHeaders,
} from '../../apps/web/src/lib/flags';
import { ShopifyStorefrontClient } from '../../apps/web/src/lib/shopify';

/**
 * Mock Cloudflare Flagship Binding for testing Worker runtime integration
 */
class MockCloudflareFlagship implements CloudflareFlagshipBinding {
  public flags: Map<string, unknown> = new Map();
  public lastEvaluatedContext?: Record<string, unknown>;

  async getBooleanValue(
    key: string,
    defaultValue: boolean,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    this.lastEvaluatedContext = context;
    if (this.flags.has(key)) {
      return Boolean(this.flags.get(key));
    }
    return defaultValue;
  }

  async getStringValue(
    key: string,
    defaultValue: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    this.lastEvaluatedContext = context;
    if (this.flags.has(key)) {
      return String(this.flags.get(key));
    }
    return defaultValue;
  }

  async getNumberValue(
    key: string,
    defaultValue: number,
    context?: Record<string, unknown>
  ): Promise<number> {
    this.lastEvaluatedContext = context;
    if (this.flags.has(key)) {
      return Number(this.flags.get(key));
    }
    return defaultValue;
  }

  async getObjectValue<T = unknown>(
    key: string,
    defaultValue: T,
    context?: Record<string, unknown>
  ): Promise<T> {
    this.lastEvaluatedContext = context;
    if (this.flags.has(key)) {
      return this.flags.get(key) as T;
    }
    return defaultValue;
  }
}

describe('Story 2.45: Cloudflare Flagship Architecture & Evaluation', () => {
  let mockFlagship: MockCloudflareFlagship;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockFlagship = new MockCloudflareFlagship();
    // Reset process.env flag variables to avoid cross-test contamination
    for (const key of FLAG_KEYS) {
      delete process.env[key];
    }
    delete (globalThis as any).FLAGS;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete (globalThis as any).FLAGS;
    process.env = { ...originalEnv };
  });

  // ----------------------------------------------------------------------------
  // 1. Flag Registry, Schema & Environment Matrix
  // ----------------------------------------------------------------------------
  describe('1. Flag Registry, Schema & Environment Matrix', () => {
    it('should validate all flags conform to Zod schema and FLAG_* prefix convention', () => {
      assert.ok(FLAG_KEYS.length >= 7, 'Expected at least 7 core flags defined');
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
  // 2. Cloudflare Flagship Binding Path (Tier 1)
  // ----------------------------------------------------------------------------
  describe('2. Cloudflare Flagship Binding Path (Tier 1)', () => {
    it('should evaluate flag using env.FLAGS native binding when available', async () => {
      mockFlagship.flags.set('FLAG_IS_DROP_ACTIVE', true);

      const isDropOn = await evaluateFlag(
        'FLAG_IS_DROP_ACTIVE',
        false,
        { userId: 'user-123' },
        { FLAGS: mockFlagship }
      );

      assert.equal(isDropOn, true);
      assert.deepEqual(mockFlagship.lastEvaluatedContext, { userId: 'user-123' });
    });

    it('should pass targeting context (userId, customerTags, country) to Flagship binding', async () => {
      mockFlagship.flags.set('FLAG_VIP_EARLY_ACCESS', true);

      const context: EvaluationContext = {
        userId: 'vip-shopper-77',
        customerTags: ['vip', 'collector'],
        country: 'US',
      };

      const result = await evaluateFlag('FLAG_VIP_EARLY_ACCESS', false, context, {
        FLAGS: mockFlagship,
      });

      assert.equal(result, true);
      assert.equal(mockFlagship.lastEvaluatedContext?.userId, 'vip-shopper-77');
      assert.deepEqual(mockFlagship.lastEvaluatedContext?.customerTags, ['vip', 'collector']);
    });

    it('should fallback to default value when flag is missing in Flagship app', async () => {
      const result = await evaluateFlag(
        'FLAG_NON_EXISTENT_FEATURE',
        false,
        {},
        { FLAGS: mockFlagship }
      );

      assert.equal(result, false);
    });

    it('should achieve sub-millisecond edge decision latency with Flagship binding (< 0.05ms)', async () => {
      mockFlagship.flags.set('FLAG_IS_DROP_ACTIVE', true);
      const env = { FLAGS: mockFlagship };

      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await evaluateFlag('FLAG_IS_DROP_ACTIVE', false, {}, env);
      }

      const totalDurationMs = performance.now() - start;
      const avgLatencyMs = totalDurationMs / iterations;

      assert.ok(
        avgLatencyMs < 0.05,
        `Average Flagship decision latency (${avgLatencyMs.toFixed(5)}ms) must be < 0.05ms`
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Local Development & Offline Testing Path (Tier 2)
  // ----------------------------------------------------------------------------
  describe('3. Local Development & Offline Testing Path (Tier 2)', () => {
    it('should evaluate flags directly from process.env when FLAGS binding is absent', async () => {
      process.env.FLAG_IS_DROP_ACTIVE = 'true';
      process.env.FLAG_ENABLE_WIREMOCK = '1';

      const isDrop = await evaluateFlag('FLAG_IS_DROP_ACTIVE', false);
      const isWireMock = await evaluateFlag('FLAG_ENABLE_WIREMOCK', false);

      assert.equal(isDrop, true);
      assert.equal(isWireMock, true);
    });

    it('should fallback to environment-tier defaults when environment variable is unset', async () => {
      delete process.env.FLAG_IS_DROP_ACTIVE;
      delete process.env.FLAG_ENABLE_WIREMOCK;

      // In test tier, default is false
      const testVal = await isFeatureEnabled('FLAG_IS_DROP_ACTIVE', { environmentTier: 'test' });
      assert.equal(testVal, false);

      // In preview tier, default is true
      const previewVal = await isFeatureEnabled('FLAG_IS_DROP_ACTIVE', {
        environmentTier: 'preview',
      });
      assert.equal(previewVal, true);
    });

    it('should evaluate numeric flags correctly from process.env', async () => {
      process.env.FLAG_PHASE_6_CANARY_PERCENT = '75';

      const canaryPercent = await getFeatureFlag('FLAG_PHASE_6_CANARY_PERCENT');
      assert.equal(canaryPercent, 75);
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
      const client = new ShopifyStorefrontClient({ token: 'test_token' });

      const res = await client.createCart('variant_123', 1);
      assert.equal(res.data, null);
      assert.equal(res.errors?.[0]?.code, 'CIRCUIT_BREAKER_ACTIVE');
    });

    it('should allow product querying even when checkout is disabled', async () => {
      process.env.FLAG_DISABLE_CHECKOUT = 'true';
      process.env.FLAG_EMERGENCY_KILL_SWITCH = 'false';

      const isKilled = await isEmergencyKillSwitchActive();
      const checkoutBlocked = await isCheckoutDisabled();

      assert.equal(isKilled, false);
      assert.equal(checkoutBlocked, true);

      // Products query remains permitted
      const client = new ShopifyStorefrontClient({ token: 'test_token' });
      const res = await client.request('{ shop { name } }');
      assert.ok(res.data);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Drop Early Access & VIP Gating
  // ----------------------------------------------------------------------------
  describe('5. Drop Early Access & VIP Gating', () => {
    it('should block public users when drop is not active and no VIP credentials provided', async () => {
      process.env.FLAG_IS_DROP_ACTIVE = 'false';
      process.env.FLAG_VIP_EARLY_ACCESS = 'true';

      const access = await canAccessDrop({});
      assert.equal(access.canAccess, false);
      assert.equal(access.isVip, false);
      assert.equal(access.isPublic, false);
    });

    it('should grant early access to visitors with valid VIP token query param or header', async () => {
      process.env.FLAG_IS_DROP_ACTIVE = 'false';
      process.env.FLAG_VIP_EARLY_ACCESS = 'true';

      const context: EvaluationContext = { vipToken: 'chrishop-vip-secret' };
      assert.equal(evaluateVipAccess(context), true);

      const access = await canAccessDrop(context);
      assert.equal(access.canAccess, true);
      assert.equal(access.isVip, true);
    });

    it('should grant early access to visitors with VIP customer tags', async () => {
      process.env.FLAG_IS_DROP_ACTIVE = 'false';
      process.env.FLAG_VIP_EARLY_ACCESS = 'true';

      const context: EvaluationContext = { customerTags: ['artist', 'newsletter'] };
      assert.equal(evaluateVipAccess(context), true);

      const access = await canAccessDrop(context);
      assert.equal(access.canAccess, true);
      assert.equal(access.isVip, true);
    });

    it('should reject invalid or expired VIP tokens', async () => {
      process.env.FLAG_IS_DROP_ACTIVE = 'false';
      process.env.FLAG_VIP_EARLY_ACCESS = 'true';

      const context: EvaluationContext = { vipToken: 'fake-or-expired-token' };
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
  // 6. Diagnostic Debug Headers
  // ----------------------------------------------------------------------------
  describe('6. Diagnostic Debug Headers', () => {
    it('should generate formatted RFC-compliant response headers for inspections', () => {
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
