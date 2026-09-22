import type { Block } from 'payload';

export const HERO_PRESETS = [
  {
    label: 'Minimalist Overlay (Wabi-Sabi / Noir Full-Bleed with Vignette)',
    value: 'minimalist_overlay',
  },
  {
    label: 'Field Workshop (Split Editorial with Leadville Provenance)',
    value: 'field_workshop',
  },
  {
    label: 'Catalog Direct (High-Density Product Roster Header)',
    value: 'catalog_direct',
  },
] as const;

export const HeroBlock: Block = {
  slug: 'hero',
  labels: {
    singular: 'Hero Banner',
    plural: 'Hero Banners',
  },
  fields: [
    {
      name: 'layoutPreset',
      type: 'select',
      defaultValue: 'minimalist_overlay',
      required: true,
      options: [
        {
          label: 'Minimalist Overlay (Wabi-Sabi / Noir Full-Bleed with Vignette)',
          value: 'minimalist_overlay',
        },
        {
          label: 'Field Workshop (Split Editorial with Leadville Provenance)',
          value: 'field_workshop',
        },
        {
          label: 'Catalog Direct (High-Density Product Roster Header)',
          value: 'catalog_direct',
        },
      ],
      admin: {
        description:
          'Choose hero composition: full-bleed photographic overlay, split workshop editorial, or direct catalog header.',
      },
    },
    {
      name: 'headline',
      type: 'text',
      required: true,
      defaultValue: 'Curiosity > Fear.',
      admin: {
        description: 'Primary hero headline.',
      },
    },
    {
      name: 'subheadline',
      type: 'text',
      defaultValue: 'Hand-Sewn Technical Outdoor Gear',
      admin: {
        description: 'Top tracking eyebrow or subheadline.',
      },
    },
    {
      name: 'ethosStatement',
      type: 'textarea',
      defaultValue:
        'Patagonia-grade technical outerwear, convertible carry rigs, and field accessories crafted by Chris for anglers and bushwhackers who explore remote canyon banks on foot.',
      admin: {
        description: 'Core ethos or craft statement.',
      },
    },
    {
      name: 'backdropImage',
      type: 'text',
      defaultValue: '/media/hero/bank-beaters-bg.jpg',
      admin: {
        description: 'Path or URL to high-resolution photographic background (Cloudflare R2).',
      },
    },
    {
      name: 'backdropMedia',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Optional Payload Media asset reference for backdrop.',
      },
    },
    {
      name: 'badgeText',
      type: 'text',
      defaultValue: '⚡ Limited-Run Drop Live',
      admin: {
        description: 'Prominent badge label.',
      },
    },
    {
      name: 'provenanceCallout',
      type: 'text',
      defaultValue: 'Single-needle lockstitched in Leadville, CO · Micro-batches of 2–4 pieces',
      admin: {
        description: 'Craftsmanship provenance callout footer.',
      },
    },
    {
      name: 'ctaButtons',
      type: 'array',
      labels: {
        singular: 'Call to Action Button',
        plural: 'Call to Action Buttons',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'href',
          type: 'text',
          required: true,
        },
        {
          name: 'variant',
          type: 'select',
          defaultValue: 'primary',
          options: [
            { label: 'Primary (Signal Orange)', value: 'primary' },
            { label: 'Outline (Subtle Stone)', value: 'outline' },
            { label: 'Ghost', value: 'ghost' },
          ],
        },
      ],
    },
  ],
};
