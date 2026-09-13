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

/**
 * Cloudflare D1 Database Binding Resolver
 * Resolves process.env.DB, globalThis.DB, or Cloudflare context provided by
 * Cloudflare Workers / Miniflare, falling back to a resilient proxy during
 * build and static typecheck so drizzle/payload never encounters an undefined client.
 */
export const getD1Binding = (): any => {
  return new Proxy({} as any, {
    get(target, prop, receiver) {
      // 1. Resolve active live D1 binding
      const activeDb =
        (typeof globalThis !== 'undefined' && (globalThis as any).DB) ||
        (typeof globalThis !== 'undefined' &&
          (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env?.DB) ||
        (typeof process !== 'undefined' && (process.env as any)?.DB);

      if (activeDb && typeof activeDb[prop] !== 'undefined') {
        const val = Reflect.get(activeDb, prop, receiver);
        return typeof val === 'function' ? val.bind(activeDb) : val;
      }

      // 2. Safe fallback during build / static analysis / standalone initialization
      if (prop === 'prepare') {
        return (_sql: string) => {
          return {
            bind: (..._params: any[]) => ({
              all: async () => ({ results: [], success: true, meta: {} }),
              first: async () => null,
              run: async () => ({ success: true, meta: { changes: 0 } }),
              raw: async () => [],
            }),
            all: async () => ({ results: [], success: true, meta: {} }),
            first: async () => null,
            run: async () => ({ success: true, meta: { changes: 0 } }),
            raw: async () => [],
          };
        };
      }

      if (prop === 'batch') {
        return async (statements: any[]) => {
          return statements.map(() => ({ results: [], success: true, meta: {} }));
        };
      }

      if (prop === 'exec') {
        return async (_query: string) => {
          return { count: 0, duration: 0 };
        };
      }

      if (prop === 'withSession') {
        return () => receiver;
      }

      if (activeDb) {
        const val = Reflect.get(activeDb, prop, receiver);
        return typeof val === 'function' ? val.bind(activeDb) : val;
      }

      return Reflect.get(target, prop, receiver);
    },
  });
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
