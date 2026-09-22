import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WAF_ROUTE_INVENTORY,
  WAF_EXPRESSIONS,
  BOT_MITIGATION_MATRIX,
  evaluateWafPolicy,
} from '../../apps/web/src/lib/waf-policy';
import { verifyWafPolicySpike } from '../../scripts/verify-waf-rules';

describe('Story 5.7: Cloudflare WAF Architectural Spike & Integration Assessment', () => {
  // ==========================================================================
  // 1. Exposed Public Edge Route Inventory & Risk Classification
  // ==========================================================================
  describe('1. Route Inventory & Attack Surface Analysis', () => {
    it('should catalog all public storefront, cart, webhook, and admin endpoints', () => {
      assert.ok(WAF_ROUTE_INVENTORY.length >= 10, 'Must catalogue all exposed edge routes');

      const pathPatterns = WAF_ROUTE_INVENTORY.map((r) => r.pathPattern);
      assert.ok(pathPatterns.includes('/'), 'Must include root homepage');
      assert.ok(pathPatterns.includes('/products/*'), 'Must include product catalog');
      assert.ok(pathPatterns.includes('/cart'), 'Must include cart page');
      assert.ok(pathPatterns.includes('/api/cart/*'), 'Must include cart mutations');
      assert.ok(pathPatterns.includes('/api/checkout/*'), 'Must include checkout handshake');
      assert.ok(pathPatterns.includes('/api/orders/webhook'), 'Must include Shopify webhooks');
      assert.ok(pathPatterns.includes('/api/health'), 'Must include edge health check');
      assert.ok(pathPatterns.includes('/admin/*'), 'Must include Payload CMS admin');
      assert.ok(pathPatterns.includes('/_next/static/*'), 'Must include Next.js static assets');
      assert.ok(pathPatterns.includes('/media/*'), 'Must include R2 media assets');
    });

    it('should assign appropriate risk profiles and rate limits to sensitive mutation endpoints', () => {
      const cartMutation = WAF_ROUTE_INVENTORY.find((r) => r.pathPattern === '/api/cart/*');
      assert.equal(cartMutation?.riskProfile, 'critical');
      assert.equal(cartMutation?.rateLimitPerMinute, 30);
      assert.equal(cartMutation?.burstLimitPer10Sec, 10);

      const webhook = WAF_ROUTE_INVENTORY.find((r) => r.pathPattern === '/api/orders/webhook');
      assert.equal(webhook?.riskProfile, 'high');
      assert.equal(webhook?.wafRuleAction, 'skip');
      assert.ok(webhook?.exemptionReason?.includes('HMAC'));
    });
  });

  // ==========================================================================
  // 2. Cloudflare Ruleset Wire Expressions
  // ==========================================================================
  describe('2. Cloudflare Wire Expressions Specification', () => {
    it('should define accurate wire expressions for webhook bypass and health probe whitelist', () => {
      assert.ok(
        WAF_EXPRESSIONS.SHOPIFY_WEBHOOK_BYPASS.includes('/api/orders/webhook'),
        'Shopify webhook bypass expression must target /api/orders/webhook'
      );
      assert.ok(
        WAF_EXPRESSIONS.SHOPIFY_WEBHOOK_BYPASS.includes('http.request.method eq "POST"'),
        'Shopify webhook bypass must enforce POST method'
      );
      assert.ok(
        WAF_EXPRESSIONS.HEALTH_CHECK_WHITELIST.includes('/api/health'),
        'Health probe whitelist expression must target /api/health'
      );
    });

    it('should define rate limiting expression covering cart and checkout mutations', () => {
      assert.ok(
        WAF_EXPRESSIONS.CART_CHECKOUT_RATE_LIMIT.includes('/api/cart'),
        'Rate limiting must cover /api/cart'
      );
      assert.ok(
        WAF_EXPRESSIONS.CART_CHECKOUT_RATE_LIMIT.includes('/api/checkout'),
        'Rate limiting must cover /api/checkout'
      );
      assert.ok(
        WAF_EXPRESSIONS.CART_CHECKOUT_RATE_LIMIT.includes('POST'),
        'Rate limiting must cover POST mutation'
      );
    });

    it('should define threat score challenge expression with exemptions for webhooks and health', () => {
      assert.ok(
        WAF_EXPRESSIONS.ELEVATED_THREAT_SCORE_CHALLENGE.includes('cf.threat_score gt 30'),
        'Must trigger on threat score > 30'
      );
      assert.ok(
        WAF_EXPRESSIONS.ELEVATED_THREAT_SCORE_CHALLENGE.includes('/api/orders/webhook'),
        'Threat score rule must exempt webhooks'
      );
      assert.ok(
        WAF_EXPRESSIONS.ELEVATED_THREAT_SCORE_CHALLENGE.includes('/api/health'),
        'Threat score rule must exempt health check'
      );
    });
  });

  // ==========================================================================
  // 3. Traffic Simulation & False-Positive Mitigation Tests
  // ==========================================================================
  describe('3. Traffic Simulation & False-Positive Mitigation', () => {
    it('should bypass WAF managed rules for legitimate Shopify webhooks with valid HMAC', () => {
      const decision = evaluateWafPolicy({
        path: '/api/orders/webhook',
        method: 'POST',
        ip: '35.190.1.5',
        hasValidHmac: true,
      });

      assert.equal(decision.action, 'skip');
      assert.equal(decision.ruleName, 'SHOPIFY_WEBHOOK_BYPASS');
      assert.equal(decision.isFalsePositiveRiskMitigated, true);
      assert.equal(decision.rateLimited, false);
    });

    it('should reject spoofed webhooks lacking HMAC at application layer without blocking IP', () => {
      const decision = evaluateWafPolicy({
        path: '/api/orders/webhook',
        method: 'POST',
        ip: '198.51.100.22',
        hasValidHmac: false,
      });

      assert.equal(decision.action, 'block');
      assert.equal(decision.ruleName, 'WEBHOOK_HMAC_AUTHENTICATION_FAILURE');
      assert.ok(decision.explanation.includes('HMAC'));
    });

    it('should allow legitimate mobile shopper cart activity without false-positive throttling', () => {
      const decision = evaluateWafPolicy({
        path: '/api/cart/add',
        method: 'POST',
        ip: '172.56.21.89',
        requestsInLast10Sec: 2,
        requestsInLastMinute: 5,
        threatScore: 0,
      });

      assert.equal(decision.action, 'allow');
      assert.equal(decision.rateLimited, false);
      assert.equal(decision.isFalsePositiveRiskMitigated, true);
    });

    it('should trigger rate limiting on aggressive scalper bot cart hammering', () => {
      const decision = evaluateWafPolicy({
        path: '/api/cart/add',
        method: 'POST',
        ip: '198.51.100.99',
        requestsInLast10Sec: 15,
        requestsInLastMinute: 45,
      });

      assert.equal(decision.action, 'rate_limit');
      assert.equal(decision.ruleName, 'CART_CHECKOUT_RATE_LIMIT');
      assert.equal(decision.rateLimited, true);
    });

    it('should trigger managed challenge on visitors with threat score > 30', () => {
      const decision = evaluateWafPolicy({
        path: '/products/hoodie',
        method: 'GET',
        ip: '203.0.113.50',
        threatScore: 40,
      });

      assert.equal(decision.action, 'managed_challenge');
      assert.equal(decision.ruleName, 'ELEVATED_THREAT_SCORE_CHALLENGE');
    });

    it('should allow external synthetic health probes to /api/health', () => {
      const decision = evaluateWafPolicy({
        path: '/api/health',
        method: 'GET',
        ip: '64.225.1.1',
        requestsInLastMinute: 60,
      });

      assert.equal(decision.action, 'allow');
      assert.equal(decision.ruleName, 'HEALTH_CHECK_WHITELIST');
    });
  });

  // ==========================================================================
  // 4. Bot Mitigation Comparison & Benchmark Matrix
  // ==========================================================================
  describe('4. Bot Defense Architecture & Benchmarks', () => {
    it('should recommend Turnstile as primary defense and Managed Challenge as secondary', () => {
      const turnstile = BOT_MITIGATION_MATRIX.find((b) => b.mechanism === 'turnstile');
      assert.equal(turnstile?.dropDaySuitability, 'recommended');
      assert.equal(turnstile?.userFrictionLevel, 'zero');
      assert.ok(turnstile!.latencyOverheadMs <= 20);

      const managed = BOT_MITIGATION_MATRIX.find((b) => b.mechanism === 'managed_challenge');
      assert.equal(managed?.dropDaySuitability, 'secondary_defense');
      assert.equal(managed?.userFrictionLevel, 'low');
    });

    it('should strictly prohibit legacy interactive CAPTCHAs due to cart abandonment', () => {
      const captcha = BOT_MITIGATION_MATRIX.find((b) => b.mechanism === 'interactive_captcha');
      assert.equal(captcha?.dropDaySuitability, 'strictly_prohibited');
      assert.equal(captcha?.userFrictionLevel, 'severe');
      assert.ok(captcha!.latencyOverheadMs >= 3000);
      assert.ok(captcha!.description.includes('cart abandonment'));
    });
  });

  // ==========================================================================
  // 5. CLI Verification Tool & Package Scripts
  // ==========================================================================
  describe('5. CLI Tooling & Package Configuration', () => {
    it('should execute verifyWafPolicySpike() and return true', async () => {
      const ok = await verifyWafPolicySpike();
      assert.equal(ok, true);
    });

    it('should define waf:verify in root package.json', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      assert.ok(pkg.scripts['waf:verify'], 'Missing waf:verify script');
      assert.equal(pkg.scripts['waf:verify'], 'tsx scripts/verify-waf-rules.ts');
    });
  });

  // ==========================================================================
  // 6. Architectural Evaluation Report & Acceptance Criteria Verification
  // ==========================================================================
  describe('6. Architectural Spike Report Completeness', () => {
    it('should verify docs/security/WAF_EVALUATION_AND_POLICY.md contains all required sections', () => {
      const reportPath = path.resolve(process.cwd(), 'docs/security/WAF_EVALUATION_AND_POLICY.md');
      assert.ok(fs.existsSync(reportPath), 'WAF report must exist at docs/security/WAF_EVALUATION_AND_POLICY.md');

      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(content.includes('Executive Summary & Context'));
      assert.ok(content.includes('Architectural Security Boundary'));
      assert.ok(content.includes('Exposed Public Edge Route Inventory'));
      assert.ok(content.includes('Cloudflare Managed Rulesets vs. OWASP Core Ruleset'));
      assert.ok(content.includes('False-Positive Avoidance & Exemption Protocols'));
      assert.ok(content.includes('Edge Rate Limiting Policies for Drops'));
      assert.ok(content.includes('Anti-Bot Defense Strategy'));
      assert.ok(content.includes('Staging WAF Testing & Security Analytics Log Inspection'));
      assert.ok(content.includes('Terraform Ruleset Configuration Blueprint'));
      assert.ok(content.includes('Story 5.5'));
    });
  });
});
