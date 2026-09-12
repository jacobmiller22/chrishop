/**
 * Cloudflare R2 Image Resizing Utilities
 *
 * Implements responsive image delivery via Cloudflare Image Resizing for all
 * media assets stored in Cloudflare R2 (chrishop-media bucket).
 *
 * Architecture (Story 2.23 / HLD Section 10):
 * - Media uploads are stored in Cloudflare R2 via @payloadcms/storage-s3
 * - sharp is explicitly EXCLUDED — native C++ addons cannot run on Cloudflare Workers
 * - All responsive transforms are delegated to Cloudflare Image Resizing at CDN edge
 * - Cloudflare Image Resizing uses /cdn-cgi/image/<options>/<source-url> format
 *
 * Cloudflare Image Resizing Documentation:
 * https://developers.cloudflare.com/images/image-resizing/
 *
 * Cost model: Zero egress charges from R2. Cloudflare Image Resizing is billed
 * per unique transform cached (first request) — subsequent cache hits are free.
 *
 * @see DEP_CLOUDFLARE_R2.md
 * @see docs/HIGH_LEVEL_DESIGN.md Section 10 (Performance, Edge Caching, SEO & Accessibility)
 */

/**
 * Standard responsive breakpoints for the ChrisShop storefront.
 * Matches Tailwind CSS v4 default breakpoints used in packages/ui.
 *
 * - sm: mobile phones in landscape / small tablets
 * - md: tablets and large mobile
 * - lg: laptop and desktop catalog grids
 * - xl: high-DPI desktop and 4K retina displays
 * - 2xl: ultra-wide displays
 */
export const RESPONSIVE_WIDTHS = [320, 640, 768, 1024, 1280, 1536, 1920] as const;

/**
 * Standard quality presets for different use cases.
 * Cloudflare Image Resizing default quality is 85 (WebP).
 */
export const IMAGE_QUALITY = {
  /** High-quality for hero banners and featured artwork (sharper, larger file) */
  HIGH: 90,
  /** Standard quality for product grids and thumbnails */
  STANDARD: 80,
  /** Reduced quality for placeholders and previews */
  PREVIEW: 60,
} as const;

export interface CloudflareImageOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Image quality (1-100). Default: 80 */
  quality?: number;
  /** Output format. Default: auto (serves WebP/AVIF to supported browsers) */
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  /** Object-fit behavior. Default: scale-down */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  /** Background color for 'pad' fit mode */
  background?: string;
  /** Sharpen amount (0-10) */
  sharpen?: number;
}

/**
 * Builds a Cloudflare Image Resizing URL for on-demand image transforms.
 *
 * Format: /cdn-cgi/image/<options>/<source-url>
 *
 * This URL pattern is intercepted by the Cloudflare edge worker which:
 * 1. Fetches the original image from the source URL (R2 CDN domain)
 * 2. Applies the requested transform (resize, format conversion, quality)
 * 3. Caches the result at edge nodes globally
 * 4. Returns the optimized image to the browser
 *
 * NOTE: Cloudflare Image Resizing must be enabled on the zone in the
 * Cloudflare Dashboard > Speed > Optimization > Image Resizing.
 *
 * @param sourceUrl - Public URL of the original image (e.g., from R2 CDN domain)
 * @param options - Image transformation options
 * @returns Cloudflare Image Resizing URL
 *
 * @example
 * buildCloudflareImageUrl(
 *   'https://media.chrishop.jacobmiller22.com/uploads/sculpture-01.jpg',
 *   { width: 800, quality: 80, format: 'auto' }
 * )
 * // => '/cdn-cgi/image/width=800,quality=80,format=auto/https://media.chrishop.jacobmiller22.com/uploads/sculpture-01.jpg'
 */
export function buildCloudflareImageUrl(
  sourceUrl: string,
  options: CloudflareImageOptions = {}
): string {
  const params: string[] = [];

  if (options.width !== undefined) params.push(`width=${options.width}`);
  if (options.height !== undefined) params.push(`height=${options.height}`);
  if (options.quality !== undefined) params.push(`quality=${options.quality}`);
  if (options.format !== undefined) params.push(`format=${options.format}`);
  if (options.fit !== undefined) params.push(`fit=${options.fit}`);
  if (options.background !== undefined) params.push(`background=${options.background}`);
  if (options.sharpen !== undefined) params.push(`sharpen=${options.sharpen}`);

  // Default to auto format for modern browser optimization (WebP/AVIF negotiation)
  if (options.format === undefined) params.push('format=auto');

  const optionsString = params.join(',');

  return `/cdn-cgi/image/${optionsString}/${sourceUrl}`;
}

