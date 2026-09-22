import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../lib/shopify';
import { verifyTurnstileToken } from '../../../../lib/turnstile';
import {
  extractTraceHeaders,
  runWithTraceContext,
  withTraceHeaders,
} from '../../../../lib/tracing';

export async function POST(request: NextRequest) {
  const trace = extractTraceHeaders(request);

  return runWithTraceContext(trace, async () => {
    try {
      const buyerIp = extractBuyerIp(request);
      const body = await request.json();
      const { variantId, quantity = 1, turnstileToken } = body;

      if (!variantId) {
        const res = NextResponse.json(
          { error: 'Missing required field: variantId' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      // Bot & Scalper Mitigation: Cloudflare Turnstile Verification
      const requireTurnstile =
        process.env.REQUIRE_TURNSTILE === 'true' ||
        (process.env.NODE_ENV === 'production' && !process.env.BYPASS_TURNSTILE);

      if (requireTurnstile && !turnstileToken) {
        const res = NextResponse.json(
          { error: 'Turnstile challenge verification required before adding to cart' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      if (turnstileToken) {
        const turnstileResult = await verifyTurnstileToken({
          token: turnstileToken,
          remoteIp: buyerIp,
        });

        if (!turnstileResult.success) {
          const res = NextResponse.json(
            {
              error: 'Bot challenge validation failed. Please reload and try again.',
              errorCodes: turnstileResult.errorCodes,
            },
            { status: 403, headers: { 'Cache-Control': 'no-store' } }
          );
          return withTraceHeaders(res, trace);
        }
      }

      // Call Shopify Storefront API with forwarded buyer IP and correlation ID headers
      let shopifyResponse: any;
      try {
        shopifyResponse = await shopify.createCart(variantId, quantity, buyerIp, trace.requestId);
      } catch (err: any) {
        const errMsg = String(err?.message || '');
        if (
          errMsg.toLowerCase().includes('rate limit exceeded') ||
          errMsg.includes('429') ||
          errMsg.toLowerCase().includes('throttled')
        ) {
          const res = NextResponse.json(
            {
              error: "Drop traffic is surging! We're queuing your request, please retry in a moment.",
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfterSec: 2,
            },
            {
              status: 429,
              headers: {
                'Cache-Control': 'no-store',
                'Retry-After': '2',
              },
            }
          );
          return withTraceHeaders(res, trace);
        }
        if (errMsg.includes('CIRCUIT_BREAKER_ACTIVE')) {
          const res = NextResponse.json(
            {
              error: 'Checkout is temporarily paused during maintenance. Please check back shortly.',
              code: 'CIRCUIT_BREAKER_ACTIVE',
            },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
          );
          return withTraceHeaders(res, trace);
        }
        throw err;
      }

      const userErrors = shopifyResponse.data?.cartCreate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        const first = userErrors[0];
        const isOutOfStock =
          first.code === 'OUT_OF_STOCK' ||
          first.message?.toLowerCase().includes('out of stock') ||
          first.message?.toLowerCase().includes('exceeds available');
        const res = NextResponse.json(
          {
            error: isOutOfStock
              ? 'The requested limited edition drop item is currently out of stock or reserved by another buyer.'
              : first.message,
            code: first.code || (isOutOfStock ? 'OUT_OF_STOCK' : 'USER_ERROR'),
            userErrors,
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const cart = shopifyResponse.data?.cartCreate?.cart;
      if (!cart) {
        const res = NextResponse.json(
          { error: 'Failed to create Shopify cart' },
          { status: 502, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const res = NextResponse.json(
        {
          success: true,
          cart,
          forwardedBuyerIp: buyerIp || null,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Type': 'application/json',
          },
        }
      );
      return withTraceHeaders(res, trace);
    } catch (err: any) {
      const res = NextResponse.json(
        { error: err?.message || 'Internal server error during cart creation' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
      return withTraceHeaders(res, trace);
    }
  });
}
