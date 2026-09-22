import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../lib/shopify';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string }> }
) {
  try {
    const buyerIp = extractBuyerIp(request);
    const { cartId } = await params;

    if (!cartId) {
      return NextResponse.json(
        { error: 'Missing required cartId parameter' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const decodedCartId = decodeURIComponent(cartId);
    const shopifyResponse = await shopify.getCart(decodedCartId, buyerIp);

    const cart = shopifyResponse.data?.cart;
    if (!cart) {
      return NextResponse.json(
        { error: 'Cart not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
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
      { error: err?.message || 'Internal server error fetching cart' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
