import type { CollectionConfig } from 'payload';

/**
 * Media Collection Schema
 *
 * Cloudflare R2 object storage upload collection for high-resolution artwork imagery.
 * Conforms to HLD Section 3.2, DEP_PAYLOAD_CMS.md, and Story 2.18.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  upload: true,
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Descriptive alt text for accessibility and SEO',
      },
    },
  ],
};
