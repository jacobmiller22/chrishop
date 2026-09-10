import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
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
  secret: process.env.PAYLOAD_SECRET || 'chrishop-payload-development-secret-32-chars-min',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
