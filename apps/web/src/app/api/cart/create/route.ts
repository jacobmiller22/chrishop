import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../lib/shopify';
import { verifyTurnstileToken } from '../../../../lib/turnstile';

export const runtime = 'edge';
export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request);
    const body = await request.json();
    const { variantId, quantity = 1, turnstileToken } = body;

    if (!variantId) {
      return NextResponse.json(
        { error: 'Missing required field: variantId' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Bot & Scalper Mitigation: Cloudflare Turnstile Verification
    const requireTurnstile =
      process.env.REQUIRE_TURNSTILE === 'true' ||
      (process.env.NODE_ENV === 'production' && !process.env.BYPASS_TURNSTILE);

    if (requireTurnstile && !turnstileToken) {
      return NextResponse.json(
        { error: 'Turnstile challenge verification required before adding to cart' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (turnstileToken) {
      const turnstileResult = await verifyTurnstileToken({
        token: turnstileToken,
        remoteIp: buyerIp,
      });

      if (!turnstileResult.success) {
        return NextResponse.json(
          {
            error: 'Bot challenge validation failed. Please reload and try again.',
            errorCodes: turnstileResult.errorCodes,
          },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // Call Shopify Storefront API with forwarded buyer IP header
    const shopifyResponse = await shopify.createCart(variantId, quantity, buyerIp);

    const userErrors = shopifyResponse.data?.cartCreate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors[0].message, userErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cart = shopifyResponse.data?.cartCreate?.cart;
    if (!cart) {
      return NextResponse.json(
        { error: 'Failed to create Shopify cart' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error during cart creation' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
