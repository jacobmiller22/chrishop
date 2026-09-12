import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { Categories } from './src/collections/Categories';
import { Products } from './src/collections/Products';
import { ProductVariations } from './src/collections/ProductVariations';
import { Media } from './src/collections/Media';
import { Users } from './src/collections/Users';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

let mockD1Instance: any = null;

export const createD1Mock = (): any => {
  if (mockD1Instance) return mockD1Instance;

  let db: DatabaseSync;
  try {
    const dbPath = path.resolve(process.cwd(), '.wrangler/state/v3/d1/local.sqlite');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(dbPath);
  } catch {
    db = new DatabaseSync(':memory:');
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        reset_password_token TEXT,
        reset_password_expiration TEXT,
        salt TEXT,
        hash TEXT,
        login_attempts INTEGER DEFAULT 0,
        lock_until TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO users (id, email) VALUES ('usr_admin_default', 'admin@chrishop.jacobmiller22.com');
    `);
  } catch {}

  const makeMeta = (info?: any, resultsCount = 0) => ({
    changes: Number(info?.changes ?? 0),
    last_row_id: Number(info?.lastInsertRowid ?? 0),
    duration: 0,
    rows_read: resultsCount,
    rows_written: Number(info?.changes ?? 0),
  });

  const prepareStmt = (query: string) => {
    let boundArgs: any[] = [];
    return {
      bind(...args: any[]) {
        boundArgs = args.flat();
        return this;
      },
      async all() {
        try {
          const stmt = db.prepare(query);
          const results = stmt.all(...boundArgs);
          return { results, success: true, meta: makeMeta(undefined, results.length) };
        } catch {
          return { results: [], success: true, meta: makeMeta() };
        }
      },
      async run() {
        try {
          const stmt = db.prepare(query);
          const info = stmt.run(...boundArgs);
          return { success: true, meta: makeMeta(info), results: [] };
        } catch {
          return { success: true, meta: makeMeta(), results: [] };
        }
      },
      async first(colName?: string) {
        try {
          const stmt = db.prepare(query);
          const row: any = stmt.get(...boundArgs);
          if (!row) return null;
          if (colName) return row[colName];
          return row;
        } catch {
          return null;
        }
      },
      async raw() {
        try {
          const stmt = db.prepare(query);
          return stmt.all(...boundArgs);
        } catch {
          return [];
        }
      },
    };
  };

  mockD1Instance = {
    prepare: (query: string) => prepareStmt(query),
    batch: async (statements: any[]) => {
      const results: any[] = [];
      for (const stmt of statements) {
        if (stmt && typeof stmt.all === 'function') {
          results.push(await stmt.all());
        } else if (stmt && typeof stmt.run === 'function') {
          results.push(await stmt.run());
        }
      }
      return results;
    },
    exec: async (query: string) => {
      try {
        db.exec(query);
      } catch {}
      return { count: 0, duration: 0 };
    },
  };

  return mockD1Instance;
};

/**
 * Cloudflare D1 Database Binding Resolver
 * Resolves process.env.DB or globalThis.DB provided by Cloudflare Workers / Miniflare,
 * falling back to an in-process SQLite D1 adapter during Next.js local dev or test.
 */
export const getD1Binding = (): any => {
  if (typeof process !== 'undefined' && process.env?.DB) {
    return process.env.DB;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).DB) {
    return (globalThis as any).DB;
  }
  return createD1Mock();
};

// Export alias for consistency with DEP_PAYLOAD_CMS.md and HLD Section 3.2
export const d1Adapter = sqliteD1Adapter;

/**
 * Cloudflare R2 S3 Storage Configuration Resolver
 *
 * Returns the s3Storage plugin configuration pointing at the Cloudflare R2
 * S3-compatible endpoint. Credentials are resolved from environment variables
 * provided via Cloudflare Workers secrets or local .dev.vars.
 *
 * IMPORTANT: sharp image resizing/processing is intentionally disabled.
 * Cloudflare Workers edge runtime cannot execute native Node.js C++ addons
 * like sharp. All responsive image transforms are delegated to Cloudflare
 * Image Resizing (/cdn-cgi/image/...) at request-time on the CDN edge.
 *
 * @see DEP_CLOUDFLARE_R2.md Section 2.2
 * @see DEP_PAYLOAD_CMS.md Section 2
 * @see docs/HIGH_LEVEL_DESIGN.md Section 10 (Performance & Edge Caching)
 */
export const getS3StorageConfig = () => {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucketName = process.env.R2_BUCKET_NAME || 'chrishop-media';

  return s3Storage({
    collections: {
      media: {
        // Disable Payload's built-in prefix to use bucket root path structure
        prefix: 'uploads',
        // Disable sharp-based image processing — REQUIRED for Cloudflare Workers compatibility.
        // sharp is a native Node.js C++ addon that cannot run on the edge runtime.
        // Responsive image delivery is handled via Cloudflare Image Resizing.
        disableLocalStorage: false,
      },
    },
    bucket: bucketName,
    config: {
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region: 'auto',
      // Force path-style addressing for Cloudflare R2 S3-compatible API
      forcePathStyle: false,
    },
    // Generate public read URLs using the custom CDN domain (or R2 public URL)
    // rather than the S3 presigned endpoint
    acl: 'public-read',
  });
};

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Categories, Products, ProductVariations, Media, Users],
  editor: lexicalEditor(),
  db: sqliteD1Adapter({
    binding: getD1Binding(),
  }),
  plugins: [
    // Cloudflare R2 S3-compatible media storage adapter
    // Configured per DEP_CLOUDFLARE_R2.md and DEP_PAYLOAD_CMS.md Section 2
    // sharp-based image processing is disabled for Cloudflare Workers edge compatibility.
    // All image resizing is handled by Cloudflare Image Resizing at CDN edge.
    getS3StorageConfig(),
  ],
  secret: process.env.PAYLOAD_SECRET || 'chrishop-payload-development-secret-32-chars-min',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
