import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../../lib/shopify';

export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request);
    const body = await request.json();
    const { cartId, lineIds, lineId } = body;

    if (!cartId) {
      return NextResponse.json(
        { error: 'Missing required field: cartId' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const targetLineIds = lineIds || (lineId ? [lineId] : []);
    if (!targetLineIds || targetLineIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing line items to remove (lineId or lineIds array required)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const shopifyResponse = await shopify.cartLinesRemove(cartId, targetLineIds, buyerIp);

    const userErrors = shopifyResponse.data?.cartLinesRemove?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors[0].message, userErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cart = shopifyResponse.data?.cartLinesRemove?.cart;
    if (!cart) {
      return NextResponse.json(
        { error: 'Failed to remove line items from cart' },
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
      { error: err?.message || 'Internal server error removing lines from cart' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
