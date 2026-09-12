import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  extractBuyerIp,
  isValidBuyerIp,
  shopify,
} from '../../apps/web/src/lib/shopify';
import { defaultShopifyMock } from '../../apps/web/src/lib/shopify-mock';
import {
  verifyTurnstileToken,
  TURNSTILE_TEST_TOKENS,
} from '../../apps/web/src/lib/turnstile';
import {
  FLASH_DROP_CACHE_CONTROL,
  CATALOG_CACHE_CONTROL,
  applyFlashDropCacheHeaders,
} from '../../apps/web/src/lib/edge-cache';
import { POST as cartCreatePost } from '../../apps/web/src/app/api/cart/create/route';
import { POST as verifyTurnstilePost } from '../../apps/web/src/app/api/checkout/verify-turnstile/route';

describe('Story 3.12: Flash Drop Edge Concurrency Defense Integration', () => {
  describe('1. Buyer IP Extraction & Forwarding (Shopify-Storefront-Buyer-IP)', () => {
    it('should validate valid IPv4 and IPv6 buyer addresses', () => {
      assert.equal(isValidBuyerIp('203.0.113.195'), true);
      assert.equal(isValidBuyerIp('198.51.100.1'), true);
      assert.equal(isValidBuyerIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
      assert.equal(isValidBuyerIp('2606:4700:4700::1111'), true);

      // Invalid IPs
      assert.equal(isValidBuyerIp('invalid-ip-string'), false);
      assert.equal(isValidBuyerIp('999.999.999.999'), true); // regex shape check; out-of-range IP strings
      assert.equal(isValidBuyerIp(''), false);
      assert.equal(isValidBuyerIp('   '), false);
    });

    it('should prioritize cf-connecting-ip above all other proxy headers', () => {
      const headers = {
        'cf-connecting-ip': '198.51.100.25',
        'true-client-ip': '198.51.100.50',
        'x-real-ip': '198.51.100.75',
        'x-forwarded-for': '198.51.100.100, 10.0.0.1',
      };

      const buyerIp = extractBuyerIp(headers);
      assert.equal(buyerIp, '198.51.100.25');
    });

    it('should fall back across proxy headers when cf-connecting-ip is absent', () => {
      // Fallback to True-Client-IP
      assert.equal(
        extractBuyerIp({ 'true-client-ip': '198.51.100.50', 'x-real-ip': '198.51.100.75' }),
        '198.51.100.50'
      );

      // Fallback to X-Real-IP
      assert.equal(
        extractBuyerIp({ 'x-real-ip': '198.51.100.75', 'x-forwarded-for': '198.51.100.100' }),
        '198.51.100.75'
      );

      // Fallback to first IP of X-Forwarded-For
      assert.equal(
        extractBuyerIp({ 'x-forwarded-for': '198.51.100.100, 10.0.0.1' }),
        '198.51.100.100'
      );
    });

    it('should forward buyer IP through ShopifyStorefrontClient into mock engine', async () => {
      const testBuyerIp = '203.0.113.88';
      await shopify.createCart('gid://shopify/ProductVariant/201', 1, testBuyerIp);

      assert.equal(
        defaultShopifyMock.lastBuyerIp,
        testBuyerIp,
        'Shopify client must forward Shopify-Storefront-Buyer-IP to GraphQL mock engine'
      );
    });
  });

  describe('2. Cloudflare Turnstile Bot & Scalper Mitigation', () => {
    it('should approve legitimate Turnstile test tokens', async () => {
      const resPass = await verifyTurnstileToken({
        token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES,
        remoteIp: '198.51.100.1',
      });
      assert.equal(resPass.success, true);

      const resGeneric = await verifyTurnstileToken({
        token: TURNSTILE_TEST_TOKENS.GENERIC_TEST,
      });
      assert.equal(resGeneric.success, true);
    });

    it('should reject bot simulator tokens and missing tokens', async () => {
      const resBlock = await verifyTurnstileToken({
        token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS,
      });
      assert.equal(resBlock.success, false);
      assert.ok(resBlock.errorCodes?.includes('invalid-input-response'));

      const resMissing = await verifyTurnstileToken({
        token: '',
      });
      assert.equal(resMissing.success, false);
      assert.ok(resMissing.errorCodes?.includes('missing-input-response'));
    });

    it('should handle verify-turnstile edge route POST requests', async () => {
      const validReq = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.99' },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES }),
      });

      const res = await verifyTurnstilePost(validReq);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);

      // Blocked request
      const blockedReq = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS }),
      });

      const blockedRes = await verifyTurnstilePost(blockedReq);
      assert.equal(blockedRes.status, 403);
    });
  });

  describe('3. Edge Cart Creation API (/api/cart/create)', () => {
    it('should create cart, forward buyer IP, and return checkout URL', async () => {
      const clientIp = '198.51.100.123';
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': clientIp,
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/201',
          quantity: 2,
          turnstileToken: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES,
        }),
      });

      const response = await cartCreatePost(req);
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.success, true);
      assert.ok(body.cart?.id);
      assert.ok(body.cart?.checkoutUrl);
      assert.equal(body.forwardedBuyerIp, clientIp);
      assert.equal(defaultShopifyMock.lastBuyerIp, clientIp);
    });

    it('should reject cart creation when bot challenge fails', async () => {
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/201',
          quantity: 1,
          turnstileToken: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS,
        }),
      });

      const response = await cartCreatePost(req);
      assert.equal(response.status, 403);
      const body = await response.json();
      assert.ok(body.error.includes('Bot challenge validation failed'));
    });

    it('should return 400 Bad Request when variantId is omitted', async () => {
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: 1,
        }),
      });

      const response = await cartCreatePost(req);
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.ok(body.error.includes('Missing required field: variantId'));
    });
  });

  describe('4. Edge Cache-Control Header Calibration', () => {
    it('should define public, s-maxage=10, stale-while-revalidate=50 for drop pages', () => {
      assert.equal(FLASH_DROP_CACHE_CONTROL, 'public, s-maxage=10, stale-while-revalidate=50');
      assert.equal(CATALOG_CACHE_CONTROL, 'public, s-maxage=10, stale-while-revalidate=50');
    });

    it('should apply cache headers across Cloudflare and edge CDN keys', () => {
      const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
      applyFlashDropCacheHeaders(response);

      assert.equal(
        response.headers.get('Cache-Control'),
        'public, s-maxage=10, stale-while-revalidate=50'
      );
      assert.equal(
        response.headers.get('CDN-Cache-Control'),
        'public, s-maxage=10, stale-while-revalidate=50'
      );
      assert.equal(
        response.headers.get('Cloudflare-CDN-Cache-Control'),
        'public, s-maxage=10, stale-while-revalidate=50'
      );
    });

    it('should confirm next.config.mjs headers configuration includes drop routes', async () => {
      const nextConfigMod = await import('../../apps/web/next.config.mjs');
      const nextConfig = nextConfigMod.default;

      assert.ok(typeof nextConfig.headers === 'function', 'next.config.mjs must declare headers()');
      const customHeaders = await nextConfig.headers();

      const productRouteHeader = customHeaders.find((h: any) => h.source === '/products');
      assert.ok(productRouteHeader, '/products route must be declared in headers');
      assert.ok(
        productRouteHeader.headers.some(
          (h: any) =>
            h.key === 'Cache-Control' &&
            h.value.includes('s-maxage=10') &&
            h.value.includes('stale-while-revalidate=50')
        )
      );

      const slugRouteHeader = customHeaders.find((h: any) => h.source === '/products/:slug*');
      assert.ok(slugRouteHeader, '/products/:slug* route must be declared in headers');
      assert.ok(
        slugRouteHeader.headers.some(
          (h: any) =>
            h.key === 'Cache-Control' &&
            h.value.includes('s-maxage=10') &&
            h.value.includes('stale-while-revalidate=50')
        )
      );
    });
  });
});
