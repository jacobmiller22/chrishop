import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import {
  parseCommandLineArgs,
  validateWranglerDualRouting,
  verifyDnsResolution,
  verifySslHandshake,
  verifyWorkerRoutingAndRedirects,
  verifyShopifyHeadlessBinding,
  verifyWebhookReachability,
  runDomainCutoverVerification,
} from '../../scripts/verify-domain-cutover';

describe('Story 4.9: Production Domain Migration & Zero-Downtime DNS Cutover Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const wranglerPath = path.join(rootDir, 'wrangler.toml');
  const runbookPath = path.join(rootDir, 'docs/runbooks/DOMAIN_MIGRATION_DNS_CUTOVER.md');
  const terraformModuleDir = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack');
  const nextConfigPath = path.join(rootDir, 'apps/web/next.config.mjs');

  describe('1. Operational Runbook & Documentation Standards', () => {
    it('should verify DOMAIN_MIGRATION_DNS_CUTOVER.md runbook exists and is comprehensive', () => {
      assert.ok(fs.existsSync(runbookPath), 'Runbook must exist at docs/runbooks/DOMAIN_MIGRATION_DNS_CUTOVER.md');
      const content = fs.readFileSync(runbookPath, 'utf-8');

      // Verify core runbook sections
      assert.ok(content.includes('## 1. Executive Summary & Objective'), 'Must include Executive Summary');
      assert.ok(content.includes('## 2. Cutover Architecture & Traffic Flow'), 'Must include Architecture diagram');
      assert.ok(content.includes('## 3. Operational Timeline & Cutover Matrix'), 'Must include Cutover Matrix');
      assert.ok(content.includes('## 4. Step-by-Step Execution Guide'), 'Must include Execution Guide');
      assert.ok(content.includes('## 5. Emergency Rollback Protocol'), 'Must include Emergency Rollback Protocol');
      assert.ok(content.includes('## 6. Troubleshooting & Common Pitfalls'), 'Must include Troubleshooting');

      // Verify operational SLOs
      assert.ok(content.includes('**RTO (Recovery Time Objective)**: < 5 minutes'), 'RTO must be < 5 minutes');
      assert.ok(content.includes('**RPO (Recovery Point Objective)**: 0 seconds'), 'RPO must be 0 seconds');
      assert.ok(content.includes('**Maximum Tolerable Downtime**: 0 seconds'), 'Zero downtime requirement');

      // Verify key technical steps
      assert.ok(content.includes('TTL reduction to 300s'), 'Must document TTL lowering');
      assert.ok(content.includes('Full (Strict)'), 'Must specify Full (Strict) SSL');
      assert.ok(content.includes('TLS 1.3'), 'Must specify TLS 1.3');
      assert.ok(content.includes('media.chrishop.com'), 'Must document media R2 CDN');
      assert.ok(content.includes('Shopify Headless Sales Channel'), 'Must document Shopify Headless binding');
      assert.ok(content.includes('Dual-register Shopify Webhooks'), 'Must document webhook dual-registration');
      assert.ok(content.includes('Canonical 301 Redirect Rules'), 'Must document 301 canonical redirects');
    });

    it('should verify docs/CLOUDFLARE_SETUP.md cross-references the domain migration runbook', () => {
      const cfSetupPath = path.join(rootDir, 'docs/CLOUDFLARE_SETUP.md');
      const content = fs.readFileSync(cfSetupPath, 'utf-8');
      assert.ok(
        content.includes('docs/runbooks/DOMAIN_MIGRATION_DNS_CUTOVER.md'),
        'CLOUDFLARE_SETUP.md must reference DOMAIN_MIGRATION_DNS_CUTOVER.md'
      );
    });
  });

  describe('2. Infrastructure as Code & Worker Configuration', () => {
    it('should verify wrangler.toml declares dual-domain routing for zero-downtime cutover', () => {
      assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml must exist');
      const content = fs.readFileSync(wranglerPath, 'utf-8');

      // Production top-level routes
      assert.ok(content.includes('pattern = "chrishop.com/*"'), 'Must declare chrishop.com/*');
      assert.ok(content.includes('pattern = "www.chrishop.com/*"'), 'Must declare www.chrishop.com/*');
      assert.ok(content.includes('pattern = "shop.chrishop.com/*"'), 'Must declare shop.chrishop.com/*');
      assert.ok(content.includes('pattern = "chrishop.jacobmiller22.com/*"'), 'Must maintain legacy chrishop.jacobmiller22.com/*');
      assert.ok(content.includes('pattern = "shop.jacobmiller22.com/*"'), 'Must maintain legacy shop.jacobmiller22.com/*');

      // Staging routes
      assert.ok(content.includes('pattern = "staging.chrishop.com/*"'), 'Staging must declare staging.chrishop.com/*');
      assert.ok(content.includes('pattern = "staging-chrishop.jacobmiller22.com/*"'), 'Staging must retain legacy route');

      // Helper function validation
      const check = validateWranglerDualRouting(wranglerPath, 'chrishop.com', 'chrishop.jacobmiller22.com');
      assert.equal(check.passed, true);
      assert.ok(check.matchedRoutes.length >= 2);
    });

    it('should fail validateWranglerDualRouting if a required route is missing', () => {
      const checkMissingTarget = validateWranglerDualRouting(
        wranglerPath,
        'nonexistent-domain-12345.com',
        'chrishop.jacobmiller22.com'
      );
      assert.equal(checkMissingTarget.passed, false);
      assert.ok(checkMissingTarget.error?.includes('missing target domain route'));

      const checkMissingLegacy = validateWranglerDualRouting(
        wranglerPath,
        'chrishop.com',
        'nonexistent-legacy-domain-999.com'
      );
      assert.equal(checkMissingLegacy.passed, false);
      assert.ok(checkMissingLegacy.error?.includes('missing fallback legacy route'));
    });

    it('should verify Terraform cloudflare_stack module supports apex domain and media CNAME', () => {
      const varsPath = path.join(terraformModuleDir, 'variables.tf');
      const varsContent = fs.readFileSync(varsPath, 'utf-8');
      assert.ok(varsContent.includes('variable "use_apex_domain"'), 'Must define use_apex_domain variable');
      assert.ok(varsContent.includes('variable "enable_media_cname"'), 'Must define enable_media_cname variable');

      const mainPath = path.join(terraformModuleDir, 'main.tf');
      const mainContent = fs.readFileSync(mainPath, 'utf-8');
      assert.ok(mainContent.includes('local.is_apex ? "@" :'), 'Must support @ record for apex domain');
      assert.ok(mainContent.includes('primary_hostname = local.is_apex ?'), 'Must compute primary_hostname');

      const dnsPath = path.join(terraformModuleDir, 'dns.tf');
      const dnsContent = fs.readFileSync(dnsPath, 'utf-8');
      assert.ok(dnsContent.includes('hostname    = local.primary_hostname'), 'Custom domain must bind primary_hostname');
      assert.ok(dnsContent.includes('resource "cloudflare_record" "media"'), 'Must declare media CNAME resource');
    });

    it('should verify Next.js configuration allows chrishop.com image hostnames', () => {
      assert.ok(fs.existsSync(nextConfigPath), 'apps/web/next.config.mjs must exist');
      const nextConfig = fs.readFileSync(nextConfigPath, 'utf-8');

      assert.ok(nextConfig.includes("hostname: 'media.chrishop.com'"), 'Must allow media.chrishop.com');
      assert.ok(nextConfig.includes("hostname: '*.chrishop.com'"), 'Must allow *.chrishop.com');
      assert.ok(nextConfig.includes("hostname: 'media.chrishop.jacobmiller22.com'"), 'Must retain legacy media host');
    });
  });

  describe('3. Automated Verification Stages & CLI Tool', () => {
    it('should verify Stage 1: DNS Resolution & Edge Proxying (Mock)', async () => {
      const result = await verifyDnsResolution('chrishop.com', { mock: true });
      assert.equal(result.stage, 1);
      assert.equal(result.passed, true);
      assert.equal(result.details.apexRecord.host, 'chrishop.com');
      assert.equal(result.details.apexRecord.type, 'AAAA');
      assert.equal(result.details.apexRecord.content, '100::');
      assert.equal(result.details.apexRecord.proxied, true);
      assert.equal(result.details.apexRecord.ttl, 300);
      assert.equal(result.details.wwwAlias.target, 'chrishop.com');
      assert.equal(result.details.cloudflareAnycast, true);
    });

    it('should verify Stage 2: Edge SSL/TLS & Transport Security (Mock)', async () => {
      const result = await verifySslHandshake('chrishop.com', { mock: true });
      assert.equal(result.stage, 2);
      assert.equal(result.passed, true);
      assert.equal(result.details.protocol, 'TLSv1.3');
      assert.equal(result.details.mode, 'Full (Strict)');
      assert.ok(result.details.hsts.includes('max-age=31536000'));
      assert.ok(result.details.hsts.includes('preload'));
      assert.equal(result.details.http3Supported, true);
    });

    it('should verify Stage 3: Worker Routing & Canonical 301 Redirection', async () => {
      const result = await verifyWorkerRoutingAndRedirects('chrishop.com', 'chrishop.jacobmiller22.com', {
        mock: true,
        wranglerPath,
      });
      assert.equal(result.stage, 3);
      assert.equal(result.passed, true);
      assert.equal(result.details.canonicalRedirect.statusCode, 301);
      assert.equal(result.details.canonicalRedirect.preservePath, true);
      assert.equal(result.details.canonicalRedirect.preserveQueryParams, true);
      assert.equal(result.details.canonicalRedirect.bypassesWebhooks, true);
    });

    it('should verify Stage 4: Shopify Headless Sales Channel Binding & CORS', async () => {
      const result = await verifyShopifyHeadlessBinding('chrishop.com', { mock: true });
      assert.equal(result.stage, 4);
      assert.equal(result.passed, true);
      assert.equal(result.details.allowedOrigin, 'https://chrishop.com');
      assert.ok(result.details.sampleCartId.startsWith('gid://shopify/Cart/'));
      assert.ok(result.details.checkoutRedirectUrl.includes('/checkouts/c/'));
      assert.equal(result.details.checkoutUrlHostnameMatches, true);
    });

    it('should verify Stage 5: Shopify Webhook Reachability & HMAC Cryptographic Gate', async () => {
      const result = await verifyWebhookReachability('chrishop.com', {
        mock: true,
        secret: 'test_domain_cutover_secret_key_123',
      });
      assert.equal(result.stage, 5);
      assert.equal(result.passed, true);
      assert.equal(result.details.hmacAlgorithm, 'HMAC-SHA256');
      assert.equal(result.details.validSignatureAccepted, true);
      assert.equal(result.details.invalidSignatureRejected, true);
      assert.equal(result.details.idempotencyKeyTTL, '24h (86400s)');
    });

    it('should run full runDomainCutoverVerification orchestrator cleanly', async () => {
      const report = await runDomainCutoverVerification({
        domain: 'chrishop.com',
        legacyDomain: 'chrishop.jacobmiller22.com',
        mock: true,
        wranglerPath,
        webhookSecret: 'test_domain_cutover_secret_key_123',
      });

      assert.equal(report.domain, 'chrishop.com');
      assert.equal(report.mode, 'mock');
      assert.equal(report.overallPassed, true);
      assert.equal(report.stages.length, 5);
      assert.ok(report.stages.every((s) => s.passed));
    });

    it('should parse CLI arguments correctly', () => {
      const opts = parseCommandLineArgs([
        '--domain',
        'shop.chrishop.com',
        '--legacy-domain',
        'old.jacobmiller22.com',
        '--mock',
        '--json',
        '--dry-run',
      ]);
      assert.equal(opts.domain, 'shop.chrishop.com');
      assert.equal(opts.legacyDomain, 'old.jacobmiller22.com');
      assert.equal(opts.mock, true);
      assert.equal(opts.target, 'mock');
      assert.equal(opts.json, true);
      assert.equal(opts.dryRun, true);
    });

    it('should execute domain:verify CLI via npm script with --mock and exit with code 0', () => {
      const output = execSync('pnpm run domain:verify --mock', {
        encoding: 'utf-8',
        cwd: rootDir,
      });
      assert.ok(output.includes('ChrisShop Production Domain Cutover Verification CLI'));
      assert.ok(output.includes('ALL 5 DOMAIN CUTOVER VERIFICATION STAGES PASSED SUCCESSFULLY'));
    });

    it('should execute domain:verify CLI with --json and output valid JSON payload', () => {
      const output = execSync('pnpm --silent run domain:verify --mock --json', {
        encoding: 'utf-8',
        cwd: rootDir,
      });
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
      assert.equal(parsed.overallPassed, true);
      assert.equal(parsed.stages.length, 5);
      assert.equal(parsed.domain, 'chrishop.com');
    });
  });
});
