#!/usr/bin/env tsx
/**
 * ChrisShop WAF Ruleset & Rate Limiting Policy Verification CLI
 *
 * Story 5.7 (#165): Architectural Spike & Integration Assessment:
 * WAF Rulesets, Rate Limiting & Checkout False-Positive Mitigation.
 *
 * Usage:
 *   pnpm run waf:verify
 */

import {
  WAF_ROUTE_INVENTORY,
  WAF_EXPRESSIONS,
  BOT_MITIGATION_MATRIX,
  evaluateWafPolicy,
} from '../apps/web/src/lib/waf-policy';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export async function verifyWafPolicySpike(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🛡️  ChrisShop Cloudflare WAF Policy & Edge Rate Limiting Spike  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let allPassed = true;

  // 1. Validate Exposed Route Inventory
  console.log(`${colors.bold}1. Exposed Edge Route Inventory & Risk Classification:${colors.reset}`);
  console.log(`  Total Registered Endpoints: ${colors.cyan}${WAF_ROUTE_INVENTORY.length}${colors.reset}`);

  const requiredPatterns = [
    '/',
    '/products/*',
    '/collections/*',
    '/cart',
    '/api/cart/*',
    '/api/checkout/*',
    '/api/orders/webhook',
    '/api/health',
    '/admin/*',
    '/_next/static/*',
    '/media/*',
  ];

  for (const pattern of requiredPatterns) {
    const found = WAF_ROUTE_INVENTORY.find((r) => r.pathPattern === pattern);
    if (found) {
      console.log(`  ✔ [${found.category.padEnd(20)}] ${colors.green}${found.pathPattern.padEnd(22)}${colors.reset} Risk: ${found.riskProfile.toUpperCase()}`);
    } else {
      console.log(`  ✖ Missing route pattern in inventory: ${pattern}`);
      allPassed = false;
    }
  }

  // 2. Validate WAF Rule Wire Expressions
  console.log(`\n${colors.bold}2. Cloudflare WAF Ruleset Wire Expressions:${colors.reset}`);
  for (const [key, expr] of Object.entries(WAF_EXPRESSIONS)) {
    if (expr && expr.length > 5) {
      console.log(`  ✔ ${colors.cyan}${key}${colors.reset}`);
      console.log(`    ${colors.dim}${expr}${colors.reset}`);
    } else {
      console.log(`  ✖ Invalid expression for ${key}`);
      allPassed = false;
    }
  }

  // 3. Evaluate Edge Decision Simulation (False Positives & Rate Limiting)
  console.log(`\n${colors.bold}3. WAF Traffic Simulation & False-Positive Mitigation Tests:${colors.reset}`);

  // Test Case A: Shopify Webhook with valid HMAC
  const webhookGood = evaluateWafPolicy({
    path: '/api/orders/webhook',
    method: 'POST',
    ip: '35.190.1.5',
    hasValidHmac: true,
  });
  if (webhookGood.action === 'skip' && webhookGood.isFalsePositiveRiskMitigated) {
    console.log(`  ✔ Shopify Webhook (Valid HMAC): Action=${colors.green}${webhookGood.action}${colors.reset} (Skipped WAF inspection)`);
  } else {
    console.log(`  ✖ Shopify Webhook failed to skip WAF inspection: ${webhookGood.action}`);
    allPassed = false;
  }

  // Test Case B: Shopify Webhook without HMAC (Application edge drop)
  const webhookBad = evaluateWafPolicy({
    path: '/api/orders/webhook',
    method: 'POST',
    ip: '198.51.100.22',
    hasValidHmac: false,
  });
  if (webhookBad.action === 'block') {
    console.log(`  ✔ Spoofed Webhook (No HMAC): Action=${colors.yellow}${webhookBad.action}${colors.reset} (Rejected at app layer, zero IP block)`);
  } else {
    console.log(`  ✖ Spoofed Webhook handled incorrectly: ${webhookBad.action}`);
    allPassed = false;
  }

  // Test Case C: Legitimate mobile customer adding item to cart
  const shopperCart = evaluateWafPolicy({
    path: '/api/cart/add',
    method: 'POST',
    ip: '172.56.21.89',
    requestsInLast10Sec: 2,
    requestsInLastMinute: 4,
    threatScore: 5,
  });
  if (shopperCart.action === 'allow') {
    console.log(`  ✔ Legitimate Shopper Cart Mutation: Action=${colors.green}${shopperCart.action}${colors.reset}`);
  } else {
    console.log(`  ✖ Legitimate shopper incorrectly throttled: ${shopperCart.action}`);
    allPassed = false;
  }

  // Test Case D: Aggressive Scalper Bot Hammering /api/cart
  const botCartHammer = evaluateWafPolicy({
    path: '/api/cart/add',
    method: 'POST',
    ip: '198.51.100.99',
    requestsInLast10Sec: 15, // Exceeds burst 10
    requestsInLastMinute: 45, // Exceeds limit 30
  });
  if (botCartHammer.action === 'rate_limit' && botCartHammer.rateLimited) {
    console.log(`  ✔ Scalper Bot Cart Hammering: Action=${colors.red}${botCartHammer.action}${colors.reset} (${botCartHammer.explanation})`);
  } else {
    console.log(`  ✖ Scalper Bot cart hammering not throttled: ${botCartHammer.action}`);
    allPassed = false;
  }

  // Test Case E: Elevated Cloudflare Threat Score Visitor
  const threatScoreVisitor = evaluateWafPolicy({
    path: '/products/hoodie',
    method: 'GET',
    ip: '203.0.113.50',
    threatScore: 45,
  });
  if (threatScoreVisitor.action === 'managed_challenge') {
    console.log(`  ✔ Suspicious Threat Score (45 > 30): Action=${colors.yellow}${threatScoreVisitor.action}${colors.reset}`);
  } else {
    console.log(`  ✖ Threat score visitor not challenged: ${threatScoreVisitor.action}`);
    allPassed = false;
  }

  // Test Case F: Better Stack Health Monitoring Probe
  const healthProbe = evaluateWafPolicy({
    path: '/api/health',
    method: 'GET',
    ip: '64.225.1.1',
    requestsInLastMinute: 60,
  });
  if (healthProbe.action === 'allow') {
    console.log(`  ✔ External Health Probe (/api/health): Action=${colors.green}${healthProbe.action}${colors.reset}`);
  } else {
    console.log(`  ✖ Health probe not allowed: ${healthProbe.action}`);
    allPassed = false;
  }

  // 4. Validate Bot Mitigation Comparison Matrix
  console.log(`\n${colors.bold}4. Anti-Bot Defense Comparison Matrix:${colors.reset}`);
  for (const item of BOT_MITIGATION_MATRIX) {
    const statusColor =
      item.dropDaySuitability === 'recommended'
        ? colors.green
        : item.dropDaySuitability === 'secondary_defense'
          ? colors.yellow
          : colors.red;

    console.log(`  • ${colors.bold}${item.name}${colors.reset}`);
    console.log(`    Suitability: ${statusColor}${item.dropDaySuitability.toUpperCase()}${colors.reset} | Friction: ${item.userFrictionLevel} | Latency: +${item.latencyOverheadMs}ms`);
  }

  const legacyCaptcha = BOT_MITIGATION_MATRIX.find((b) => b.mechanism === 'interactive_captcha');
  if (legacyCaptcha?.dropDaySuitability !== 'strictly_prohibited') {
    console.log(`  ✖ Legacy CAPTCHA must be strictly prohibited`);
    allPassed = false;
  }

  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✔ WAF Policy & Rate Limiting Architectural Spike Verified!${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✖ Verification failed. Resolve errors above.${colors.reset}\n`);
  }

  return allPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyWafPolicySpike().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}