/**
 * Generates a responsive `srcset` attribute string using Cloudflare Image Resizing
 * for the given source image URL.
 *
 * Each entry in the srcset uses a Cloudflare Image Resizing URL that transforms
 * the original high-resolution R2 image to the target width on-demand at CDN edge.
 *
 * This completely replaces server-side sharp processing:
 * - No variants are pre-generated on upload (no sharp invocation)
 * - Variants are generated and cached on first request at edge nodes
 * - Storage footprint = 1 original per image (no thumbnail variants in R2)
 * - Delivery cost = Cloudflare Image Resizing per unique transform (zero egress from R2)
 *
 * @param sourceUrl - Public URL of the original image stored in Cloudflare R2
 * @param widths - Array of target widths for the srcset. Defaults to RESPONSIVE_WIDTHS.
 * @param quality - Image quality (1-100). Defaults to IMAGE_QUALITY.STANDARD (80).
 * @returns `srcset` attribute string (e.g., "/cdn-cgi/image/width=320,... 320w, ...")
 *
 * @example
 * generateCloudflareImageSrcset(
 *   'https://media.chrishop.jacobmiller22.com/uploads/sculpture-01.jpg',
 *   [320, 640, 1024],
 *   80
 * )
 * // => '/cdn-cgi/image/width=320,quality=80,format=auto/https://media... 320w, /cdn-cgi/image/width=640,... 640w, ...'
 */
export function generateCloudflareImageSrcset(
  sourceUrl: string,
  widths: readonly number[] = RESPONSIVE_WIDTHS,
  quality: number = IMAGE_QUALITY.STANDARD
): string {
  return widths
    .map((width) => {
      const url = buildCloudflareImageUrl(sourceUrl, { width, quality });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generates a complete `sizes` attribute string for responsive images.
 *
 * The sizes attribute tells the browser which layout size the image will occupy
 * at each breakpoint, enabling it to select the optimal srcset entry.
 *
 * @param sizesConfig - Array of [breakpoint, size] tuples. Last entry is the default.
 * @returns `sizes` attribute string
 *
 * @example
 * generateSizesAttribute([
 *   ['(max-width: 768px)', '100vw'],
 *   ['(max-width: 1280px)', '50vw'],
 *   ['33vw']
 * ])
 * // => '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw'
 */
export function generateSizesAttribute(
  sizesConfig: Array<[string, string] | [string]>
): string {
  return sizesConfig
    .map(([breakpointOrDefault, size]) => {
      if (size === undefined) {
        // Last entry without media query = default size
        return breakpointOrDefault;
      }
      return `${breakpointOrDefault} ${size}`;
    })
    .join(', ');
}

/**
 * Standard size configurations for common ChrisShop layout contexts.
 * Used as defaults for the `sizes` attribute in image components.
 */
export const STANDARD_SIZES = {
  /** Full-width hero banner images */
  HERO: '100vw',
  /** Catalog grid images (3-column on desktop, 2-column on tablet, 1-column on mobile) */
  CATALOG_GRID: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  /** Featured product image on product detail page */
  PRODUCT_FEATURED: '(max-width: 768px) 100vw, 50vw',
  /** Thumbnail / admin list view */
  THUMBNAIL: '(max-width: 640px) 50vw, 20vw',
} as const;

/**
 * Constructs a complete image prop object for use with Next.js <Image> or <img>.
 *
 * Combines srcset generation and sizes attribute for a given media asset.
 *
 * @param sourceUrl - Public URL of the original image in Cloudflare R2
 * @param alt - Accessible alt text (required for WCAG 2.1 AA compliance)
 * @param sizesPreset - Layout context preset from STANDARD_SIZES
 * @param quality - Image quality override (default: IMAGE_QUALITY.STANDARD)
 * @returns Props object with src, srcSet, sizes, and alt
 */
export function buildResponsiveImageProps(
  sourceUrl: string,
  alt: string,
  sizesPreset: string = STANDARD_SIZES.CATALOG_GRID,
  quality: number = IMAGE_QUALITY.STANDARD
): {
  src: string;
  srcSet: string;
  sizes: string;
  alt: string;
} {
  return {
    // Original URL as src fallback for browsers without srcset support
    src: sourceUrl,
    srcSet: generateCloudflareImageSrcset(sourceUrl, RESPONSIVE_WIDTHS, quality),
    sizes: sizesPreset,
    alt,
  };
}
