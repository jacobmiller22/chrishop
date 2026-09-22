import type { GlobalConfig } from 'payload';
import { isAdmin } from '../access';

export const FONT_PAIRING_PRESETS = [
  {
    label: 'Japanese Craft: Shippori Mincho (Display) + Plus Jakarta Sans (Body)',
    value: 'shippori_jakarta',
  },
  {
    label: 'Field Technical: Space Grotesk (Display) + IBM Plex Mono (Body)',
    value: 'space_plex',
  },
  {
    label: 'Editorial Alpine: Fraunces (Display) + Inter (Body)',
    value: 'fraunces_inter',
  },
] as const;

export const SURFACE_CANVAS_OPTIONS = [
  { label: 'Obsidian Night (#0F1215 - Default)', value: '#0F1215' },
  { label: 'Deep Basalt (#0B0E11)', value: '#0B0E11' },
  { label: 'Workshop Charcoal (#15191E)', value: '#15191E' },
] as const;

export const ThemeSettings: GlobalConfig = {
  slug: 'themeSettings',
  label: 'Theme & Typography Settings',
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      async () => {
        try {
          const { revalidatePath, revalidateTag } = await import('next/cache');
          revalidatePath('/', 'layout');
          (revalidateTag as any)('theme');
        } catch {
          // Graceful no-op in tests or build
        }
      },
    ],
  },
  fields: [
    {
      name: 'fontPreset',
      type: 'select',
      defaultValue: 'shippori_jakarta',
      required: true,
      options: [
        {
          label: 'Japanese Craft: Shippori Mincho (Display) + Plus Jakarta Sans (Body)',
          value: 'shippori_jakarta',
        },
        {
          label: 'Field Technical: Space Grotesk (Display) + IBM Plex Mono (Body)',
          value: 'space_plex',
        },
        {
          label: 'Editorial Alpine: Fraunces (Display) + Inter (Body)',
          value: 'fraunces_inter',
        },
      ],
      admin: {
        description: 'Choose typography pairings for display headlines and body text.',
      },
    },
    {
      name: 'surfaceCanvas',
      type: 'select',
      defaultValue: '#0F1215',
      required: true,
      options: [
        { label: 'Obsidian Night (#0F1215 - Default)', value: '#0F1215' },
        { label: 'Deep Basalt (#0B0E11)', value: '#0B0E11' },
        { label: 'Workshop Charcoal (#15191E)', value: '#15191E' },
      ],
      admin: {
        description: 'Primary storefront canvas background color.',
      },
    },
    {
      name: 'accentColor',
      type: 'text',
      defaultValue: '#E55B24',
      required: true,
      admin: {
        description: 'Brand accent color (default: Signal Hazard Orange #E55B24).',
      },
    },
    {
      name: 'hairlineBorder',
      type: 'select',
      defaultValue: 'subtle',
      options: [
        { label: 'Subtle Stone (border-stone-800/60)', value: 'subtle' },
        { label: 'Defined Contrast (border-stone-800/90)', value: 'defined' },
        { label: 'Blaze Accent (border-[#E55B24]/40)', value: 'blaze' },
      ],
      admin: {
        description: 'Border contrast intensity across cards and section dividers.',
      },
    },
  ],
};
