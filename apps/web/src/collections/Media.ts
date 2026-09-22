import type { CollectionConfig } from 'payload';

/**
 * Media Collection Schema
 *
 * Cloudflare R2 object storage upload collection for high-resolution photography,
 * technical illustrations, animated GIFs, and lightweight field video clips.
 * Conforms to HLD Section 3.2, DEP_PAYLOAD_CMS.md, DEP_CLOUDFLARE_R2.md, and Story 3.16.
 *
 * EDGE RUNTIME CONSTRAINT (Zero-Sharp Policy):
 * Payload CMS natively relies on `sharp` for image dimension extraction and thumbnails.
 * `sharp` is a native C++ addon that CANNOT execute in Cloudflare Workers.
 * - `imageSizes` is intentionally NOT configured.
 * - Image resizing and format conversion are delegated to Cloudflare Image Resizing at edge.
 * - Video streaming and GIFs are served directly from Cloudflare R2 with range support.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    disableLocalStorage: true,
    // Supported MIME types: still images, animated GIFs, and lightweight HTML5 video clips
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/png',
      'image/avif',
      'image/gif',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
    ],
    // Maximum upload file size: 25 MB (26,214,400 bytes)
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data) return data;

        // Auto-detect media_type based on mimeType if not manually set
        const mimeType = (req as any)?.file?.mimetype || data.mime_type || data.mimeType || '';
        if (!data.media_type) {
          if (mimeType.startsWith('video/')) {
            data.media_type = 'video';
          } else if (mimeType === 'image/gif') {
            data.media_type = 'gif';
          } else {
            data.media_type = 'image';
          }
        }

        return data;
      },
    ],
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
        description: 'Optional visible caption displayed beneath the media item in galleries',
      },
    },
    {
      name: 'media_type',
      type: 'select',
      defaultValue: 'image',
      options: [
        { label: 'Still Photograph / Vector (Image)', value: 'image' },
        { label: 'Motion Video Clip (MP4 / WebM)', value: 'video' },
        { label: 'Animated GIF Loop', value: 'gif' },
      ],
      admin: {
        description: 'Discriminator for rendering still photography, HTML5 video, or animated GIFs.',
      },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Poster frame image shown before video playback or on low-bandwidth connections.',
        condition: (data) => data?.media_type === 'video',
      },
    },
    {
      name: 'poster_url',
      type: 'text',
      admin: {
        description: 'Direct URL or path to fallback poster frame image.',
        condition: (data) => data?.media_type === 'video',
      },
    },
    {
      name: 'loop',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Continuously loop video playback.',
        condition: (data) => data?.media_type === 'video' || data?.media_type === 'gif',
      },
    },
    {
      name: 'auto_play',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Automatically play muted video when entering viewport.',
        condition: (data) => data?.media_type === 'video',
      },
    },
  ],
};
