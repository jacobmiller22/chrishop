import { NextRequest, NextResponse } from 'next/server';
import {
  generateBase32Secret,
  generateTotpUri,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  verifyAndConsumeBackupCode,
} from '@/lib/totp';
import {
  build2FACookie,
  buildClear2FACookie,
  create2FAToken,
  extractPayloadUserFromRequest,
  is2FARequired,
  verifyAdminSession2FA,
} from '@/lib/payload-2fa';

/**
 * 2FA Status Endpoint
 * GET /api/auth/2fa
 */
export async function GET(req: NextRequest) {
  const user = await extractPayloadUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  const required = is2FARequired(user);
  const verified = await verifyAdminSession2FA(req, user);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles,
      totpEnabled: user.totpEnabled,
    },
    twoFactorRequired: required,
    twoFactorVerified: verified,
  });
}

/**
 * 2FA Management & Verification Endpoint
 * POST /api/auth/2fa
 */
export async function POST(req: NextRequest) {
  const user = await extractPayloadUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request payload' },
      { status: 400 }
    );
  }

  const { action } = body;

  // 1. Enrollment Setup: Generate new TOTP secret, URI, and emergency backup codes
  if (action === 'setup') {
    const secret = generateBase32Secret(20);
    const uri = generateTotpUri({
      secret,
      accountName: user.email,
      issuer: 'ChrisShop',
    });
    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = await Promise.all(backupCodes.map((c) => hashBackupCode(c)));

    return NextResponse.json({
      success: true,
      action: 'setup',
      secret,
      uri,
      backupCodes,
      hashedBackupCodes,
    });
  }

  // 2. Verification: Verify 6-digit TOTP code and issue signed 2FA session token
  if (action === 'verify') {
    const { code, secret } = body;
    const totpSecret = secret || user.totpSecret;

    if (!totpSecret) {
      return NextResponse.json(
        { success: false, error: 'No TOTP secret configured or provided' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing 6-digit verification code' },
        { status: 400 }
      );
    }

    const isValid = await verifyTotpCode(totpSecret, code);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired 6-digit TOTP code' },
        { status: 400 }
      );
    }

    // Generate signed 2FA session token
    const token = await create2FAToken({
      userId: user.id,
      email: user.email,
      roles: user.roles,
    });

    const response = NextResponse.json({
      success: true,
      verified: true,
      token,
      message: 'TOTP 2FA verification successful',
    });

    // Set secure HTTP-only 2FA session cookie
    response.headers.set('Set-Cookie', build2FACookie(token));
    return response;
  }

  // 3. Emergency Recovery: Burn single-use recovery code
  if (action === 'recovery') {
    const { recoveryCode, storedHashedCodes } = body;
    const hashesToCheck = storedHashedCodes || user.totpBackupCodes;

    if (!recoveryCode || typeof recoveryCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing recovery code' },
        { status: 400 }
      );
    }

    if (!hashesToCheck || !Array.isArray(hashesToCheck) || hashesToCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No backup codes available for this account' },
        { status: 400 }
      );
    }

    const { valid, remainingCodes } = await verifyAndConsumeBackupCode(
      recoveryCode,
      hashesToCheck
    );

    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid emergency backup recovery code' },
        { status: 400 }
      );
    }

    // Generate signed 2FA session token
    const token = await create2FAToken({
      userId: user.id,
      email: user.email,
      roles: user.roles,
    });

    const response = NextResponse.json({
      success: true,
      verified: true,
      token,
      remainingBackupCodes: remainingCodes.length,
      remainingHashedCodes: remainingCodes,
      message: 'Emergency backup recovery code accepted and consumed',
    });

    response.headers.set('Set-Cookie', build2FACookie(token));
    return response;
  }

  // 4. Disable 2FA: Requires valid TOTP code
  if (action === 'disable') {
    const { code, secret } = body;
    const totpSecret = secret || user.totpSecret;

    if (totpSecret && code) {
      const isValid = await verifyTotpCode(totpSecret, code);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid 6-digit TOTP code' },
          { status: 400 }
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      totpEnabled: false,
      message: 'TOTP 2FA successfully disabled',
    });

    response.headers.set('Set-Cookie', buildClear2FACookie());
    return response;
  }

  return NextResponse.json(
    { success: false, error: `Unsupported action: "${action}"` },
    { status: 400 }
  );
}
