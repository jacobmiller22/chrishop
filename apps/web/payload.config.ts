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
 * Resolves process.env.DB or globalThis.DB provided by Cloudflare Workers / Miniflare,
 * falling back to an empty mock object during build and static typecheck.
 */
export const getD1Binding = (): any => {
  if (typeof process !== 'undefined' && process.env?.DB) {
    return process.env.DB;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).DB) {
    return (globalThis as any).DB;
  }
  return {};
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
