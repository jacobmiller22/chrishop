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

  return {
    userId: sessionId,
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
  env?: Record<string, unknown>
): Promise<boolean> {
  return isFeatureEnabled('FLAG_IS_DROP_ACTIVE', context, env);
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
    return generateFlagDebugHeaders(flags, tier);
  }
  return {};
}
