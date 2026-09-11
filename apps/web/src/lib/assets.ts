/**
 * Cloudflare R2 Media Asset URL Resolver
 * Resolves storage keys to public CDN URLs (client-safe)
 */
export function getAssetUrl(fileOrKey?: string | { id?: string; url?: string } | null): string | null {
  if (!fileOrKey) return null;

  if (typeof fileOrKey === 'object') {
    if (fileOrKey.url) return fileOrKey.url;
    if (fileOrKey.id) return getAssetUrl(fileOrKey.id);
    return null;
  }

  const key = fileOrKey.trim();
  if (!key) return null;

  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  const baseUrl = (process.env.NEXT_PUBLIC_R2_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://media.chrishop.jacobmiller22.com').replace(/\/+$/, '');
  const cleanKey = key.replace(/^\/+/, '');
  return `${baseUrl}/${cleanKey}`;
}
