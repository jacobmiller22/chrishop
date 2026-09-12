import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

  it('should route and render distinct collection views for all registered collections in worker', async () => {
    const workerPath = path.join(rootDir, '.open-next/worker.js');
    assert.ok(fs.existsSync(workerPath), 'worker.js must exist');
    const worker = (await import(workerPath)).default;

    const mockEnv = {
      DB: { prepare: () => ({ all: () => [] }) },
      NEXT_CACHE_WORKERS_KV: { get: () => null, put: () => {} },
      BUCKET: { get: () => null, put: () => {} },
      ASSETS: { fetch: async () => new Response('Asset Not Found', { status: 404 }) },
      SITE_URL: 'https://chrishop.jacobmiller22.com',
      CMS_URL: 'https://chrishop.jacobmiller22.com',
    };

    const collections = [
      { slug: 'products', title: 'Products', itemMarker: 'The Bushwhack Storm Anorak' },
      { slug: 'categories', title: 'Categories', itemMarker: 'Apparel' },
      { slug: 'product-variations', title: 'Product Variations', itemMarker: 'Field Olive — Standard Run' },
      { slug: 'media', title: 'Media', itemMarker: 'media/bushwhack-storm-anorak/hero.jpeg' },
      { slug: 'users', title: 'Users', itemMarker: 'admin@chrishop.jacobmiller22.com' },
    ];

    for (const col of collections) {
      const request = new Request(`https://chrishop.jacobmiller22.com/admin/collections/${col.slug}`);
      const response = await worker.fetch(request, mockEnv, {});

      assert.equal(response.status, 200, `Route /admin/collections/${col.slug} must return 200`);
      assert.match(response.headers.get('content-type') || '', /text\/html/);

      const html = await response.text();

      // Crucial assertion: Must NOT render Administrative Dashboard!
      assert.ok(!html.includes('Administrative Dashboard'), `Collection route ${col.slug} must NOT render Administrative Dashboard`);

      // Must render collection title
      assert.ok(html.includes(`<h1 class="payload-page-title">${col.title}</h1>`), `Must render ${col.title} heading`);

      // Must contain breadcrumbs pointing back to Dashboard
      assert.ok(html.includes('<nav class="payload-breadcrumbs">'), 'Must render breadcrumbs');
      assert.ok(html.includes('href="/admin"'), 'Breadcrumbs must link to Dashboard');
      assert.ok(html.includes(col.title), 'Breadcrumbs must include collection title');

      // Must have active class in sidebar navigation
      assert.ok(
        html.includes(`href="/admin/collections/${col.slug}" class="payload-nav-link active"`),
        `Sidebar link for ${col.slug} must have active class`
      );

      // Must render collection data table and records
      assert.ok(html.includes('class="payload-table"'), 'Must render data table');
      assert.ok(html.includes(col.itemMarker), `Must render authentic records containing ${col.itemMarker}`);

      // Must render action buttons (+ Create New)
      assert.ok(html.includes(`href="/admin/collections/${col.slug}/create"`), 'Must link to Create New view');
    }
  });

  it('should render document edit and create views under /admin/collections/:slug/*', async () => {
    const workerPath = path.join(rootDir, '.open-next/worker.js');
    const worker = (await import(workerPath)).default;

    const mockEnv = {
      DB: { prepare: () => ({ all: () => [] }) },
      NEXT_CACHE_WORKERS_KV: { get: () => null, put: () => {} },
      BUCKET: { get: () => null, put: () => {} },
      ASSETS: { fetch: async () => new Response('Asset Not Found', { status: 404 }) },
      SITE_URL: 'https://chrishop.jacobmiller22.com',
      CMS_URL: 'https://chrishop.jacobmiller22.com',
    };

    // Test Document Edit View
    const editReq = new Request('https://chrishop.jacobmiller22.com/admin/collections/products/bushwhack-storm-anorak');
    const editRes = await worker.fetch(editReq, mockEnv, {});
    assert.equal(editRes.status, 200);
    const editHtml = await editRes.text();

    assert.ok(!editHtml.includes('Administrative Dashboard'), 'Edit view must not render dashboard');
    assert.ok(editHtml.includes('Edit Product: bushwhack-storm-anorak'), 'Edit view must display Edit Product heading');
    assert.ok(editHtml.includes('Save Changes'), 'Must have Save Changes button');
    assert.ok(editHtml.includes('href="/admin/collections/products"'), 'Must link back to collection');

    // Test Document Create View
    const createReq = new Request('https://chrishop.jacobmiller22.com/admin/collections/products/create');
    const createRes = await worker.fetch(createReq, mockEnv, {});
    assert.equal(createRes.status, 200);
    const createHtml = await createRes.text();

    assert.ok(!createHtml.includes('Administrative Dashboard'), 'Create view must not render dashboard');
    assert.ok(createHtml.includes('Create New Product'), 'Create view must display Create New heading');
    assert.ok(createHtml.includes('Save &amp; Publish'), 'Must have Save & Publish button');
  });
});
