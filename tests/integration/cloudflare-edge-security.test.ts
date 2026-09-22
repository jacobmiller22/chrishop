import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { POST as verifyTurnstileHandler } from '../../apps/web/src/app/api/checkout/verify-turnstile/route';
import {
  verifyTurnstileToken,
  TURNSTILE_TEST_TOKENS,
  resetTurnstileRateLimits,
} from '../../apps/web/src/lib/turnstile';
import { verifyCloudflareEdgeSecurity } from '../../scripts/verify-cloudflare-edge-security';

describe('Story 5.5: Cloudflare Integration — WAF, CDN & DDoS Protection', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const securityTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/security.tf');
  const cacheTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/cache.tf');
  const outputsTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/outputs.tf');

  beforeEach(() => {
    resetTurnstileRateLimits();
  });

  afterEach(() => {
    resetTurnstileRateLimits();
  });

  // ==========================================================================
  // 1. Cloudflare WAF Custom Ruleset & False-Positive Avoidance
  // ==========================================================================
  describe('1. Cloudflare WAF Custom Ruleset Configuration', () => {
    it('should define cloudflare_ruleset.waf_custom with webhook bypass and threat challenge', () => {
      assert.ok(fs.existsSync(securityTfPath), 'security.tf must exist');
      const content = fs.readFileSync(securityTfPath, 'utf-8');

      assert.ok(
        content.includes('resource "cloudflare_ruleset" "waf_custom"'),
        'Must define cloudflare_ruleset.waf_custom'
      );
      assert.ok(
        content.includes('phase       = "http_request_firewall_custom"'),
        'WAF ruleset phase must be http_request_firewall_custom'
      );
      assert.ok(
        content.includes('action = "skip"'),
        'Must declare skip action for Shopify webhook bypass'
      );
      assert.ok(
        content.includes('/api/orders/webhook'),
        'Webhook bypass must explicitly target /api/orders/webhook'
      );
      assert.ok(
        content.includes('action      = "managed_challenge"'),
        'Must declare managed_challenge for high threat scores'
      );
      assert.ok(
        content.includes('cf.threat_score gt 30'),
        'Managed challenge must evaluate threat score > 30'
      );
    });

    it('should export waf_ruleset_id in terraform outputs', () => {
      const content = fs.readFileSync(outputsTfPath, 'utf-8');
      assert.ok(content.includes('output "waf_ruleset_id"'), 'Must export waf_ruleset_id output');
    });
  });

  // ==========================================================================
  // 2. Edge DDoS Rate Limiting for Cart & Checkout
  // ==========================================================================
  describe('2. Edge Rate Limiting Policies', () => {
    it('should define cloudflare_ruleset.rate_limiting targeting cart and checkout handshakes', () => {
      const content = fs.readFileSync(securityTfPath, 'utf-8');

      assert.ok(
        content.includes('resource "cloudflare_ruleset" "rate_limiting"'),
        'Must define cloudflare_ruleset.rate_limiting'
      );
      assert.ok(
        content.includes('phase       = "http_ratelimit"'),
        'Rate limit phase must be http_ratelimit'
      );
      assert.ok(
        content.includes('requests_per_period = 30'),
        'Must rate limit to 30 requests per period'
      );
      assert.ok(
        content.includes('period              = 60'),
        'Period must be 60 seconds'
      );
      assert.ok(
        content.includes('action = "managed_challenge"'),
        'Action on rate limit exceeded must be managed_challenge'
      );
      assert.ok(
        content.includes('/api/cart'),
        'Rate limiting rule must match /api/cart'
      );
      assert.ok(
        content.includes('/api/checkout'),
        'Rate limiting rule must match /api/checkout'
      );
    });

    it('should export rate_limit_ruleset_id in terraform outputs', () => {
      const content = fs.readFileSync(outputsTfPath, 'utf-8');
      assert.ok(
        content.includes('output "rate_limit_ruleset_id"'),
        'Must export rate_limit_ruleset_id output'
      );
    });
  });

  // ==========================================================================
  // 3. Turnstile Bot Protection & Public Submission Guardrails
  // ==========================================================================
  describe('3. Cloudflare Turnstile Bot Defense & Handshake Verification', () => {
    it('should provision cloudflare_turnstile_widget in terraform with managed mode', () => {
      const content = fs.readFileSync(securityTfPath, 'utf-8');
      assert.ok(
        content.includes('resource "cloudflare_turnstile_widget" "checkout"'),
        'Must declare cloudflare_turnstile_widget.checkout'
      );
      assert.ok(
        content.includes('mode       = "managed"'),
        'Turnstile widget mode must be managed'
      );
    });

    it('should verify Turnstile tokens using server-side SDK helper', async () => {
      const passResult = await verifyTurnstileToken({
        token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES,
      });
      assert.equal(passResult.success, true, 'ALWAYS_PASSES token must verify successfully');

      const blockResult = await verifyTurnstileToken({
        token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS,
      });
      assert.equal(blockResult.success, false, 'ALWAYS_BLOCKS token must be rejected');
    });

    it('should protect /api/checkout/verify-turnstile endpoint with token verification and rate limiting', async () => {
      // Valid token request
      const validReq = new NextRequest('https://chrishop.jacobmiller22.com/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES }),
      });
      const validRes = await verifyTurnstileHandler(validReq);
      assert.equal(validRes.status, 200);
      const validJson = await validRes.json();
      assert.equal(validJson.success, true);

      // Missing token request
      const missingReq = new NextRequest('https://chrishop.jacobmiller22.com/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const missingRes = await verifyTurnstileHandler(missingReq);
      assert.equal(missingRes.status, 400);

      // Invalid token request
      const invalidReq = new NextRequest('https://chrishop.jacobmiller22.com/api/checkout/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS }),
      });
      const invalidRes = await verifyTurnstileHandler(invalidReq);
      assert.equal(invalidRes.status, 403);
    });
  });

  // ==========================================================================
  // 4. Edge CDN Caching & Immutable Media Delivery
  // ==========================================================================
  describe('4. Edge CDN Caching and Page Rules', () => {
    it('should configure 1-year immutable edge caching for static assets and R2 media', () => {
      assert.ok(fs.existsSync(cacheTfPath), 'cache.tf must exist');
      const content = fs.readFileSync(cacheTfPath, 'utf-8');

      assert.ok(
        content.includes('resource "cloudflare_page_rule" "cache_static_assets"'),
        'Must define cache_static_assets page rule'
      );
      assert.ok(
        content.includes('target   = "*${var.zone_name}/_next/static/*"'),
        'Static cache rule must target /_next/static/*'
      );
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "cache_media"'),
        'Must define cache_media page rule'
      );
      assert.ok(
        content.includes('target   = "*${var.zone_name}/media/*"'),
        'Media cache rule must target /media/*'
      );
      assert.ok(
        content.includes('edge_cache_ttl    = 31536000'),
        'Edge cache TTL must be 1 year (31536000s)'
      );
    });

    it('should bypass cache for administrative and dynamic API endpoints', () => {
      const content = fs.readFileSync(cacheTfPath, 'utf-8');
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "bypass_admin"'),
        'Must define bypass_admin page rule'
      );
      assert.ok(
        content.includes('resource "cloudflare_page_rule" "bypass_api"'),
        'Must define bypass_api page rule'
      );
      assert.ok(
        content.includes('cache_level = "bypass"'),
        'Must enforce bypass cache level'
      );
    });
  });

  // ==========================================================================
  // 5. TLS 1.3 & HSTS Transport Hardening
  // ==========================================================================
  describe('5. Transport Security, TLS 1.3 & HSTS', () => {
    it('should configure TLS 1.3, Strict SSL, HTTP/3, and HSTS headers in zone settings', () => {
      const content = fs.readFileSync(cacheTfPath, 'utf-8');

      assert.ok(content.includes('tls_1_3                  = "on"'), 'Must enforce tls_1_3 = on');
      assert.ok(content.includes('ssl                      = "strict"'), 'Must enforce ssl = strict');
      assert.ok(content.includes('http3                    = "on"'), 'Must enforce http3 = on');
      assert.ok(content.includes('security_header'), 'Must declare security_header block');
      assert.ok(content.includes('max_age            = 31536000'), 'HSTS max_age must be 1 year');
      assert.ok(content.includes('preload            = true'), 'HSTS preload must be true');
      assert.ok(content.includes('nosniff            = true'), 'nosniff header must be true');
    });
  });

  // ==========================================================================
  // 6. Verification CLI & Package Scripts
  // ==========================================================================
  describe('6. Edge Security Verification Tooling', () => {
    it('should execute verifyCloudflareEdgeSecurity() and pass all stages', async () => {
      const ok = await verifyCloudflareEdgeSecurity();
      assert.equal(ok, true, 'All edge security verification checks must pass');
    });

    it('should define security:verify in package.json', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      assert.ok(pkg.scripts['security:verify'], 'Missing security:verify in package.json');
      assert.equal(
        pkg.scripts['security:verify'],
        'tsx scripts/verify-cloudflare-edge-security.ts'
      );
    });
  });
});
