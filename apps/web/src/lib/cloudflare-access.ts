/**
 * ChrisShop Cloudflare Access (Zero Trust) Identity Verification Engine
 *
 * Story 5.6: Cloudflare Access (Zero Trust) Identity Gate & CLI Tooling (#139)
 *
 * Implements edge-level perimeter validation for Cloudflare Access:
 * 1. Cryptographically verifies RS256 signatures on `Cf-Access-Jwt-Assertion` using
 *    Cloudflare Zero Trust JWKS public certificates.
 * 2. Validates AUD (Audience), Issuer, Expiration, and User Email claims.
 * 3. Authenticates programmatic CI/CD and probe traffic via Service Tokens (`CF-Access-Client-Id` / `CF-Access-Client-Secret`).
 * 4. Protects `/admin/*`, `staging.chrishop.com`, and preview environments while allowing automated health probes.
 */

export interface CloudflareAccessClaims {
  aud: string[] | string;
  email: string;
  sub: string;
  iss: string;
  exp: number;
  nbf?: number;
  iat?: number;
  type?: string;
  identity_nonce?: string;
  country?: string;
  [key: string]: any;
}

export interface CloudflareAccessValidationResult {
  authorized: boolean;
  userEmail?: string;
  userId?: string;
  isServiceToken?: boolean;
  claims?: CloudflareAccessClaims;
  error?: string;
  statusCode?: number;
}

export interface ServiceTokenCredential {
  clientId: string;
  clientSecret: string;
}

export interface CloudflareAccessConfig {
  teamName: string;
  expectedAud?: string | string[];
  serviceTokens?: ServiceTokenCredential[];
  jwksCacheTtlMs?: number;
  customJwks?: { keys: Array<JsonWebKey & { kid: string }> };
  allowTestBypass?: boolean;
}

export const DEFAULT_ACCESS_TEAM_NAME = 'chrishop';
export const DEFAULT_JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory JWKS cache across edge requests
const jwksCache = new Map<string, { keys: Map<string, CryptoKey>; expiresAt: number }>();

/**
 * Base64URL decoder compatible with edge runtimes and Node.js
 */
export function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  if (typeof atob === 'function') {
    return atob(base64);
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Base64URL encoder compatible with edge runtimes and Node.js
 */
export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buffer === 'string') {
    bytes = new TextEncoder().encode(buffer);
  } else if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else {
    bytes = buffer;
  }

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Parses unverified JWT parts: header, payload, and raw signature.
 */
export function parseJwtParts(jwt: string): {
  header: { alg: string; kid?: string; typ?: string };
  payload: CloudflareAccessClaims;
  signatureBytes: Uint8Array;
  signingInput: string;
} {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: token must have 3 dot-delimited parts');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64));
  const payload = JSON.parse(base64UrlDecode(payloadB64));

  // Convert signature base64url to raw bytes
  let binarySig = '';
  const decodedSig = base64UrlDecode(signatureB64);
  for (let i = 0; i < decodedSig.length; i++) {
    binarySig += decodedSig[i];
  }
  const signatureBytes = new Uint8Array(binarySig.length);
  for (let i = 0; i < binarySig.length; i++) {
    signatureBytes[i] = binarySig.charCodeAt(i);
  }

  const signingInput = `${headerB64}.${payloadB64}`;

  return { header, payload, signatureBytes, signingInput };
}

export function clearJwksCache(): void {
  jwksCache.clear();
}

/**
 * Fetches and caches JWKS public keys from Cloudflare Zero Trust.
 */
