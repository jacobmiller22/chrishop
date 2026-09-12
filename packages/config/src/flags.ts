import { z } from 'zod';

/**
 * ==============================================================================
 * ChrisShop Edge-Native Feature Flagging Engine
 * Specification: docs/decisions/ADR_FEATURE_FLAGGING_FLAGSHIP.md
 *
 * Implements a high-performance, multi-layered feature flag evaluation system
 * optimized for Cloudflare Workers V8 isolates, offline Miniflare development,
 * and zero-latency in-memory/KV resolution.
 * ==============================================================================
 */

export type EnvironmentTier = 'preview' | 'staging' | 'production' | 'development' | 'test';

export const flagSchema = z.object({
  /** Controls drop catalog visibility and active purchase access */
  FLAG_IS_DROP_ACTIVE: z.boolean().default(false),
  /** Forces Shopify client to route through local WireMock/mock bridge */
  FLAG_ENABLE_WIREMOCK: z.boolean().default(false),
  /** Renders maintenance holding screen and halts shopping interactions */
  FLAG_MAINTENANCE_MODE: z.boolean().default(false),
  /** Master circuit breaker: immediately disables cart modifications and checkout redirects */
  FLAG_EMERGENCY_KILL_SWITCH: z.boolean().default(false),
  /** Granular circuit breaker: disables checkout redirects while allowing catalog browsing */
  FLAG_DISABLE_CHECKOUT: z.boolean().default(false),
  /** Enables VIP gating: allows early drop access to verified VIP tokens/tags */
  FLAG_VIP_EARLY_ACCESS: z.boolean().default(false),
  /** Emits X-ChrisShop-Flag-* diagnostic response headers */
  FLAG_VERBOSE_DEBUG_HEADERS: z.boolean().default(false),
  /** Percentage (0-100) of visitor sessions bucketed into Phase 6 canary features */
  FLAG_PHASE_6_CANARY_PERCENT: z.number().min(0).max(100).default(0),
  /** Controls storefront layout and aesthetic archetype */
  FLAG_STOREFRONT_VIBE: z
    .enum(['field_workshop', 'alpine_minimal', 'hardware_vault', 'noir_minimal'])
    .default('field_workshop'),
});

export type FeatureFlags = z.infer<typeof flagSchema>;
export type FlagKey = keyof FeatureFlags;

export const FLAG_KEYS = Object.keys(flagSchema.shape) as FlagKey[];

/**
 * Multi-Tier Environment Strategy Matrix
 * Defines default flag states across Ephemeral PR Previews, Staging, Production,
 * Local Development, and Automated Test suites.
 */
export const ENVIRONMENT_FLAG_DEFAULTS: Record<EnvironmentTier, FeatureFlags> = {
  preview: {
    FLAG_IS_DROP_ACTIVE: true,
    FLAG_ENABLE_WIREMOCK: true,
    FLAG_MAINTENANCE_MODE: false,
    FLAG_EMERGENCY_KILL_SWITCH: false,
    FLAG_DISABLE_CHECKOUT: false,
    FLAG_VIP_EARLY_ACCESS: true,
    FLAG_VERBOSE_DEBUG_HEADERS: true,
    FLAG_PHASE_6_CANARY_PERCENT: 100,
    FLAG_STOREFRONT_VIBE: 'field_workshop',
  },
  staging: {
    FLAG_IS_DROP_ACTIVE: true,
    FLAG_ENABLE_WIREMOCK: false,
    FLAG_MAINTENANCE_MODE: false,
    FLAG_EMERGENCY_KILL_SWITCH: false,
    FLAG_DISABLE_CHECKOUT: false,
    FLAG_VIP_EARLY_ACCESS: true,
    FLAG_VERBOSE_DEBUG_HEADERS: true,
    FLAG_PHASE_6_CANARY_PERCENT: 50,
    FLAG_STOREFRONT_VIBE: 'field_workshop',
  },
  production: {
    FLAG_IS_DROP_ACTIVE: false,
    FLAG_ENABLE_WIREMOCK: false,
    FLAG_MAINTENANCE_MODE: false,
    FLAG_EMERGENCY_KILL_SWITCH: false,
    FLAG_DISABLE_CHECKOUT: false,
    FLAG_VIP_EARLY_ACCESS: false,
    FLAG_VERBOSE_DEBUG_HEADERS: false,
    FLAG_PHASE_6_CANARY_PERCENT: 0,
    FLAG_STOREFRONT_VIBE: 'field_workshop',
  },
  development: {
    FLAG_IS_DROP_ACTIVE: true,
    FLAG_ENABLE_WIREMOCK: true,
    FLAG_MAINTENANCE_MODE: false,
    FLAG_EMERGENCY_KILL_SWITCH: false,
    FLAG_DISABLE_CHECKOUT: false,
    FLAG_VIP_EARLY_ACCESS: true,
    FLAG_VERBOSE_DEBUG_HEADERS: true,
    FLAG_PHASE_6_CANARY_PERCENT: 100,
    FLAG_STOREFRONT_VIBE: 'field_workshop',
  },
  test: {
    FLAG_IS_DROP_ACTIVE: false,
    FLAG_ENABLE_WIREMOCK: false,
    FLAG_MAINTENANCE_MODE: false,
    FLAG_EMERGENCY_KILL_SWITCH: false,
    FLAG_DISABLE_CHECKOUT: false,
    FLAG_VIP_EARLY_ACCESS: false,
    FLAG_VERBOSE_DEBUG_HEADERS: false,
    FLAG_PHASE_6_CANARY_PERCENT: 0,
    FLAG_STOREFRONT_VIBE: 'field_workshop',
  },
};

