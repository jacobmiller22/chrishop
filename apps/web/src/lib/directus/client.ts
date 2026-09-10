import { createDirectus, rest } from '@directus/sdk';
import type { DirectusSchema } from './types';

/**
 * Default ISR caching revalidation TTL (60 seconds) per HIGH_LEVEL_DESIGN Section 10.
 */
export const DEFAULT_CATALOG_REVALIDATE = 60;

/**
 * Resolve the Directus CMS base URL from environment variables, falling back
 * to the standard local dev stack port (8055).
 */
export function getDirectusUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_CMS_URL ||
    process.env.DIRECTUS_URL ||
    'http://localhost:8055'
  );
}

export interface DirectusClientOptions {
  url?: string;
  revalidate?: number;
  fetch?: typeof fetch;
}

export type DirectusRestClient = ReturnType<typeof createDirectusClient>;

/**
 * Factory to create a typed Directus SDK REST client with Next.js ISR fetch caching.
 */
export function createDirectusClient(options?: DirectusClientOptions) {
  const baseUrl = options?.url || getDirectusUrl();
  const revalidateSeconds = options?.revalidate ?? DEFAULT_CATALOG_REVALIDATE;
  const customFetch = options?.fetch;

  return createDirectus<DirectusSchema>(baseUrl, {
    globals: customFetch ? { fetch: customFetch } : undefined,
  }).with(
    rest({
      onRequest: (request) => {
        return {
          ...request,
          // Next.js ISR caching extension for fetch
          next: {
            revalidate: revalidateSeconds,
            tags: ['directus', 'catalog'],
          },
        } as unknown as RequestInit;
      },
    })
  );
}

// ============================================================================
// Singleton Client Instance
// ============================================================================

let singletonClient: DirectusRestClient | null = null;

/**
 * Get or initialize the singleton Directus REST client.
 */
export function getDirectusClient(options?: DirectusClientOptions): DirectusRestClient {
  if (!options && singletonClient) {
    return singletonClient;
  }

  const client = createDirectusClient(options);

  if (!options) {
    singletonClient = client;
  }

  return client;
}

/**
 * Reset the singleton client (useful for unit testing with custom environment or mocks).
 */
export function resetDirectusClient(): void {
  singletonClient = null;
}

/**
 * Singleton Directus REST client export for general usage.
 */
export const directus = getDirectusClient();

// ============================================================================
// Image & Media URL Resolver (MinIO / Directus Assets)
// ============================================================================

/**
 * Formats a Directus file ID or object into a fully-qualified asset URL.
 * Transparently supports direct absolute URLs (e.g. MinIO/R2) or Directus asset UUIDs.
 */
export function getAssetUrl(fileOrId?: string | { id: string } | null): string | null {
  if (!fileOrId) return null;
  const id = typeof fileOrId === 'string' ? fileOrId : fileOrId.id;
  if (!id) return null;
  if (id.startsWith('http://') || id.startsWith('https://')) {
    return id;
  }
  const baseUrl = getDirectusUrl().replace(/\/+$/, '');
  return `${baseUrl}/assets/${id}`;
}
