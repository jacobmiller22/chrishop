import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import {
  verifyTurnstileToken,
  checkTurnstileRateLimit,
  resetTurnstileRateLimits,
  TURNSTILE_TEST_TOKENS,
} from '../../apps/web/src/lib/turnstile';
import { POST as verifyTurnstilePost } from '../../apps/web/src/app/api/checkout/verify-turnstile/route';
import { POST as cartCreatePost } from '../../apps/web/src/app/api/cart/create/route';
import { defaultShopifyMock } from '../../apps/web/src/lib/shopify-mock';
import { TurnstileWidget } from '../../packages/ui/src/components/TurnstileWidget';

describe('Story 3.10: Drop Rush Defense — Cloudflare Turnstile Verification on Cart Checkout Handshake', () => {
  const rootDir = path.resolve(__dirname, '../..');

  beforeEach(() => {
    resetTurnstileRateLimits();
    defaultShopifyMock.reset();
  });

  describe('1. Environment Configuration & Terraform Provisioning', () => {
    it('should verify Turnstile variables are declared in packages/config/src/env.ts', () => {
      const envTsPath = path.join(rootDir, 'packages/config/src/env.ts');
      const content = fs.readFileSync(envTsPath, 'utf-8');

      assert.ok(content.includes('CLOUDFLARE_TURNSTILE_SITE_KEY:'), 'Must declare CLOUDFLARE_TURNSTILE_SITE_KEY');
      assert.ok(content.includes('CLOUDFLARE_TURNSTILE_SECRET_KEY:'), 'Must declare CLOUDFLARE_TURNSTILE_SECRET_KEY');
      assert.ok(content.includes('NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY:'), 'Must declare NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY');
    });

    it('should verify Turnstile variables are documented in .env.example', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      const content = fs.readFileSync(envExamplePath, 'utf-8');

      assert.ok(content.includes('NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY='), 'Must document NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY');
      assert.ok(content.includes('CLOUDFLARE_TURNSTILE_SECRET_KEY='), 'Must document CLOUDFLARE_TURNSTILE_SECRET_KEY');
      assert.ok(content.includes('TURNSTILE_RATE_LIMIT_MAX='), 'Must document TURNSTILE_RATE_LIMIT_MAX');
    });

    it('should verify Turnstile widget resource in Terraform cloudflare_stack module', () => {
      const securityTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/security.tf');
      assert.ok(fs.existsSync(securityTfPath), 'security.tf must exist');
      const content = fs.readFileSync(securityTfPath, 'utf-8');

      assert.ok(content.includes('resource "cloudflare_turnstile_widget" "checkout"'), 'Must define Turnstile widget in Terraform');
      assert.ok(content.includes('mode       = "managed"'), 'Turnstile widget must use managed mode');
    });

    it('should verify Turnstile keys configured in wrangler.toml across environments', () => {
      const wranglerPath = path.join(rootDir, 'wrangler.toml');
      const content = fs.readFileSync(wranglerPath, 'utf-8');

      assert.ok(content.includes('NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"'), 'wrangler.toml must configure site key');
      assert.ok(content.includes('CLOUDFLARE_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"'), 'wrangler.toml must configure server site key');
    });
  });

  describe('2. Turnstile Verification Edge Route (/api/checkout/verify-turnstile)', () => {
    it('should validate valid Turnstile token and return 200 with rate limit headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.5',
        },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES }),
      });

      const res = await verifyTurnstilePost(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate');
      assert.ok(res.headers.has('X-RateLimit-Limit'));
      assert.ok(res.headers.has('X-RateLimit-Remaining'));

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.challengeTs);
    });

    it('should reject missing Turnstile token with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.6',
        },
        body: JSON.stringify({}),
      });

      const res = await verifyTurnstilePost(req);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error, 'Missing Turnstile challenge token');
    });

    it('should reject bot simulator tokens with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.7',
        },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS }),
      });

      const res = await verifyTurnstilePost(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error, 'Turnstile verification rejected');
      assert.ok(body.errorCodes.includes('invalid-input-response'));
    });
  });

  describe('3. Rate Limiting on Turnstile Verification Endpoint', () => {
    it('should allow requests within rate limit and return decrementing remaining counts', async () => {
      const ip = '198.51.100.20';
      const limit = 3;

      const r1 = await checkTurnstileRateLimit({ key: ip, limit, windowSeconds: 60 });
      assert.equal(r1.success, true);
      assert.equal(r1.remaining, 2);

      const r2 = await checkTurnstileRateLimit({ key: ip, limit, windowSeconds: 60 });
      assert.equal(r2.success, true);
      assert.equal(r2.remaining, 1);

      const r3 = await checkTurnstileRateLimit({ key: ip, limit, windowSeconds: 60 });
      assert.equal(r3.success, true);
      assert.equal(r3.remaining, 0);

      // 4th request exceeds limit
      const r4 = await checkTurnstileRateLimit({ key: ip, limit, windowSeconds: 60 });
      assert.equal(r4.success, false);
      assert.equal(r4.remaining, 0);
      assert.ok((r4.retryAfterSeconds ?? 0) > 0);
    });

    it('should enforce 429 Too Many Requests over HTTP when threshold is exceeded', async () => {
      const spammerIp = '198.51.100.99';
      process.env.TURNSTILE_RATE_LIMIT_MAX = '3';
      process.env.TURNSTILE_RATE_LIMIT_WINDOW = '30';

      for (let i = 0; i < 3; i++) {
        const req = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': spammerIp,
          },
          body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES }),
        });
        const res = await verifyTurnstilePost(req);
        assert.equal(res.status, 200, `Request ${i + 1} should be within rate limit`);
      }

      // 4th request from same IP exceeds rate limit
      const spamReq = new NextRequest('http://localhost:3000/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': spammerIp,
        },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES }),
      });
      const spamRes = await verifyTurnstilePost(spamReq);
      assert.equal(spamRes.status, 429);
      assert.ok(spamRes.headers.has('Retry-After'));
      assert.equal(spamRes.headers.get('X-RateLimit-Remaining'), '0');

      const body = await spamRes.json();
      assert.equal(body.success, false);
      assert.ok(body.error.includes('Rate limit exceeded'));

      // Clean up test environment overrides
      delete process.env.TURNSTILE_RATE_LIMIT_MAX;
      delete process.env.TURNSTILE_RATE_LIMIT_WINDOW;
    });

    it('should support Cloudflare Workers KV store for distributed rate limiting', async () => {
      const mockKvStore = new Map<string, string>();
      const mockKv = {
        async get(k: string, type?: string) {
          const val = mockKvStore.get(k);
          if (!val) return null;
          return type === 'json' ? JSON.parse(val) : val;
        },
        async put(k: string, val: string) {
          mockKvStore.set(k, val);
        },
      };

      const distributedIp = '203.0.113.77';
      const res1 = await checkTurnstileRateLimit({
        key: distributedIp,
        limit: 2,
        windowSeconds: 60,
        kv: mockKv,
      });
      assert.equal(res1.success, true);
      assert.equal(res1.remaining, 1);

      const res2 = await checkTurnstileRateLimit({
        key: distributedIp,
        limit: 2,
        windowSeconds: 60,
        kv: mockKv,
      });
      assert.equal(res2.success, true);
      assert.equal(res2.remaining, 0);

      // Exceeded via KV
      const res3 = await checkTurnstileRateLimit({
        key: distributedIp,
        limit: 2,
        windowSeconds: 60,
        kv: mockKv,
      });
      assert.equal(res3.success, false);
      assert.equal(res3.remaining, 0);
    });
  });

  describe('4. Cart Creation Handshake Protection (/api/cart/create)', () => {
    it('should block cart creation when Turnstile verification fails', async () => {
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.55',
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/101',
          quantity: 1,
          turnstileToken: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS,
        }),
      });

      const res = await cartCreatePost(req);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Bot challenge validation failed'));
    });

    it('should allow legitimate Turnstile token and forward buyer IP to Shopify', async () => {
      const legitimateBuyerIp = '198.51.100.88';
      const req = new NextRequest('http://localhost:3000/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': legitimateBuyerIp,
        },
        body: JSON.stringify({
          variantId: 'gid://shopify/ProductVariant/101',
          quantity: 1,
          turnstileToken: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES,
        }),
      });

      const res = await cartCreatePost(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.cart.checkoutUrl);
      assert.equal(defaultShopifyMock.lastBuyerIp, legitimateBuyerIp);
    });
  });

  describe('5. TurnstileWidget UI Component Export', () => {
    it('should export TurnstileWidget from @chrishop/ui', () => {
      assert.equal(typeof TurnstileWidget, 'function');
    });
  });
});
