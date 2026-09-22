import { z } from 'zod';

/**
 * ==============================================================================
 * ChrisShop Cloudflare Flagship Feature Flagging Engine
 * Specification: docs/decisions/ADR_FEATURE_FLAGGING_FLAGSHIP.md
 *
 * Implements a streamlined 2-tier feature flag evaluation system:
 * 1. Cloud Edge Runtime: Evaluates via Cloudflare Flagship native binding (env.FLAGS)
 * 2. Local Dev & Tests: Evaluates directly from environment variables (process.env.FLAG_*)
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
  /** Story 1.18: POC Storefront Hero Banner & Dynamic Homepage Feature Switch */
  FLAG_HOMEPAGE_HERO_POC: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof flagSchema>;
export type FlagKey = keyof FeatureFlags;
export const FLAG_KEYS = Object.keys(flagSchema.shape) as FlagKey[];

/**
 * Multi-Tier Environment Strategy Matrix
 * Standard default flag states across Ephemeral PR Previews, Staging, Production,
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
    FLAG_HOMEPAGE_HERO_POC: true,
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
    FLAG_HOMEPAGE_HERO_POC: true,
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
    FLAG_HOMEPAGE_HERO_POC: false,
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
    FLAG_HOMEPAGE_HERO_POC: true,
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
    FLAG_HOMEPAGE_HERO_POC: false,
  },
};

/**
 * Contextual attributes for flag evaluation & targeting rules
 * Conforms to Cloudflare Flagship FlagshipEvaluationContext
 */
export interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  vipToken?: string;
  customerTags?: string[];
  ipAddress?: string;
  environmentTier?: EnvironmentTier;
  sessionFlags?: Record<string, boolean | string | number>;
  [key: string]: unknown;
}

/**
 * Cloudflare Flagship Worker Binding Interface
 * Matches Cloudflare's native Flagship binding methods from @cloudflare/workers-types
 */
export interface CloudflareFlagshipBinding {
  getBooleanValue(
    key: string,
    defaultValue: boolean,
    context?: Record<string, unknown>
  ): Promise<boolean>;
  getStringValue(
    key: string,
    defaultValue: string,
    context?: Record<string, unknown>
  ): Promise<string>;
  getNumberValue(
    key: string,
    defaultValue: number,
    context?: Record<string, unknown>
  ): Promise<number>;
  getObjectValue<T = unknown>(
    key: string,
    defaultValue: T,
    context?: Record<string, unknown>
  ): Promise<T>;
}

/**
 * Resolves the active environment tier
 */
export function resolveEnvironmentTier(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
  context?: EvaluationContext
): EnvironmentTier {
  if (context?.environmentTier) return context.environmentTier;
  const rawEnv = (env.NODE_ENV || 'development').toLowerCase();
  if (rawEnv === 'test') return 'test';
  if (rawEnv === 'preview' || rawEnv.includes('pr-') || env.PREVIEW === 'true') return 'preview';
  if (rawEnv === 'staging' || env.STAGING === 'true') return 'staging';
  if (rawEnv === 'production') return 'production';
  return 'development';
}

/**
 * Core Multi-Tier Feature Flag Evaluator (Story 2.47 & ADR-001)
 *
 * Precedence in Preview Environments:
 * 1. Reviewer Session Override (URL query ?flag:KEY=val or cookie chrishop_flags_override) - Preview & Dev only!
 * 2. PR Worker Var Override (declared in wrangler.toml [env.preview.vars] or process.env)
 * 3. Staging Flagship Binding (env.FLAGS from Staging Flagship app)
 * 4. Staging Default Fallback (ENVIRONMENT_FLAG_DEFAULTS.staging)
 *
 * Precedence in Production Environments:
 * - Reviewer session overrides are STRICTLY IGNORED.
 * - Authoritative evaluation via Cloudflare Flagship (env.FLAGS) or production vars/defaults.
 */
