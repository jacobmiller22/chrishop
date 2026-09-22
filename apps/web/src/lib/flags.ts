/**
 * ChrisShop Storefront Edge Feature Flag Client
 *
 * Implements high-level helper functions for Next.js SSR, React Server Components,
 * route handlers, and edge middleware.
 * Specification: docs/decisions/ADR_FEATURE_FLAGGING_FLAGSHIP.md
 */

import {
  type EvaluationContext,
  isFeatureEnabled,
  evaluateAllFlags,
  evaluateVipAccess,
  generateFlagDebugHeaders,
  resolveEnvironmentTier,
} from '@chrishop/config';

export * from '@chrishop/config';

/**
 * Extracts visitor context from standard Web Request headers and cookies.
 */
export function extractEvaluationContext(request?: Request): EvaluationContext {
  if (!request) {
    return {
      environmentTier: resolveEnvironmentTier(),
    };
  }

  const url = new URL(request.url);
  const cookieHeader = request.headers.get('cookie') || '';

  // Extract session ID from cookie or header
  const sessionMatch = cookieHeader.match(/(?:^|;\s*)chrishop_session_id=([^;]+)/);
  const sessionId =
    sessionMatch?.[1] ||
    request.headers.get('x-session-id') ||
    url.searchParams.get('session_id') ||
    undefined;

  // Extract VIP token from query param, header, or cookie
  const vipMatch = cookieHeader.match(/(?:^|;\s*)chrishop_vip_token=([^;]+)/);
  const vipToken =
    url.searchParams.get('vip_token') ||
    request.headers.get('x-vip-token') ||
    vipMatch?.[1] ||
    undefined;

  // Extract customer tags if forwarded by auth headers
  const rawTags = request.headers.get('x-customer-tags');
  const customerTags = rawTags ? rawTags.split(',').map((t) => t.trim()) : undefined;

  const ipAddress =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    undefined;

  const tier = resolveEnvironmentTier(process.env, { environmentTier: undefined });

  // Story 2.47 (Option C): Extract Reviewer Session Flag Overrides
  // Restricted strictly to preview and local development; strictly ignored in production!
  const sessionFlags: Record<string, boolean | string | number> = {};

  const normalizeFlagKey = (k: string): string => {
    const upper = k.toUpperCase().replace(/-/g, '_');
    const aliasMap: Record<string, string> = {
      WIREMOCK: 'FLAG_ENABLE_WIREMOCK',
      FLAG_WIREMOCK: 'FLAG_ENABLE_WIREMOCK',
      DROP_ACTIVE: 'FLAG_IS_DROP_ACTIVE',
      FLAG_DROP_ACTIVE: 'FLAG_IS_DROP_ACTIVE',
      MAINTENANCE: 'FLAG_MAINTENANCE_MODE',
      FLAG_MAINTENANCE: 'FLAG_MAINTENANCE_MODE',
      KILL_SWITCH: 'FLAG_EMERGENCY_KILL_SWITCH',
      FLAG_KILL_SWITCH: 'FLAG_EMERGENCY_KILL_SWITCH',
      DISABLE_CHECKOUT: 'FLAG_DISABLE_CHECKOUT',
      FLAG_DISABLE_CHECKOUT: 'FLAG_DISABLE_CHECKOUT',
      CHECKOUT: 'FLAG_DISABLE_CHECKOUT',
      FLAG_CHECKOUT: 'FLAG_DISABLE_CHECKOUT',
      VIP: 'FLAG_VIP_EARLY_ACCESS',
      FLAG_VIP: 'FLAG_VIP_EARLY_ACCESS',
      CANARY: 'FLAG_PHASE_6_CANARY_PERCENT',
      FLAG_CANARY: 'FLAG_PHASE_6_CANARY_PERCENT',
      HERO: 'FLAG_HOMEPAGE_HERO_POC',
      FLAG_HERO: 'FLAG_HOMEPAGE_HERO_POC',
      HERO_POC: 'FLAG_HOMEPAGE_HERO_POC',
      FLAG_HERO_POC: 'FLAG_HOMEPAGE_HERO_POC',
      HOMEPAGE_HERO: 'FLAG_HOMEPAGE_HERO_POC',
      FLAG_HOMEPAGE_HERO: 'FLAG_HOMEPAGE_HERO_POC',
      FLAG_HOMEPAGE_HERO_POC: 'FLAG_HOMEPAGE_HERO_POC',
    };
    if (aliasMap[upper]) return aliasMap[upper];
    if (!upper.startsWith('FLAG_')) return 'FLAG_' + upper;
    return upper;
  };

  if (tier !== 'production') {
    // 1. Extract from Cookie: chrishop_flags_override (JSON or key=value pairs)
    const cookieOverrideMatch = cookieHeader.match(/(?:^|;\s*)chrishop_flags_override=([^;]+)/);
    if (cookieOverrideMatch?.[1]) {
      try {
        const decoded = decodeURIComponent(cookieOverrideMatch[1]);
        if (decoded.startsWith('{')) {
          const parsed = JSON.parse(decoded);
          for (const [k, v] of Object.entries(parsed)) {
            sessionFlags[normalizeFlagKey(k)] = v as boolean | string | number;
          }
        } else {
          // Key-value pairs: FLAG_A:true,FLAG_B:false or FLAG_A=true&FLAG_B=false
          const pairs = decoded.split(/[,&]/);
          for (const pair of pairs) {
            const [k, v] = pair.split(/[:=]/);
            if (k && v !== undefined) {
              const cleanKey = normalizeFlagKey(k.trim());
              const cleanVal = v.trim();
              if (cleanVal.toLowerCase() === 'true' || cleanVal === '1') sessionFlags[cleanKey] = true;
              else if (cleanVal.toLowerCase() === 'false' || cleanVal === '0') sessionFlags[cleanKey] = false;
              else if (!isNaN(Number(cleanVal)) && cleanVal !== '') sessionFlags[cleanKey] = Number(cleanVal);
              else sessionFlags[cleanKey] = cleanVal;
            }
          }
        }
      } catch {
        // Ignore malformed cookie
      }
    }

    // 2. Extract from URL Query Parameters: ?flag:FLAG_NAME=val or ?flag_FLAG_NAME=val (supersedes cookie)
    for (const [paramKey, paramVal] of url.searchParams.entries()) {
      const match = paramKey.match(/^flag[:_]([A-Za-z0-9_-]+)$/);
      if (match) {
        const flagKey = normalizeFlagKey(match[1]);
        let parsedVal: boolean | number | string = paramVal;
        if (paramVal.toLowerCase() === 'true' || paramVal === '1') parsedVal = true;
        else if (paramVal.toLowerCase() === 'false' || paramVal === '0') parsedVal = false;
        else if (!isNaN(Number(paramVal)) && paramVal.trim() !== '') parsedVal = Number(paramVal);

        sessionFlags[flagKey] = parsedVal;
      }
    }
  }

  return {
    userId: sessionId,
    sessionId,
    vipToken,
    customerTags,
    ipAddress,
    environmentTier: tier,
    sessionFlags: Object.keys(sessionFlags).length > 0 ? sessionFlags : undefined,
  };
}

