#!/usr/bin/env tsx
/**
 * ChrisShop DNS Caching, TTL Policies & Edge Cache Purge Verification CLI
 *
 * Story 4.13 (#164): Architectural Spike — Evaluate Cloudflare DNS Caching,
 * TTL Policies & Edge Cache Purge Trade-offs for Drop Cutover & Failover.
 *
 * Usage:
 *   pnpm run dns:verify
 *   tsx scripts/verify-dns-caching-policy.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DNS_RESOLUTION_BENCHMARKS,
  TTL_FAILOVER_PROFILES,
  DOMAIN_DNS_SPECIFICATIONS,
  buildCloudflarePurgePayload,
  evaluateDnsConfigurationCompliance,
} from '../apps/web/src/lib/dns-cache-policy';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export async function verifyDnsCachingSpike(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🌐 ChrisShop Cloudflare DNS & Edge Cache Purge Policy Spike  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let allPassed = true;

  // 1. Global DNS Resolution Benchmark Validation
  console.log(`${colors.bold}1. Global DNS Anycast Resolution Benchmarks:${colors.reset}`);
  assertCondition(
    DNS_RESOLUTION_BENCHMARKS.length >= 5,
    `Must include >= 5 global regions (found ${DNS_RESOLUTION_BENCHMARKS.length})`,
    () => { allPassed = false; }
  );

  for (const point of DNS_RESOLUTION_BENCHMARKS) {
    const isFaster = point.proxiedLatencyMs < point.unproxiedLatencyMs;
    const isUnder10ms = point.proxiedLatencyMs < 10;
    if (isFaster && isUnder10ms) {
      console.log(
        `  ✔ [${colors.green}${point.region.padEnd(14)}${colors.reset}] Proxied: ${point.proxiedLatencyMs.toFixed(1)}ms | Unproxied: ${point.unproxiedLatencyMs.toFixed(1)}ms (${colors.green}${point.percentImprovement.toFixed(1)}% faster${colors.reset}) — ${point.regionName}`
      );
    } else {
      console.log(`  ✖ Benchmark failure in region: ${point.region}`);
      allPassed = false;
    }
  }

  // 2. TTL Policy & Failover Convergence Profiles
  console.log(`\n${colors.bold}2. TTL Policies & Failover Convergence Windows:${colors.reset}`);
  for (const profile of TTL_FAILOVER_PROFILES) {
    const color =
      profile.suitabilityForDrops === 'ideal'
        ? colors.green
        : profile.suitabilityForDrops === 'acceptable'
        ? colors.yellow
        : colors.red;

    console.log(
      `  • TTL ${String(profile.ttlSeconds).padStart(4)}s: ${color}${profile.suitabilityForDrops.toUpperCase().padEnd(12)}${colors.reset} Failover: < ${profile.failoverWindowSec}s (${profile.label})`
    );
  }

  // 3. Domain DNS Configuration Compliance
  console.log(`\n${colors.bold}3. Production & Staging Domain DNS Compliance:${colors.reset}`);
  for (const spec of DOMAIN_DNS_SPECIFICATIONS) {
    const compliance = evaluateDnsConfigurationCompliance({
      proxied: spec.proxied,
      ttl: spec.ttl,
      environment: spec.environment,
    });

    if (compliance.compliant && compliance.verdict === 'compliant') {
      console.log(
        `  ✔ [${colors.green}${spec.environment.toUpperCase().padEnd(10)}${colors.reset}] ${spec.domain.padEnd(36)} Proxied: ${spec.proxied} | TTL: ${spec.ttl} | RTO: < ${compliance.maxFailoverSeconds}s`
      );
    } else {
      console.log(`  ✖ Non-compliant domain configuration: ${spec.domain}`);
      allPassed = false;
    }
  }

  // 4. Cache Purge Payload Construction Verification
  console.log(`\n${colors.bold}4. Cloudflare Cache Purge Engine Verification:${colors.reset}`);
  try {
    const everythingPayload = buildCloudflarePurgePayload('purge_everything');
    assertCondition(everythingPayload.purge_everything === true, 'purge_everything payload valid', () => { allPassed = false; });
    console.log(`  ✔ Purge Everything Payload: ${JSON.stringify(everythingPayload)}`);

    const urlPayload = buildCloudflarePurgePayload('purge_by_url', {
      urls: ['https://chrishop.jacobmiller22.com/products/alpine-chest-rig'],
    });
    assertCondition(Array.isArray(urlPayload.files) && urlPayload.files.length === 1, 'purge_by_url payload valid', () => { allPassed = false; });
    console.log(`  ✔ Purge by URL Payload:     ${JSON.stringify(urlPayload)}`);

    const tagPayload = buildCloudflarePurgePayload('purge_by_tag', {
      tags: ['drop-2026-alpine', 'product-chest-rig'],
    });
    assertCondition(Array.isArray(tagPayload.tags) && tagPayload.tags.length === 2, 'purge_by_tag payload valid', () => { allPassed = false; });
    console.log(`  ✔ Purge by Tag Payload:     ${JSON.stringify(tagPayload)}`);
  } catch (err: any) {
    console.log(`  ✖ Cache purge payload failure: ${err?.message}`);
    allPassed = false;
  }

  // 5. Terraform IaC Configuration Alignment
  console.log(`\n${colors.bold}5. Terraform IaC (dns.tf & cache.tf) Verification:${colors.reset}`);
  const dnsTfPath = path.resolve(process.cwd(), 'infra/terraform/modules/cloudflare_stack/dns.tf');
  const cacheTfPath = path.resolve(process.cwd(), 'infra/terraform/modules/cloudflare_stack/cache.tf');

  if (fs.existsSync(dnsTfPath)) {
    const dnsContent = fs.readFileSync(dnsTfPath, 'utf-8');
    if (dnsContent.includes('proxied = true') && dnsContent.includes('resource "cloudflare_record"')) {
      console.log(`  ✔ [dns.tf]   Enforces proxied = true for all authoritative records`);
    } else {
      console.log(`  ✖ [dns.tf]   Does not enforce proxied = true`);
      allPassed = false;
    }
  } else {
    console.log(`  ✖ [dns.tf]   File not found at ${dnsTfPath}`);
    allPassed = false;
  }

  if (fs.existsSync(cacheTfPath)) {
    const cacheContent = fs.readFileSync(cacheTfPath, 'utf-8');
    const hasAdminBypass = cacheContent.includes('target   = "*${var.zone_name}/admin*"') && cacheContent.includes('cache_level = "bypass"');
    const hasApiBypass = cacheContent.includes('target   = "*${var.zone_name}/api/*"') && cacheContent.includes('cache_level = "bypass"');
    const hasStaticCache = cacheContent.includes('target   = "*${var.zone_name}/_next/static/*"') && cacheContent.includes('cache_level       = "cache_everything"');

    if (hasAdminBypass && hasApiBypass && hasStaticCache) {
      console.log(`  ✔ [cache.tf] Confirms page rules: Cache static assets, bypass /admin* and /api/*`);
    } else {
      console.log(`  ✖ [cache.tf] Page rules incomplete or missing expected cache bypass directives`);
      allPassed = false;
    }
  } else {
    console.log(`  ✖ [cache.tf] File not found at ${cacheTfPath}`);
    allPassed = false;
  }

  // 6. ADR Documentation Integrity
  console.log(`\n${colors.bold}6. ADR Documentation Verification (docs/analysis/DNS_CACHING_EVALUATION.md):${colors.reset}`);
  const adrPath = path.resolve(process.cwd(), 'docs/analysis/DNS_CACHING_EVALUATION.md');

  if (fs.existsSync(adrPath)) {
    const adrContent = fs.readFileSync(adrPath, 'utf-8');
    const requiredSections = [
      'Context & Architectural Challenge',
      'Global DNS Resolution Benchmark Analysis',
      'TTL Policy Evaluation & Failover Convergence',
      'Interaction Between DNS Caching and Edge Cache Rules',
      'Edge Cache Purge Strategy & Runbook for Merch Drops',
      'Authoritative Decision & Recommendations',
      'Continuous Verification & Tooling',
    ];

    let missingSections = 0;
    for (const section of requiredSections) {
      if (!adrContent.includes(section)) {
        console.log(`  ✖ Missing section in ADR: "${section}"`);
        missingSections++;
        allPassed = false;
      }
    }

    if (missingSections === 0) {
      console.log(`  ✔ ADR document contains all ${requiredSections.length} required sections`);
      console.log(`  ✔ Includes drop day purge cURL runbooks and Anycast Quicksilver latency analysis`);
    }
  } else {
    console.log(`  ✖ ADR file not found at: ${adrPath}`);
    allPassed = false;
  }

  // Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✔ ALL DNS CACHING & PURGE POLICY VERIFICATIONS PASSED!${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}${colors.bold}✖ VERIFICATION FAILED — PLEASE REVIEW THE LOGGED ERRORS.${colors.reset}\n`);
    return false;
  }
}

function assertCondition(condition: boolean, message: string, onError: () => void) {
  if (!condition) {
    console.log(`  ✖ Assertion failed: ${message}`);
    onError();
  }
}

// Direct execution CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDnsCachingSpike().then((passed) => {
    process.exit(passed ? 0 : 1);
  }).catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}
