/**
 * ChrisShop Drop Day Conversion Funnel Instrumentation & Step Telemetry
 *
 * Story 4.28 (#333): Drop Day Conversion Funnel Instrumentation & Step Telemetry
 *
 * Provides:
 * 1. Standardized 6-stage funnel event schema and validation:
 *    - Step 1: Drop Countdown Impression (countdown_view)
 *    - Step 2: Product Detail Page View (product_view)
 *    - Step 3: Add to Cart Click (add_to_cart_attempt)
 *    - Step 4: Cart Create Result (cart_create_result: cart_create_success vs rate_limited vs out_of_stock)
 *    - Step 5: Shopify Checkout Redirection (checkout_redirect)
 *    - Step 6: Shopify Order Paid (order_completed)
 * 2. Workers Analytics Engine sink integration (CONVERSION_ANALYTICS binding)
 * 3. In-memory event buffer and real-time conversion rate calculations
 * 4. Structured edge logging for Logpush and Sentry breadcrumbs
 */

import { getCurrentTraceContext } from './tracing';

export type FunnelStage =
  | 'countdown_view'
  | 'product_view'
  | 'add_to_cart_attempt'
  | 'cart_create_result'
  | 'checkout_redirect'
  | 'order_completed';

export type CartCreateOutcome =
  | 'cart_create_success'
  | 'rate_limited'
  | 'out_of_stock'
  | 'failure';