/**
 * Checks if the public product drop is currently live.
 */
export async function isDropActive(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  return isFeatureEnabled('FLAG_IS_DROP_ACTIVE', context, env);
}

/**
 * Story 1.18: Checks if the POC Homepage Hero Banner layout is enabled.
 */
export async function isHomepageHeroPocEnabled(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  return isFeatureEnabled('FLAG_HOMEPAGE_HERO_POC', context, env);
}

/**
 * Checks if Shopify Storefront requests should route through WireMock/mock bridge.
 */
export async function isWireMockEnabled(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  return isFeatureEnabled('FLAG_ENABLE_WIREMOCK', context, env);
}

/**
 * Checks if the storefront is in maintenance/countdown holding mode.
 */
export async function isMaintenanceMode(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  return isFeatureEnabled('FLAG_MAINTENANCE_MODE', context, env);
}

/**
 * Checks if the master emergency kill-switch is active.
 */
export async function isEmergencyKillSwitchActive(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  return isFeatureEnabled('FLAG_EMERGENCY_KILL_SWITCH', context, env);
}

/**
 * Checks if checkout transitions are disabled.
 */
export async function isCheckoutDisabled(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<boolean> {
  const isKilled = await isEmergencyKillSwitchActive(context, env);
  if (isKilled) return true;
  return isFeatureEnabled('FLAG_DISABLE_CHECKOUT', context, env);
}

/**
 * Checks whether a given visitor can access the drop (either public drop is live OR visitor has valid VIP access).
 */
export async function canAccessDrop(
  context: EvaluationContext = {},
  env?: Record<string, unknown>
): Promise<{ canAccess: boolean; isVip: boolean; isPublic: boolean }> {
  // Check maintenance mode first: maintenance blocks all shopping
  const maintenance = await isMaintenanceMode(context, env);
  if (maintenance) {
    return { canAccess: false, isVip: false, isPublic: false };
  }

  // Check if public drop is active
  const publicActive = await isDropActive(context, env);
  if (publicActive) {
    return { canAccess: true, isVip: false, isPublic: true };
  }

  // Check if VIP Early Access is enabled
  const vipGatingEnabled = await isFeatureEnabled('FLAG_VIP_EARLY_ACCESS', context, env);
  if (!vipGatingEnabled) {
    return { canAccess: false, isVip: false, isPublic: false };
  }

  // Validate VIP credentials
  const isVip = evaluateVipAccess(context);
  return { canAccess: isVip, isVip, isPublic: false };
}

/**
 * Evaluates all flags and returns diagnostic headers if verbose debug headers are enabled.
 */
export async function getFlagResponseHeaders(
  context?: EvaluationContext,
  env?: Record<string, unknown>
): Promise<Record<string, string>> {
  const flags = await evaluateAllFlags(context, env);
  if (flags.FLAG_VERBOSE_DEBUG_HEADERS) {
    const tier = resolveEnvironmentTier(process.env, context);
    return generateFlagDebugHeaders(flags, tier, context);
  }
  return {};
}
