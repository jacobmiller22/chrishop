import { NextRequest, NextResponse } from 'next/server';
import { shopify, extractBuyerIp } from '../../../../lib/shopify';
import {
  extractTraceHeaders,
  runWithTraceContext,
  withTraceHeaders,
} from '../../../../lib/tracing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const trace = extractTraceHeaders(request);

  return runWithTraceContext(trace, async () => {
    try {
      const buyerIp = extractBuyerIp(request);
      const { cartId } = await params;

      if (!cartId) {
        const res = NextResponse.json(
          { error: 'Missing required cartId parameter' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const decodedCartId = decodeURIComponent(cartId);
      const shopifyResponse = await shopify.getCart(decodedCartId, buyerIp, trace.requestId);

      const cart = shopifyResponse.data?.cart;
      if (!cart) {
        const res = NextResponse.json(
          { error: 'Cart not found' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
        return withTraceHeaders(res, trace);
      }

      const res = NextResponse.json(
        { success: true, cart, forwardedBuyerIp: buyerIp || null },
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
        { error: err?.message || 'Internal server error fetching cart' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
      return withTraceHeaders(res, trace);
    }
  });
}
