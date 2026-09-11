import { NextResponse } from 'next/server';

export async function GET() {
  const g = globalThis as unknown as Record<string, unknown>;
  const env = process.env;

  const d1 = Boolean(env.DB || g.DB);
  const kv = Boolean(env.NEXT_CACHE_WORKERS_KV || g.NEXT_CACHE_WORKERS_KV);
  const r2 = Boolean(env.BUCKET || g.BUCKET);
  const assets = Boolean(env.ASSETS || g.ASSETS);
  const site = Boolean(
    env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || g.SITE_URL || g.NEXT_PUBLIC_SITE_URL
  );
  const cms = Boolean(
    env.CMS_URL || env.PAYLOAD_PUBLIC_SERVER_URL || g.CMS_URL || g.PAYLOAD_PUBLIC_SERVER_URL
  );

  return NextResponse.json(
    {
      status: 'healthy',
      service: '@chrishop/web',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
      bindings: {
        d1,
        kv,
        r2,
        assets,
        site,
        cms,
      },
    },
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
}

