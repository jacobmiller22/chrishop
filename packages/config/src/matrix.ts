// ============================================================================
// Types & Interfaces
// ============================================================================

export type StorefrontTarget = 'local' | 'preview' | 'staging' | 'production';
export type D1Target = 'local-sqlite' | 'miniflare' | 'staging-remote' | 'production-remote';
export type KvTarget = 'in-memory' | 'miniflare-disk' | 'staging-remote' | 'production-remote';
export type R2Target = 'mock-filesystem' | 'miniflare' | 'staging-remote' | 'production-remote';
export type ShopifyTarget = 'mock' | 'dev-store' | 'production-store';
export type NotificationsTarget = 'mock-in-memory' | 'staging-webhook' | 'production';

export interface D1SubsystemConfig {
  target: D1Target;
  readOnly?: boolean;
  databaseId?: string;
  accountId?: string;
  apiToken?: string;
}

export interface SubsystemsConfig {
  storefront: StorefrontTarget;
  databaseD1: D1SubsystemConfig;
  kvCache: KvTarget;
  r2Storage: R2Target;
  shopify: ShopifyTarget;
  notifications: NotificationsTarget;
}

export interface IntegrationMatrixConfig {
  profile: string;
  subsystems: SubsystemsConfig;
  credentials?: Record<string, string>;
  allowProdWrites?: boolean;
}

export interface D1DatabaseLike {
  prepare(sql: string): {
    bind?(...params: any[]): any;
    all(...params: any[]): Promise<any> | any;
    get(...params: any[]): Promise<any> | any;
    first?(...params: any[]): Promise<any> | any;
    run(...params: any[]): Promise<any> | any;
  };
  exec?(sql: string): Promise<any> | any;
  batch?(statements: any[]): Promise<any> | any;
}

// ============================================================================
// Standard Profiles
// ============================================================================

export const STANDARD_PROFILES: Record<string, IntegrationMatrixConfig> = {
  'local-offline': {
    profile: 'local-offline',
    subsystems: {
      storefront: 'local',
      databaseD1: {
        target: 'local-sqlite',
        readOnly: false,
      },
      kvCache: 'in-memory',
      r2Storage: 'mock-filesystem',
      shopify: 'mock',
      notifications: 'mock-in-memory',
    },
    allowProdWrites: false,
  },
  'hybrid-staging': {
    profile: 'hybrid-staging',
    subsystems: {
      storefront: 'local',
      databaseD1: {
        target: 'staging-remote',
        readOnly: false,
        databaseId: 'chrishop-staging-db',
      },
      kvCache: 'staging-remote',
      r2Storage: 'staging-remote',
      shopify: 'dev-store',
      notifications: 'staging-webhook',
    },
    allowProdWrites: false,
  },
  'prod-readonly-probe': {
    profile: 'prod-readonly-probe',
    subsystems: {
      storefront: 'local',
      databaseD1: {
        target: 'production-remote',
        readOnly: true, // STRICTLY ENFORCED
        databaseId: 'chrishop-prod-db',
      },
      kvCache: 'production-remote',
      r2Storage: 'production-remote',
      shopify: 'production-store',
      notifications: 'mock-in-memory',
    },
    allowProdWrites: false,
  },
};

// ============================================================================
// Production Safety Guardrails & SQL Mutation Prevention
// ============================================================================

export class ProductionWriteForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionWriteForbiddenError';
  }
}

const MUTATING_SQL_REGEX = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE)\b/i;

export function isMutatingSql(sql: string): boolean {
  // Strip single-line (-- ...) and multi-line (/* ... */) comments
  const cleanSql = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  return MUTATING_SQL_REGEX.test(cleanSql);
}

export function assertSafeSql(sql: string, readOnly: boolean): void {
  if (readOnly && isMutatingSql(sql)) {
    const verb = sql.trim().split(/\s+/)[0]?.toUpperCase() || 'MUTATION';
    throw new ProductionWriteForbiddenError(
      `Mutating SQL operation (${verb}) is forbidden under read-only matrix profile. Query: "${sql.slice(0, 80).trim()}..."`
    );
  }
}

// ============================================================================
// Profile Resolution Engine
// ============================================================================

