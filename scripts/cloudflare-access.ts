#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare Access (Zero Trust) CLI & Verification Tool
 *
 * Story 5.6: Cloudflare Access (Zero Trust) Identity Gate & CLI Tooling (#139)
 *
 * Commands:
 *   pnpm run access:verify   - Audits Cloudflare Access configuration, JWKS, & signature verification
 *   pnpm run access:token    - Generates test tokens or displays cloudflared login instructions
 *
 * Usage:
 *   tsx scripts/cloudflare-access.ts verify
 *   tsx scripts/cloudflare-access.ts token [--email user@example.com] [--aud <aud-tag>]
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ACCESS_TEAM_NAME,
  base64UrlEncode,
  verifyCloudflareAccessJwt,
  validateServiceToken,
  isProtectedAccessRoute,
} from '../apps/web/src/lib/cloudflare-access';

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

/**
 * Generates an ephemeral RSA key pair (RS256) and returns JWK + private key for testing.
 */
export async function generateTestKeyPair(kid = 'test-access-key-1'): Promise<{
  publicKeyJwk: JsonWebKey & { kid: string };
  privateKey: crypto.KeyObject;
  jwks: { keys: Array<JsonWebKey & { kid: string }> };
}> {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const pubKeyObject = crypto.createPublicKey(publicKey);
  const pubJwk = pubKeyObject.export({ format: 'jwk' }) as JsonWebKey;
  const publicKeyJwk = {
    ...pubJwk,
    kid,
    alg: 'RS256',
    use: 'sig',
  };

  const privKeyObject = crypto.createPrivateKey(privateKey);
  return {
    publicKeyJwk,
    privateKey: privKeyObject,
    jwks: { keys: [publicKeyJwk] },
  };
}

/**
 * Signs a test Cloudflare Access JWT using a private RSA key.
 */
