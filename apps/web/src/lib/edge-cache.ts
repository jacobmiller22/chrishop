/**
 * ChrisShop Edge Cache Control Configuration
 *
 * Defines standardized HTTP Cache-Control headers calibrated for high-concurrency
 * limited-edition flash drops on Cloudflare Workers and Cloudflare Edge CDN.
 *
 * Pattern: `public, s-maxage=10, stale-while-revalidate=50`
 * - s-maxage=10: Cloudflare Edge CDN caches product data for 10 seconds.
 * - stale-while-revalidate=50: Edge serves stale cached content for up to 50 additional seconds
 *   while asynchronously revalidating in the background, shielding D1 SQLite from spikes.
 *
 * Specification: Story 3.12 (#185) Acceptance Criteria 3
 */

export const FLASH_DROP_CACHE_CONTROL = 'public, s-maxage=10, stale-while-revalidate=50';
export const CATALOG_CACHE_CONTROL = 'public, s-maxage=10, stale-while-revalidate=50';
export const NO_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, proxy-revalidate';

export function getFlashDropCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': FLASH_DROP_CACHE_CONTROL,
    'CDN-Cache-Control': FLASH_DROP_CACHE_CONTROL,
    'Cloudflare-CDN-Cache-Control': FLASH_DROP_CACHE_CONTROL,
  };
}

export function applyFlashDropCacheHeaders<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', FLASH_DROP_CACHE_CONTROL);
  response.headers.set('CDN-Cache-Control', FLASH_DROP_CACHE_CONTROL);
  response.headers.set('Cloudflare-CDN-Cache-Control', FLASH_DROP_CACHE_CONTROL);
  return response;
}
