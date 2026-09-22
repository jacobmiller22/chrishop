import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../lib/shopify';

export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request);
    const body = await request.json();
    const { cartId, buyerIdentity } = body;

    if (!cartId) {
      return NextResponse.json(
        { error: 'Missing required field: cartId' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!buyerIdentity || typeof buyerIdentity !== 'object') {
      return NextResponse.json(
        { error: 'Missing required field: buyerIdentity' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const shopifyResponse = await shopify.cartBuyerIdentityUpdate(cartId, buyerIdentity, buyerIp);

    const userErrors = shopifyResponse.data?.cartBuyerIdentityUpdate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors[0].message, userErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cart = shopifyResponse.data?.cartBuyerIdentityUpdate?.cart;
    if (!cart) {
      return NextResponse.json(
        { error: 'Failed to update cart buyer identity' },
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
      { error: err?.message || 'Internal server error updating buyer identity' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
