import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import TOTP and 2FA engine
import {
  base32Encode,
  base32Decode,
  generateBase32Secret,
  generateTotpUri,
  generateTotpCode,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  verifyAndConsumeBackupCode,
} from '../../apps/web/src/lib/totp';

import {
  create2FAToken,
  verify2FAToken,
  parseCookieHeader,
  build2FACookie,
  buildClear2FACookie,
  verifyAdminSession2FA,
  is2FARequired,
  TWO_FACTOR_COOKIE_NAME,
} from '../../apps/web/src/lib/payload-2fa';

import {
  checkIsAdmin,
  checkIsEditor,
  checkIsAdminOrEditor,
  isAdmin,
  isEditor,
  isAdminOrEditor,
  isAdminOrSelf,
  adminOnlyField,
  isEditorialWriteAllowed,
  isEditorialDeleteAllowed,
  canAccessAdminPanel,
} from '../../apps/web/src/access/rbac';

describe('Story 5.2: Payload CMS RBAC & Mandatory TOTP 2FA Enforcement', () => {
  const rootDir = process.cwd();

  describe('1. RFC 6238 TOTP Cryptographic Engine', () => {
    it('should generate and round-trip RFC 4648 Base32 binary data', () => {
      const original = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21]); // "Hello!"
      const encoded = base32Encode(original);
      assert.ok(typeof encoded === 'string', 'Base32 string must be returned');
      assert.ok(encoded.length > 0, 'Encoded string must not be empty');

      const decoded = base32Decode(encoded);
      assert.deepEqual(Array.from(decoded), Array.from(original), 'Decoded bytes must match original');
    });

    it('should generate a 20-byte (160-bit) cryptographically random Base32 secret', () => {
      const secret1 = generateBase32Secret(20);
      const secret2 = generateBase32Secret(20);

      assert.ok(secret1.length >= 32, '20 bytes base32 encoded must be at least 32 chars');
      assert.notEqual(secret1, secret2, 'Consecutive secrets must be distinct and random');
      assert.match(secret1, /^[A-Z2-7]+$/, 'Secret must only contain RFC 4648 Base32 characters');
    });

    it('should generate valid otpauth:// URI for authenticator pairing', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const uri = generateTotpUri({
        secret,
        accountName: 'admin@chrishop.com',
        issuer: 'ChrisShop',
      });

      assert.ok(uri.startsWith('otpauth://totp/'), 'URI must use otpauth://totp/ scheme');
      assert.ok(uri.includes('secret=JBSWY3DPEHPK3PXP'), 'URI must contain secret');
      assert.ok(uri.includes('issuer=ChrisShop'), 'URI must contain issuer');
      assert.ok(uri.includes('admin%40chrishop.com') || uri.includes('admin@chrishop.com'), 'URI must contain encoded account');
      assert.ok(uri.includes('digits=6'), 'URI must specify 6 digits');
      assert.ok(uri.includes('period=30'), 'URI must specify 30s period');
    });

    it('should calculate valid 6-digit TOTP code and verify with drift tolerance', async () => {
      const secret = generateBase32Secret();
      const now = Date.now();

      const code = await generateTotpCode(secret, now);
      assert.match(code, /^\d{6}$/, 'TOTP code must be exactly 6 decimal digits');

      // Valid within current window
      const isValidCurrent = await verifyTotpCode(secret, code, { timestamp: now });
      assert.equal(isValidCurrent, true, 'Current code must be valid');

      // Valid within ±1 window (drift tolerance of ±30s)
      const isValidMinus30 = await verifyTotpCode(secret, code, { timestamp: now + 30000 });
      assert.equal(isValidMinus30, true, 'Code must be accepted 30s later within tolerance window');

      const isValidPlus30 = await verifyTotpCode(secret, code, { timestamp: now - 30000 });
      assert.equal(isValidPlus30, true, 'Code must be accepted 30s earlier within tolerance window');

      // Expired beyond window (drift > 60s)
      const isExpired = await verifyTotpCode(secret, code, { timestamp: now + 90000, window: 1 });
      assert.equal(isExpired, false, 'Code must be rejected after window expiration');

      // Reject tampered codes
      const isBogus = await verifyTotpCode(secret, '999999', { timestamp: now });
      assert.equal(isBogus, false, 'Tampered code must be rejected');

      // Reject non-6-digit tokens
      const isShort = await verifyTotpCode(secret, '123', { timestamp: now });
      assert.equal(isShort, false, 'Short code must be rejected');
    });

    it('should generate, hash, and single-use burn emergency backup recovery codes', async () => {
      const backupCodes = generateBackupCodes(8, 8);
      assert.equal(backupCodes.length, 8, 'Must generate exactly 8 backup codes');
      for (const code of backupCodes) {
        assert.match(code, /^[2-9A-Z]{4}-[2-9A-Z]{4}$/, 'Code must follow XXXX-XXXX format');
      }

      // Hash all codes
      const hashedCodes = await Promise.all(backupCodes.map((c) => hashBackupCode(c)));
      assert.equal(hashedCodes.length, 8, 'Must hash 8 backup codes');
      for (const h of hashedCodes) {
        assert.match(h, /^[a-f0-9]{64}$/, 'Hash must be valid SHA-256 hex string');
      }

      // Redeem code 0 (success)
      const codeToRedeem = backupCodes[0];
      const result = await verifyAndConsumeBackupCode(codeToRedeem, hashedCodes);
      assert.equal(result.valid, true, 'Valid backup code must be accepted');
      assert.equal(result.remainingCodes.length, 7, 'Accepted backup code must be burned (removed)');
      assert.ok(!result.remainingCodes.includes(hashedCodes[0]), 'Burned code hash must not be present');

      // Re-redeem already burned code (must fail)
      const secondAttempt = await verifyAndConsumeBackupCode(codeToRedeem, result.remainingCodes);
      assert.equal(secondAttempt.valid, false, 'Reused backup code must be rejected');
      assert.equal(secondAttempt.remainingCodes.length, 7, 'Remaining count unchanged after failed attempt');

      // Invalid recovery code
      const bogusAttempt = await verifyAndConsumeBackupCode('XXXX-YYYY', result.remainingCodes);
      assert.equal(bogusAttempt.valid, false, 'Bogus backup code must be rejected');
    });
  });

  describe('2. 2FA Session & Token Management', () => {
    it('should create and verify tamper-proof signed HMAC-SHA256 2FA tokens', async () => {
      const payload = {
        userId: 'admin-usr-1',
        email: 'admin@chrishop.com',
        roles: ['admin'],
      };

      const token = await create2FAToken(payload);
      assert.ok(typeof token === 'string', 'Token must be a string');
      assert.ok(token.includes('.'), 'Token must have payload.signature format');

      const verified = await verify2FAToken(token);
      assert.ok(verified, 'Token must verify successfully');
      assert.equal(verified?.userId, 'admin-usr-1');
      assert.equal(verified?.email, 'admin@chrishop.com');
      assert.deepEqual(verified?.roles, ['admin']);
      assert.ok(verified?.exp && verified.exp > Math.floor(Date.now() / 1000));
    });

    it('should reject tampered or expired 2FA tokens', async () => {
      const payload = {
        userId: 'admin-usr-1',
        email: 'admin@chrishop.com',
        roles: ['admin'],
      };

      const validToken = await create2FAToken(payload);
      const [payloadPart, sigPart] = validToken.split('.');

      // Tamper signature
      const tamperedToken = `${payloadPart}.${sigPart.slice(0, -4)}AAAA`;
      const verifiedTampered = await verify2FAToken(tamperedToken);
      assert.equal(verifiedTampered, null, 'Tampered token must be rejected');

      // Expired token (TTL = -10 seconds)
      const expiredToken = await create2FAToken(payload, undefined, -10);
      const verifiedExpired = await verify2FAToken(expiredToken);
      assert.equal(verifiedExpired, null, 'Expired token must be rejected');
    });

    it('should correctly format and parse 2FA session cookies', () => {
      const token = 'mock.jwt.token';
      const cookieHeader = build2FACookie(token, 28800);

      assert.ok(cookieHeader.includes(`${TWO_FACTOR_COOKIE_NAME}=${token}`));
      assert.ok(cookieHeader.includes('HttpOnly'));
      assert.ok(cookieHeader.includes('SameSite=Lax'));
      assert.ok(cookieHeader.includes('Path=/'));

      const parsed = parseCookieHeader(cookieHeader);
      assert.equal(parsed[TWO_FACTOR_COOKIE_NAME], token);

      const clearHeader = buildClear2FACookie();
      assert.ok(clearHeader.includes('Max-Age=0'));
    });

    it('should verify admin session 2FA across cookie, header, and one-shot TOTP code', async () => {
      const adminUser = {
        id: 'usr-admin-1',
        email: 'admin@chrishop.com',
        roles: ['admin'],
        totpSecret: generateBase32Secret(),
      };

      const token = await create2FAToken({
        userId: adminUser.id,
        email: adminUser.email,
        roles: adminUser.roles,
      });

      // 1. Session verification via cookie
      const reqCookie = {
        user: adminUser,
        headers: new Headers({
          cookie: `${TWO_FACTOR_COOKIE_NAME}=${token}`,
        }),
      };
      assert.equal(await verifyAdminSession2FA(reqCookie), true, 'Cookie verification must pass');

      // 2. Session verification via header
      const reqHeader = {
        user: adminUser,
        headers: new Headers({
          'x-admin-2fa-token': token,
        }),
      };
      assert.equal(await verifyAdminSession2FA(reqHeader), true, 'Header verification must pass');

      // 3. One-shot verification via current TOTP code header
      const currentCode = await generateTotpCode(adminUser.totpSecret);
      const reqDirectTotp = {
        user: adminUser,
        headers: new Headers({
          'x-totp-code': currentCode,
        }),
      };
      assert.equal(await verifyAdminSession2FA(reqDirectTotp), true, 'Direct TOTP code header must pass');

      // 4. Missing 2FA proof must fail for Admin
      const reqUnverified = {
        user: adminUser,
        headers: new Headers(),
      };
      assert.equal(await verifyAdminSession2FA(reqUnverified), false, 'Missing 2FA proof must fail');

      // 5. Non-admin editor does not require 2FA
      const editorUser = {
        id: 'usr-editor-1',
        email: 'editor@chrishop.com',
        roles: ['editor'],
      };
      const reqEditor = {
        user: editorUser,
        headers: new Headers(),
      };
      assert.equal(await verifyAdminSession2FA(reqEditor), true, 'Editor must not be blocked by 2FA');
    });
  });

  describe('3. Role-Based Access Control (RBAC) Engine', () => {
    const adminUser = { id: '1', email: 'admin@chrishop.com', roles: ['admin'] };
    const editorUser = { id: '2', email: 'editor@chrishop.com', roles: ['editor'] };
    const guestUser = null;

    it('should correctly evaluate role predicates', () => {
      assert.equal(checkIsAdmin(adminUser), true, 'Admin user is admin');
      assert.equal(checkIsAdmin(editorUser), false, 'Editor user is not admin');
      assert.equal(checkIsAdmin(guestUser), false, 'Guest is not admin');

      assert.equal(checkIsEditor(editorUser), true, 'Editor user is editor');
      assert.equal(checkIsEditor(adminUser), false, 'Admin user is not editor');

      assert.equal(checkIsAdminOrEditor(adminUser), true, 'Admin is in AdminOrEditor');
      assert.equal(checkIsAdminOrEditor(editorUser), true, 'Editor is in AdminOrEditor');
      assert.equal(checkIsAdminOrEditor(guestUser), false, 'Guest is not in AdminOrEditor');
    });

    it('should enforce collection write vs delete restrictions', () => {
      const mockReq = (user: any) => ({ req: { user } }) as any;

      // Editorial write (create / update): Admin and Editor permitted
      assert.equal(isEditorialWriteAllowed(mockReq(adminUser)), true, 'Admin can write editorial content');
      assert.equal(isEditorialWriteAllowed(mockReq(editorUser)), true, 'Editor can write editorial content');
      assert.equal(isEditorialWriteAllowed(mockReq(guestUser)), false, 'Guest cannot write editorial content');

      // Editorial delete: Only Admin permitted; Editor strictly prohibited
      assert.equal(isEditorialDeleteAllowed(mockReq(adminUser)), true, 'Admin can delete content');
      assert.equal(isEditorialDeleteAllowed(mockReq(editorUser)), false, 'Editor CANNOT delete content');
      assert.equal(isEditorialDeleteAllowed(mockReq(guestUser)), false, 'Guest cannot delete content');
    });

    it('should enforce user management access (isAdminOrSelf)', () => {
      const mockReq = (user: any) => ({ req: { user } }) as any;

      // Admin has unrestricted read/update
      assert.equal(isAdminOrSelf(mockReq(adminUser)), true, 'Admin has full access');

      // Editor gets where constraint matching self
      const editorAccess = isAdminOrSelf(mockReq(editorUser));
      assert.deepEqual(editorAccess, { id: { equals: '2' } }, 'Editor restricted to own profile');

      // Guest denied
      assert.equal(isAdminOrSelf(mockReq(guestUser)), false, 'Guest denied');
    });

    it('should restrict privilege escalation via adminOnlyField', () => {
      const mockReq = (user: any) => ({ req: { user } }) as any;

      assert.equal(adminOnlyField(mockReq(adminUser)), true, 'Admin can update roles and 2FA fields');
      assert.equal(adminOnlyField(mockReq(editorUser)), false, 'Editor CANNOT update roles or 2FA fields');
    });
  });

  describe('4. Mandatory Admin Dashboard Gate (canAccessAdminPanel)', () => {
    it('should deny unauthenticated users and non-staff', async () => {
      const reqGuest = { user: undefined, headers: new Headers() } as any;
      assert.equal(await canAccessAdminPanel({ req: reqGuest }), false, 'Guest denied /admin');

      const reqCustomer = { user: { id: '3', roles: ['customer'] }, headers: new Headers() } as any;
      assert.equal(await canAccessAdminPanel({ req: reqCustomer }), false, 'Customer denied /admin');
    });

    it('should grant Editors access to /admin UI without 2FA challenge', async () => {
      const reqEditor = {
        user: { id: '2', email: 'editor@chrishop.com', roles: ['editor'] },
        headers: new Headers(),
      } as any;

      assert.equal(await canAccessAdminPanel({ req: reqEditor }), true, 'Editor granted /admin access');
    });

    it('should block Admins lacking verified 2FA, and grant access once verified', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@chrishop.com',
        roles: ['admin'],
        totpSecret: generateBase32Secret(),
      };

      // 1. Admin lacking 2FA proof is BLOCKED
      const reqBlocked = {
        user: adminUser,
        headers: new Headers(),
      } as any;
      assert.equal(await canAccessAdminPanel({ req: reqBlocked }), false, 'Unverified Admin blocked from /admin');

      // 2. Admin with verified 2FA token is GRANTED
      const token = await create2FAToken({
        userId: adminUser.id,
        email: adminUser.email,
        roles: adminUser.roles,
      });

      const reqAllowed = {
        user: adminUser,
        headers: new Headers({
          cookie: `${TWO_FACTOR_COOKIE_NAME}=${token}`,
        }),
      } as any;
      assert.equal(await canAccessAdminPanel({ req: reqAllowed }), true, 'Verified Admin granted /admin access');
    });
  });

  describe('5. Payload CMS Collection Configurations Inspection', () => {
    it('should verify Users collection has RBAC roles and 2FA fields configured', async () => {
      const { Users } = await import('../../apps/web/src/collections/Users');
      assert.equal(Users.slug, 'users');
      assert.equal(Users.auth, true);

      // Verify access control
      assert.ok(Users.access, 'Users must declare access controls');
      assert.ok(typeof Users.access.admin === 'function', 'Users must configure admin gate');
      assert.ok(typeof Users.access.read === 'function', 'Users must configure read access');
      assert.ok(typeof Users.access.create === 'function', 'Users must configure create access');
      assert.ok(typeof Users.access.update === 'function', 'Users must configure update access');
      assert.ok(typeof Users.access.delete === 'function', 'Users must configure delete access');

      // Verify fields
      const fieldNames = Users.fields.map((f: any) => f.name);
      assert.ok(fieldNames.includes('roles'), 'roles field must exist');
      assert.ok(fieldNames.includes('totpEnabled'), 'totpEnabled field must exist');
      assert.ok(fieldNames.includes('totpSecret'), 'totpSecret field must exist');
      assert.ok(fieldNames.includes('totpVerifiedAt'), 'totpVerifiedAt field must exist');
      assert.ok(fieldNames.includes('totpBackupCodes'), 'totpBackupCodes field must exist');
    });

    it('should verify content collections restrict delete to Admin', async () => {
      const { Products } = await import('../../apps/web/src/collections/Products');
      const { Categories } = await import('../../apps/web/src/collections/Categories');
      const { ProductLines } = await import('../../apps/web/src/collections/ProductLines');
      const { ProductVariations } = await import('../../apps/web/src/collections/ProductVariations');
      const { Media } = await import('../../apps/web/src/collections/Media');
      const { Pages } = await import('../../apps/web/src/collections/Pages');

      const collections = [Products, Categories, ProductLines, ProductVariations, Media, Pages];

      for (const col of collections) {
        assert.ok(col.access, `${col.slug} must declare access controls`);
        assert.ok(typeof col.access.create === 'function', `${col.slug} must declare create access`);
        assert.ok(typeof col.access.update === 'function', `${col.slug} must declare update access`);
        assert.ok(typeof col.access.delete === 'function', `${col.slug} must declare delete access`);

        // Test delete gate: Admin passes, Editor fails
        const adminReq = { req: { user: { roles: ['admin'] } } } as any;
        const editorReq = { req: { user: { roles: ['editor'] } } } as any;

        assert.equal(col.access.delete(adminReq), true, `${col.slug} delete permitted for Admin`);
        assert.equal(col.access.delete(editorReq), false, `${col.slug} delete DENIED for Editor`);
      }
    });

    it('should verify ThemeSettings global restricts update to Admin', async () => {
      const { ThemeSettings } = await import('../../apps/web/src/globals/ThemeSettings');
      assert.ok(ThemeSettings.access, 'ThemeSettings must declare access controls');
      assert.ok(typeof ThemeSettings.access.update === 'function', 'ThemeSettings must declare update access');

      const adminReq = { req: { user: { roles: ['admin'] } } } as any;
      const editorReq = { req: { user: { roles: ['editor'] } } } as any;

      assert.equal(ThemeSettings.access.update(adminReq), true, 'ThemeSettings update permitted for Admin');
      assert.equal(ThemeSettings.access.update(editorReq), false, 'ThemeSettings update DENIED for Editor');
    });
  });

  describe('6. 2FA API Route & Admin UI File Integrity', () => {
    it('should verify 2FA API route and Admin 2FA challenge page exist', () => {
      const apiRoutePath = path.join(rootDir, 'apps/web/src/app/api/auth/2fa/route.ts');
      const admin2faPagePath = path.join(
        rootDir,
        'apps/web/src/app/(payload)/admin/2fa/page.tsx'
      );

      assert.ok(fs.existsSync(apiRoutePath), 'API route apps/web/src/app/api/auth/2fa/route.ts must exist');
      assert.ok(fs.existsSync(admin2faPagePath), 'UI page apps/web/src/app/(payload)/admin/2fa/page.tsx must exist');

      const routeContent = fs.readFileSync(apiRoutePath, 'utf-8');
      assert.ok(routeContent.includes('action === \'setup\''), 'Route must support setup action');
      assert.ok(routeContent.includes('action === \'verify\''), 'Route must support verify action');
      assert.ok(routeContent.includes('action === \'recovery\''), 'Route must support recovery action');

      const pageContent = fs.readFileSync(admin2faPagePath, 'utf-8');
      assert.ok(pageContent.includes('Two-Factor Authentication'), 'Page must contain 2FA heading');
      assert.ok(pageContent.includes('totpCode'), 'Page must contain TOTP code input');
    });
  });

  describe('7. D1 Additive Migration & Operational Runbook Integrity', () => {
    it('should verify 0010_story_5_2_payload_rbac_totp_2fa.sql migration exists and is additive', () => {
      const migrationPath = path.join(
        rootDir,
        'migrations/0010_story_5_2_payload_rbac_totp_2fa.sql'
      );
      assert.ok(fs.existsSync(migrationPath), 'Migration 0010 must exist');

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('ALTER TABLE users ADD COLUMN roles'), 'Must add roles column');
      assert.ok(sql.includes('ALTER TABLE users ADD COLUMN totp_enabled'), 'Must add totp_enabled column');
      assert.ok(sql.includes('ALTER TABLE users ADD COLUMN totp_secret'), 'Must add totp_secret column');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS users_roles'), 'Must create users_roles table');
      assert.ok(!sql.includes('DROP TABLE'), 'Migration must strictly prohibit DROP TABLE');
    });

    it('should verify PAYLOAD_RBAC_2FA_RUNBOOK.md operational runbook is complete', () => {
      const runbookPath = path.join(
        rootDir,
        'docs/security/PAYLOAD_RBAC_2FA_RUNBOOK.md'
      );
      assert.ok(fs.existsSync(runbookPath), 'PAYLOAD_RBAC_2FA_RUNBOOK.md must exist');

      const runbook = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(runbook.includes('RBAC Permissions Matrix'), 'Must include RBAC matrix');
      assert.ok(runbook.includes('Google Authenticator'), 'Must document Google Authenticator');
      assert.ok(runbook.includes('Emergency Backup Code Recovery'), 'Must document backup recovery');
      assert.ok(runbook.includes('Break-Glass Administrator Recovery'), 'Must document break-glass D1 recovery');
    });
  });
});
