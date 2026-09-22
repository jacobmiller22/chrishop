import type { Block } from 'payload';

export const FeaturedCollectionBlock: Block = {
  slug: 'featuredCollection',
  labels: {
    singular: 'Featured Collection',
    plural: 'Featured Collections',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      defaultValue: 'Active Bank Equipment',
    },
    {
      name: 'subtitle',
      type: 'text',
      defaultValue: 'Small-Batch Roster',
    },
    {
      name: 'categoryFilter',
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: 'All Equipment Silhouettes', value: 'all' },
        { label: 'Technical Outerwear', value: 'outerwear' },
        { label: 'Packs & Carry Systems', value: 'packs-carry' },
        { label: 'Field Accessories', value: 'field-accessories' },
      ],
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 6,
      admin: {
        description: 'Maximum number of items to display.',
      },
    },
    {
      name: 'showStartingPrice',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Display "Starting at $X.XX" badge.',
      },
    },
  ],
};
