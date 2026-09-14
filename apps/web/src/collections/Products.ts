import type { CollectionConfig } from 'payload';

/**
 * Products Collection Schema (Paradigm 2: Pure Product-First with Typed Tags)
 *
 * "Everything is a Tag" Model.
 * Eliminates all relational groupings entirely.
 * Categorization, product lines, material badges, and batch provenance are modeled
 * as structured typed tags (e.g. line:bushwhack, cat:apparel, style:anorak, mat:dyneema, batch:micro-001).
 * Zero relational foreign keys; eliminates database join latency.
 */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sku', 'base_price', 'tags', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique product identifier (e.g. prod-bushwhack-anorak)',
      },
    },
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
        description: 'Linked Shopify Product GID',
      },
    },
    {
      name: 'base_price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Flat price in USD. No relational inheritance required.',
      },
    },
    {
      name: 'sku',
      type: 'text',
      admin: {
        description: 'Unique Stock Keeping Unit (SKU)',
      },
    },
    {
      name: 'tags',
      type: 'array',
      admin: {
        description: 'Faceted typed tags for dynamic edge grouping (e.g. line:chest-rig, cat:packs, mat:cordura, type:micro-batch)',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
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
        description: 'Lifecycle state of the product',
      },
    },
    {
      name: 'category_id',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      admin: {
        description: 'Legacy relationship field preserved for baseline schema compatibility',
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
        description: "Chris's bench and field notes on design, construction, and testing conditions",
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
        description: 'Technical fabric specs and hardware',
      },
    },
    {
      name: 'weight',
      type: 'text',
      admin: {
        description: 'Total garment/pack weight',
      },
    },
    {
      name: 'fit_profile',
      type: 'text',
      admin: {
        description: 'Fit characteristics',
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
