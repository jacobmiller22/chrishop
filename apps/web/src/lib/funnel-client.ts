/**
 * ChrisShop Client-Side Conversion Funnel Telemetry Dispatcher
 *
 * Story 4.28 (#333): Drop Day Conversion Funnel Instrumentation & Step Telemetry
 *
 * Non-blocking client beaconing for storefront events (countdown view, PDP view,
 * add-to-cart clicks, and checkout redirects).
 * Uses navigator.sendBeacon where available for zero-impact page unload resilience,
 * falling back to fetch with keepalive: true.
 */

import type { FunnelStage, FunnelEventInput } from './funnel-telemetry';

const SESSION_STORAGE_KEY = 'chrishop_funnel_session_id';

/**
 * Returns or initializes a persistent anonymous session ID for the browser tab/session.
 */
export function getFunnelSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';

  try {
    let sid = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sid) {
      sid = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return 'ephemeral-session';
  }
}

export interface ClientFunnelEventOptions {
  event_name: FunnelStage;
  drop_id?: string;
  product_id?: string;
  variant_id?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dispatches a conversion funnel telemetry event asynchronously from the browser.
 * Safe to call during page transitions or component unmounts.
 */
export function emitFunnelEventClient(options: ClientFunnelEventOptions): void {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getFunnelSessionId();
    const payload: FunnelEventInput = {
      event_name: options.event_name,
      drop_id: options.drop_id || 'bankbeaters-leadville',
      product_id: options.product_id || 'storefront',
      variant_id: options.variant_id,
      session_id: sessionId,
      outcome: options.outcome,
      timestamp: Date.now(),
      metadata: {
        ...options.metadata,
        path: window.location.pathname,
        referrer: document.referrer || undefined,
        screen: `${window.screen?.width}x${window.screen?.height}`,
      },
    };

    const endpoint = '/api/telemetry/funnel';
    const payloadString = JSON.stringify(payload);

    // 1. Prefer navigator.sendBeacon for reliable async edge transmission
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payloadString], { type: 'application/json' });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    }

    // 2. Fallback to fetch with keepalive: true
    if (typeof fetch === 'function') {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString,
        keepalive: true,
      }).catch(() => {
        // Non-blocking telemetry drop
      });
    }
  } catch {
    // Non-fatal telemetry dispatch error
  }
}

/**
 * Convenience dispatchers for specific storefront actions
 */
export function trackCountdownView(dropId?: string, productId?: string, metadata?: Record<string, unknown>): void {
  emitFunnelEventClient({
    event_name: 'countdown_view',
    drop_id: dropId,
    product_id: productId || 'drop-schedule',
    metadata,
  });
}

export function trackProductView(productId: string, dropId?: string, variantId?: string, metadata?: Record<string, unknown>): void {
  emitFunnelEventClient({
    event_name: 'product_view',
    drop_id: dropId,
    product_id: productId,
    variant_id: variantId,
    metadata,
  });
}

export function trackAddToCartAttempt(productId: string, variantId?: string, dropId?: string, metadata?: Record<string, unknown>): void {
  emitFunnelEventClient({
    event_name: 'add_to_cart_attempt',
    drop_id: dropId,
    product_id: productId,
    variant_id: variantId,
    metadata,
  });
}

export function trackCheckoutRedirect(
  productId: string,
  checkoutUrl: string,
  variantId?: string,
  dropId?: string,
  metadata?: Record<string, unknown>
): void {
  emitFunnelEventClient({
    event_name: 'checkout_redirect',
    drop_id: dropId,
    product_id: productId,
    variant_id: variantId,
    metadata: {
      ...metadata,
      checkoutUrl,
    },
  });
}
