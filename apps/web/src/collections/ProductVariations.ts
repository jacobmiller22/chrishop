import type { CollectionConfig } from 'payload';
import {
  revalidateVariationAfterChange,
  revalidateVariationAfterDelete,
} from './hooks/revalidateCatalog';
import { isAdmin, isAdminOrEditor } from '../access';

/**
 * Derives a human-readable edition badge based on maker batch classification (Story 3.19)
 */
export function deriveEditionBadge(
  variationType?: string | null,
  totalEditionCount?: number | null
): string {
  switch (variationType) {
    case 'one_of_one':
      return '1-of-1 Prototype';
    case 'micro_batch':
      return totalEditionCount && totalEditionCount > 0
        ? `Only ${totalEditionCount} Crafted`
        : 'Limited Micro-Batch';
    case 'prototype':
      return 'Archive Sample';
    case 'standard':
    default:
      return 'Standard Production';
  }
}

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
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data) {
          // Auto-derive edition_badge if not explicitly provided
          if (!data.edition_badge || (typeof data.edition_badge === 'string' && data.edition_badge.trim() === '')) {
            data.edition_badge = deriveEditionBadge(data.variation_type, data.total_edition_count);
          }
        }
        return data;
      },
    ],
    afterChange: [revalidateVariationAfterChange],
    afterDelete: [revalidateVariationAfterDelete],
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique variation identifier (e.g. var-anorak-olive)',
      },
    },
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
      name: 'variation_type',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Standard Production', value: 'standard' },
        { label: 'Micro-Batch Run (2-10 Pieces)', value: 'micro_batch' },
        { label: 'One-of-One (Unique Single Item)', value: 'one_of_one' },
        { label: 'Archive / Prototype Sample', value: 'prototype' },
      ],
      admin: {
        description: 'Maker batch classification (Standard run vs workshop micro-batch)',
      },
    },
    {
      name: 'edition_badge',
      type: 'text',
      admin: {
        description: 'Prominent badge tag for limited runs (e.g. "Only 3 Crafted", "Deadstock Duck Camo Edition")',
      },
    },
    {
      name: 'variation_notes',
      type: 'textarea',
      admin: {
        description:
          'Maker story for this variation (deadstock fabric provenance, sewing table notes, differences from standard silhouette)',
      },
    },
    {
      name: 'variation_images',
      type: 'array',
      admin: {
        description:
          'Quick workbench detail photos specific to this variation. Automatically prepended to the parent gallery on the PDP.',
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
