import type { Block } from 'payload';

export const MaterialProvenanceBlock: Block = {
  slug: 'materialProvenance',
  labels: {
    singular: 'Material Provenance & Armor',
    plural: 'Material Provenance Blocks',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      defaultValue: 'Technical Textiles',
    },
    {
      name: 'headline',
      type: 'text',
      required: true,
      defaultValue: 'Armor & Hardware Matrix',
    },
    {
      name: 'materials',
      type: 'array',
      labels: {
        singular: 'Material Spec',
        plural: 'Material Specs',
      },
      defaultValue: [
        {
          name: 'Toray 3-Layer Membrane',
          spec: '20,000mm / 20,000g Breathable DWR',
          badge: 'Outerwear Armor',
          description:
            'Japanese technical membrane providing complete waterproof storm protection under driving rains.',
        },
        {
          name: '500D / 1000D Mil-Spec Cordura®',
          spec: 'High-Tenacity Textured Nylon 6,6',
          badge: 'Abrasion Shield',
          description:
            'Rock-solid puncture and tear resistance for crawling over shale and through alder brush.',
        },
        {
          name: 'X-Pac® VX21 Sailcloth',
          spec: 'Multi-Ply Laminated Composite (210D Face)',
          badge: 'Waterproof Rig',
          description:
            'Ultra-rigid, zero-stretch composite fabric with integrated polyester X-PLY mesh for weatherproofing.',
        },
        {
          name: 'YKK® AquaGuard® Zippers',
          spec: 'Polyurethane Laminated Coil',
          badge: 'Storm Seal',
          description:
            'Water-repellent coil zippers engineered to keep internal tackle pouches bone-dry.',
        },
      ],
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'spec',
          type: 'text',
          required: true,
        },
        {
          name: 'badge',
          type: 'text',
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
