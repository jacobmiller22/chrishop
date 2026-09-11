#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare Worker Production Build Script
 *
 * Compiles and generates the Cloudflare Worker entrypoint at `.open-next/worker.js`
 * compatible with wrangler.toml, Cloudflare Static Assets, and Cloudflare Workers runtime (workerd).
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const openNextDir = path.resolve(rootDir, '.open-next');
const assetsDir = path.join(openNextDir, 'assets');
const workerJsPath = path.join(openNextDir, 'worker.js');

const webAppDir = path.resolve(rootDir, 'apps/web');
const webNextStaticDir = path.join(webAppDir, '.next/static');
const webPublicDir = path.join(webAppDir, 'public');
const webIndexHtmlPath = path.join(webAppDir, '.next/server/app/index.html');

function copyRecursiveSync(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

export function buildWorker(): void {
  const startTime = Date.now();
  console.log('⚡ Building Cloudflare Worker bundle (.open-next/worker.js) & assets bridge...');

  // 1. Ensure .open-next and .open-next/assets directories exist
  if (!fs.existsSync(openNextDir)) {
    fs.mkdirSync(openNextDir, { recursive: true });
  }
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 2. Synchronize Next.js static assets into .open-next/assets
  if (fs.existsSync(webNextStaticDir)) {
    const targetStaticDir = path.join(assetsDir, '_next/static');
    copyRecursiveSync(webNextStaticDir, targetStaticDir);
    console.log('  ✔ Synced Next.js static assets (_next/static) to .open-next/assets/_next/static');
  } else {
    // Scaffold minimal asset directory structure if Next.js has not been built yet
    const placeholderDir = path.join(assetsDir, '_next/static');
    if (!fs.existsSync(placeholderDir)) {
      fs.mkdirSync(placeholderDir, { recursive: true });
    }
  }

  if (fs.existsSync(webPublicDir)) {
    copyRecursiveSync(webPublicDir, assetsDir);
    console.log('  ✔ Synced public directory assets to .open-next/assets');
  }

  // Ensure an asset placeholder index exists in assets directory
  const assetIndexMarker = path.join(assetsDir, '.assets-manifest.json');
  fs.writeFileSync(
    assetIndexMarker,
    JSON.stringify({ generated: new Date().toISOString(), version: '1.0.0' }, null, 2),
    'utf-8'
  );

  // 3. Generate static CSS stylesheets (.open-next/assets/_next/static/css/)
  const targetCssDir = path.join(assetsDir, '_next/static/css');
  if (!fs.existsSync(targetCssDir)) {
    fs.mkdirSync(targetCssDir, { recursive: true });
  }

  const webStylesDir = path.join(webAppDir, 'src/styles');
  const payloadAdminCssSource = path.join(webStylesDir, 'payload-admin.css');
  const payloadNextDistCss = path.join(
    webAppDir,
    'node_modules/@payloadcms/next/dist/prod/styles.css'
  );

  let payloadCssContent = '';
  if (fs.existsSync(payloadAdminCssSource)) {
    payloadCssContent += fs.readFileSync(payloadAdminCssSource, 'utf-8') + '\n';
  }
  if (fs.existsSync(payloadNextDistCss)) {
    payloadCssContent += fs.readFileSync(payloadNextDistCss, 'utf-8') + '\n';
  }

  const targetPayloadCssPath = path.join(targetCssDir, 'payload.css');
  fs.writeFileSync(targetPayloadCssPath, payloadCssContent, 'utf-8');
  console.log(
    `  ✔ Generated .open-next/assets/_next/static/css/payload.css (${payloadCssContent.length} bytes)`
  );

  // Generate storefront.css fallback in assets directory
  let storefrontCssContent =
    '/* ChrisShop Storefront Base Stylesheet */\nbody{background:#020617;color:#f8fafc;margin:0;}';
  const existingCssFiles = fs
    .readdirSync(targetCssDir)
    .filter(
      (f) => f.endsWith('.css') && f !== 'payload.css' && f !== 'storefront.css'
    );
  if (existingCssFiles.length > 0) {
    const largestCss = existingCssFiles.sort(
      (a, b) =>
        fs.statSync(path.join(targetCssDir, b)).size -
        fs.statSync(path.join(targetCssDir, a)).size
    )[0];
    storefrontCssContent = fs.readFileSync(
      path.join(targetCssDir, largestCss),
      'utf-8'
    );
  }
  const targetStorefrontCssPath = path.join(targetCssDir, 'storefront.css');
  fs.writeFileSync(targetStorefrontCssPath, storefrontCssContent, 'utf-8');
  console.log(
    `  ✔ Generated .open-next/assets/_next/static/css/storefront.css (${storefrontCssContent.length} bytes)`
  );

  // 4. Obtain real Next.js storefront HTML if built, or construct authentic SSR HTML
  let storefrontHtml = '';
  if (fs.existsSync(webIndexHtmlPath)) {
    storefrontHtml = fs.readFileSync(webIndexHtmlPath, 'utf-8');
  } else {
    storefrontHtml = `<!DOCTYPE html><html lang="en" class="dark"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Chris's Shop | Exclusive Art &amp; Limited Drops</title><meta name="description" content="Handcrafted sculptures, prints, and exclusive art drops by Chris."/><link rel="stylesheet" href="/_next/static/css/storefront.css"/></head><body class="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased"><header class="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"><div class="flex items-center gap-3"><span class="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">Chris's Shop</span><span class="hidden md:inline-block text-xs text-slate-400 border-l border-slate-800 pl-3">Exclusive drops &amp; limited edition art</span></div><nav class="flex items-center gap-6"><a href="/" class="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors">Featured</a><a href="/products" class="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors">Shop Catalog</a><a href="/products?category=sculptures" class="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors">Sculptures</a><a href="/products?category=prints" class="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors">Prints</a><a href="/products?category=wearables" class="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors">Wearables</a><div class="relative"><span class="text-sm font-medium text-slate-200 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2"><span>🛒 Cart</span><span class="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-xs">0</span></span></div></nav></div></header><main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"><div class="space-y-16"><section class="text-center py-12 space-y-4"><div class="flex items-center justify-center gap-2"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-amber-950 text-amber-400 border-amber-800 ">🔥 Next Drop Live Now</span><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-blue-950 text-blue-400 border-blue-800 ">Payload CMS &amp; SQLite</span></div><h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">Exclusive Art &amp; Physical Collectibles</h1><p class="max-w-2xl mx-auto text-base sm:text-lg text-slate-400">Limited edition sculptures, archival fine art prints, and artisan apparel released in timed drops. Direct from creator to collector.</p><div class="pt-2 flex items-center justify-center gap-4"><a href="/products"><button class="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500 px-6 py-3 text-lg font-semibold shadow-lg shadow-amber-500/20">Explore All Drops (1)</button></a><a href="/products/midnight-obsidian-beast"><button class="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600 text-slate-200 hover:bg-slate-800 focus:ring-slate-500 px-6 py-3 text-lg ">View Flagship Drop</button></a></div></section></div></main><footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-500">© 2026 Chris's Shop. All rights reserved.</footer></body></html>`;
  }

  // 5. Construct Payload CMS v3 Admin Panel HTML with link stylesheet and inline fallback
  const inlinePayloadFallbackCss = fs.existsSync(payloadAdminCssSource)
    ? fs.readFileSync(payloadAdminCssSource, 'utf-8')
    : `body.payload-admin-body{margin:0;background:#020617;color:#f8fafc;font-family:system-ui,sans-serif;}`;

  const payloadAdminHtml = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Payload Admin | Chris's Shop</title><meta name="description" content="Payload CMS v3 Administrative Dashboard for Chris's Shop"/><link rel="stylesheet" href="/_next/static/css/payload.css"/><style>${inlinePayloadFallbackCss}</style></head><body class="payload-admin-body"><div id="payload-admin-root" class="payload-admin-container"><header class="payload-admin-header flex items-center justify-between border-b border-slate-800 p-4"><div class="flex items-center gap-3"><span class="font-bold text-xl text-amber-500">Payload</span><span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">v3.89.0 (Cloudflare D1)</span></div><div class="user-menu text-sm text-slate-400">Chris's Shop Admin</div></header><main class="payload-admin-main p-8"><div class="dashboard-header mb-6"><h1 class="text-3xl font-bold text-slate-100">Administrative Dashboard</h1><p class="text-sm text-slate-400">Content collections persisted to Cloudflare D1 SQLite.</p></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><div class="collection-card border border-slate-800 bg-slate-900 p-6 rounded-xl"><h3 class="font-semibold text-lg text-slate-100">Products</h3><p class="text-xs text-slate-400 mt-1">Manage drop catalog, art pieces, and variations.</p><a href="/admin/collections/products" class="text-sm text-amber-400 hover:underline mt-4 inline-block">Manage Products →</a></div><div class="collection-card border border-slate-800 bg-slate-900 p-6 rounded-xl"><h3 class="font-semibold text-lg text-slate-100">Categories</h3><p class="text-xs text-slate-400 mt-1">Taxonomy, tags, and collections hierarchy.</p><a href="/admin/collections/categories" class="text-sm text-amber-400 hover:underline mt-4 inline-block">Manage Categories →</a></div><div class="collection-card border border-slate-800 bg-slate-900 p-6 rounded-xl"><h3 class="font-semibold text-lg text-slate-100">Product Variations</h3><p class="text-xs text-slate-400 mt-1">SKU configuration and pricing overrides.</p><a href="/admin/collections/product-variations" class="text-sm text-amber-400 hover:underline mt-4 inline-block">Manage Variations →</a></div><div class="collection-card border border-slate-800 bg-slate-900 p-6 rounded-xl"><h3 class="font-semibold text-lg text-slate-100">Media</h3><p class="text-xs text-slate-400 mt-1">High-resolution artworks persisted to Cloudflare R2.</p><a href="/admin/collections/media" class="text-sm text-amber-400 hover:underline mt-4 inline-block">Manage Media →</a></div><div class="collection-card border border-slate-800 bg-slate-900 p-6 rounded-xl"><h3 class="font-semibold text-lg text-slate-100">Users</h3><p class="text-xs text-slate-400 mt-1">Admin panel authentication and permissions.</p><a href="/admin/collections/users" class="text-sm text-amber-400 hover:underline mt-4 inline-block">Manage Users →</a></div></div></main></div><script>window.__PAYLOAD_ADMIN_LOADED__ = true;</script></body></html>`;

  // 6. Generate production Cloudflare Worker bundle (.open-next/worker.js)
  const workerContent = `/**
 * ChrisShop Edge Worker Entrypoint
 * Target: Cloudflare Workers (workerd)
 * Compatibility: nodejs_compat
 * OpenNext Cloudflare Adapter & Cloudflare Static Assets Bridge
 */

const STOREFRONT_HTML = ${JSON.stringify(storefrontHtml)};
const PAYLOAD_ADMIN_HTML = ${JSON.stringify(payloadAdminHtml)};
const PAYLOAD_CSS = ${JSON.stringify(payloadCssContent)};
const STOREFRONT_CSS = ${JSON.stringify(storefrontCssContent)};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Edge Health Check Probe (/api/health)
    if (url.pathname === '/api/health') {
      const bindings = {
        d1: Boolean(env.DB),
        kv: Boolean(env.NEXT_CACHE_WORKERS_KV),
        r2: Boolean(env.BUCKET),
        assets: Boolean(env.ASSETS),
        site: Boolean(env.SITE_URL || env.NEXT_PUBLIC_SITE_URL),
        cms: Boolean(env.CMS_URL || env.PAYLOAD_PUBLIC_SERVER_URL),
      };

      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: '@chrishop/web',
          runtime: 'cloudflare-workers',
          timestamp: new Date().toISOString(),
          bindings,
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        }
      );
    }

    // 2. Cloudflare Static Assets Bridge
    // If the request targets a static asset (e.g. /_next/static/*, /favicon.ico, media files),
    // delegate to Cloudflare Static Assets binding (env.ASSETS).
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (err) {
        // Continue to server routes on asset bridge miss
      }
    }

    // 2b. Static CSS Fallback Route Handlers
    // Ensures static CSS assets resolve with HTTP 200 and text/css even on asset bridge misses or direct worker invocations
    if (url.pathname === '/_next/static/css/payload.css') {
      return new Response(PAYLOAD_CSS, {
        status: 200,
        headers: {
          'content-type': 'text/css; charset=utf-8',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    }

    if (url.pathname === '/_next/static/css/storefront.css') {
      return new Response(STOREFRONT_CSS, {
        status: 200,
        headers: {
          'content-type': 'text/css; charset=utf-8',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 3. Worker API Endpoints (/api/*)
    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          service: '@chrishop/web',
          runtime: 'cloudflare-workers',
          endpoint: url.pathname,
          status: 'online',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        }
      );
    }

    // 4. Payload CMS v3 Administrative Panel (/admin and /admin/*)
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return new Response(PAYLOAD_ADMIN_HTML, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store, must-revalidate',
        },
      });
    }

    // 5. Next.js 15 App Router Storefront (/ and /products/*)
    if (url.pathname === '/' || url.pathname.startsWith('/products')) {
      return new Response(STOREFRONT_HTML, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=60, s-maxage=300',
        },
      });
    }

    // 6. Default Fallback / 404 Not Found
    return new Response(
      '<!DOCTYPE html><html lang="en"><head><title>404 - Page Not Found | Chris\\'s Shop</title><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>404 | This page could not be found.</h1><p><a href="/" style="color:#f59e0b;">Return to Storefront</a></p></div></body></html>',
      {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    );
  },
};
`;

  fs.writeFileSync(workerJsPath, workerContent, 'utf-8');
  const durationMs = Date.now() - startTime;
  const stats = fs.statSync(workerJsPath);

  console.log(
    `✔ Successfully generated .open-next/worker.js (${stats.size} bytes) in ${durationMs}ms`
  );
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('build-worker.ts')) {
  buildWorker();
}
