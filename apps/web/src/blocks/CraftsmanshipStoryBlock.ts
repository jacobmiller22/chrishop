import type { Block } from 'payload';

export const CraftsmanshipStoryBlock: Block = {
  slug: 'craftsmanshipStory',
  labels: {
    singular: 'Craftsmanship & Workbench Story',
    plural: 'Craftsmanship Stories',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      defaultValue: 'Craftsmanship & Provenance',
    },
    {
      name: 'headline',
      type: 'text',
      required: true,
      defaultValue: "The Maker's Bench",
    },
    {
      name: 'storyText',
      type: 'textarea',
      defaultValue:
        'In angling and bushwhacking culture, a Bank Beater is someone who explores shorelines, cut-banks, tidal marshes, and remote canyon pools on foot. Chris sews gear by hand in Leadville, CO using bombproof Cordura, X-Pac sailcloth, and bonded nylon thread.',
    },
    {
      name: 'pillars',
      type: 'array',
      labels: {
        singular: 'Craft Pillar',
        plural: 'Craft Pillars',
      },
      defaultValue: [
        {
          icon: '🛡️',
          title: 'Bombproof Construction',
          description:
            'Bar-tacked stress points, waterproof AquaGuard® zips, and reinforced high-wear zones engineered to outlast the harshest brambles.',
        },
        {
          icon: '🧵',
          title: 'Micro-Batch Agility',
          description:
            'Limited runs of 2–4 unique pieces using salvaged deadstock camouflage, custom pocketing, and hand-stamped serialized tags.',
        },
        {
          icon: '♻️',
          title: 'Lifetime Repair Guarantee',
          description:
            'Gear is built to be used, not displayed. If you shred an elbow crawling through briars, send it back to the workshop for field repair.',
        },
      ],
      fields: [
        {
          name: 'icon',
          type: 'text',
          defaultValue: '🧵',
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
        },
      ],
    },
  ],
};
