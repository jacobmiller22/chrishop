/**
 * Payload CMS 2FA Session & Cryptographic Token Verification
 *
 * Implements tamper-proof HMAC-SHA256 signed 2FA session tokens and cookie management
 * using standard Web Crypto API. Works seamlessly across Cloudflare Workers and Node.js.
 *
 * Conforms to docs/HIGH_LEVEL_DESIGN.md Section 7 and Story 5.2.
 */

import { verifyTotpCode } from './totp';

export const TWO_FACTOR_COOKIE_NAME = 'payload-2fa-session';
export const DEFAULT_2FA_SESSION_TTL = 8 * 60 * 60; // 8 hours in seconds

export interface TwoFactorTokenPayload {
  userId: string | number;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getPayloadSecret(secretOverride?: string): string {
  const secret =
    secretOverride ||
    process.env.PAYLOAD_SECRET ||
    'chrishop-payload-development-secret-32-chars-min';
  return secret;
}

/**
 * Creates a signed HMAC-SHA256 2FA session token.
 */
export async function create2FAToken(
  payload: Omit<TwoFactorTokenPayload, 'iat' | 'exp'>,
  secretOverride?: string,
  expiresInSeconds: number = DEFAULT_2FA_SESSION_TTL
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TwoFactorTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const payloadJson = JSON.stringify(fullPayload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const encodedPayload = base64UrlEncode(payloadBytes);

  const secret = getPayloadSecret(secretOverride);
  const secretBytes = new TextEncoder().encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies and decodes a signed HMAC-SHA256 2FA session token.
 */
export async function verify2FAToken(
  token: string,
  secretOverride?: string
): Promise<TwoFactorTokenPayload | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;

  try {
    const secret = getPayloadSecret(secretOverride);
    const secretBytes = new TextEncoder().encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(encodedPayload);
    const signature = base64UrlDecode(encodedSignature);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature as unknown as BufferSource,
      data
    );
    if (!isValid) {
      return null;
    }

    const payloadBytes = base64UrlDecode(encodedPayload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: TwoFactorTokenPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Parses a standard Cookie header into key-value pairs.
 */
export function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  }
  return cookies;
}

/**
 * Builds a secure Set-Cookie header for the 2FA session cookie.
 */
export function build2FACookie(token: string, maxAgeSeconds: number = DEFAULT_2FA_SESSION_TTL): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  return `${TWO_FACTOR_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

/**
 * Builds a Set-Cookie header to clear the 2FA session cookie.
 */
export function buildClear2FACookie(): string {
  return `${TWO_FACTOR_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Checks whether an authenticated user requires mandatory TOTP 2FA (Admins only).
 */
export function is2FARequired(user: any): boolean {
  if (!user) return false;
  if (Array.isArray(user.roles)) {
    return user.roles.includes('admin');
  }
  return user.role === 'admin';
}

/**
 * Verifies if an incoming Payload or HTTP request satisfies the mandatory 2FA policy.
 * Checks for:
 * 1. x-admin-2fa-token header
 * 2. payload-2fa-session cookie
 * 3. x-totp-code header (direct one-shot verification against user's secret)
 */
export async function verifyAdminSession2FA(
  req: { headers?: Headers | any; cookies?: any; user?: any },
  userOverride?: any
): Promise<boolean> {
  const user = userOverride || req?.user;
  if (!user) return false;

  // Non-admin roles (e.g. editor) do not require mandatory 2FA
  if (!is2FARequired(user)) {
    return true;
  }

  // Helper to extract header value across Headers object or plain object
  const getHeader = (name: string): string | null => {
    if (!req?.headers) return null;
    if (typeof req.headers.get === 'function') {
      return req.headers.get(name) || req.headers.get(name.toLowerCase());
    }
    return req.headers[name] || req.headers[name.toLowerCase()] || null;
  };

  // 1. Check direct x-totp-code one-shot header (e.g., automated API calls or scripts)
  const directTotpCode = getHeader('x-totp-code');
  if (directTotpCode && user.totpSecret) {
    const isCodeValid = await verifyTotpCode(user.totpSecret, directTotpCode);
    if (isCodeValid) {
      return true;
    }
  }

  // 2. Check x-admin-2fa-token header
  let token = getHeader('x-admin-2fa-token');
  if (token?.startsWith('Bearer ')) {
    token = token.slice(7);
  }

  // 3. Check payload-2fa-session cookie if header was not provided
  if (!token) {
    if (req.cookies && typeof req.cookies === 'object' && req.cookies[TWO_FACTOR_COOKIE_NAME]) {
      token = req.cookies[TWO_FACTOR_COOKIE_NAME];
    } else {
      const cookieHeader = getHeader('cookie');
      const parsedCookies = parseCookieHeader(cookieHeader);
      token = parsedCookies[TWO_FACTOR_COOKIE_NAME] || null;
    }
  }

  if (!token) {
    return false;
  }

  // Verify token signature and claims
  const verifiedPayload = await verify2FAToken(token);
  if (!verifiedPayload) {
    return false;
  }

  // Match token user identity
  if (String(verifiedPayload.userId) !== String(user.id)) {
    return false;
  }

  return true;
}

/**
 * Extracts and cryptographically verifies the authenticated Payload user from request headers/cookies.
 */
export async function extractPayloadUserFromRequest(
  req: { headers?: Headers | any } | Request,
  secretOverride?: string
): Promise<{ id: string | number; email: string; roles: string[]; totpEnabled?: boolean; totpSecret?: string; totpBackupCodes?: string[] } | null> {
  const getHeader = (name: string): string | null => {
    if (!req?.headers) return null;
    if (typeof req.headers.get === 'function') {
      return req.headers.get(name) || req.headers.get(name.toLowerCase());
    }
    return (req.headers as any)[name] || (req.headers as any)[name.toLowerCase()] || null;
  };

  const cookieHeader = getHeader('cookie') || '';
  const cookies = parseCookieHeader(cookieHeader);
  let token = cookies['payload-token'];

  if (!token) {
    const authHeader = getHeader('authorization') || '';
    if (authHeader.startsWith('Bearer ') || authHeader.startsWith('JWT ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const secret = getPayloadSecret(secretOverride);
    const secretBytes = new TextEncoder().encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature as unknown as BufferSource,
      data
    );
    if (!isValid) return null;

    const payloadBytes = base64UrlDecode(payloadB64);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson);

    // Expiration check
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : payload.role ? [payload.role] : ['editor'],
      totpEnabled: Boolean(payload.totpEnabled),
      totpSecret: payload.totpSecret,
      totpBackupCodes: payload.totpBackupCodes,
    };
  } catch {
    return null;
  }
}
