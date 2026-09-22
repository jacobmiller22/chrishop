import type { CollectionConfig } from 'payload';
import { syncProductToShopify } from './hooks/syncProductToShopify';

/**
 * Products Collection Schema (Paradigm 1: Hybrid Product-First)
 *
 * Physical items are the primary, first-class entity.
 * Can exist completely standalone (e.g. 1-of-1 workbench prototypes) with zero parent container overhead.
 * Optionally links to a `product_line` for shared storytelling and default price inheritance.
 * Category is a controlled select dropdown directly on the product form.
 */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sku', 'category', 'base_price', 'product_line_id', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [syncProductToShopify],
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique product identifier (e.g. prod-rig-minimalist)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Product title',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly slug for storefront product detail page routing',
      },
    },
    {
      name: 'shopify_product_id',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Direct 1:1 linked Shopify Product GID',
      },
    },
    {
      name: 'base_price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Base price in USD. If product line is specified, can be inherited from line default.',
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
      name: 'sku',
      type: 'text',
      admin: {
        description: 'Unique Stock Keeping Unit (SKU)',
      },
    },
    {
      name: 'product_line_id',
      type: 'relationship',
      relationTo: 'product_lines' as any,
      hasMany: false,
      admin: {
        description: 'Optional parent product line or drop capsule for shared narrative & default price inheritance',
      },
    },
    {
      name: 'category_id',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      admin: {
        description: 'Legacy category relationship for backward compatibility',
      },
    },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'packs',
      options: [
        { label: 'Apparel & Outerwear', value: 'apparel' },
        { label: 'Packs & Carry Systems', value: 'packs' },
        { label: 'Field Accessories & Tools', value: 'accessories' },
      ],
      admin: {
        description: 'Controlled category dropdown (fast authoring directly on product record)',
      },
    },
    {
      name: 'options',
      type: 'array',
      admin: {
        description: 'Colorways, sizing, or material editions available for this product',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'value',
          type: 'text',
          required: true,
        },
        {
          name: 'sku_suffix',
          type: 'text',
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
        description: 'Supporting workbench and field photographs',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'maker_field_notes',
      type: 'textarea',
      admin: {
        description: "Chris's bench and field testing notes",
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
        description: 'Garment or pack weight',
      },
    },
    {
      name: 'fit_profile',
      type: 'text',
      admin: {
        description: 'Fit characteristics or carrying ergonomics',
      },
    },
    {
      name: 'origin',
      type: 'text',
      defaultValue: "Hand-crafted in Chris's workshop",
      admin: {
        description: 'Workshop production provenance',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Full editorial description',
      },
    },
  ],
};
