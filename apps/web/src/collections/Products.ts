import type { CollectionConfig } from 'payload';

/**
 * Products Collection Schema
 *
 * Authoritative editorial source of truth for artwork titles, artist statements,
 * provenance, and media gallery. Synchronized to Shopify Admin API on publish.
 * Conforms to HLD Section 3.2 and Story 2.18.
 */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'base_price', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Product or artwork title',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly product slug for storefront page routing',
      },
    },
    {
      name: 'shopify_product_id',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Linked Shopify Product GID (e.g. gid://shopify/Product/1234567890)',
      },
    },
    {
      name: 'base_price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Base price in USD. Synchronized to default Shopify variant.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Lifecycle state of the artwork',
      },
    },
    {
      name: 'category_id',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      admin: {
        description: 'Primary product category taxonomy reference',
      },
    },
    {
      name: 'featured_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Primary hero image for catalog grids and detail pages',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      admin: {
        description: 'Supporting high-resolution artwork photographs and angle shots',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'maker_field_notes',
      type: 'textarea',
      admin: {
        description: 'Chris’s bench and field notes on design, construction, and bank-testing conditions',
      },
    },
    {
      name: 'artist_statement',
      type: 'textarea',
      admin: {
        description: 'Legacy artist statement field (mapped to maker_field_notes)',
      },
    },
    {
      name: 'materials',
      type: 'text',
      admin: {
        description: 'Technical fabric specs and hardware (e.g. 3-Layer DWR Ripstop, 500D Cordura®, YKK AquaGuard®)',
      },
    },
    {
      name: 'weight',
      type: 'text',
      admin: {
        description: 'Total garment/pack weight (e.g. 21.4 oz / 606g)',
      },
    },
    {
      name: 'fit_profile',
      type: 'text',
      admin: {
        description: 'Fit characteristics (e.g. Relaxed Athletic with articulated elbows)',
      },
    },
    {
      name: 'origin',
      type: 'text',
      defaultValue: "Hand-cut & sewn in small batches in Chris's workshop",
      admin: {
        description: 'Workshop production provenance',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Full rich text editorial description rendered via Lexical editor',
      },
    },
  ],
};
