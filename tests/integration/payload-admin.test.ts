import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import payloadConfigPromise from '../../apps/web/payload.config';

describe('Payload CMS v3 Admin Panel & Edge Route Integration', () => {
  const rootDir = process.cwd();

  it('should compile and build sanitized Payload configuration with collections', async () => {
    const config = await payloadConfigPromise;
    assert.ok(config, 'Payload config must resolve successfully');
    assert.ok(Array.isArray(config.collections), 'Collections must be an array');

    const collectionSlugs = config.collections.map((c) => c.slug);
    assert.ok(collectionSlugs.includes('categories'), 'categories collection must exist');
    assert.ok(collectionSlugs.includes('products'), 'products collection must exist');
    assert.ok(collectionSlugs.includes('product_variations'), 'product_variations collection must exist');
    assert.ok(collectionSlugs.includes('media'), 'media collection must exist');
    assert.ok(collectionSlugs.includes('users'), 'users collection must exist');
  });

  it('should configure Payload admin panel with users auth collection', async () => {
    const config = await payloadConfigPromise;
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

  it('should verify open-next.config.ts configures function splitting for admin and storefront', () => {
    const configPath = path.join(rootDir, 'apps/web/open-next.config.ts');
    assert.ok(fs.existsSync(configPath), 'open-next.config.ts must exist');
    const content = fs.readFileSync(configPath, 'utf-8');
    assert.ok(content.includes('functions:'), 'Must declare functions map');
    assert.ok(content.includes('admin:'), 'Must declare admin function');
    assert.ok(content.includes('app/(payload)/admin/[[...segments]]/page'), 'Must map admin page route');
    assert.ok(content.includes('app/(payload)/api/[...slug]/route'), 'Must map payload api route');
    assert.ok(content.includes('app/(payload)/api/graphql/route'), 'Must map payload graphql route');
    assert.ok(content.includes('admin/*'), 'Must pattern match admin/*');
  });

  it('should compile and extract authentic Payload CMS native CSS stylesheet into assets', () => {
    const payloadCssPath = path.join(
      rootDir,
      '.open-next/assets/_next/static/css/payload.css'
    );
    assert.ok(fs.existsSync(payloadCssPath), 'payload.css must exist in .open-next/assets');
    const content = fs.readFileSync(payloadCssPath, 'utf-8');
    assert.ok(content.length > 50000, `payload.css must be substantial (>50KB), got ${content.length}`);
    assert.ok(content.includes('payload-default') || content.includes('--theme-elevation-'), 'Must contain authentic Payload design tokens');
  });
});
