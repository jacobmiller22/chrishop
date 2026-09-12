/**
 * Custom Next.js Image Loader for Cloudflare Image Resizing & R2 Media Assets
 *
 * Implements the Next.js `imageLoader` specification to route all `<Image />`
 * component requests through the Cloudflare Image Resizing edge pipeline.
 *
 * Architecture (Story 2.42 & Story 2.43):
 * - Canonical URI scheme: /cdn-cgi/image/width={width},quality={quality},format=auto/{normalizedPath}
 * - Zero server-side sharp dependency in Cloudflare Workers edge runtime.
 * - Handles Miniflare local emulation fallback (direct local file serving) vs
 *   staging/production Cloudflare R2 bucket URLs.
 * - Preserves full remote URLs and strips leading slashes from relative R2 keys.
 *
 * @see docs/HIGH_LEVEL_DESIGN.md Section 10
 * @see docs/CLOUDFLARE_SETUP.md Section 12
 * @see https://nextjs.org/docs/app/api-reference/next-config-js/images#loaderfile
 */

export interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

/**
 * Normalizes an image path or URL for Cloudflare Image Resizing:
 * - If full http(s) URL, preserves it intact.
 * - If relative path, strips leading slashes so it can be appended cleanly to /cdn-cgi/image/...
 */
export function normalizeImagePath(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  return src.replace(/^\/+/, '');
}

/**
 * Detects if a URL targets a local development server (localhost, 127.0.0.1, [::1]).
 */
export function isLocalDevUrl(src: string): boolean {
  if (!src) return false;
  try {
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      return false;
    }
    const url = new URL(src);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

/**
 * Checks whether the current runtime environment is running in Miniflare local emulation
 * or local dev mode where direct local file serving fallback should be used.
 */
export function isMiniflareMode(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }

  return (
    process.env.MINIFLARE === 'true' ||
    process.env.NEXT_PUBLIC_MINIFLARE === 'true' ||
    process.env.NEXT_PUBLIC_LOCAL_DEV === 'true' ||
    process.env.NEXT_PUBLIC_DEV_FALLBACK === 'true'
  );
}

/**
 * Determines if an asset request should bypass Cloudflare Image Resizing:
 * - Local dev URLs (localhost / 127.0.0.1)
 * - Local file paths when running in Miniflare / local dev fallback mode
 * - SVGs (vector graphics do not require raster resizing)
 * - Inline data URIs and blob URIs
 * - URLs already prefixed with /cdn-cgi/image/ (prevent redundant transforms)
 */
export function shouldBypassResizing(src: string): boolean {
  if (!src) return true;

  // 1. Pass through inline data/blob URIs
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return true;
  }

  // 2. Pass through already transformed URLs
  if (src.startsWith('/cdn-cgi/image/')) {
    return true;
  }

  // 3. Pass through SVG vector assets
  const cleanPath = src.split('?')[0] || '';
  if (cleanPath.endsWith('.svg')) {
    return true;
  }

  // 4. Pass through local dev URLs (e.g. http://localhost:3000/uploads/art.jpg)
  if (isLocalDevUrl(src)) {
    return true;
  }

  // 5. Miniflare local dev fallback: direct local file serving for relative paths
  if (isMiniflareMode() && !src.startsWith('http://') && !src.startsWith('https://')) {
    return true;
  }

  return false;
}

/**
 * Builds a Cloudflare Image Resizing URL conforming to Next.js loader specifications.
 *
 * @param props ImageLoaderProps containing src, width, and optional quality
 * @returns Cloudflare Image Resizing URI or un-resized passthrough URL
 */
export function buildCloudflareLoaderUrl({ src, width, quality }: ImageLoaderProps): string {
  if (!src) return '';

  // Return un-resized URL if resizing should be bypassed (local dev, SVG, data URIs)
  if (shouldBypassResizing(src)) {
    return src;
  }

  const q = quality || 85;
  const normalizedPath = normalizeImagePath(src);

  return `/cdn-cgi/image/width=${width},quality=${q},format=auto/${normalizedPath}`;
}

/**
 * Default Next.js Image Loader export.
 * Registered in `next.config.mjs` via `images.loaderFile`.
 */
export default function imageLoader(props: ImageLoaderProps): string {
  return buildCloudflareLoaderUrl(props);
}
