import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../../lib/shopify';

export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request);
    const body = await request.json();
    const { cartId, lines, lineId, quantity } = body;

    if (!cartId) {
      return NextResponse.json(
        { error: 'Missing required field: cartId' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updateLines = lines || (lineId !== undefined && quantity !== undefined ? [{ id: lineId, quantity }] : []);
    if (!updateLines || updateLines.length === 0) {
      return NextResponse.json(
        { error: 'Missing line items to update (lineId & quantity or lines array required)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const shopifyResponse = await shopify.cartLinesUpdate(cartId, updateLines, buyerIp);

    const userErrors = shopifyResponse.data?.cartLinesUpdate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors[0].message, userErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cart = shopifyResponse.data?.cartLinesUpdate?.cart;
    if (!cart) {
      return NextResponse.json(
        { error: 'Failed to update cart line items' },
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
      { error: err?.message || 'Internal server error updating cart lines' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
