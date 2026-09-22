import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../../lib/shopify';

export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request);
    const body = await request.json();
    const { cartId, lines, variantId, quantity = 1 } = body;

    if (!cartId) {
      return NextResponse.json(
        { error: 'Missing required field: cartId' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cartLines = lines || (variantId ? [{ merchandiseId: variantId, quantity }] : []);
    if (!cartLines || cartLines.length === 0) {
      return NextResponse.json(
        { error: 'Missing line items to add (variantId or lines array required)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const shopifyResponse = await shopify.cartLinesAdd(cartId, cartLines, buyerIp);

    const userErrors = shopifyResponse.data?.cartLinesAdd?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors[0].message, userErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cart = shopifyResponse.data?.cartLinesAdd?.cart;
    if (!cart) {
      return NextResponse.json(
        { error: 'Failed to add line items to cart' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, cart, forwardedBuyerIp: buyerIp || null },
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
      { error: err?.message || 'Internal server error adding lines to cart' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