export function resolveMatrixProfile(
  profileName?: string,
  overrides?: Partial<IntegrationMatrixConfig>
): IntegrationMatrixConfig {
  const chosenProfile =
    profileName ||
    (typeof process !== 'undefined' ? process.env.MATRIX_PROFILE : undefined) ||
    'local-offline';

  const base = STANDARD_PROFILES[chosenProfile] || STANDARD_PROFILES['local-offline'];

  const config: IntegrationMatrixConfig = {
    profile: chosenProfile,
    subsystems: {
      ...base.subsystems,
      ...(overrides?.subsystems || {}),
      databaseD1: {
        ...base.subsystems.databaseD1,
        ...(overrides?.subsystems?.databaseD1 || {}),
      },
    },
    credentials: {
      ...(base.credentials || {}),
      ...(overrides?.credentials || {}),
    },
    allowProdWrites:
      overrides?.allowProdWrites ??
      (typeof process !== 'undefined'
        ? process.env.ALLOW_PROD_WRITES === 'true' || process.env.ALLOW_PROD_WRITES === '1'
        : false),
  };

  // Production Safety Enforcement
  if (config.subsystems.databaseD1.target === 'production-remote') {
    if (!config.allowProdWrites) {
      config.subsystems.databaseD1.readOnly = true;
    }
  }

  return config;
}

// ============================================================================
// Remote Cloudflare D1 REST API Client
// ============================================================================

export interface RemoteD1ClientOptions {
  accountId?: string;
  databaseId?: string;
  apiToken?: string;
  readOnly?: boolean;
  fetchFn?: typeof fetch;
  apiEndpoint?: string;
}

export function createRemoteD1Client(options: RemoteD1ClientOptions = {}): D1DatabaseLike {
  const accountId =
    options.accountId ||
    (typeof process !== 'undefined' ? process.env.CLOUDFLARE_ACCOUNT_ID : undefined);
  const databaseId =
    options.databaseId ||
    (typeof process !== 'undefined' ? process.env.CLOUDFLARE_D1_DATABASE_ID : undefined);
  const apiToken =
    options.apiToken ||
    (typeof process !== 'undefined' ? process.env.CLOUDFLARE_API_TOKEN : undefined);
  const readOnly = options.readOnly ?? true;
  const fetchFn =
    options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (undefined as any));

  async function executeQuery(sql: string, params: any[] = []): Promise<any> {
    assertSafeSql(sql, readOnly);

    if (!fetchFn) {
      throw new Error('fetch is not available in the current environment');
    }

    if (!accountId || !databaseId || !apiToken) {
      throw new Error(
        'Cloudflare D1 remote client requires accountId, databaseId, and apiToken credentials.'
      );
    }

    const endpoint =
      options.apiEndpoint ||
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudflare D1 HTTP query failed (HTTP ${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    if (!data.success) {
      const err = data.errors?.[0]?.message || 'Unknown D1 API error';
      throw new Error(`Cloudflare D1 API error: ${err}`);
    }

    return data.result?.[0] || { results: [], meta: {} };
  }

  const client: D1DatabaseLike = {
    prepare(sql: string) {
      return {
        bind(...params: any[]) {
          return {
            async all() {
              const res = await executeQuery(sql, params);
              return res.results || [];
            },
            async get() {
              const res = await executeQuery(sql, params);
              return res.results?.[0] || null;
            },
            async first() {
              const res = await executeQuery(sql, params);
              return res.results?.[0] || null;
            },
            async run() {
              const res = await executeQuery(sql, params);
              return {
                changes: res.meta?.changes ?? 0,
                last_row_id: res.meta?.last_row_id,
                duration: res.meta?.duration,
              };
            },
          };
        },
        async all(...params: any[]) {
          const res = await executeQuery(sql, params);
          return res.results || [];
        },
        async get(...params: any[]) {
          const res = await executeQuery(sql, params);
          return res.results?.[0] || null;
        },
        async first(...params: any[]) {
          const res = await executeQuery(sql, params);
          return res.results?.[0] || null;
        },
        async run(...params: any[]) {
          const res = await executeQuery(sql, params);
          return {
            changes: res.meta?.changes ?? 0,
            last_row_id: res.meta?.last_row_id,
            duration: res.meta?.duration,
          };
        },
      };
    },
    async exec(sql: string) {
      return executeQuery(sql, []);
    },
    async batch(statements: Array<{ sql: string; params?: any[] }>) {
      for (const stmt of statements) {
        assertSafeSql(stmt.sql, readOnly);
      }
      const results = [];
      for (const stmt of statements) {
        results.push(await executeQuery(stmt.sql, stmt.params || []));
      }
      return results;
    },
  };

  return client;
}

// ============================================================================
// Test Harness Utilities
// ============================================================================

export async function withMatrixProfile<T>(
  profile: string,
  fn: (config: IntegrationMatrixConfig) => Promise<T> | T
): Promise<T> {
  const previous = typeof process !== 'undefined' ? process.env.MATRIX_PROFILE : undefined;
  try {
    if (typeof process !== 'undefined') {
      process.env.MATRIX_PROFILE = profile;
    }
    const config = resolveMatrixProfile(profile);
    return await fn(config);
  } finally {
    if (typeof process !== 'undefined') {
      if (previous !== undefined) {
        process.env.MATRIX_PROFILE = previous;
      } else {
        delete process.env.MATRIX_PROFILE;
      }
    }
  }
}