export interface FunnelEvent {
  event_name: FunnelStage;
  step_index: number;
  drop_id: string;
  product_id: string;
  variant_id?: string;
  correlation_id: string;
  session_id?: string;
  outcome?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type FunnelEventInput = Omit<FunnelEvent, 'step_index' | 'correlation_id' | 'timestamp'> & {
  step_index?: number;
  correlation_id?: string;
  timestamp?: number;
};

export interface FunnelConversionCounts {
  countdown_view: number;
  product_view: number;
  add_to_cart_attempt: number;
  cart_create_success: number;
  rate_limited: number;
  out_of_stock: number;
  cart_create_other_failure: number;
  checkout_redirect: number;
  order_completed: number;
}

export interface FunnelConversionRates {
  countdownToProductPct: number;
  productToCartAttemptPct: number;
  cartAttemptToSuccessPct: number;
  cartSuccessToCheckoutPct: number;
  checkoutToOrderPaidPct: number;
  overallConversionPct: number;
}

export interface FunnelBottlenecks {
  cartRateLimitPct: number;
  cartOutOfStockPct: number;
  cartAbandonmentPct: number;
  checkoutAbandonmentPct: number;
}

export interface FunnelConversionSummary {
  totalEvents: number;
  timeWindow: {
    firstEventTimestamp: number | null;
    lastEventTimestamp: number | null;
  };
  counts: FunnelConversionCounts;
  conversionRates: FunnelConversionRates;
  bottlenecks: FunnelBottlenecks;
}

export type FunnelEventListener = (event: FunnelEvent) => void;

const funnelListeners: FunnelEventListener[] = [];
const EVENT_BUFFER_MAX_SIZE = 2000;
const eventBuffer: FunnelEvent[] = [];

/**
 * Returns the standard 1-6 sequential step index for a given funnel stage.
 */
export function getStepIndexForStage(stage: FunnelStage): number {
  switch (stage) {
    case 'countdown_view':
      return 1;
    case 'product_view':
      return 2;
    case 'add_to_cart_attempt':
      return 3;
    case 'cart_create_result':
      return 4;
    case 'checkout_redirect':
      return 5;
    case 'order_completed':
      return 6;
    default:
      return 0;
  }
}

/**
 * Validates that an incoming event adheres strictly to the standardized funnel event schema.
 */
export function validateFunnelEvent(event: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['Event payload must be a non-null object'] };
  }

  const e = event as Record<string, unknown>;

  const validStages: FunnelStage[] = [
    'countdown_view',
    'product_view',
    'add_to_cart_attempt',
    'cart_create_result',
    'checkout_redirect',
    'order_completed',
  ];

  if (!e.event_name || !validStages.includes(e.event_name as FunnelStage)) {
    errors.push(
      `Invalid or missing event_name: "${String(e.event_name)}". Expected one of: ${validStages.join(', ')}`
    );
  }

  if (typeof e.drop_id !== 'string' || !e.drop_id.trim()) {
    errors.push('Missing or empty drop_id');
  }

  if (typeof e.product_id !== 'string' || !e.product_id.trim()) {
    errors.push('Missing or empty product_id');
  }

  if (typeof e.correlation_id !== 'string' || !e.correlation_id.trim()) {
    errors.push('Missing or empty correlation_id');
  }

  if (typeof e.timestamp !== 'number' || isNaN(e.timestamp) || e.timestamp <= 0) {
    errors.push(`Invalid timestamp: ${String(e.timestamp)}`);
  }

  if (e.step_index !== undefined && (typeof e.step_index !== 'number' || e.step_index < 1 || e.step_index > 6)) {
    errors.push(`step_index must be an integer between 1 and 6, received ${String(e.step_index)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Registers an observer callback for emitted funnel events.
 * Returns an unregister function.
 */
export function onFunnelEvent(listener: FunnelEventListener): () => void {
  funnelListeners.push(listener);
  return () => {
    const idx = funnelListeners.indexOf(listener);
    if (idx !== -1) funnelListeners.splice(idx, 1);
  };
}

/**
 * Dispatches an event to Cloudflare Workers Analytics Engine if bound.
 */
export function writeToWorkersAnalyticsEngine(event: FunnelEvent, env?: Record<string, any>): boolean {
  try {
    const g = globalThis as Record<string, any>;
    const analyticsEngine =
      env?.CONVERSION_ANALYTICS ||
      env?.ANALYTICS_ENGINE ||
      g.CONVERSION_ANALYTICS ||
      g.ANALYTICS_ENGINE;

    if (analyticsEngine && typeof analyticsEngine.writeDataPoint === 'function') {
      analyticsEngine.writeDataPoint({
        blobs: [
          event.event_name,
          event.drop_id,
          event.product_id,
          event.variant_id || 'unspecified',
          event.outcome || 'default',
          event.correlation_id,
          event.session_id || 'anonymous',
        ],
        doubles: [
          event.timestamp,
          event.step_index,
          typeof event.metadata?.price === 'number' ? event.metadata.price : 0,
          typeof event.metadata?.quantity === 'number' ? event.metadata.quantity : 1,
        ],
        indexes: [event.event_name, event.drop_id],
      });
      return true;
    }
  } catch (err) {
    console.error('[FunnelTelemetry:AnalyticsEngineError]', err);
  }
  return false;
}

/**
 * Emits a structured log line for Cloudflare Logpush and Sentry breadcrumbs.
 */
function logStructuredFunnelEvent(event: FunnelEvent): void {
  try {
    const line = JSON.stringify({
      telemetry: 'conversion_funnel',
      event: event.event_name,
      step: event.step_index,
      dropId: event.drop_id,
      productId: event.product_id,
      variantId: event.variant_id,
      outcome: event.outcome,
      correlationId: event.correlation_id,
      sessionId: event.session_id,
      timestamp: event.timestamp,
      metadata: event.metadata,
    });
    console.log(`[FunnelTelemetry:Event] ${line}`);
  } catch {
    // Non-fatal logging error
  }
}

/**
 * Records a conversion funnel event into the unified pipeline.
 * Attaches ambient trace correlation ID and timestamp if not already provided.
 */
export function recordFunnelEvent(
  eventInput: FunnelEventInput,
  env?: Record<string, any>
): FunnelEvent {
  const trace = getCurrentTraceContext();
  const correlation_id =
    eventInput.correlation_id ||
    trace?.requestId ||
    `cr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const step_index = eventInput.step_index ?? getStepIndexForStage(eventInput.event_name);
  const timestamp = eventInput.timestamp ?? Date.now();

  const event: FunnelEvent = {
    event_name: eventInput.event_name,
    step_index,
    drop_id: eventInput.drop_id || 'default-drop',
    product_id: eventInput.product_id || 'storefront',
    variant_id: eventInput.variant_id,
    correlation_id,
    session_id: eventInput.session_id,
    outcome: eventInput.outcome,
    timestamp,
    metadata: eventInput.metadata,
  };

  // 1. Ring Buffer Ingestion
  if (eventBuffer.length >= EVENT_BUFFER_MAX_SIZE) {
    eventBuffer.shift();
  }
  eventBuffer.push(event);

  // 2. Structured Cloudflare Edge Log
  logStructuredFunnelEvent(event);

  // 3. Workers Analytics Engine Pipeline Sink
  writeToWorkersAnalyticsEngine(event, env);

  // 4. Notify registered event listeners
  for (const listener of funnelListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[FunnelTelemetry:ListenerError]', err);
    }
  }

  return event;
}

/**
 * Retrieves recorded funnel events, with optional filtering.
 */
export function getFunnelEvents(filter?: {
  drop_id?: string;
  product_id?: string;
  session_id?: string;
  event_name?: FunnelStage;
  since?: number;
}): FunnelEvent[] {
  return eventBuffer.filter((ev) => {
    if (filter?.drop_id && ev.drop_id !== filter.drop_id) return false;
    if (filter?.product_id && ev.product_id !== filter.product_id) return false;
    if (filter?.session_id && ev.session_id !== filter.session_id) return false;
    if (filter?.event_name && ev.event_name !== filter.event_name) return false;
    if (filter?.since !== undefined && ev.timestamp < filter.since) return false;
    return true;
  });
}

