/**
 * ChrisShop Storefront Edge Feature Flag Client
 *
 * Implements high-level helper functions for Next.js SSR, React Server Components,
 * route handlers, and edge middleware.
 * Specification: docs/decisions/ADR_FEATURE_FLAGGING_FLAGSHIP.md
 */

import {
  type EvaluationContext,
  type KVNamespaceLike,
  isFeatureEnabled,
  getFeatureFlag,
  evaluateAllFlags,
  evaluateCanaryRollout,
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

  return {
    sessionId,
    vipToken,
    customerTags,
    ipAddress,
    environmentTier: resolveEnvironmentTier(process.env, { environmentTier: undefined }),
  };
}

/**
 * Checks if the public product drop is currently live.
 */
export async function isDropActive(
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  return isFeatureEnabled('FLAG_IS_DROP_ACTIVE', context, process.env, kvBinding);
}

/**
 * Checks if Shopify Storefront requests should route through WireMock/mock bridge.
 */
export async function isWireMockEnabled(
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  return isFeatureEnabled('FLAG_ENABLE_WIREMOCK', context, process.env, kvBinding);
}

/**
 * Checks if the storefront is in maintenance/countdown holding mode.
 */
export async function isMaintenanceMode(
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  return isFeatureEnabled('FLAG_MAINTENANCE_MODE', context, process.env, kvBinding);
}

/**
 * Checks if the master emergency kill-switch is active.
 */
export async function isEmergencyKillSwitchActive(
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  return isFeatureEnabled('FLAG_EMERGENCY_KILL_SWITCH', context, process.env, kvBinding);
}

/**
 * Checks if checkout transitions are disabled.
 */
export async function isCheckoutDisabled(
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  const isKilled = await isEmergencyKillSwitchActive(context, kvBinding);
  if (isKilled) return true;
  return isFeatureEnabled('FLAG_DISABLE_CHECKOUT', context, process.env, kvBinding);
}

/**
 * Checks whether a given visitor can access the drop (either public drop is live OR visitor has valid VIP access).
 */
export async function canAccessDrop(
  context: EvaluationContext = {},
  kvBinding?: KVNamespaceLike
): Promise<{ canAccess: boolean; isVip: boolean; isPublic: boolean }> {
  // Check maintenance mode first: maintenance blocks all shopping
  const maintenance = await isMaintenanceMode(context, kvBinding);
  if (maintenance) {
    return { canAccess: false, isVip: false, isPublic: false };
  }

  // Check if public drop is active
  const publicActive = await isDropActive(context, kvBinding);
  if (publicActive) {
    return { canAccess: true, isVip: false, isPublic: true };
  }

  // Check if VIP Early Access is enabled
  const vipGatingEnabled = await isFeatureEnabled('FLAG_VIP_EARLY_ACCESS', context, process.env, kvBinding);
  if (!vipGatingEnabled) {
    return { canAccess: false, isVip: false, isPublic: false };
  }

  // Validate VIP credentials
  const isVip = evaluateVipAccess(context);
  return { canAccess: isVip, isVip, isPublic: false };
}

/**
 * Checks if a session qualifies for Phase 6 canary feature rollout.
 */
export async function isSessionInCanary(
  sessionId: string,
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<boolean> {
  const canaryPercent = await getFeatureFlag(
    'FLAG_PHASE_6_CANARY_PERCENT',
    context,
    process.env,
    kvBinding
  );
  return evaluateCanaryRollout(sessionId, canaryPercent);
}

/**
 * Evaluates all flags and returns diagnostic headers if verbose debug headers are enabled.
 */
export async function getFlagResponseHeaders(
  context?: EvaluationContext,
  kvBinding?: KVNamespaceLike
): Promise<Record<string, string>> {
  const flags = await evaluateAllFlags(context, process.env, kvBinding);
  if (flags.FLAG_VERBOSE_DEBUG_HEADERS) {
    const tier = resolveEnvironmentTier(process.env, context);
    return generateFlagDebugHeaders(flags, tier);
  }
  return {};
}
