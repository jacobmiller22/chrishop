import type { CollectionConfig } from 'payload';
import { syncProductToShopify } from './hooks/syncProductToShopify';

/**
 * Standard BankBeaters Technical Textile Presets (Story 3.19)
 */
export const MATERIAL_PRESET_MAP: Record<string, string> = {
  toray_cordura:
    '3-Layer DWR Toray Ripstop (20,000mm/20,000g), 500D Cordura® Panels, YKK AquaGuard®',
  stretch_cordura:
    'Heavyweight 4-Way Stretch DWR Ripstop, 1000D Cordura® Knee & Ankle Panels',
  xpac_vx21:
    'Waterproof X-Pac® VX21 Composite Sailcloth, 500D Cordura® Base, Hypalon Plier Dock',
  cordura_eva:
    '500D Mil-Spec Cordura®, High-Density Closed-Cell EVA Fly Patch',
  martexin_blaze:
    '12oz Martexin Original Waxed Canvas, 420D Hi-Vis Blaze Orange Packcloth',
  waxed_eva:
    'Dry-Finish Waxed Cotton Canvas, Floatable Closed-Cell EVA Foam Brim',
  dyneema_composite:
    'Dyneema® Composite Fabric (CT5K.18), YKK AquaGuard®',
};

export const MATERIAL_PRESET_OPTIONS = [
  { label: 'Toray 3-Layer Ripstop / 500D Cordura (Storm Shells)', value: 'toray_cordura' },
  { label: 'Heavyweight 4-Way Stretch DWR / 1000D Cordura (Brush Pants)', value: 'stretch_cordura' },
  { label: 'Waterproof X-Pac® VX21 / 500D Cordura (Packs & Slings)', value: 'xpac_vx21' },
  { label: '500D Mil-Spec Cordura / High-Density EVA (Chest Rigs)', value: 'cordura_eva' },
  { label: '12oz Martexin Waxed Canvas / Blaze Packcloth (Tool Rolls)', value: 'martexin_blaze' },
  { label: 'Dry-Finish Waxed Canvas / Floatable EVA Brim (Caps)', value: 'waxed_eva' },
  { label: 'Dyneema® Composite Fabric CT5K.18 (Ultralight)', value: 'dyneema_composite' },
  { label: 'Custom Specification', value: 'custom' },
];

export const FIT_PROFILE_OPTIONS = [
  {
    label: 'Technical Straight (Articulated knees, gusseted seat for cut-bank scrambles)',
    value: 'Technical Straight (Articulated knees, gusseted seat for steep cut-bank scrambles)',
  },
  {
    label: 'Relaxed Athletic (Engineered for layering and overhead casting mobility)',
    value: 'Relaxed Athletic (Engineered for layering and overhead casting mobility)',
  },
  {
    label: 'Low-Profile 4-Point Harness (Rides high above deep wading lines)',
    value: 'Low-Profile 4-Point Harness (Rides high above deep wading lines)',
  },
  {
    label: 'Ambidextrous Sling / Lumbar Switchable (Breathable 3D Spacer Mesh)',
    value: 'Ambidextrous Sling / Lumbar Switchable with Breathable 3D Spacer Mesh',
  },
  {
    label: 'Tri-Fold Compact (Fits into thigh pocket or pack sleeve)',
    value: 'Tri-Fold Compact (Fits into any thigh pocket or pack exterior sleeve)',
  },
  {
    label: 'Low Crown 5-Panel with Nylon Webbing Adjuster',
    value: 'Low Crown 5-Panel with Nylon Webbing Quick-Release Adjuster',
  },
  {
    label: 'Standard True-to-Size Workshop Spec',
    value: 'Standard True-to-Size Workshop Spec',
  },
  {
    label: 'Custom Spec / Workbench Fit',
    value: 'Custom Spec / Workbench Fit',
  },
];

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
    beforeChange: [
      ({ data }) => {
        if (data) {
          // Auto-populate materials from material_preset if materials is not set or empty
          if (
            data.material_preset &&
            data.material_preset in MATERIAL_PRESET_MAP &&
            (!data.materials || (typeof data.materials === 'string' && data.materials.trim() === ''))
          ) {
            data.materials = MATERIAL_PRESET_MAP[data.material_preset];
          }
        }
        return data;
      },
    ],
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
      name: 'material_preset',
      type: 'select',
      options: MATERIAL_PRESET_OPTIONS,
      admin: {
        description: 'Standard BankBeaters technical textile preset. Auto-populates Materials field when left blank.',
      },
    },
    {
      name: 'materials',
      type: 'text',
      admin: {
        description: 'Technical fabric specs and hardware. Auto-filled from Material Preset or customizable.',
      },
    },
    {
      name: 'weight',
      type: 'text',
      admin: {
        description: 'Garment or pack weight (e.g. 21.4 oz (606g))',
      },
    },
    {
      name: 'fit_profile',
      type: 'select',
      options: FIT_PROFILE_OPTIONS,
      admin: {
        description: 'Controlled fit characteristics or carrying ergonomics preset',
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