/**
 * Resets the in-memory event buffer (primarily for test isolation).
 */
export function clearFunnelEvents(): void {
  eventBuffer.length = 0;
}

/**
 * Computes conversion funnel counts, conversion rates, and bottleneck statistics from an event set.
 */
export function calculateFunnelMetrics(events: FunnelEvent[]): FunnelConversionSummary {
  const counts: FunnelConversionCounts = {
    countdown_view: 0,
    product_view: 0,
    add_to_cart_attempt: 0,
    cart_create_success: 0,
    rate_limited: 0,
    out_of_stock: 0,
    cart_create_other_failure: 0,
    checkout_redirect: 0,
    order_completed: 0,
  };

  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const ev of events) {
    if (firstTs === null || ev.timestamp < firstTs) firstTs = ev.timestamp;
    if (lastTs === null || ev.timestamp > lastTs) lastTs = ev.timestamp;

    switch (ev.event_name) {
      case 'countdown_view':
        counts.countdown_view++;
        break;
      case 'product_view':
        counts.product_view++;
        break;
      case 'add_to_cart_attempt':
        counts.add_to_cart_attempt++;
        break;
      case 'cart_create_result':
        if (ev.outcome === 'cart_create_success' || ev.outcome === 'success') {
          counts.cart_create_success++;
        } else if (ev.outcome === 'rate_limited') {
          counts.rate_limited++;
        } else if (ev.outcome === 'out_of_stock') {
          counts.out_of_stock++;
        } else {
          counts.cart_create_other_failure++;
        }
        break;
      case 'checkout_redirect':
        counts.checkout_redirect++;
        break;
      case 'order_completed':
        counts.order_completed++;
        break;
    }
  }

  // Safe division rounding to 2 decimal places
  const pct = (numerator: number, denominator: number): number => {
    if (!denominator || denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 10000) / 100;
  };

  const totalCartAttempts = counts.add_to_cart_attempt;
  const totalCartCreations =
    counts.cart_create_success +
    counts.rate_limited +
    counts.out_of_stock +
    counts.cart_create_other_failure;

  const denominatorForCartSuccess = totalCartAttempts > 0 ? totalCartAttempts : totalCartCreations;

  // Conversion Rates across the 6 stages
  const countdownToProductPct = pct(counts.product_view, counts.countdown_view);
  const productToCartAttemptPct = pct(counts.add_to_cart_attempt, counts.product_view);
  const cartAttemptToSuccessPct = pct(counts.cart_create_success, denominatorForCartSuccess);
  const cartSuccessToCheckoutPct = pct(counts.checkout_redirect, counts.cart_create_success);
  const checkoutToOrderPaidPct = pct(counts.order_completed, counts.checkout_redirect);

  // Overall Top-of-Funnel to Paid conversion
  const topOfFunnelCount = Math.max(counts.countdown_view, counts.product_view);
  const overallConversionPct = pct(counts.order_completed, topOfFunnelCount);

  // Bottleneck & Drop-Off Metrics
  const cartRateLimitPct = pct(counts.rate_limited, totalCartCreations);
  const cartOutOfStockPct = pct(counts.out_of_stock, totalCartCreations);
  const cartAbandonmentPct =
    counts.cart_create_success > 0
      ? pct(Math.max(0, counts.cart_create_success - counts.checkout_redirect), counts.cart_create_success)
      : 0;
  const checkoutAbandonmentPct =
    counts.checkout_redirect > 0
      ? pct(Math.max(0, counts.checkout_redirect - counts.order_completed), counts.checkout_redirect)
      : 0;

  return {
    totalEvents: events.length,
    timeWindow: {
      firstEventTimestamp: firstTs,
      lastEventTimestamp: lastTs,
    },
    counts,
    conversionRates: {
      countdownToProductPct,
      productToCartAttemptPct,
      cartAttemptToSuccessPct,
      cartSuccessToCheckoutPct,
      checkoutToOrderPaidPct,
      overallConversionPct,
    },
    bottlenecks: {
      cartRateLimitPct,
      cartOutOfStockPct,
      cartAbandonmentPct,
      checkoutAbandonmentPct,
    },
  };
}

/**
 * Returns conversion summary metrics for the recorded events in the buffer.
 */
export function getFunnelConversionMetrics(filter?: {
  drop_id?: string;
  since?: number;
}): FunnelConversionSummary {
  const events = getFunnelEvents(filter);
  return calculateFunnelMetrics(events);
}
