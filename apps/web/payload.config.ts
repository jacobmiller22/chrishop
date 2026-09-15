import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { Categories } from './src/collections/Categories';
import { ProductLines } from './src/collections/ProductLines';
import { Products } from './src/collections/Products';
import { ProductVariations } from './src/collections/ProductVariations';
import { Media } from './src/collections/Media';
import { Users } from './src/collections/Users';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export const getD1Binding = (): any => {
  return new Proxy({} as any, {
    get(target, prop, receiver) {
      const activeDb =
        (typeof globalThis !== 'undefined' && (globalThis as any).DB) ||
        (typeof globalThis !== 'undefined' &&
          (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env?.DB) ||
        (typeof process !== 'undefined' && (process.env as any)?.DB);

      if (activeDb && typeof activeDb[prop] !== 'undefined') {
        const val = Reflect.get(activeDb, prop, receiver);
        return typeof val === 'function' ? val.bind(activeDb) : val;
      }

      if (prop === 'prepare') {
        return (_sql: string) => ({
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
        });
      }

      if (prop === 'batch') {
        return async (statements: any[]) => statements.map(() => ({ results: [], success: true, meta: {} }));
      }

      if (prop === 'exec') {
        return async (_query: string) => ({ count: 0, duration: 0 });
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

export const d1Adapter = sqliteD1Adapter;

export const getS3StorageConfig = () => {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucketName = process.env.R2_BUCKET_NAME || 'chrishop-media';
  const enabled = Boolean(endpoint && accessKeyId && secretAccessKey);

  return s3Storage({
    enabled,
    collections: {
      media: {
        prefix: 'uploads',
        disableLocalStorage: true,
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
      forcePathStyle: false,
    },
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
  collections: [Categories, ProductLines, Products, ProductVariations, Media, Users],
  editor: lexicalEditor(),
  db: sqliteD1Adapter({
    binding: getD1Binding(),
    push: false,
    allowIDOnCreate: true,
  }),
  plugins: [getS3StorageConfig()],
  secret: process.env.PAYLOAD_SECRET || 'chrishop-payload-development-secret-32-chars-min',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
