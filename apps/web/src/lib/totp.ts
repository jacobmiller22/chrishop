/**
 * RFC 6238 TOTP (Time-Based One-Time Password) Cryptographic Engine
 *
 * Implements RFC 6238 and RFC 4226 using standard Web Crypto API (crypto.subtle).
 * 100% Edge-native, zero external dependencies, compatible with Cloudflare Workers,
 * Node.js 18+, Bun, and Miniflare.
 *
 * Conforms to docs/HIGH_LEVEL_DESIGN.md Section 7 and Story 5.2.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Unambiguous chars (no 0/O, 1/I)

/**
 * Encodes binary data into an RFC 4648 Base32 string (without padding).
 */
export function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string into binary data.
 */
export function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const result: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: "${clean[i]}"`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(result);
}

/**
 * Generates a cryptographically secure random Base32 secret for TOTP enrollment.
 * Default length: 20 bytes (160 bits), optimal for HMAC-SHA1.
 */
export function generateBase32Secret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export interface TotpUriParams {
  secret: string;
  accountName: string;
  issuer?: string;
  period?: number;
  digits?: number;
}

/**
 * Generates a standard otpauth:// URI for authenticator app pairing
 * (Google Authenticator, 1Password, Apple Passwords, etc.).
 */
export function generateTotpUri({
  secret,
  accountName,
  issuer = 'ChrisShop',
  period = 30,
  digits = 6,
}: TotpUriParams): string {
  const encIssuer = encodeURIComponent(issuer);
  const encAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=${digits}&period=${period}`;
}

/**
 * Generates a 6-digit TOTP code for a given Base32 secret and timestamp (RFC 6238).
 */
export async function generateTotpCode(
  secret: string,
  timestamp: number = Date.now(),
  stepSeconds = 30
): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counter = Math.floor(timestamp / 1000 / stepSeconds);

  // 8-byte big-endian counter buffer
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter), false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const sigBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 Section 5.3)
  const offset = sigBytes[19] & 0x0f;
  const binary =
    ((sigBytes[offset] & 0x7f) << 24) |
    ((sigBytes[offset + 1] & 0xff) << 16) |
    ((sigBytes[offset + 2] & 0xff) << 8) |
    (sigBytes[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return String(otp).padStart(6, '0');
}

export interface VerifyTotpOptions {
  window?: number; // Drift window steps (default: 1, allows -30s to +30s)
  timestamp?: number;
  stepSeconds?: number;
}

/**
 * Verifies a 6-digit TOTP token against a Base32 secret with drift window tolerance.
 */
export async function verifyTotpCode(
  secret: string,
  token: string,
  options: VerifyTotpOptions = {}
): Promise<boolean> {
  const normalized = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const window = options.window ?? 1;
  const timestamp = options.timestamp ?? Date.now();
  const stepSeconds = options.stepSeconds ?? 30;

  for (let step = -window; step <= window; step++) {
    const candidateTimestamp = timestamp + step * stepSeconds * 1000;
    try {
      const expected = await generateTotpCode(secret, candidateTimestamp, stepSeconds);
      if (expected === normalized) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Generates an array of single-use emergency backup recovery codes (formatted as XXXX-XXXX).
 */
export function generateBackupCodes(count = 8, length = 8): string[] {
  const codes: string[] = [];
  const randomBytes = new Uint8Array(count * length);
  crypto.getRandomValues(randomBytes);

  let byteIdx = 0;
  for (let i = 0; i < count; i++) {
    let codeStr = '';
    for (let j = 0; j < length; j++) {
      const charIdx = randomBytes[byteIdx++] % RECOVERY_CHARSET.length;
      codeStr += RECOVERY_CHARSET[charIdx];
    }
    // Format as XXXX-XXXX if length is 8
    const formatted = length === 8 ? `${codeStr.slice(0, 4)}-${codeStr.slice(4)}` : codeStr;
    codes.push(formatted);
  }

  return codes;
}

/**
 * Cryptographically hashes an emergency backup code using SHA-256 for secure storage.
 */
export async function hashBackupCode(code: string): Promise<string> {
  const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies an entered backup code against stored hashed codes and consumes it (one-time use burn).
 */
export async function verifyAndConsumeBackupCode(
  inputCode: string,
  storedHashedCodes: string[]
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  if (!inputCode || !storedHashedCodes || storedHashedCodes.length === 0) {
    return { valid: false, remainingCodes: storedHashedCodes || [] };
  }

  const inputHash = await hashBackupCode(inputCode);
  const matchIndex = storedHashedCodes.indexOf(inputHash);

  if (matchIndex === -1) {
    return { valid: false, remainingCodes: storedHashedCodes };
  }

  const remaining = storedHashedCodes.filter((_, idx) => idx !== matchIndex);
  return { valid: true, remainingCodes: remaining };
}
