import type { CollectionConfig } from 'payload';

/**
 * ProductVariations Collection Schema
 *
 * ARCHITECTURAL INVARIANT (Story 2.18 / HLD Section 3.2):
 * Live stock quantity is queried dynamically from Shopify to eliminate dual-write split brain.
 * Mutable live inventory levels MUST NOT be stored in D1 SQLite.
 */
export const ProductVariations: CollectionConfig = {
  slug: 'product_variations',
  admin: {
    useAsTitle: 'variation_name',
    defaultColumns: ['variation_name', 'sku', 'product_id', 'price_override', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      hasMany: false,
      admin: {
        description: 'Parent product for this variation or edition',
      },
    },
    {
      name: 'shopify_variant_id',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Linked Shopify ProductVariant GID (e.g. gid://shopify/ProductVariant/987654321)',
      },
    },
    {
      name: 'variation_name',
      type: 'text',
      required: true,
      admin: {
        description: 'Edition or variation title (e.g. Obsidian Cast Edition, Giclée Print 24x36)',
      },
    },
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Unique Stock Keeping Unit (SKU) identifier',
      },
    },
    {
      name: 'price_override',
      type: 'number',
      min: 0,
      admin: {
        description: 'Optional price override. When omitted, falls back to parent product base_price.',
      },
    },
    {
      name: 'is_limited_edition',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Indicates whether this variation is a capped, numbered limited edition run',
      },
    },
    {
      name: 'total_edition_count',
      type: 'number',
      min: 1,
      admin: {
        description: 'Total serialized prints/casts manufactured in this edition run',
        condition: (data) => Boolean(data?.is_limited_edition),
      },
    },
    {
      name: 'release_date',
      type: 'date',
      admin: {
        description: 'Scheduled drop timestamp to drive storefront countdown timers',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'coming_soon',
      options: [
        { label: 'Coming Soon', value: 'coming_soon' },
        { label: 'Active', value: 'active' },
        { label: 'Sold Out', value: 'sold_out' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Editorial availability status. Note: live checkout inventory availability is validated against Shopify.',
      },
    },
  ],
};