export async function getCloudflareAccessPublicKeys(
  teamName: string,
  config?: Partial<CloudflareAccessConfig>
): Promise<Map<string, CryptoKey>> {
  // If custom JWKS is provided (e.g. tests or custom keys), parse and return without global team caching
  if (config?.customJwks) {
    const customKeyMap = new Map<string, CryptoKey>();
    for (const jwk of config.customJwks.keys || []) {
      if (jwk.kid) {
        const cryptoKey = await crypto.subtle.importKey(
          'jwk',
          jwk,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        );
        customKeyMap.set(jwk.kid, cryptoKey);
      }
    }
    return customKeyMap;
  }

  const now = Date.now();
  const cached = jwksCache.get(teamName);

  if (cached && cached.expiresAt > now) {
    return cached.keys;
  }

  const certsUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(certsUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Cloudflare Access certs from ${certsUrl} (${res.status})`);
  }
  const jwks = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };

  const keyMap = new Map<string, CryptoKey>();
  for (const jwk of jwks.keys || []) {
    if (jwk.kid) {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      keyMap.set(jwk.kid, cryptoKey);
    }
  }

  const ttl = config?.jwksCacheTtlMs || DEFAULT_JWKS_CACHE_TTL_MS;
  jwksCache.set(teamName, { keys: keyMap, expiresAt: now + ttl });
  return keyMap;
}

/**
 * Determines whether an incoming request targets a route protected by Cloudflare Access.
 */
export function isProtectedAccessRoute(url: URL): boolean {
  // Always permit public edge health probes for Better Stack / CI monitoring
  if (url.pathname === '/api/health') {
    return false;
  }

  // Admin panel is always protected across all domains
  if (url.pathname.startsWith('/admin')) {
    return true;
  }

  // Staging environments: entire storefront is perimeter-protected
  const hostname = url.hostname.toLowerCase();
  if (
    hostname.startsWith('staging.') ||
    hostname.startsWith('staging-') ||
    hostname.includes('.preview.') ||
    hostname.endsWith('.preview.chrishop.com')
  ) {
    return true;
  }

  return false;
}

/**
 * Cryptographically verifies a Cloudflare Access JWT.
 */
export async function verifyCloudflareAccessJwt(
  jwt: string,
  config: CloudflareAccessConfig
): Promise<CloudflareAccessClaims> {
  const { header, payload, signatureBytes, signingInput } = parseJwtParts(jwt);

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}. Cloudflare Access requires RS256.`);
  }

  if (!header.kid) {
    throw new Error('JWT header missing required "kid" key identifier');
  }

  const keys = await getCloudflareAccessPublicKeys(config.teamName, config);
  const cryptoKey = keys.get(header.kid);

  if (!cryptoKey) {
    throw new Error(`No public key matching kid "${header.kid}" found for team "${config.teamName}"`);
  }

  // Cryptographic signature check via Web Crypto API
  const isValidSig = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes as unknown as BufferSource,
    new TextEncoder().encode(signingInput)
  );

  if (!isValidSig) {
    throw new Error('Cryptographic signature verification failed: invalid JWT signature');
  }

  // Claims Validation
  const nowSec = Math.floor(Date.now() / 1000);

  // Expiry check with 60-second clock skew tolerance
  if (payload.exp && payload.exp < nowSec - 60) {
    throw new Error(`JWT expired at ${new Date(payload.exp * 1000).toISOString()}`);
  }

  // Not Before check
  if (payload.nbf && payload.nbf > nowSec + 60) {
    throw new Error(`JWT is not yet valid (nbf: ${new Date(payload.nbf * 1000).toISOString()})`);
  }

  // Issuer check
  const expectedIss = `https://${config.teamName}.cloudflareaccess.com`;
  if (payload.iss && payload.iss !== expectedIss && !config.allowTestBypass) {
    throw new Error(`Invalid issuer "${payload.iss}". Expected "${expectedIss}"`);
  }

  // Audience check
  if (config.expectedAud) {
    const expectedAudiences = Array.isArray(config.expectedAud)
      ? config.expectedAud
      : [config.expectedAud];

    const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const hasMatchingAud = expectedAudiences.some((aud) => tokenAudiences.includes(aud));

    if (!hasMatchingAud) {
      throw new Error(
        `Audience mismatch: token audience (${tokenAudiences.join(', ')}) does not match expected (${expectedAudiences.join(', ')})`
      );
    }
  }

  return payload;
}

/**
 * Validates Service Token credentials against configured secrets.
 */
