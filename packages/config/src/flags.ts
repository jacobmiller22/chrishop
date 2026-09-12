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
 * Core 2-Tier Feature Flag Evaluator
 *
 * Tier 1: Cloudflare Flagship Native Binding (when running in deployed Worker)
 * Tier 2: Direct Environment Variable (when running in local dev / Miniflare offline / unit tests)
 */
export async function evaluateFlag<T extends boolean | string | number>(
  key: string,
  defaultValue: T,
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<T> {
  const g = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
  const flagship = (env?.FLAGS || g.FLAGS) as CloudflareFlagshipBinding | undefined;

  // Tier 1: Cloudflare Flagship Binding
  if (flagship) {
    const evalContext = context as Record<string, unknown> | undefined;
    if (typeof defaultValue === 'boolean' && typeof flagship.getBooleanValue === 'function') {
      return (await flagship.getBooleanValue(key, defaultValue, evalContext)) as T;
    }
    if (typeof defaultValue === 'string' && typeof flagship.getStringValue === 'function') {
      return (await flagship.getStringValue(key, defaultValue, evalContext)) as T;
    }
    if (typeof defaultValue === 'number' && typeof flagship.getNumberValue === 'function') {
      return (await flagship.getNumberValue(key, defaultValue, evalContext)) as T;
    }
    if (typeof flagship.getObjectValue === 'function') {
      return (await flagship.getObjectValue(key, defaultValue, evalContext)) as T;
    }
  }

  // Tier 2: Direct Environment Variable (Local dev, .dev.vars, unit tests)
  const envVal =
    (typeof process !== 'undefined' ? process.env?.[key] : undefined) ??
    (typeof env?.[key] === 'string' ? (env[key] as string) : undefined);

  if (envVal !== undefined) {
    if (typeof defaultValue === 'boolean') {
      return (envVal === 'true' || envVal === '1') as T;
    }
    if (typeof defaultValue === 'number') {
      const num = Number(envVal);
      return (isNaN(num) ? defaultValue : num) as T;
    }
    return envVal as T;
  }

  // Static tier fallback if environment variable is unset
  const tier = resolveEnvironmentTier(typeof process !== 'undefined' ? process.env : {}, context);
  const tierDefault = ENVIRONMENT_FLAG_DEFAULTS[tier]?.[key as FlagKey];
  if (tierDefault !== undefined) {
    return tierDefault as T;
  }

  return defaultValue;
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
  const defaultVal = ENVIRONMENT_FLAG_DEFAULTS[tier]?.[key] ?? false;
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
  const defaultVal = ENVIRONMENT_FLAG_DEFAULTS[tier]?.[key];
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
  tier: EnvironmentTier
): Record<string, string> {
  return {
    'X-ChrisShop-Flags-Evaluated': 'true',
    'X-ChrisShop-Tier': tier,
    'X-ChrisShop-Flag-DropActive': String(flags.FLAG_IS_DROP_ACTIVE),
    'X-ChrisShop-Flag-WireMock': String(flags.FLAG_ENABLE_WIREMOCK),
    'X-ChrisShop-Flag-Maintenance': String(flags.FLAG_MAINTENANCE_MODE),
    'X-ChrisShop-Flag-KillSwitch': String(flags.FLAG_EMERGENCY_KILL_SWITCH),
    'X-ChrisShop-Flag-CanaryPercent': String(flags.FLAG_PHASE_6_CANARY_PERCENT),
  };
}
