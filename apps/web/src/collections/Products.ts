import type { CollectionConfig } from 'payload';

/**
 * Products Collection Schema (Paradigm 4: Recursive Node Tree / Directed Acyclic Graph)
 *
 * "A product is a node in a tree".
 * Models arbitrary hierarchical depth using self-referential parent_id links.
 * Each node declares a role (collection, model, item) and can inherit price,
 * provenance, and editorial metadata from its ancestor chain via recursive CTEs.
 */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'node_role', 'parent_id', 'base_price', 'status', 'updatedAt'],
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
        description: 'Unique node identifier (e.g. node-alpine-chest-rig)',
      },
    },
    {
      name: 'parent_id',
      type: 'relationship',
      relationTo: 'products' as any,
      hasMany: false,
      admin: {
        description: 'Self-referential parent node in the catalog tree (NULL for root nodes)',
      },
    },
    {
      name: 'node_role',
      type: 'select',
      required: true,
      defaultValue: 'model',
      options: [
        { label: 'Collection / Series (Root)', value: 'collection' },
        { label: 'Model / Silhouette (Branch)', value: 'model' },
        { label: 'Item / SKU / Edition (Leaf)', value: 'item' },
      ],
      admin: {
        description: 'Hierarchical role within the recursive tree graph',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Node title or garment/pack name',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly slug for storefront routing',
      },
    },
    {
      name: 'sku',
      type: 'text',
      admin: {
        description: 'SKU identifier for purchaseable leaf items',
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
        description: 'Base price in USD. If overridden in ancestor/descendant, resolved via recursive CTE.',
      },
    },
    {
      name: 'price',
      type: 'number',
      min: 0,
      admin: {
        description: 'Optional explicit price override. Inherits from parent node if omitted.',
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
        description: 'Lifecycle state of the node',
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
        description: 'Rich-text description and technical specs',
      },
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
        description: 'Primary hero image',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      admin: {
        description: 'High-resolution photo gallery',
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
