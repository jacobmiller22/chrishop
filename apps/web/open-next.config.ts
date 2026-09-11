import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext Cloudflare Configuration for ChrisShop (@chrishop/web)
 *
 * Implements the approved multi-worker route splitting architecture (DOC-ARCH-2026-SPIKE-2.27):
 * - Default function: Lean public storefront (<3.5MB uncompressed, <220ms cold start)
 * - Admin function: Dedicated worker for Payload CMS v3 editorial & management routes
 */
const config = defineCloudflareConfig();

config.functions = {
  admin: {
    routes: [
      'app/(payload)/admin/[[...segments]]/page',
      'app/(payload)/api/[...slug]/route',
      'app/(payload)/api/graphql/route',
    ],
    patterns: ['admin/*', 'api/payload/*'],
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
    },
  },
};

export default config;
