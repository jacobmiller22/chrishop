import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access';

/**
 * ProductLines Collection Schema (Paradigm 1: Hybrid Product-First)
 *
 * Optional narrative container for product families (e.g. "Alpine Chest Rig System", "Bushwhack Series").
 * Provides shared brand storytelling, lookbooks, and optional default price inheritance.
 * Products can associate with a line optionally, or exist completely standalone.
 */
export const ProductLines: CollectionConfig = {
  slug: 'product_lines',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'default_price', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
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
        description: 'Narrative line or capsule title (e.g. Alpine Chest Rig System)',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly slug for capsule lookbooks and series landing pages',
      },
    },
    {
      name: 'story',
      type: 'textarea',
      admin: {
        description: 'Shared narrative story, design philosophy, and field testing background',
      },
    },
    {
      name: 'default_price',
      type: 'number',
      min: 0,
      admin: {
        description: 'Optional default base price in USD. Inherited by child products that do not specify an override price.',
      },
    },
    {
      name: 'hero_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Capsule hero banner image',
      },
    },
    {
      name: 'lookbook_gallery',
      type: 'array',
      admin: {
        description: 'Atmospheric field lookbook photography for the entire product line',
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
  ],
};
