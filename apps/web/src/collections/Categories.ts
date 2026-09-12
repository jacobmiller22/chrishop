import type { CollectionConfig } from 'payload';

/**
 * Categories Collection Schema
 *
 * Defines product category taxonomy (e.g., "Original Sculptures", "Fine Art Prints")
 * per HLD Section 3.2 and Story 2.18.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Category name (e.g. Original Sculptures, Fine Art Prints)',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly category slug for filtering and navigation',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      admin: {
        description: 'Parent category for hierarchical nesting (supports depth-2 category navigation)',
      },
      validate: (value: any, { id }: any) => {
        if (value && id && (value === id || value?.id === id)) {
          return 'A category cannot be its own parent (self-parenting cycle detected).';
        }
        return true;
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Editorial description of the adventure gear category',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero cover image for the category',
      },
    },
  ],
};
