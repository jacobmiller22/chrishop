import type { PageBlock } from '../components/storefront/sections';

export interface StorefrontPage {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  layout: PageBlock[];
  meta?: {
    title?: string;
    description?: string;
  };
}

export const DEFAULT_HOMEPAGE_LAYOUT: PageBlock[] = [
  {
    blockType: 'hero',
    id: 'block-hero-1',
    layoutPreset: 'minimalist_overlay',
    headline: 'Curiosity > Fear.',
    subheadline: 'Hand-Sewn Technical Outdoor Gear',
    ethosStatement:
      'Patagonia-grade technical outerwear, convertible carry rigs, and field accessories crafted by Chris for anglers and bushwhackers who explore remote canyon banks on foot.',
    backdropImage: '/media/hero/bank-beaters-bg.jpg',
    badgeText: '⚡ Limited-Run Drop Live',
    provenanceCallout:
      'Single-needle lockstitched in Colorado · Micro-batches of 2–4 serialized pieces',
  },
  {
    blockType: 'featuredCollection',
    id: 'block-featured-1',
    title: 'Active Bank Equipment',
    subtitle: 'Small-Batch Roster',
    categoryFilter: 'all',
    limit: 6,
    showStartingPrice: true,
  },
  {
    blockType: 'craftsmanshipStory',
    id: 'block-craft-1',
    eyebrow: 'Craftsmanship & Provenance',
    headline: "The Maker's Bench",
    storyText:
      'In angling and bushwhacking culture, a Bank Beater is someone who explores shorelines, cut-banks, tidal marshes, and remote canyon pools on foot. Chris sews gear by hand in Leadville, CO using bombproof Cordura, X-Pac sailcloth, and bonded nylon thread.',
    pillars: [
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
  },
  {
    blockType: 'materialProvenance',
    id: 'block-materials-1',
    eyebrow: 'Technical Textiles',
    headline: 'Armor & Hardware Matrix',
    materials: [
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
  },
];

/**
 * Resolves storefront page layout configuration for a given slug.
 * Supports D1 dynamic queries with fallback to predefined modular layouts.
 */
export async function fetchPageBySlug(
  slug: string,
  d1Binding?: any
): Promise<StorefrontPage | null> {
  const normalizedSlug = slug.replace(/^\//, '') || 'homepage';

  // 1. Check for D1 database query if available
  const db =
    d1Binding ||
    (typeof globalThis !== 'undefined' && (globalThis as any).DB) ||
    (typeof globalThis !== 'undefined' &&
      (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env?.DB);

  if (db && typeof db.prepare === 'function') {
    try {
      const row = await db
        .prepare('SELECT * FROM pages WHERE slug = ? AND status = ? LIMIT 1')
        .bind(normalizedSlug, 'published')
        .first?.();

      if (row) {
        let layoutBlocks: PageBlock[] = [];
        if (row.layout_json) {
          try {
            layoutBlocks = JSON.parse(row.layout_json);
          } catch {}
        }

        return {
          id: String(row.id),
          title: row.title,
          slug: row.slug,
          status: row.status,
          layout: layoutBlocks.length > 0 ? layoutBlocks : DEFAULT_HOMEPAGE_LAYOUT,
          meta: {
            title: row.meta_title,
            description: row.meta_description,
          },
        };
      }
    } catch {
      // Graceful fallback to default layout if pages table is not yet migrated
    }
  }

  // 2. Return fallback layout for homepage
  if (normalizedSlug === 'homepage' || normalizedSlug === 'home') {
    return {
      id: 'page-homepage',
      title: 'BankBeaters Homepage',
      slug: 'homepage',
      status: 'published',
      layout: DEFAULT_HOMEPAGE_LAYOUT,
      meta: {
        title: 'BankBeaters Adventure Gear · Curiosity > Fear',
        description: 'Patagonia-grade technical outerwear, convertible carry rigs, and field accessories hand-sewn in Leadville, CO.',
      },
    };
  }

  return null;
}
