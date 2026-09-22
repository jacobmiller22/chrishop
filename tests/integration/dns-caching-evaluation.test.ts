import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DNS_RESOLUTION_BENCHMARKS,
  TTL_FAILOVER_PROFILES,
  DOMAIN_DNS_SPECIFICATIONS,
  buildCloudflarePurgePayload,
  evaluateDnsConfigurationCompliance,
} from '../../apps/web/src/lib/dns-cache-policy';
import { verifyDnsCachingSpike } from '../../scripts/verify-dns-caching-policy';

describe('Story 4.13: Cloudflare DNS Caching, TTL Policies & Edge Cache Purge Spike Suite', () => {
  // ==========================================================================
  // 1. Global Anycast DNS Resolution Benchmarks
  // ==========================================================================
  describe('1. Anycast DNS Resolution Benchmarks', () => {
    it('should catalog empirical latency benchmarks across >= 5 global regions', () => {
      assert.ok(DNS_RESOLUTION_BENCHMARKS.length >= 5, 'Must evaluate >= 5 global regions');
      const regions = DNS_RESOLUTION_BENCHMARKS.map((b) => b.region);
      assert.ok(regions.includes('us-east'), 'Must include US East');
      assert.ok(regions.includes('us-west'), 'Must include US West');
      assert.ok(regions.includes('eu-central'), 'Must include Europe Central');
      assert.ok(regions.includes('ap-southeast'), 'Must include Asia Pacific');
      assert.ok(regions.includes('global-avg'), 'Must include Global Average');
    });

    it('should demonstrate sub-10ms Anycast DNS resolution and >80% latency reduction', () => {
      for (const point of DNS_RESOLUTION_BENCHMARKS) {
        assert.ok(
          point.proxiedLatencyMs < 10,
          `Proxied latency in ${point.region} must be < 10ms, got ${point.proxiedLatencyMs}ms`
        );
        assert.ok(
          point.proxiedLatencyMs < point.unproxiedLatencyMs,
          `Proxied latency must be faster than unproxied in ${point.region}`
        );
        assert.ok(
          point.percentImprovement > 80,
          `Latency improvement must exceed 80% in ${point.region}, got ${point.percentImprovement}%`
        );
      }
    });

    it('should confirm global average DNS lookup latency is < 5ms for Anycast proxying', () => {
      const globalAvg = DNS_RESOLUTION_BENCHMARKS.find((b) => b.region === 'global-avg');
      assert.ok(globalAvg, 'Must include global average benchmark');
      assert.ok(globalAvg.proxiedLatencyMs < 5.0, 'Global average proxied latency must be < 5ms');
      assert.equal(globalAvg.proxiedLatencyMs, 4.4);
    });
  });

  // ==========================================================================
  // 2. TTL Policies & Failover Convergence Windows
  // ==========================================================================
  describe('2. TTL Policy & Failover Profiles', () => {
    it('should designate Cloudflare Auto (TTL 1) as IDEAL for flash drops', () => {
      const autoProfile = TTL_FAILOVER_PROFILES.find((p) => p.ttlSeconds === 1);
      assert.ok(autoProfile, 'Must include Auto TTL profile');
      assert.equal(autoProfile.suitabilityForDrops, 'ideal');
      assert.ok(autoProfile.failoverWindowSec <= 3, 'Auto TTL failover window must be <= 3s');
      assert.ok(autoProfile.rationale.includes('Quicksilver'));
    });

    it('should mark 60s TTL as acceptable exclusively for unproxied cutover windows', () => {
      const lowTtl = TTL_FAILOVER_PROFILES.find((p) => p.ttlSeconds === 60);
      assert.ok(lowTtl, 'Must include 60s TTL profile');
      assert.equal(lowTtl.suitabilityForDrops, 'acceptable');
      assert.ok(lowTtl.failoverWindowSec <= 150);
    });

    it('should mark 300s TTL as dangerous and 3600s TTL as prohibited for drops', () => {
      const stdTtl = TTL_FAILOVER_PROFILES.find((p) => p.ttlSeconds === 300);
      const highTtl = TTL_FAILOVER_PROFILES.find((p) => p.ttlSeconds === 3600);
      assert.equal(stdTtl?.suitabilityForDrops, 'dangerous');
      assert.equal(highTtl?.suitabilityForDrops, 'prohibited');
    });
  });

  // ==========================================================================
  // 3. Domain DNS Configuration Compliance
  // ==========================================================================
  describe('3. Production & Staging Domain DNS Compliance', () => {
    it('should enforce proxied = true and TTL = 1 for all production and staging domains', () => {
      const expectedDomains = [
        'chrishop.jacobmiller22.com',
        'shop.jacobmiller22.com',
        'staging-chrishop.jacobmiller22.com',
      ];

      for (const domain of expectedDomains) {
        const spec = DOMAIN_DNS_SPECIFICATIONS.find((s) => s.domain === domain);
        assert.ok(spec, `Missing specification for domain: ${domain}`);
        assert.equal(spec.proxied, true, `${domain} must be proxied (orange-cloud)`);
        assert.equal(spec.ttl, 1, `${domain} must use TTL 1 (Auto)`);
        assert.ok(spec.failoverRTOSeconds <= 3, `${domain} failover RTO must be <= 3s`);
      }
    });

    it('should evaluate compliant domains without errors via evaluateDnsConfigurationCompliance', () => {
      for (const spec of DOMAIN_DNS_SPECIFICATIONS) {
        const compliance = evaluateDnsConfigurationCompliance({
          proxied: spec.proxied,
          ttl: spec.ttl,
          environment: spec.environment,
        });

        assert.equal(compliance.compliant, true);
        assert.equal(compliance.verdict, 'compliant');
        assert.equal(compliance.maxFailoverSeconds, 3);
      }
    });

    it('should flag unproxied high-TTL records as non-compliant', () => {
      const badConfig = evaluateDnsConfigurationCompliance({
        proxied: false,
        ttl: 300,
        environment: 'production',
      });

      assert.equal(badConfig.compliant, false);
      assert.equal(badConfig.verdict, 'non_compliant');
      assert.ok(badConfig.recommendations.some((r) => r.toLowerCase().includes('excessive ttl')));
    });
  });

  // ==========================================================================
  // 4. Cloudflare Cache Purge Engine
  // ==========================================================================
  describe('4. Cloudflare Cache Purge Engine', () => {
    it('should build valid purge_everything payload', () => {
      const payload = buildCloudflarePurgePayload('purge_everything');
      assert.deepEqual(payload, { purge_everything: true });
    });

    it('should build valid purge_by_url payload', () => {
      const urls = ['https://chrishop.jacobmiller22.com/products/alpine-chest-rig'];
      const payload = buildCloudflarePurgePayload('purge_by_url', { urls });
      assert.deepEqual(payload, { files: urls });
    });

    it('should build valid purge_by_tag payload', () => {
      const tags = ['drop-2026-alpine', 'product-chest-rig'];
      const payload = buildCloudflarePurgePayload('purge_by_tag', { tags });
      assert.deepEqual(payload, { tags });
    });

    it('should reject purge_by_url when no URLs are supplied', () => {
      assert.throws(() => {
        buildCloudflarePurgePayload('purge_by_url', { urls: [] });
      }, /requires at least one URL/);
    });

    it('should reject purge_by_tag when no tags are supplied', () => {
      assert.throws(() => {
        buildCloudflarePurgePayload('purge_by_tag', { tags: [] });
      }, /requires at least one cache tag/);
    });
  });

  // ==========================================================================
  // 5. Terraform IaC Configuration Alignment
  // ==========================================================================
  describe('5. Terraform IaC Configuration Alignment', () => {
    const dnsPath = path.resolve(__dirname, '../../infra/terraform/modules/cloudflare_stack/dns.tf');
    const cachePath = path.resolve(__dirname, '../../infra/terraform/modules/cloudflare_stack/cache.tf');

    it('should enforce proxied = true across all cloudflare_record resources in dns.tf', () => {
      assert.ok(fs.existsSync(dnsPath), 'dns.tf must exist');
      const content = fs.readFileSync(dnsPath, 'utf-8');

      assert.ok(
        content.includes('resource "cloudflare_record" "storefront"'),
        'Must define storefront record'
      );
      assert.ok(
        content.includes('proxied = true'),
        'Must set proxied = true on storefront'
      );
      assert.ok(
        content.includes('resource "cloudflare_record" "aliases"'),
        'Must define aliases records'
      );
      assert.ok(
        content.includes('resource "cloudflare_record" "media"'),
        'Must define media CNAME record'
      );
    });

    it('should confirm cache bypass page rules for /admin* and /api/* in cache.tf', () => {
      assert.ok(fs.existsSync(cachePath), 'cache.tf must exist');
      const content = fs.readFileSync(cachePath, 'utf-8');

      assert.ok(content.includes('resource "cloudflare_page_rule" "bypass_admin"'));
      assert.ok(content.includes('target   = "*${var.zone_name}/admin*"'));
      assert.ok(content.includes('resource "cloudflare_page_rule" "bypass_api"'));
      assert.ok(content.includes('target   = "*${var.zone_name}/api/*"'));
      assert.ok(content.includes('cache_level = "bypass"'));
    });
  });

  // ==========================================================================
  // 6. ADR Documentation Integrity
  // ==========================================================================
  describe('6. ADR Documentation Integrity', () => {
    const adrFile = path.resolve(__dirname, '../../docs/analysis/DNS_CACHING_EVALUATION.md');

    it('should provide complete ADR in docs/analysis/DNS_CACHING_EVALUATION.md', () => {
      assert.ok(fs.existsSync(adrFile), 'DNS_CACHING_EVALUATION.md must exist');
      const stats = fs.statSync(adrFile);
      assert.ok(stats.size > 4000, 'ADR document must be comprehensive (> 4KB)');
    });

    it('should contain all required evaluation sections and purge runbooks', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      const requiredSections = [
        'Context & Architectural Challenge',
        'Global DNS Resolution Benchmark Analysis',
        'TTL Policy Evaluation & Failover Convergence',
        'Interaction Between DNS Caching and Edge Cache Rules',
        'Edge Cache Purge Strategy & Runbook for Merch Drops',
        'Authoritative Decision & Recommendations',
        'Continuous Verification & Tooling',
      ];

      for (const section of requiredSections) {
        assert.ok(content.includes(section), `Missing section in ADR: ${section}`);
      }

      assert.ok(content.includes('curl -X POST "https://api.cloudflare.com/client/v4/zones/'), 'Must include cURL purge runbook');
      assert.ok(content.includes('purge_everything'), 'Must document purge_everything');
      assert.ok(content.includes('Cache-Tag'), 'Must document Cache-Tag purging');
    });
  });

  // ==========================================================================
  // 7. Verification CLI Runner
  // ==========================================================================
  describe('7. Verification CLI Execution', () => {
    it('should successfully run verifyDnsCachingSpike() returning true', async () => {
      const passed = await verifyDnsCachingSpike();
      assert.equal(passed, true, 'verifyDnsCachingSpike must return true');
    });
  });
});