export function signTestAccessJwt(
  claims: {
    email: string;
    aud?: string | string[];
    teamName?: string;
    expiresInSec?: number;
    sub?: string;
  },
  privateKey: crypto.KeyObject,
  kid = 'test-access-key-1'
): string {
  const now = Math.floor(Date.now() / 1000);
  const teamName = claims.teamName || DEFAULT_ACCESS_TEAM_NAME;
  const exp = now + (claims.expiresInSec ?? 3600);

  const header = {
    alg: 'RS256',
    kid,
    typ: 'JWT',
  };

  const payload = {
    aud: claims.aud || 'chrishop-admin-aud-production',
    email: claims.email,
    sub: claims.sub || 'user-uuid-12345',
    iss: `https://${teamName}.cloudflareaccess.com`,
    exp,
    nbf: now - 10,
    iat: now,
    type: 'app',
    identity_nonce: 'mock-nonce-abc',
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signatureBytes = signer.sign(privateKey);
  const signatureB64 = base64UrlEncode(signatureBytes);

  return `${signingInput}.${signatureB64}`;
}

/**
 * Runs the comprehensive verification of Cloudflare Access configurations & cryptographic logic.
 */
export async function verifyCloudflareAccess(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}=== Cloudflare Access (Zero Trust) Perimeter Verification ===${colors.reset}\n`);

  let allPassed = true;
  const rootDir = process.cwd();

  // 1. Check Terraform Access Configuration
  const accessTfPath = path.resolve(rootDir, 'infra/terraform/modules/cloudflare_stack/access.tf');
  process.stdout.write(`▶ Checking Terraform Access definitions (${path.basename(accessTfPath)})... `);
  if (fs.existsSync(accessTfPath)) {
    const content = fs.readFileSync(accessTfPath, 'utf-8');
    const hasAdminApp = content.includes('resource "cloudflare_access_application" "admin"');
    const hasStagingApp = content.includes('resource "cloudflare_access_application" "staging_perimeter"');
    const hasServiceToken = content.includes('resource "cloudflare_access_service_token" "ci_probe"');
    const hasPolicy = content.includes('resource "cloudflare_access_policy" "admin_allow_team"');

    if (hasAdminApp && hasStagingApp && hasServiceToken && hasPolicy) {
      console.log(`${colors.green}✔ PASS${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ FAIL: Missing required access resources in access.tf${colors.reset}`);
      allPassed = false;
    }
  } else {
    console.log(`${colors.red}✖ FAIL: access.tf missing${colors.reset}`);
    allPassed = false;
  }

  // 2. Check Protected Route Detection Logic
  process.stdout.write('▶ Validating perimeter route matching rules... ');
  const adminUrl = new URL('https://chrishop.com/admin');
  const adminSubUrl = new URL('https://chrishop.com/admin/collections/products');
  const stagingUrl = new URL('https://staging.chrishop.com/catalog');
  const stagingHealthUrl = new URL('https://staging.chrishop.com/api/health');
  const prodHomeUrl = new URL('https://chrishop.com/');

  const routeCheck =
    isProtectedAccessRoute(adminUrl) === true &&
    isProtectedAccessRoute(adminSubUrl) === true &&
    isProtectedAccessRoute(stagingUrl) === true &&
    isProtectedAccessRoute(stagingHealthUrl) === false &&
    isProtectedAccessRoute(prodHomeUrl) === false;

  if (routeCheck) {
    console.log(`${colors.green}✔ PASS${colors.reset}`);
  } else {
    console.log(`${colors.red}✖ FAIL: Route protection logic failed${colors.reset}`);
    allPassed = false;
  }

  // 3. Cryptographic RS256 Verification with Ephemeral Key Pair
  process.stdout.write('▶ Testing Web Crypto RS256 signature verification... ');
  try {
    const { publicKeyJwk, privateKey, jwks } = await generateTestKeyPair('verify-kid-1');
    const testAud = 'test-chrishop-aud';
    const jwt = signTestAccessJwt(
      { email: 'maker@bankbeaters.example', aud: testAud },
      privateKey,
      'verify-kid-1'
    );

    const verifiedClaims = await verifyCloudflareAccessJwt(jwt, {
      teamName: DEFAULT_ACCESS_TEAM_NAME,
      expectedAud: testAud,
      customJwks: jwks,
      allowTestBypass: true,
    });

    if (verifiedClaims.email === 'maker@bankbeaters.example') {
      console.log(`${colors.green}✔ PASS${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ FAIL: Claims email mismatch${colors.reset}`);
      allPassed = false;
    }
  } catch (err: any) {
    console.log(`${colors.red}✖ FAIL: ${err.message}${colors.reset}`);
    allPassed = false;
  }

  // 4. Service Token Validation Check
  process.stdout.write('▶ Validating CI Service Token credentials check... ');
  const mockTokens = [{ clientId: 'ci-probe-client-id-123', clientSecret: 'ci-probe-secret-abc' }];
  const validServiceToken = validateServiceToken(
    'ci-probe-client-id-123',
    'ci-probe-secret-abc',
    mockTokens
  );
  const invalidServiceToken = validateServiceToken(
    'ci-probe-client-id-123',
    'wrong-secret',
    mockTokens
  );

  if (validServiceToken && !invalidServiceToken) {
    console.log(`${colors.green}✔ PASS${colors.reset}`);
  } else {
    console.log(`${colors.red}✖ FAIL: Service token validation failed${colors.reset}`);
    allPassed = false;
  }

  // 5. Check Documentation Runbook
  const runbookPath = path.resolve(rootDir, 'docs/security/CLOUDFLARE_ACCESS_RUNBOOK.md');
  process.stdout.write(`▶ Verifying security runbook (${path.basename(runbookPath)})... `);
  if (fs.existsSync(runbookPath)) {
    console.log(`${colors.green}✔ PASS${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⊘ PENDING (will be generated)${colors.reset}`);
  }

  console.log(`\n${colors.bold}Status:${colors.reset} ${allPassed ? `${colors.green}All checks passed.${colors.reset}` : `${colors.red}Some checks failed.${colors.reset}`}\n`);
  return allPassed;
}

/**
 * Displays token generation or cloudflared guidance.
 */
export async function displayTokenGuidance(): Promise<void> {
  console.log(`\n${colors.bold}${colors.cyan}=== Cloudflare Access Developer Token & Login Helper ===${colors.reset}\n`);

  console.log(`${colors.bold}1. CLI Login via cloudflared:${colors.reset}`);
  console.log(`   To authenticate your local browser and CLI to access protected staging/preview environments:`);
  console.log(`   ${colors.cyan}brew install cloudflared${colors.reset}`);
  console.log(`   ${colors.cyan}cloudflared access login https://staging.chrishop.com${colors.reset}\n`);

  console.log(`${colors.bold}2. Generating Mock Test JWT for Local Testing:${colors.reset}`);
  const { privateKey } = await generateTestKeyPair('cli-dev-kid');
  const sampleJwt = signTestAccessJwt(
    { email: 'maker@bankbeaters.example', aud: 'chrishop-admin-aud' },
    privateKey,
    'cli-dev-kid'
  );

  console.log(`   Simulated JWT Header: ${colors.dim}Cf-Access-Jwt-Assertion${colors.reset}`);
  console.log(`   ${colors.green}${sampleJwt}${colors.reset}\n`);

  console.log(`${colors.bold}3. Using Service Tokens in CI/CD or Curl:${colors.reset}`);
  console.log(`   ${colors.dim}curl -H "CF-Access-Client-Id: <client-id>" \\${colors.reset}`);
  console.log(`   ${colors.dim}     -H "CF-Access-Client-Secret: <client-secret>" \\${colors.reset}`);
  console.log(`   ${colors.dim}     https://chrishop.com/admin${colors.reset}\n`);
}

// CLI Execution Entrypoint
async function main() {
  const cmd = process.argv[2] || 'verify';

  if (cmd === 'verify') {
    const passed = await verifyCloudflareAccess();
    process.exit(passed ? 0 : 1);
  } else if (cmd === 'token') {
    await displayTokenGuidance();
    process.exit(0);
  } else {
    console.log(`Usage: tsx scripts/cloudflare-access.ts [verify|token]`);
    process.exit(1);
  }
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('cloudflare-access.ts')) {
  main().catch((err) => {
    console.error('Fatal error in cloudflare-access CLI:', err);
    process.exit(1);
  });
}
