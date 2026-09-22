import { NextRequest, NextResponse } from 'next/server';
import { extractBuyerIp } from '../../../../lib/shopify';
import {
  verifyTurnstileToken,
  checkTurnstileRateLimit,
} from '../../../../lib/turnstile';

export async function POST(request: NextRequest) {
  try {
    const buyerIp = extractBuyerIp(request) || '127.0.0.1';

    // Rate Limiting Gate: protect endpoint from automated bot exhaustion
    const kv = (globalThis as any).NEXT_CACHE_WORKERS_KV;
    const rateLimit = await checkTurnstileRateLimit({
      key: buyerIp,
      limit: parseInt(process.env.TURNSTILE_RATE_LIMIT_MAX || '10', 10),
      windowSeconds: parseInt(process.env.TURNSTILE_RATE_LIMIT_WINDOW || '60', 10),
      kv,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before retrying checkout verification.',
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(rateLimit.retryAfterSeconds || 60),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing Turnstile challenge token' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        }
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
        {
          status: 403,
          headers: {
            'Cache-Control': 'no-store',
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        }
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
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.resetAt),
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
