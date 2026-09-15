import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Ensure CJS/ESM interop for @next/env under tsx/esbuild
try {
  const nextEnv = require('../../apps/web/node_modules/@next/env');
  if (nextEnv && !nextEnv.default) {
    nextEnv.default = nextEnv;
  }
} catch {}

describe('Payload CMS v3 Admin Panel & Edge Route Integration', () => {
  const rootDir = process.cwd();

  const getPayloadConfig = async () => {
    const mod = await import('../../apps/web/payload.config');
    return mod.default;
  };

  it('should compile and build sanitized Payload configuration with collections', async () => {
    const config = await getPayloadConfig();
    assert.ok(config, 'Payload config must resolve successfully');
    assert.ok(Array.isArray(config.collections), 'Collections must be an array');

    const collectionSlugs = config.collections.map((c: any) => c.slug);
    assert.ok(collectionSlugs.includes('categories'), 'categories collection must exist');
    assert.ok(collectionSlugs.includes('products'), 'products collection must exist');
    assert.ok(!collectionSlugs.includes('product_variations'), 'product_variations collection purged in Candidate 4');
    assert.ok(collectionSlugs.includes('media'), 'media collection must exist');
    assert.ok(collectionSlugs.includes('users'), 'users collection must exist');
  });

  it('should configure Payload admin panel with users auth collection', async () => {
    const config = await getPayloadConfig();
    assert.ok(config.admin, 'Admin configuration must exist');
    assert.equal(config.admin.user, 'users', 'Admin user collection must be "users"');
  });

  it('should verify Payload Admin App Router files are in place and valid', () => {
    const adminPagePath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/admin/[[...segments]]/page.tsx'
    );
    const notFoundPath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/admin/[[...segments]]/not-found.tsx'
    );
    const layoutPath = path.join(rootDir, 'apps/web/src/app/(payload)/layout.tsx');
    const apiRoutePath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/api/[...slug]/route.ts'
    );
    const graphqlRoutePath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/api/graphql/route.ts'
    );

    assert.ok(fs.existsSync(adminPagePath), 'Payload admin page.tsx must exist');
    assert.ok(fs.existsSync(notFoundPath), 'Payload admin not-found.tsx must exist');
    assert.ok(fs.existsSync(layoutPath), 'Payload (payload)/layout.tsx must exist');
    assert.ok(fs.existsSync(apiRoutePath), 'Payload REST API route.ts must exist');
    assert.ok(fs.existsSync(graphqlRoutePath), 'Payload GraphQL route.ts must exist');

    const adminPageContent = fs.readFileSync(adminPagePath, 'utf-8');
    assert.ok(
      adminPageContent.includes('@payloadcms/next/views'),
      'Admin page must import from @payloadcms/next/views'
    );
    assert.ok(adminPageContent.includes('RootPage'), 'Admin page must render RootPage');
    assert.ok(
      adminPageContent.includes('generateMetadata'),
      'Admin page must export generateMetadata'
    );
  });

  it('should verify Payload importMap is populated with storage and UI components', () => {
    const importMapPath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/admin/importMap.js'
    );
    assert.ok(fs.existsSync(importMapPath), 'importMap.js must exist');
    const content = fs.readFileSync(importMapPath, 'utf-8');
    assert.ok(
      content.includes('@payloadcms/storage-s3/client#S3ClientUploadHandler'),
      'importMap must define S3ClientUploadHandler to prevent NestProviders from blanking the UI'
    );
    assert.ok(
      !content.trim().endsWith('export const importMap = {};'),
      'importMap must not be an empty stub'
    );
  });

  it('should verify Payload REST and GraphQL endpoints are configured for Next.js App Router', () => {
    const apiRoutePath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/api/[...slug]/route.ts'
    );
    const content = fs.readFileSync(apiRoutePath, 'utf-8');
    assert.ok(content.includes('REST_GET'), 'API route must export REST_GET');
    assert.ok(content.includes('REST_POST'), 'API route must export REST_POST');

    const gqlPath = path.join(
      rootDir,
      'apps/web/src/app/(payload)/api/graphql/route.ts'
    );
    const gqlContent = fs.readFileSync(gqlPath, 'utf-8');
    assert.ok(gqlContent.includes('GRAPHQL_POST'), 'GraphQL route must export GRAPHQL_POST');
  });

  it('should verify open-next.config.ts configures unified single worker via defineCloudflareConfig', () => {
    const configPath = path.join(rootDir, 'apps/web/open-next.config.ts');
    assert.ok(fs.existsSync(configPath), 'open-next.config.ts must exist');
    const content = fs.readFileSync(configPath, 'utf-8');
    assert.ok(content.includes('defineCloudflareConfig'), 'Must configure defineCloudflareConfig');
    assert.ok(!content.includes('functions:'), 'Must NOT declare split functions map in unified single worker architecture');
  });

  it('should compile and extract authentic Payload CMS native CSS stylesheet into assets', () => {
    const payloadCssPath = path.join(
      rootDir,
      '.open-next/assets/_next/static/css/payload.css'
    );
    if (!fs.existsSync(payloadCssPath)) {
      execSync('pnpm run build:worker', { cwd: rootDir, stdio: 'pipe' });
    }
    assert.ok(fs.existsSync(payloadCssPath), 'payload.css must exist in .open-next/assets');
    const content = fs.readFileSync(payloadCssPath, 'utf-8');
    assert.ok(content.length > 50000, `payload.css must be substantial (>50KB), got ${content.length}`);
    assert.ok(content.includes('payload-default') || content.includes('--theme-elevation-'), 'Must contain authentic Payload design tokens');
  });

  it('should verify route group isolation: storefront layout is isolated from payload admin layout', () => {
    const storefrontLayoutPath = path.join(
      rootDir,
      'apps/web/src/app/(storefront)/layout.tsx'
    );
    const rootLayoutPath = path.join(rootDir, 'apps/web/src/app/layout.tsx');
    const payloadLayoutPath = path.join(rootDir, 'apps/web/src/app/(payload)/layout.tsx');

    assert.ok(fs.existsSync(storefrontLayoutPath), '(storefront)/layout.tsx must exist');
    assert.ok(!fs.existsSync(rootLayoutPath), 'Root app/layout.tsx must NOT exist to avoid layout nesting collisions');
    assert.ok(fs.existsSync(payloadLayoutPath), '(payload)/layout.tsx must exist as independent root layout');

    const storefrontContent = fs.readFileSync(storefrontLayoutPath, 'utf-8');
    assert.ok(storefrontContent.includes('<Header'), 'Storefront layout must render storefront Header');
    assert.ok(storefrontContent.includes('<main'), 'Storefront layout must contain its own main container');

    const payloadContent = fs.readFileSync(payloadLayoutPath, 'utf-8');
    assert.ok(payloadContent.includes('RootLayout'), 'Payload layout must render Payload RootLayout');
    assert.ok(!payloadContent.includes('@chrishop/ui'), 'Payload layout must NOT bleed storefront Header components');
  });

  it('should verify unified worker entrypoint (.open-next/worker.js) dispatches to default server-function', () => {
    const workerPath = path.join(rootDir, '.open-next/worker.js');
    assert.ok(fs.existsSync(workerPath), 'worker.js must exist');
    const content = fs.readFileSync(workerPath, 'utf-8');

    // Verifies unified single worker dispatching
    assert.ok(
      content.includes('./server-functions/default/handler.mjs'),
      'Must route to default server-function'
    );
    assert.ok(
      !content.includes('./server-functions/admin/handler.mjs'),
      'Must not route to split admin server-function'
    );
    assert.ok(
      content.includes('/api/health'),
      'Must include edge health check probe'
    );
    assert.ok(
      content.includes('/media/'),
      'Must include R2 media direct delivery handler'
    );
  });

  it('should verify deprecation of synthetic HTML mockups in build-worker.ts and worker.js', () => {
    const buildWorkerContent = fs.readFileSync(path.join(rootDir, 'scripts/build-worker.ts'), 'utf-8');
    assert.ok(!buildWorkerContent.includes('renderPayloadAdmin'), 'build-worker.ts must not contain renderPayloadAdmin mockup');
    assert.ok(!buildWorkerContent.includes('PAYLOAD_COLLECTIONS'), 'build-worker.ts must not contain PAYLOAD_COLLECTIONS mock array');

    const workerContent = fs.readFileSync(path.join(rootDir, '.open-next/worker.js'), 'utf-8');
    assert.ok(!workerContent.includes('renderPayloadAdmin'), 'worker.js must not contain renderPayloadAdmin mockup');
    assert.ok(!workerContent.includes('PAYLOAD_COLLECTIONS'), 'worker.js must not contain PAYLOAD_COLLECTIONS mock array');
  });
});