export async function evaluateFlag<T extends boolean | string | number>(
  key: string,
  defaultValue: T,
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<T> {
  const g = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
  const flagship = (env?.FLAGS || g.FLAGS) as CloudflareFlagshipBinding | undefined;
  const tier = resolveEnvironmentTier(
    typeof process !== 'undefined' ? process.env : {},
    context
  );

  // Helper to coerce value to expected type
  const coerce = (val: unknown): T => {
    if (typeof defaultValue === 'boolean') {
      if (typeof val === 'boolean') return val as T;
      if (typeof val === 'string') return (val === 'true' || val === '1') as T;
      if (typeof val === 'number') return (val !== 0) as T;
    }
    if (typeof defaultValue === 'number') {
      const num = Number(val);
      return (isNaN(num) ? defaultValue : num) as T;
    }
    return String(val) as T;
  };

  // Precedence Step 1: Reviewer Session Override (PREVIEW, DEV, TEST only; STRICTLY IGNORED in production)
  if (tier !== 'production' && context?.sessionFlags && key in context.sessionFlags) {
    return coerce(context.sessionFlags[key]);
  }

  // Precedence Step 2: PR Worker Var Override (env[key] or process.env[key])
  // In preview or local dev/test, PR branch worker vars take precedence over Staging Flagship
  const envVal =
    (typeof env?.[key] !== 'undefined' ? env[key] : undefined) ??
    (typeof process !== 'undefined' ? process.env?.[key] : undefined);

  if (tier === 'preview' || tier === 'development' || tier === 'test') {
    if (envVal !== undefined && envVal !== null) {
      return coerce(envVal);
    }
  }

  // Compute tier default fallback (in preview, cascade to staging defaults)
  const effectiveTier = tier === 'preview' ? 'staging' : tier;
  const rawTierDefault =
    ENVIRONMENT_FLAG_DEFAULTS[effectiveTier]?.[key as FlagKey] ??
    ENVIRONMENT_FLAG_DEFAULTS[tier]?.[key as FlagKey];
  const tierDefault = (rawTierDefault !== undefined ? rawTierDefault : defaultValue) as T;

  // Precedence Step 3: Cloudflare Flagship Binding (Staging Flagship or Production Flagship)
  if (flagship) {
    const evalContext = context as Record<string, unknown> | undefined;
    if (typeof defaultValue === 'boolean' && typeof flagship.getBooleanValue === 'function') {
      return (await flagship.getBooleanValue(key, tierDefault as boolean, evalContext)) as T;
    }
    if (typeof defaultValue === 'string' && typeof flagship.getStringValue === 'function') {
      return (await flagship.getStringValue(key, tierDefault as string, evalContext)) as T;
    }
    if (typeof defaultValue === 'number' && typeof flagship.getNumberValue === 'function') {
      return (await flagship.getNumberValue(key, tierDefault as number, evalContext)) as T;
    }
    if (typeof flagship.getObjectValue === 'function') {
      return (await flagship.getObjectValue(key, tierDefault, evalContext)) as T;
    }
  }

  // In production or staging, if Flagship binding was absent, use direct envVal
  if (tier === 'production' || tier === 'staging') {
    if (envVal !== undefined && envVal !== null) {
      return coerce(envVal);
    }
  }

  // Precedence Step 4: Environment Tier Default Fallback
  return tierDefault;
}

/**
 * Boolean flag evaluation convenience helper
 */
export async function isFeatureEnabled(
  key: FlagKey,
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  const tier = resolveEnvironmentTier(typeof process !== 'undefined' ? process.env : {}, context);
  const effectiveTier = tier === 'preview' ? 'staging' : tier;
  const defaultVal = ENVIRONMENT_FLAG_DEFAULTS[effectiveTier]?.[key] ?? false;
  return evaluateFlag(key, Boolean(defaultVal), context, env);
}

/**
 * Generic flag evaluation convenience helper
 */
export async function getFeatureFlag<K extends FlagKey>(
  key: K,
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<FeatureFlags[K]> {
  const tier = resolveEnvironmentTier(typeof process !== 'undefined' ? process.env : {}, context);
  const effectiveTier = tier === 'preview' ? 'staging' : tier;
  const defaultVal = ENVIRONMENT_FLAG_DEFAULTS[effectiveTier]?.[key];
  return evaluateFlag(key, defaultVal as FeatureFlags[K], context, env);
}

/**
 * Evaluates all flags at once
 */
export async function evaluateAllFlags(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<FeatureFlags> {
  const result: Partial<FeatureFlags> = {};
  for (const key of FLAG_KEYS) {
    result[key] = (await getFeatureFlag(key, context, env)) as never;
  }
  return result as FeatureFlags;
}

/**
 * VIP Access evaluation helper for early access gates
 */
export function evaluateVipAccess(
  context: EvaluationContext,
  configuredSecrets: string[] = ['chrishop-vip-secret', 'dev-vip-token-2026']
): boolean {
  if (context.vipToken && configuredSecrets.includes(context.vipToken)) {
    return true;
  }
  if (context.customerTags) {
    return context.customerTags.some((tag) =>
      ['vip', 'early-access', 'artist', 'collector'].includes(tag.toLowerCase())
    );
  }
  return false;
}

/**
 * RFC-compliant diagnostic debug headers
 */
export function generateFlagDebugHeaders(
  flags: FeatureFlags,
  tier: EnvironmentTier,
  context?: EvaluationContext
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-ChrisShop-Flags-Evaluated': 'true',
    'X-ChrisShop-Tier': tier,
    'X-ChrisShop-Flag-DropActive': String(flags.FLAG_IS_DROP_ACTIVE),
    'X-ChrisShop-Flag-WireMock': String(flags.FLAG_ENABLE_WIREMOCK),
    'X-ChrisShop-Flag-Maintenance': String(flags.FLAG_MAINTENANCE_MODE),
    'X-ChrisShop-Flag-KillSwitch': String(flags.FLAG_EMERGENCY_KILL_SWITCH),
    'X-ChrisShop-Flag-CanaryPercent': String(flags.FLAG_PHASE_6_CANARY_PERCENT),
    'X-ChrisShop-Flag-HeroPoc': String(flags.FLAG_HOMEPAGE_HERO_POC),
  };
  if (context?.sessionFlags && Object.keys(context.sessionFlags).length > 0) {
    headers['X-ChrisShop-Flag-ReviewerOverride'] = 'true';
  }
  return headers;
}
