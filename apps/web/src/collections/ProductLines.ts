import type { CollectionConfig } from 'payload';

/**
 * ProductLines Collection Schema (Paradigm 3: Strict 3-Tier Hierarchy)
 *
 * Tier 1: Master Brand Line / Series Container (e.g. "Alpine Chest Rig System", "Bushwhack Series").
 * In strict 3-tier architecture, every product MUST belong to a product line.
 * Provides root storytelling and default price for cascading price inheritance.
 */
export const ProductLines: CollectionConfig = {
  slug: 'product_lines',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'default_price', 'updatedAt'],
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
        description: 'Unique product line identifier (e.g. line-alpine-chest-rig)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Narrative line or series title (e.g. Alpine Chest Rig System)',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly slug for series landing pages',
      },
    },
    {
      name: 'story',
      type: 'textarea',
      admin: {
        description: 'Shared narrative story and design philosophy across all silhouettes',
      },
    },
    {
      name: 'default_price',
      type: 'number',
      min: 0,
      admin: {
        description: 'Default tier-1 base price in USD. Inherited by child products and variations unless overridden.',
      },
    },
    {
      name: 'hero_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero editorial banner for the product line',
      },
    },
  ],
};
