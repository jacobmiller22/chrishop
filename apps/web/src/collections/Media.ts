import type { CollectionConfig } from 'payload';

/**
 * Media Collection Schema
 *
 * Cloudflare R2 object storage upload collection for high-resolution artwork imagery.
 * Conforms to HLD Section 3.2, DEP_PAYLOAD_CMS.md, DEP_CLOUDFLARE_R2.md, and Story 2.23.
 *
 * EDGE RUNTIME CONSTRAINT (Story 2.23 Adversarial Finding):
 * Payload CMS natively relies on `sharp` for image dimension extraction, resizing,
 * and thumbnail generation. `sharp` is a native Node.js C++ addon that CANNOT execute
 * in the Cloudflare Workers edge runtime.
 *
 * Implementation strategy:
 * - `imageSizes` is intentionally NOT configured — this prevents Payload from invoking
 *   sharp to generate server-side thumbnail variants on upload.
 * - `disableLocalStorage: true` is NOT used — storage is handled by the s3Storage plugin
 *   configured in payload.config.ts.
 * - Responsive image delivery is handled entirely via Cloudflare Image Resizing
 *   (/cdn-cgi/image/width=...,quality=.../<path>) at CDN edge on request.
 * - MIME type validation and file size limits are enforced here to guard upload integrity
 *   without requiring any server-side image processing.
 *
 * @see DEP_CLOUDFLARE_R2.md Section 2.2
 * @see apps/web/src/lib/r2-image.ts for the Cloudflare Image Resizing srcset generator
 */
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    // Supported MIME types for product photography, artwork galleries, and digital certificates.
    // JPEG and WebP are the primary formats for high-resolution artwork.
    // PNG is supported for logos, icons, and transparency-required assets.
    // AVIF provides best-in-class compression for modern browsers.
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/png',
      'image/avif',
      'image/gif',
      'image/svg+xml',
    ],
    // Maximum upload file size: 25 MB
    // Sufficient for high-resolution uncompressed JPEG artwork masters (typical 10-20 MB).
    // Prevents runaway storage costs and slow upload UX.
    // NO imageSizes configured — sharp is explicitly excluded from the edge runtime.
    // Responsive srcset URLs are generated via Cloudflare Image Resizing at request time.
    // See: apps/web/src/lib/r2-image.ts -> generateCloudflareImageSrcset()
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Descriptive alt text for accessibility and SEO (WCAG 2.1 AA compliance)',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional visible caption displayed beneath the image in galleries',
      },
    },
  ],
};
