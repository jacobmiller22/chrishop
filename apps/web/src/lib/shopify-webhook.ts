import { verifyShopifyWebhookHmac } from './order-consumer';

// In-memory fallback cache for deduplication when KV binding is absent
export const inMemoryWebhookStore = new Map<string, number>();

/**
 * Resets the in-memory idempotency cache (used by unit and integration tests).
 */
export function resetWebhookIdempotencyCache(): void {
  inMemoryWebhookStore.clear();
}

/**
 * Validates Shopify HMAC-SHA256 signature using Web Crypto API (crypto.subtle)
 * with constant-time comparison for Cloudflare Edge and Node.js runtimes.
 */
export async function verifyShopifyWebhookHmacSubtle(
  rawBody: string,
  hmacHeader: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) {
    return true;
  }
  if (!rawBody || !hmacHeader) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const subtle =
      globalThis.crypto?.subtle ||
      ((await import('node:crypto')).webcrypto as unknown as Crypto)?.subtle;

    if (!subtle) {
      return verifyShopifyWebhookHmac(rawBody, hmacHeader, secret);
    }

    const key = await subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const bodyData = encoder.encode(rawBody);
    const signatureBuffer = await subtle.sign('HMAC', key, bodyData);

    const signatureBytes = new Uint8Array(signatureBuffer);
    let binary = '';
    for (let i = 0; i < signatureBytes.byteLength; i++) {
      binary += String.fromCharCode(signatureBytes[i]);
    }
    const computedHmac =
      typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(signatureBuffer).toString('base64');

    const expectedBuffer = Buffer.from(computedHmac, 'utf8');
    const actualBuffer = Buffer.from(hmacHeader, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    const nodeCrypto = await import('node:crypto').catch(() => null);
    if (nodeCrypto && typeof nodeCrypto.timingSafeEqual === 'function') {
      return nodeCrypto.timingSafeEqual(expectedBuffer, actualBuffer);
    }

    let mismatch = 0;
    for (let i = 0; i < expectedBuffer.length; i++) {
      mismatch |= expectedBuffer[i] ^ actualBuffer[i];
    }
    return mismatch === 0;
  } catch (err) {
    console.warn('[ShopifyWebhook:HmacSubtleError]', err);
    return false;
  }
}

/**
 * Idempotency Gate: checks if a webhook event ID has already been received.
 * Checks Cloudflare Workers KV (NEXT_CACHE_WORKERS_KV) with an in-memory fallback.
 * Uses a default TTL of 86400 seconds (24 hours).
 */
export async function checkAndSetIdempotency(
  webhookId: string,
  kv?: any,
  ttlSeconds: number = 86400
): Promise<{ isDuplicate: boolean }> {
  const key = `order_webhook:${webhookId}`;
  const now = Date.now();

  // 1. Cloudflare Workers KV Check & Set
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    try {
      const existing = await kv.get(key);
      if (existing !== null && existing !== undefined) {
        return { isDuplicate: true };
      }
      await kv.put(key, new Date().toISOString(), { expirationTtl: ttlSeconds });
      // Keep in-memory cache in sync
      inMemoryWebhookStore.set(key, now + ttlSeconds * 1000);
      return { isDuplicate: false };
    } catch (kvErr) {
      console.warn(
        '[ShopifyWebhook:KVIdempotencyWarning] KV lookup failed, falling back to memory store:',
        kvErr
      );
    }
  }

  // 2. In-Memory Cache Check & Set
  // Prune expired entries
  for (const [k, expiresAt] of inMemoryWebhookStore.entries()) {
    if (expiresAt <= now) {
      inMemoryWebhookStore.delete(k);
    }
  }

  const existingExpire = inMemoryWebhookStore.get(key);
  if (existingExpire && existingExpire > now) {
    return { isDuplicate: true };
  }

  inMemoryWebhookStore.set(key, now + ttlSeconds * 1000);
  return { isDuplicate: false };
}
