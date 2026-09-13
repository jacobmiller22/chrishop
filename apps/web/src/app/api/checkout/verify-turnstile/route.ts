import { NextRequest, NextResponse } from 'next/server';
import { extractBuyerIp } from '../../../../lib/shopify';
import { verifyTurnstileToken } from '../../../../lib/turnstile';

export const runtime = 'edge';
export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request);
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing Turnstile challenge token' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const result = await verifyTurnstileToken({
      token,
      remoteIp: buyerIp,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Turnstile verification rejected',
          errorCodes: result.errorCodes,
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        challengeTs: result.challengeTs,
        hostname: result.hostname,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Turnstile verification error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
