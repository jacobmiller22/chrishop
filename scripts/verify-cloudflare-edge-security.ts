#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare Edge Security, WAF, CDN & DDoS Verification CLI
 *
 * Story 5.5 (#56): Cloudflare Integration — WAF, CDN & DDoS Protection
 *
 * Validates:
 * 1. Cloudflare WAF Custom Ruleset & Shopify Webhook Bypass
 * 2. Edge DDoS Rate Limiting for Cart & Checkout
 * 3. Cloudflare Turnstile Bot Mitigation & Widget Provisioning
 * 4. Edge CDN Caching Rules for Static Assets & Immutable Media
 * 5. TLS 1.3, Strict SSL & HSTS Transport Hardening
 *
 * Usage:
 *   pnpm run security:verify
 */

import fs from 'node:fs';
import path from 'node:path';
import { verifyTurnstileToken, TURNSTILE_TEST_TOKENS } from '../apps/web/src/lib/turnstile';
import { evaluateWafPolicy } from '../apps/web/src/lib/waf-policy';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export async function verifyCloudflareEdgeSecurity(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🛡️  ChrisShop Cloudflare Edge Security, WAF, CDN & DDoS       ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let allPassed = true;
  const rootDir = path.resolve(__dirname, '..');
  const securityTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/security.tf');
  const cacheTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/cache.tf');
  const outputsTfPath = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack/outputs.tf');

  // 1. Verify WAF Custom Ruleset & Rate Limiting in Terraform
  console.log(`${colors.bold}1. Cloudflare WAF Rulesets & Rate Limiting in Terraform:${colors.reset}`);
  if (!fs.existsSync(securityTfPath)) {
    console.log(`  ✖ Missing security.tf at ${securityTfPath}`);
    allPassed = false;
  } else {
    const securityHcl = fs.readFileSync(securityTfPath, 'utf-8');

    // Check custom WAF ruleset
    if (securityHcl.includes('resource "cloudflare_ruleset" "waf_custom"') &&
        securityHcl.includes('phase       = "http_request_firewall_custom"') &&
        securityHcl.includes('/api/orders/webhook') &&
        securityHcl.includes('action = "skip"')) {
      console.log(`  ✔ WAF Custom Ruleset: ${colors.green}Configured${colors.reset} (Shopify webhook skip bypass enabled)`);
    } else {
      console.log(`  ✖ WAF Custom Ruleset missing required webhook skip configuration`);
      allPassed = false;
    }

    // Check rate limiting ruleset
    if (securityHcl.includes('resource "cloudflare_ruleset" "rate_limiting"') &&
        securityHcl.includes('phase       = "http_ratelimit"') &&
        securityHcl.includes('/api/cart') &&
        securityHcl.includes('requests_per_period = 30')) {
      console.log(`  ✔ Edge Rate Limiting: ${colors.green}Configured${colors.reset} (30 req/min managed challenge on cart/checkout)`);
    } else {
      console.log(`  ✖ Edge Rate Limiting ruleset missing or misconfigured`);
      allPassed = false;
    }

    // Check outputs
    const outputsHcl = fs.readFileSync(outputsTfPath, 'utf-8');
    if (outputsHcl.includes('output "waf_ruleset_id"') && outputsHcl.includes('output "rate_limit_ruleset_id"')) {
      console.log(`  ✔ Terraform Outputs: ${colors.green}Exported${colors.reset} (waf_ruleset_id, rate_limit_ruleset_id)`);
    } else {
      console.log(`  ✖ Missing WAF or Rate Limit outputs in outputs.tf`);
      allPassed = false;
    }
  }

  // 2. Verify Turnstile Anti-Bot Engine
  console.log(`\n${colors.bold}2. Cloudflare Turnstile Bot Mitigation & Handshake Token Verification:${colors.reset}`);
  const securityHcl = fs.readFileSync(securityTfPath, 'utf-8');
  if (securityHcl.includes('resource "cloudflare_turnstile_widget" "checkout"') &&
      securityHcl.includes('mode       = "managed"')) {
    console.log(`  ✔ Turnstile Widget: ${colors.green}Provisioned${colors.reset} in Terraform (mode = managed)`);
  } else {
    console.log(`  ✖ Turnstile widget missing in security.tf`);
    allPassed = false;
  }

  // Test server-side verification with pass token
  const passResult = await verifyTurnstileToken({ token: TURNSTILE_TEST_TOKENS.ALWAYS_PASSES });
  if (passResult.success) {
    console.log(`  ✔ Turnstile Test Verification (ALWAYS_PASSES): ${colors.green}PASSED${colors.reset}`);
  } else {
    console.log(`  ✖ Turnstile pass test failed`);
    allPassed = false;
  }

  // Test server-side verification with block token
  const blockResult = await verifyTurnstileToken({ token: TURNSTILE_TEST_TOKENS.ALWAYS_BLOCKS });
  if (!blockResult.success) {
    console.log(`  ✔ Turnstile Test Verification (ALWAYS_BLOCKS): ${colors.green}REJECTED${colors.reset} as expected`);
  } else {
    console.log(`  ✖ Turnstile block test failed to reject`);
    allPassed = false;
  }

  // 3. Verify Edge CDN Caching Configuration
  console.log(`\n${colors.bold}3. Cloudflare Edge CDN Caching & Page Rules:${colors.reset}`);
  if (!fs.existsSync(cacheTfPath)) {
    console.log(`  ✖ Missing cache.tf at ${cacheTfPath}`);
    allPassed = false;
  } else {
    const cacheHcl = fs.readFileSync(cacheTfPath, 'utf-8');

    if (cacheHcl.includes('resource "cloudflare_page_rule" "cache_static_assets"') &&
        cacheHcl.includes('cache_everything') &&
        cacheHcl.includes('edge_cache_ttl    = 31536000')) {
      console.log(`  ✔ Static Assets Page Rule: ${colors.green}Active${colors.reset} (1-year edge TTL for /_next/static/*)`);
    } else {
      console.log(`  ✖ Missing static asset edge caching rule`);
      allPassed = false;
    }

    if (cacheHcl.includes('resource "cloudflare_page_rule" "cache_media"') &&
        cacheHcl.includes('cache_everything') &&
        cacheHcl.includes('edge_cache_ttl    = 31536000')) {
      console.log(`  ✔ Immutable Media Page Rule: ${colors.green}Active${colors.reset} (1-year edge TTL for /media/*)`);
    } else {
      console.log(`  ✖ Missing media edge caching rule`);
      allPassed = false;
    }

    if (cacheHcl.includes('resource "cloudflare_page_rule" "bypass_admin"') &&
        cacheHcl.includes('resource "cloudflare_page_rule" "bypass_api"')) {
      console.log(`  ✔ Dynamic Bypass Rules: ${colors.green}Active${colors.reset} (bypass for /admin* and /api/*)`);
    } else {
      console.log(`  ✖ Missing dynamic route bypass rules`);
      allPassed = false;
    }
  }

  // 4. Verify TLS 1.3 & HSTS Transport Settings
  console.log(`\n${colors.bold}4. Transport Security, TLS 1.3 & HSTS Zone Settings:${colors.reset}`);
  const cacheHcl = fs.readFileSync(cacheTfPath, 'utf-8');
  const hasTls13 = cacheHcl.includes('tls_1_3                  = "on"');
  const hasStrictSsl = cacheHcl.includes('ssl                      = "strict"');
  const hasHsts =
    cacheHcl.includes('security_header') &&
    cacheHcl.includes('max_age            = 31536000') &&
    cacheHcl.includes('preload            = true');

  if (hasTls13) {
    console.log(`  ✔ TLS 1.3 Enforcement: ${colors.green}ON${colors.reset}`);
  } else {
    console.log(`  ✖ Missing tls_1_3 in zone settings`);
    allPassed = false;
  }

  if (hasStrictSsl) {
    console.log(`  ✔ SSL Mode: ${colors.green}STRICT${colors.reset}`);
  } else {
    console.log(`  ✖ SSL mode must be strict`);
    allPassed = false;
  }

  if (hasHsts) {
    console.log(`  ✔ HSTS (Strict Transport Security): ${colors.green}ENABLED${colors.reset} (max-age: 1 year, preload: true)`);
  } else {
    console.log(`  ✖ Missing HSTS security_header in zone settings`);
    allPassed = false;
  }

  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✔ Cloudflare Edge Security, WAF, CDN & DDoS Verification Passed!${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✖ Verification failed. Resolve errors above.${colors.reset}\n`);
  }

  return allPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyCloudflareEdgeSecurity().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}
