import type { Block } from 'payload';

export const DropCountdownBlock: Block = {
  slug: 'dropCountdown',
  labels: {
    singular: 'Drop Countdown',
    plural: 'Drop Countdowns',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      defaultValue: 'Next Micro-Batch Drop',
    },
    {
      name: 'subtitle',
      type: 'text',
      defaultValue: 'Leadville Workshop Batch Release',
    },
    {
      name: 'targetDate',
      type: 'date',
      admin: {
        description: 'Scheduled release timestamp for countdown timer.',
      },
    },
    {
      name: 'ctaText',
      type: 'text',
      defaultValue: 'Get Field Dispatch Alert →',
    },
    {
      name: 'ctaHref',
      type: 'text',
      defaultValue: '/drops',
    },
    {
      name: 'teaserNotes',
      type: 'textarea',
      defaultValue:
        'Small batch run of serialized Alpine Chest Rigs sewn from salvaged multicam sailcloth.',
    },
  ],
};
