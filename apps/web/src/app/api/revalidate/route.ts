import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * On-demand edge cache revalidation route handler.
 * Triggered by Payload CMS afterChange hooks or automated workflows.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const secret = process.env.PAYLOAD_SECRET || 'chrishop-payload-development-secret-32-chars-min';

    if (authHeader !== `Bearer ${secret}`) {
      const urlSecret = req.nextUrl.searchParams.get('secret');
      if (urlSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { path, tag } = body as { path?: string; tag?: string };

    const revalidated: string[] = [];

    if (path) {
      revalidatePath(path);
      revalidated.push(`path:${path}`);
    }

    if (tag) {
      (revalidateTag as any)(tag);
      revalidated.push(`tag:${tag}`);
    }

    return NextResponse.json({
      success: true,
      revalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error during revalidation' },
      { status: 500 }
    );
  }
}