export function validateServiceToken(
  clientId: string | null,
  clientSecret: string | null,
  configuredTokens?: ServiceTokenCredential[]
): boolean {
  if (!clientId || !clientSecret || !configuredTokens || configuredTokens.length === 0) {
    return false;
  }

  return configuredTokens.some(
    (token) => token.clientId === clientId && token.clientSecret === clientSecret
  );
}

/**
 * Full Cloudflare Access validation handler for edge requests.
 */
export async function validateCloudflareAccess(
  request: Request,
  config?: Partial<CloudflareAccessConfig>
): Promise<CloudflareAccessValidationResult> {
  const url = new URL(request.url);

  // 1. Check if route requires Cloudflare Access protection
  if (!isProtectedAccessRoute(url)) {
    return { authorized: true };
  }

  const teamName = config?.teamName || process.env.CLOUDFLARE_ACCESS_TEAM_NAME || DEFAULT_ACCESS_TEAM_NAME;
  const fullConfig: CloudflareAccessConfig = {
    teamName,
    expectedAud: config?.expectedAud || process.env.CLOUDFLARE_ACCESS_AUD,
    serviceTokens: config?.serviceTokens,
    customJwks: config?.customJwks,
    allowTestBypass: config?.allowTestBypass ?? (process.env.NODE_ENV === 'test'),
  };

  // 2. Service Token Authentication (for CI/CD pipelines & automated synthetic monitors)
  const clientId =
    request.headers.get('CF-Access-Client-Id') || request.headers.get('cf-access-client-id');
  const clientSecret =
    request.headers.get('CF-Access-Client-Secret') || request.headers.get('cf-access-client-secret');

  if (clientId && clientSecret) {
    const isTokenValid = validateServiceToken(clientId, clientSecret, fullConfig.serviceTokens);
    if (isTokenValid) {
      return {
        authorized: true,
        isServiceToken: true,
        userEmail: `service-token-${clientId}@service.cloudflareaccess.com`,
        userId: clientId,
      };
    }
    return {
      authorized: false,
      statusCode: 403,
      error: 'Invalid Cloudflare Access Service Token credentials',
    };
  }

  // 3. JWT Header Verification (Cf-Access-Jwt-Assertion)
  const jwtAssertion =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    request.headers.get('cf-access-jwt-assertion') ||
    request.headers.get('cf-access-token');

  if (!jwtAssertion) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Missing required Cf-Access-Jwt-Assertion header. Authentication via Cloudflare Access required.',
    };
  }

  try {
    const claims = await verifyCloudflareAccessJwt(jwtAssertion, fullConfig);

    // Cross-check convenience email header if present
    const convenienceEmail =
      request.headers.get('Cf-Access-Authenticated-User-Email') ||
      request.headers.get('cf-access-authenticated-user-email');

    if (convenienceEmail && claims.email && convenienceEmail.toLowerCase() !== claims.email.toLowerCase()) {
      return {
        authorized: false,
        statusCode: 403,
        error: `Identity header mismatch: Cf-Access-Authenticated-User-Email (${convenienceEmail}) does not match JWT claim (${claims.email})`,
      };
    }

    return {
      authorized: true,
      userEmail: claims.email,
      userId: claims.sub,
      claims,
      isServiceToken: claims.type === 'app',
    };
  } catch (err: any) {
    return {
      authorized: false,
      statusCode: 403,
      error: `Cloudflare Access validation failed: ${err.message}`,
    };
  }
}

/**
 * Creates a standardized HTTP 401/403 Response for unauthenticated perimeter requests.
 */
export function createAccessDeniedResponse(result: CloudflareAccessValidationResult): Response {
  const status = result.statusCode || 401;
  const payload = {
    error: status === 401 ? 'Unauthorized' : 'Forbidden',
    code: status === 401 ? 'ERR_ACCESS_UNAUTHORIZED' : 'ERR_ACCESS_FORBIDDEN',
    message: result.error || 'Access to this resource is restricted by Cloudflare Access.',
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'x-chrishop-access-denied': 'true',
    },
  });
}