/**
 * Contextual attributes for flag evaluation
 */
export interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  vipToken?: string;
  customerTags?: string[];
  ipAddress?: string;
  environmentTier?: EnvironmentTier;
  attributes?: Record<string, unknown>;
}

/**
 * Cloudflare Workers KV Interface Subset
 */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put?(key: string, value: string): Promise<void>;
  delete?(key: string): Promise<void>;
}

/**
 * 32-bit FNV-1a Hash Algorithm
 * Provides deterministic, zero-dependency, sub-microsecond bucketing for canary rollouts.
 */
export function hashToBucket(identifier: string, seed: string = 'chrishop'): number {
  let hash = 2166136261;
  const str = `${seed}:${identifier}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

/**
 * Evaluates whether a given session falls into a canary percentage bucket.
 */
export function evaluateCanaryRollout(sessionId: string, targetPercent: number): boolean {
  if (targetPercent <= 0) return false;
  if (targetPercent >= 100) return true;
  const bucket = hashToBucket(sessionId, 'phase-6-canary');
  return bucket < targetPercent;
}

/**
 * Evaluates whether a visitor context qualifies for VIP Early Access.
 */
export function evaluateVipAccess(
  context: EvaluationContext,
  configuredSecrets: string[] = ['chrishop-vip-secret', 'dev-vip-token-2026']
): boolean {
  if (context.vipToken && configuredSecrets.includes(context.vipToken)) {
    return true;
  }
  if (context.customerTags) {
    const hasVipTag = context.customerTags.some((tag) =>
      ['vip', 'early-access', 'artist', 'collector'].includes(tag.toLowerCase())
    );
    if (hasVipTag) return true;
  }
  return false;
}

/**
 * Resolves the active environment tier from process.env or context
 */
export function resolveEnvironmentTier(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
  context?: EvaluationContext
): EnvironmentTier {
  if (context?.environmentTier) {
    return context.environmentTier;
  }

  const rawEnv = (env.NODE_ENV || 'development').toLowerCase();
  if (rawEnv === 'test') return 'test';
  if (rawEnv === 'preview' || rawEnv.includes('pr-') || env.PREVIEW === 'true') return 'preview';
  if (rawEnv === 'staging' || env.STAGING === 'true') return 'staging';
  if (rawEnv === 'production') return 'production';
  return 'development';
}

/**
 * EdgeFeatureFlagEngine
 *
 * Implements layered resolution:
 * Level 0: In-Memory Request Overrides (Testing / QA query params)
 * Level 1: In-Memory L1 Cache with TTL (V8 isolate warm cache, < 0.05ms)
 * Level 2: Cloudflare Workers KV L2 Storage (1-4ms edge-replicated)
 * Level 3: Worker Environment Variables (process.env / env.VARS)
 * Level 4: Environment-Tier Defaults Matrix
 */
export class EdgeFeatureFlagEngine {
  private inMemoryOverrides: Map<string, unknown> = new Map();
  private l1Cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private cacheTtlMs: number;

  constructor(cacheTtlMs: number = 10000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  public setOverride<K extends FlagKey>(key: K, value: FeatureFlags[K]): void {
    this.inMemoryOverrides.set(key, value);
    this.l1Cache.delete(key);
  }

  public clearOverrides(): void {
    this.inMemoryOverrides.clear();
    this.l1Cache.clear();
  }

  public clearCache(): void {
    this.l1Cache.clear();
  }

  public async getFlag<K extends FlagKey>(
    key: K,
    context?: EvaluationContext,
    env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
    kvBinding?: KVNamespaceLike
  ): Promise<FeatureFlags[K]> {
    // Level 0: In-Memory Per-Request Override
    if (this.inMemoryOverrides.has(key)) {
      return this.inMemoryOverrides.get(key) as FeatureFlags[K];
    }

    const tier = resolveEnvironmentTier(env, context);
    const cacheKey = `${tier}:${key}`;

    // Level 1: In-Memory L1 Cache (< 0.05ms)
    const now = Date.now();
    const cached = this.l1Cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value as FeatureFlags[K];
    }

    // Level 2: Cloudflare Workers KV Binding (1-4ms)
    if (kvBinding) {
      try {
        const kvValue = await kvBinding.get(`flag:${key}`);
        if (kvValue !== null) {
          const parsed = this.parseRawValue(key, kvValue);
          this.l1Cache.set(cacheKey, { value: parsed, expiresAt: now + this.cacheTtlMs });
          return parsed as FeatureFlags[K];
        }
      } catch {
        // Fall through to L3 gracefully on KV error
      }
    }

    // Level 3: Environment Variables (wrangler.toml vars / process.env)
    const envVal = env[key];
    if (envVal !== undefined && envVal !== '') {
      const parsed = this.parseRawValue(key, envVal);
      this.l1Cache.set(cacheKey, { value: parsed, expiresAt: now + this.cacheTtlMs });
      return parsed as FeatureFlags[K];
    }

    // Level 4: Multi-Tier Defaults Matrix
    const tierDefaults = ENVIRONMENT_FLAG_DEFAULTS[tier];
    const defaultValue = tierDefaults[key];

    this.l1Cache.set(cacheKey, { value: defaultValue, expiresAt: now + this.cacheTtlMs });
    return defaultValue as FeatureFlags[K];
  }

  public async isEnabled(
    key: FlagKey,
    context?: EvaluationContext,
    env?: Record<string, string | undefined>,
    kvBinding?: KVNamespaceLike
  ): Promise<boolean> {
    const val = await this.getFlag(key, context, env, kvBinding);
    if (typeof val === 'boolean') {
      return val;
    }
    if (typeof val === 'number') {
      return val > 0;
    }
    return Boolean(val);
  }

  public async evaluateAll(
    context?: EvaluationContext,
    env?: Record<string, string | undefined>,
    kvBinding?: KVNamespaceLike
  ): Promise<FeatureFlags> {
    const evaluated: Partial<FeatureFlags> = {};
    for (const key of FLAG_KEYS) {
      evaluated[key] = (await this.getFlag(key, context, env, kvBinding)) as any;
    }
    return evaluated as FeatureFlags;
  }

  private parseRawValue(key: FlagKey, raw: string): unknown {
    if (key === 'FLAG_PHASE_6_CANARY_PERCENT') {
      const num = Number(raw);
      return Number.isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
    }
    if (key === 'FLAG_STOREFRONT_VIBE') {
      const val = raw.trim().toLowerCase();
      if (
        val === 'alpine_minimal' ||
        val === 'hardware_vault' ||
        val === 'field_workshop' ||
        val === 'noir_minimal'
      ) {
        return val;
      }
      return 'field_workshop';
    }
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return false;
  }
}

/** Global default engine instance */
export const defaultFlagEngine = new EdgeFeatureFlagEngine();

/**
 * Functional Convenience API (OpenFeature-aligned)
 */
export async function isFeatureEnabled(
  key: FlagKey,
  context?: EvaluationContext,
  env?: Record<string, string | undefined>,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  return defaultFlagEngine.isEnabled(key, context, env, kvBinding);
}

export async function getFeatureFlag<K extends FlagKey>(
  key: K,
  context?: EvaluationContext,
  env?: Record<string, string | undefined>,
  kvBinding?: KVNamespaceLike
): Promise<FeatureFlags[K]> {
  return defaultFlagEngine.getFlag(key, context, env, kvBinding);
}

export async function evaluateAllFlags(
  context?: EvaluationContext,
  env?: Record<string, string | undefined>,
  kvBinding?: KVNamespaceLike
): Promise<FeatureFlags> {
  return defaultFlagEngine.evaluateAll(context, env, kvBinding);
}

export function clearFlagCache(): void {
  defaultFlagEngine.clearCache();
}

/**
 * Generates RFC-compliant diagnostic debug response headers
 */
export function generateFlagDebugHeaders(
  flags: FeatureFlags,
  tier?: EnvironmentTier
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-ChrisShop-Flags-Evaluated': 'true',
    'X-ChrisShop-Tier': tier || 'unknown',
    'X-ChrisShop-Flag-DropActive': String(flags.FLAG_IS_DROP_ACTIVE),
    'X-ChrisShop-Flag-WireMock': String(flags.FLAG_ENABLE_WIREMOCK),
    'X-ChrisShop-Flag-Maintenance': String(flags.FLAG_MAINTENANCE_MODE),
    'X-ChrisShop-Flag-KillSwitch': String(flags.FLAG_EMERGENCY_KILL_SWITCH),
    'X-ChrisShop-Flag-CanaryPercent': String(flags.FLAG_PHASE_6_CANARY_PERCENT),
  };
  return headers;
}
