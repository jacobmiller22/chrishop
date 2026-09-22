import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isProtectedAccessRoute,
  validateCloudflareAccess,
  verifyCloudflareAccessJwt,
  validateServiceToken,
  createAccessDeniedResponse,
  base64UrlEncode,
  base64UrlDecode,
  DEFAULT_ACCESS_TEAM_NAME,
} from '../../apps/web/src/lib/cloudflare-access';
import {
  generateTestKeyPair,
  signTestAccessJwt,
} from '../../scripts/cloudflare-access';

describe('Story 5.6: Cloudflare Access (Zero Trust) Identity Gate & CLI Tooling', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const terraformModuleDir = path.join(rootDir, 'infra/terraform/modules/cloudflare_stack');
  const runbookPath = path.join(rootDir, 'docs/security/CLOUDFLARE_ACCESS_RUNBOOK.md');

  // ==========================================================================
  // 1. Perimeter Protected Route Detection
  // ==========================================================================
  describe('1. Perimeter Protected Route Detection', () => {
    it('should identify admin routes as protected on all domains', () => {
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/admin')), true);
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/admin/collections/users')), true);
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/admin/login')), true);
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.jacobmiller22.com/admin')), true);
    });

    it('should identify staging and preview environments as protected perimeters', () => {
      assert.equal(isProtectedAccessRoute(new URL('https://staging.chrishop.com/')), true);
      assert.equal(isProtectedAccessRoute(new URL('https://staging.chrishop.com/products/jacket')), true);
      assert.equal(isProtectedAccessRoute(new URL('https://staging-chrishop.jacobmiller22.com/')), true);
      assert.equal(isProtectedAccessRoute(new URL('https://pr-42.preview.chrishop.com/catalog')), true);
    });

    it('should allow public access to health check endpoint on all domains', () => {
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/api/health')), false);
      assert.equal(isProtectedAccessRoute(new URL('https://staging.chrishop.com/api/health')), false);
      assert.equal(isProtectedAccessRoute(new URL('https://pr-42.preview.chrishop.com/api/health')), false);
    });

    it('should allow public access to general storefront pages on production', () => {
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/')), false);
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/products')), false);
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/drops')), false);
      assert.equal(isProtectedAccessRoute(new URL('https://chrishop.com/api/cart/create')), false);
    });
  });

  // ==========================================================================
  // 2. Unauthenticated Request Blocking & Missing Token Handling
  // ==========================================================================
  describe('2. Unauthenticated Request Blocking', () => {
    it('should reject unauthenticated access to /admin with 401 Unauthorized', async () => {
      const req = new Request('https://chrishop.com/admin');
      const result = await validateCloudflareAccess(req);

      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 401);
      assert.ok(result.error?.includes('Cf-Access-Jwt-Assertion'));

      const response = createAccessDeniedResponse(result);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal(response.headers.get('x-chrishop-access-denied'), 'true');

      const body = await response.json();
      assert.equal(body.error, 'Unauthorized');
      assert.equal(body.code, 'ERR_ACCESS_UNAUTHORIZED');
    });

    it('should reject unauthenticated access to staging domain with 401', async () => {
      const req = new Request('https://staging.chrishop.com/products');
      const result = await validateCloudflareAccess(req);

      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 401);
    });
  });

  // ==========================================================================
  // 3. Cryptographic JWT Verification (RS256 Web Crypto API)
  // ==========================================================================
  describe('3. Cryptographic JWT Verification (RS256 Web Crypto)', () => {
    it('should cryptographically verify a valid RS256 Cloudflare Access JWT', async () => {
      const { privateKey, jwks } = await generateTestKeyPair('access-key-prod');
      const testAud = 'chrishop-admin-aud-2026';
      const userEmail = 'maker@bankbeaters.example';

      const jwt = signTestAccessJwt(
        { email: userEmail, aud: testAud },
        privateKey,
        'access-key-prod'
      );

      const claims = await verifyCloudflareAccessJwt(jwt, {
        teamName: DEFAULT_ACCESS_TEAM_NAME,
        expectedAud: testAud,
        customJwks: jwks,
        allowTestBypass: true,
      });

      assert.equal(claims.email, userEmail);
      assert.equal(claims.aud, testAud);
      assert.ok(claims.sub);
    });

    it('should reject an expired JWT with error', async () => {
      const { privateKey, jwks } = await generateTestKeyPair('access-key-prod');
      const testAud = 'chrishop-admin-aud-2026';

      // Token expired 5 minutes ago
      const expiredJwt = signTestAccessJwt(
        { email: 'maker@bankbeaters.example', aud: testAud, expiresInSec: -300 },
        privateKey,
        'access-key-prod'
      );

      await assert.rejects(
        async () => {
          await verifyCloudflareAccessJwt(expiredJwt, {
            teamName: DEFAULT_ACCESS_TEAM_NAME,
            expectedAud: testAud,
            customJwks: jwks,
            allowTestBypass: true,
          });
        },
        /JWT expired/
      );
    });

    it('should reject a JWT with tampered signature bytes', async () => {
      const { privateKey, jwks } = await generateTestKeyPair('access-key-prod');
      const jwt = signTestAccessJwt(
        { email: 'maker@bankbeaters.example' },
        privateKey,
        'access-key-prod'
      );

      // Mutate signature
      const parts = jwt.split('.');
      parts[2] = parts[2].substring(0, parts[2].length - 4) + 'AAAA';
      const tamperedJwt = parts.join('.');

      await assert.rejects(
        async () => {
          await verifyCloudflareAccessJwt(tamperedJwt, {
            teamName: DEFAULT_ACCESS_TEAM_NAME,
            customJwks: jwks,
            allowTestBypass: true,
          });
        },
        /invalid JWT signature/
      );
    });

    it('should reject a JWT when audience (aud) does not match expected application', async () => {
      const { privateKey, jwks } = await generateTestKeyPair('access-key-prod');
      const jwt = signTestAccessJwt(
        { email: 'maker@bankbeaters.example', aud: 'other-unauthorized-app-aud' },
        privateKey,
        'access-key-prod'
      );

      await assert.rejects(
        async () => {
          await verifyCloudflareAccessJwt(jwt, {
            teamName: DEFAULT_ACCESS_TEAM_NAME,
            expectedAud: 'chrishop-admin-aud-target',
            customJwks: jwks,
            allowTestBypass: true,
          });
        },
        /Audience mismatch/
      );
    });
  });

  // ==========================================================================
  // 4. Request Header Identity Validation & Spoofing Defense
  // ==========================================================================
  describe('4. Request Header Validation & Spoofing Defense', () => {
    it('should authorize request when JWT and Cf-Access-Authenticated-User-Email match', async () => {
      const { privateKey, jwks } = await generateTestKeyPair('access-key-1');
      const testAud = 'chrishop-admin-aud';
      const userEmail = 'maker@bankbeaters.example';

      const jwt = signTestAccessJwt({ email: userEmail, aud: testAud }, privateKey, 'access-key-1');

      const req = new Request('https://chrishop.com/admin', {
        headers: {
          'Cf-Access-Jwt-Assertion': jwt,
          'Cf-Access-Authenticated-User-Email': userEmail,
        },
      });

      const result = await validateCloudflareAccess(req, {
        expectedAud: testAud,
        customJwks: jwks,
        allowTestBypass: true,
      });

      assert.equal(result.authorized, true);
      assert.equal(result.userEmail, userEmail);
    });

    it('should reject request when convenience header does not match cryptographic JWT claim', async () => {
      const { privateKey, jwks } = await generateTestKeyPair('access-key-1');
      const testAud = 'chrishop-admin-aud';
      const realEmail = 'maker@bankbeaters.example';
      const spoofedEmail = 'attacker@malicious.example';

      const jwt = signTestAccessJwt({ email: realEmail, aud: testAud }, privateKey, 'access-key-1');

      const req = new Request('https://chrishop.com/admin', {
        headers: {
          'Cf-Access-Jwt-Assertion': jwt,
          'Cf-Access-Authenticated-User-Email': spoofedEmail,
        },
      });

      const result = await validateCloudflareAccess(req, {
        expectedAud: testAud,
        customJwks: jwks,
        allowTestBypass: true,
      });

      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 403);
      assert.ok(result.error?.includes('Identity header mismatch'));
    });
  });

  // ==========================================================================
  // 5. Service Token Authentication (CI/CD & Synthetic Probes)
  // ==========================================================================
  describe('5. Service Token Authentication', () => {
    const configuredTokens = [
      {
        clientId: 'chrishop-ci-client-id-001',
        clientSecret: 'secret-token-value-xyz987',
      },
    ];

    it('should authorize request with valid Service Token credentials', async () => {
      const req = new Request('https://chrishop.com/admin', {
        headers: {
          'CF-Access-Client-Id': 'chrishop-ci-client-id-001',
          'CF-Access-Client-Secret': 'secret-token-value-xyz987',
        },
      });

      const result = await validateCloudflareAccess(req, {
        serviceTokens: configuredTokens,
      });

      assert.equal(result.authorized, true);
      assert.equal(result.isServiceToken, true);
      assert.equal(result.userId, 'chrishop-ci-client-id-001');
    });

    it('should reject request with invalid Service Token secret', async () => {
      const req = new Request('https://chrishop.com/admin', {
        headers: {
          'CF-Access-Client-Id': 'chrishop-ci-client-id-001',
          'CF-Access-Client-Secret': 'invalid-secret-value',
        },
      });

      const result = await validateCloudflareAccess(req, {
        serviceTokens: configuredTokens,
      });

      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 403);
      assert.ok(result.error?.includes('Invalid Cloudflare Access Service Token'));
    });
  });

  // ==========================================================================
  // 6. Base64URL Encoding & Decoding Helpers
  // ==========================================================================
  describe('6. Base64URL Encoding & Decoding Helpers', () => {
    it('should roundtrip encode and decode strings without padding issues', () => {
      const testCases = [
        'Hello World',
        '{"alg":"RS256","typ":"JWT"}',
        'special-characters-!@#$%^&*()_+~',
        'a',
        'ab',
        'abc',
      ];

      for (const text of testCases) {
        const encoded = base64UrlEncode(text);
        assert.ok(!encoded.includes('+'), 'Base64URL must not contain +');
        assert.ok(!encoded.includes('/'), 'Base64URL must not contain /');
        assert.ok(!encoded.includes('='), 'Base64URL must not contain =');
        const decoded = base64UrlDecode(encoded);
        assert.equal(decoded, text);
      }
    });
  });

  // ==========================================================================
  // 7. Terraform Cloudflare Access IaC Declarations
  // ==========================================================================
  describe('7. Terraform Cloudflare Access Infrastructure as Code (access.tf)', () => {
    const accessTfPath = path.join(terraformModuleDir, 'access.tf');
    const variablesTfPath = path.join(terraformModuleDir, 'variables.tf');
    const outputsTfPath = path.join(terraformModuleDir, 'outputs.tf');

    it('should verify access.tf defines required Access applications and policies', () => {
      assert.ok(fs.existsSync(accessTfPath), 'access.tf must exist in cloudflare_stack module');
      const content = fs.readFileSync(accessTfPath, 'utf-8');

      // Admin application
      assert.ok(
        content.includes('resource "cloudflare_access_application" "admin"'),
        'Must define cloudflare_access_application.admin'
      );
      assert.match(
        content,
        /domain\s+=\s*"\$\{local\.primary_hostname\}\/admin"/,
        'Admin app must protect /admin path'
      );

      // Staging application
      assert.ok(
        content.includes('resource "cloudflare_access_application" "staging_perimeter"'),
        'Must define cloudflare_access_application.staging_perimeter'
      );

      // Service token
      assert.ok(
        content.includes('resource "cloudflare_access_service_token" "ci_probe"'),
        'Must define cloudflare_access_service_token.ci_probe'
      );

      // Access policies
      assert.ok(
        content.includes('resource "cloudflare_access_policy" "admin_allow_team"'),
        'Must define cloudflare_access_policy.admin_allow_team'
      );
      assert.ok(
        content.includes('resource "cloudflare_access_policy" "admin_bypass_service_token"'),
        'Must define cloudflare_access_policy.admin_bypass_service_token'
      );
    });

    it('should verify variables.tf defines Access configuration variables', () => {
      const content = fs.readFileSync(variablesTfPath, 'utf-8');
      assert.ok(content.includes('variable "enable_cloudflare_access"'));
      assert.ok(content.includes('variable "access_team_name"'));
      assert.ok(content.includes('variable "access_allowed_emails"'));
      assert.ok(content.includes('variable "access_allowed_domains"'));
    });

    it('should verify outputs.tf exports Access IDs and AUD tags', () => {
      const content = fs.readFileSync(outputsTfPath, 'utf-8');
      assert.ok(content.includes('output "access_admin_application_id"'));
      assert.ok(content.includes('output "access_admin_aud"'));
      assert.ok(content.includes('output "access_service_token_id"'));
    });
  });

  // ==========================================================================
  // 8. Operational Security Runbook Verification
  // ==========================================================================
  describe('8. Operational Security Runbook Verification', () => {
    it('should verify CLOUDFLARE_ACCESS_RUNBOOK.md is comprehensive', () => {
      assert.ok(fs.existsSync(runbookPath), 'CLOUDFLARE_ACCESS_RUNBOOK.md must exist');
      const content = fs.readFileSync(runbookPath, 'utf-8');

      assert.ok(content.includes('Zero Trust'));
      assert.ok(content.includes('cloudflared access login'));
      assert.ok(content.includes('Emergency Break-Glass Procedures'));
      assert.ok(content.includes('Service Tokens'));
      assert.ok(content.includes('pnpm run access:verify'));
    });
  });
});
