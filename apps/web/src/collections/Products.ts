import type { CollectionConfig } from 'payload';

/**
 * Products Collection Schema (Paradigm 3: Strict 3-Tier Hierarchy)
 *
 * Tier 2: Model / Silhouette (e.g. "Minimalist Chest Rig", "Bushwhack Storm Anorak").
 * In strict 3-tier architecture, every product MUST belong to a parent ProductLine.
 * Base price is optional; if null, it inherits from product_lines.default_price.
 * Child SKUs are modeled in ProductVariations (Tier 3).
 */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'product_line_id', 'base_price', 'status', 'updatedAt'],
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
      name: 'product_line_id',
      type: 'relationship',
      relationTo: 'product_lines' as any,
      required: true,
      hasMany: false,
      admin: {
        description: 'Tier 1 parent line / series container (MANDATORY in Strict 3-Tier)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Silhouette or model title',
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
        description: 'Tier 2 base price in USD.',
      },
    },
    {
      name: 'price',
      type: 'number',
      min: 0,
      admin: {
        description: 'Optional price override. If omitted, falls back to base_price or line default_price.',
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
        description: 'Lifecycle state of the product model',
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
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Silhouette narrative, design intent, and technical specifications',
      },
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
        description: 'Artist statement field (mapped to maker_field_notes)',
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
      defaultValue: "Hand-crafted in Chris's workshop",
      admin: {
        description: 'Provenance and workshop crafting location',
      },
    },
    {
      name: 'featured_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Primary hero image for catalog grids and social preview cards',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      admin: {
        description: 'High-resolution craft and field-testing photo gallery',
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
  ],
};
