import type { CollectionConfig } from 'payload';
import {
  HeroBlock,
  DropCountdownBlock,
  FeaturedCollectionBlock,
  CraftsmanshipStoryBlock,
  MaterialProvenanceBlock,
} from '../blocks';
import { revalidatePage } from './hooks/revalidatePage';
import { isAdmin, isAdminOrEditor } from '../access';

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: 'Page',
    plural: 'Pages',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [revalidatePage],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal page title (e.g. "Homepage", "About The Maker", "Spring 2026 Drop").',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL slug (e.g. "homepage", "about", "drops").',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'layout',
      type: 'blocks',
      required: true,
      labels: {
        singular: 'Section Block',
        plural: 'Section Blocks',
      },
      blocks: [
        HeroBlock,
        DropCountdownBlock,
        FeaturedCollectionBlock,
        CraftsmanshipStoryBlock,
        MaterialProvenanceBlock,
      ],
      admin: {
        description: 'Drag and drop blocks to customize the layout and section order of this page.',
      },
    },
    {
      name: 'meta',
      type: 'group',
      label: 'SEO & Metadata',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Meta Title',
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Meta Description',
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'OpenGraph Image',
        },
      ],
    },
  ],
};
