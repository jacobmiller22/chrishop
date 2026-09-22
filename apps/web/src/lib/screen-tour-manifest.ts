/**
 * ChrisShop Automated Screen Tour Registry & Manifest
 *
 * Story 4.11 (#153): Cloudflare Browser Rendering Automated Screen Tour Suite
 *
 * Catalogs all core storefront routes, Payload CMS views, and operations endpoints
 * with critical selectors, safety tiers, personas, and story provenance.
 */

export type ScreenCategory = 'storefront' | 'admin' | 'ops';
export type ScreenPersona = 'shopper' | 'creator' | 'engineering';
export type SafetyTier = 'safe_read' | 'mutating';

export interface ScreenDefinition {
  id: string;
  name: string;
  route: string;
  category: ScreenCategory;
  persona: ScreenPersona;
  criticalSelectors: string[];
  safetyTier: SafetyTier;
  description: string;
  provenance: string;
}

export const SCREEN_TOUR_MANIFEST: ScreenDefinition[] = [
  // ============================================================================
  // Storefront Screens (Shopper Persona)
  // ============================================================================
  {
    id: 'storefront.home',
    name: 'Storefront Home',
    route: '/',
    category: 'storefront',
    persona: 'shopper',
    criticalSelectors: ['nav', 'h1', 'main'],
    safetyTier: 'safe_read',
    description: 'Cinematic maker hero banner, featured drops, and BankBeaters narrative.',
    provenance: 'Story 1.16: Storefront UX Overhaul Suite',
  },
  {
    id: 'storefront.about',
    name: 'About & Workshop Vault',
    route: '/about',
    category: 'storefront',
    persona: 'shopper',
    criticalSelectors: ['h1', 'main'],
    safetyTier: 'safe_read',
    description: 'The Maker Story, Colorado workshop photography, and Lifetime Guarantee.',
    provenance: 'Story 1.16: Storefront UX Overhaul Suite',
  },
  {
    id: 'storefront.products',
    name: 'Product Catalog Grid',
    route: '/products',
    category: 'storefront',
    persona: 'shopper',
    criticalSelectors: ['main'],
    safetyTier: 'safe_read',
    description: 'Live catalog grid displaying active and upcoming micro-batch releases.',
    provenance: 'Story 2.18: Scaffold Payload CMS v3 with D1 SQLite Adapter',
  },
  {
    id: 'storefront.pdp',
    name: 'Product Detail Page (PDP)',
    route: '/products/leadville-fly-reel',
    category: 'storefront',
    persona: 'shopper',
    criticalSelectors: ['h1', 'main'],
    safetyTier: 'safe_read',
    description: 'High-conversion craft architecture, quick specs, and variant selection.',
    provenance: 'Story 1.16: PDP High-Conversion Craft Architecture',
  },
  {
    id: 'storefront.drop',
    name: 'Drop Countdown & Room',
    route: '/drop',
    category: 'storefront',
    persona: 'shopper',
    criticalSelectors: ['main'],
    safetyTier: 'safe_read',
    description: 'Real-time countdown timer synchronized with Workers KV edge state.',
    provenance: 'Story 3.1: Live Drop State Engine',
  },
  {
    id: 'storefront.cart',
    name: 'Cart Overview & Drawer',
    route: '/cart',
    category: 'storefront',
    persona: 'shopper',
    criticalSelectors: ['main'],
    safetyTier: 'safe_read',
    description: 'Shopper cart line items, pricing breakdown, and checkout action.',
    provenance: 'Story 3.2: Shopify Headless Checkout Integration',
  },

  // ============================================================================
  // Admin & Content Screens (Creator Persona)
  // ============================================================================
  {
    id: 'admin.login',
    name: 'Payload CMS Admin Portal',
    route: '/admin',
    category: 'admin',
    persona: 'creator',
    criticalSelectors: ['body'],
    safetyTier: 'safe_read',
    description: 'Authentication entry point and dashboard for content management.',
    provenance: 'Story 2.18: Payload CMS v3 on Cloudflare Workers',
  },
  {
    id: 'admin.collections_products',
    name: 'Payload Products Collection',
    route: '/admin/collections/products',
    category: 'admin',
    persona: 'creator',
    criticalSelectors: ['body'],
    safetyTier: 'safe_read',
    description: 'Product authoring, variant configurations, and inventory allocations.',
    provenance: 'Story 2.18: Scaffold Payload CMS v3 in apps/web',
  },
  {
    id: 'admin.collections_drops',
    name: 'Payload Drops Collection',
    route: '/admin/collections/drops',
    category: 'admin',
    persona: 'creator',
    criticalSelectors: ['body'],
    safetyTier: 'safe_read',
    description: 'Scheduled drop launch windows and countdown configuration.',
    provenance: 'Story 3.1: Live Drop State Engine & KV Sync',
  },
  {
    id: 'admin.drop_room',
    name: 'Creator Live Drop Room',
    route: '/admin/drop-room',
    category: 'admin',
    persona: 'creator',
    criticalSelectors: ['body'],
    safetyTier: 'safe_read',
    description: 'Chris live creator room with visitor counter and burn-down gauges.',
    provenance: 'Story 4.16: Dashboard Architecture Spike (Layer 1)',
  },

  // ============================================================================
  // Operations & Health Screens (Engineering Persona)
  // ============================================================================
  {
    id: 'ops.portal',
    name: 'Jacob Edge Ops Portal',
    route: '/ops',
    category: 'ops',
    persona: 'engineering',
    criticalSelectors: ['body'],
    safetyTier: 'safe_read',
    description: 'Low-level edge telemetry, D1 slow queries, and Cloudflare metrics.',
    provenance: 'Story 4.16: Dashboard Architecture Spike (Layer 2)',
  },
  {
    id: 'ops.health',
    name: 'Edge Health Synthetic Probe',
    route: '/api/health',
    category: 'ops',
    persona: 'engineering',
    criticalSelectors: ['body'],
    safetyTier: 'safe_read',
    description: 'Edge runtime heartbeat probe validating D1, KV, and R2 bindings.',
    provenance: 'Story 4.7: Better Stack Uptime Monitoring',
  },
];

/**
 * Filters the screen registry based on requested focus or categories.
 */
export function filterScreens(focus: 'all' | 'storefront' | 'admin' | 'ops' | 'recent'): ScreenDefinition[] {
  if (focus === 'storefront') {
    return SCREEN_TOUR_MANIFEST.filter((s) => s.category === 'storefront');
  }
  if (focus === 'admin') {
    return SCREEN_TOUR_MANIFEST.filter((s) => s.category === 'admin');
  }
  if (focus === 'ops') {
    return SCREEN_TOUR_MANIFEST.filter((s) => s.category === 'ops');
  }
  if (focus === 'recent') {
    // Focus on recent delivery phase milestones (Phase 4 / Phase 3)
    return SCREEN_TOUR_MANIFEST.filter(
      (s) =>
        s.provenance.includes('Story 4.16') ||
        s.provenance.includes('Story 4.7') ||
        s.provenance.includes('Story 1.16')
    );
  }
  return SCREEN_TOUR_MANIFEST;
}
