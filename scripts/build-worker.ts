#!/usr/bin/env tsx
/**
 * ChrisShop Cloudflare Worker Production Build Script
 *
 * Option B: Unified Single Worker Architecture
 * Builds Next.js & Genuine Payload CMS via @opennextjs/cloudflare,
 * synchronizes build artifacts to monorepo root .open-next, and generates
 * the unified Cloudflare Worker entrypoint with bindings, health check, and R2 media delivery.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const openNextDir = path.resolve(rootDir, '.open-next');
const assetsDir = path.join(openNextDir, 'assets');
const workerJsPath = path.join(openNextDir, 'worker.js');

const webAppDir = path.resolve(rootDir, 'apps/web');
const webOpenNextDir = path.join(webAppDir, '.open-next');
const webNextStaticDir = path.join(webAppDir, '.next/static');
const webPublicDir = path.join(webAppDir, 'public');

export function buildWorker(): void {
  const startTime = Date.now();
  console.log('⚡ Building ChrisShop Unified Cloudflare Worker bundle (.open-next/worker.js)...');

  // 1. Compile Next.js & Payload CMS via unpatched OpenNext if needed
  const defaultHandler = path.join(webOpenNextDir, 'server-functions/default/handler.mjs');
  const webNextDir = path.join(webAppDir, '.next');
  const needsCompile =
    !fs.existsSync(defaultHandler) ||
    (fs.existsSync(webNextDir) &&
      fs.statSync(webNextDir).mtimeMs > fs.statSync(defaultHandler).mtimeMs);

  if (needsCompile) {
    console.log('  ▶ Compiling via @opennextjs/cloudflare...');
    execSync('pnpm --filter @chrishop/web exec opennextjs-cloudflare build --skipWranglerConfigCheck', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  }

  // 2. Synchronize OpenNext compilation artifacts into root .open-next
  fs.mkdirSync(openNextDir, { recursive: true });

  if (fs.existsSync(webOpenNextDir)) {
    fs.cpSync(webOpenNextDir, openNextDir, {
      recursive: true,
      dereference: false,
      force: true,
      filter: (src) => !src.includes('node_modules'),
    });
    console.log('  ✔ Synchronized OpenNext build artifacts to root .open-next');
  }

  // Ensure OpenNext require-hook shim is applied to Next 16 server bundle on Cloudflare Workers
  const handlerFile = path.join(openNextDir, 'server-functions/default/apps/web/handler.mjs');
  if (fs.existsSync(handlerFile)) {
    let handlerContent = fs.readFileSync(handlerFile, 'utf-8');
    if (handlerContent.includes('require_require_hook()')) {
      handlerContent = handlerContent.replace(
        'require_require_hook()',
        '/* OpenNext require-hook edge shim */ void 0'
      );
      fs.writeFileSync(handlerFile, handlerContent, 'utf-8');
      console.log('  ✔ Applied OpenNext edge require-hook shim to server handler');
    }
  }

  // Ensure open-next.config.mjs is present at root of .open-next for direct relative imports
  const buildConfigMjs = path.join(openNextDir, '.build/open-next.config.mjs');
  const middlewareConfigMjs = path.join(openNextDir, 'middleware/open-next.config.mjs');
  const targetConfigMjs = path.join(openNextDir, 'open-next.config.mjs');
  if (fs.existsSync(buildConfigMjs)) {
    fs.copyFileSync(buildConfigMjs, targetConfigMjs);
  } else if (fs.existsSync(middlewareConfigMjs)) {
    fs.copyFileSync(middlewareConfigMjs, targetConfigMjs);
  }

  // 3. Ensure static assets are complete
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  const targetStaticDir = path.join(assetsDir, '_next/static');
  const targetCssDir = path.join(targetStaticDir, 'css');
  if (!fs.existsSync(targetCssDir)) {
    fs.mkdirSync(targetCssDir, { recursive: true });
  }
  if (fs.existsSync(webNextStaticDir)) {
    fs.cpSync(webNextStaticDir, targetStaticDir, { recursive: true, dereference: false });
  }
  if (fs.existsSync(webPublicDir)) {
    fs.cpSync(webPublicDir, assetsDir, { recursive: true, dereference: false });
  }

  // Copy canonical Payload CSS stylesheet
  const destPayloadCss = path.join(targetCssDir, 'payload.css');
  try {
    const payloadCssSource = require.resolve('@payloadcms/next/css', {
      paths: [rootDir, webAppDir, path.join(rootDir, 'node_modules')],
    });
    if (fs.existsSync(payloadCssSource)) {
      fs.copyFileSync(payloadCssSource, destPayloadCss);
      console.log('  ✔ Copied authentic Payload CSS stylesheet to assets');
    }
  } catch (err: any) {
    console.warn('  ⚠️ Could not resolve @payloadcms/next/css:', err.message);
  }

  // 4. Generate Edge Environment Polyfills (.open-next/edge-env.js)
  const edgeEnvContent = `/**
 * Edge Environment Polyfills for Cloudflare Workers (workerd)
 * Ensures standard Node.js globals expected by libraries like undici/payload exist.
 */
import Module from "node:module";
import path from "node:path";

if (typeof globalThis.require === "undefined") {
  const customRequire = function (id) {
    if (id === "module" || id === "node:module") {
      return Module;
    }
    if (id === "path" || id === "node:path") {
      return path;
    }
    try {
      return Module.createRequire(import.meta.url)(id);
    } catch {
      return {};
    }
  };
  customRequire.resolve = function (id) {
    return id;
  };
  globalThis.require = customRequire;
}
if (typeof process !== "undefined") {
  try {
    if (!process.versions) {
      process.versions = { node: "22.0.0" };
    } else if (!process.versions.node) {
      process.versions.node = "22.0.0";
    }
  } catch {}
  if (!process.version) {
    try {
      process.version = "v22.0.0";
    } catch {}
  }
}
if (typeof globalThis.MessagePort === "undefined") {
  globalThis.MessagePort = class MessagePort {};
}
if (typeof globalThis.MessageChannel === "undefined") {
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      this.port1 = new globalThis.MessagePort();
      this.port2 = new globalThis.MessagePort();
    }
  };
}
if (typeof globalThis.WeakRef === "undefined") {
  globalThis.WeakRef = class WeakRef {
    constructor(target) {
      this.target = target;
    }
    deref() {
      return this.target;
    }
  };
}
if (typeof globalThis.FinalizationRegistry === "undefined") {
  globalThis.FinalizationRegistry = class FinalizationRegistry {
    constructor(cleanupCallback) {
      this.cleanupCallback = cleanupCallback;
    }
    register() {}
    unregister() {}
  };
}
`;
  fs.writeFileSync(path.join(openNextDir, 'edge-env.js'), edgeEnvContent, 'utf-8');

  // 5. Generate Unified Cloudflare Worker Entrypoint (.open-next/worker.js)
  const workerContent = `/**
 * ChrisShop Unified Edge Worker Entrypoint
 * Option B: Single Worker Architecture (Storefront + Genuine Payload CMS v3)
 */

import "./edge-env.js";
//@ts-expect-error: Will be resolved by wrangler build
import { handleCdnCgiImageRequest, handleImageRequest } from "./cloudflare/images.js";
//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "./cloudflare/init.js";
//@ts-expect-error: Will be resolved by wrangler build
import { maybeGetSkewProtectionResponse } from "./cloudflare/skew-protection.js";
// @ts-expect-error: Will be resolved by wrangler build
import { handler as middlewareHandler } from "./middleware/handler.mjs";

export default {
  async fetch(request, env, ctx) {
    const executionCtx =
      ctx && typeof ctx.waitUntil === "function"
        ? ctx
        : { waitUntil: () => {}, passThroughOnException: () => {} };
    const url = new URL(request.url);

    // 1. Edge Health Check Probe (/api/health)
    if (url.pathname === "/api/health") {
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
          status: "healthy",
          service: "@chrishop/web",
          runtime: "cloudflare-workers",
          timestamp: new Date().toISOString(),
          bindings,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        }
      );
    }

    // 2. Diagnostic Edge Debug Probe (/api/debug)
    if (url.pathname === "/api/debug") {
      const debugInfo = {
        runtime: "cloudflare-workers",
        timestamp: new Date().toISOString(),
        bindings: {
          d1: Boolean(env.DB),
          kv: Boolean(env.NEXT_CACHE_WORKERS_KV),
          r2: Boolean(env.BUCKET),
          assets: Boolean(env.ASSETS),
        },
      };

      if (env.DB && typeof env.DB.prepare === "function") {
        try {
          const tablesResult = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
          debugInfo.tables = (tablesResult?.results || []).map((t) => t.name);

          const usersResult = await env.DB.prepare("SELECT id, email FROM users LIMIT 5").all();
          debugInfo.users = usersResult?.results || [];

          const productsResult = await env.DB.prepare("SELECT count(*) as count FROM products").all();
          debugInfo.productsCount = productsResult?.results?.[0]?.count;
        } catch (dbErr) {
          debugInfo.dbError = { message: dbErr?.message, stack: dbErr?.stack };
        }
      }

      return new Response(JSON.stringify(debugInfo, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    // 2. Edge R2 Media Handler (/media/*)
    if (url.pathname.startsWith("/media/")) {
      const r2Key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
      if (env.BUCKET && typeof env.BUCKET.get === "function") {
        try {
          const r2Object = await env.BUCKET.get(r2Key);
          if (r2Object) {
            const headers = new Headers();
            if (typeof r2Object.writeHttpMetadata === "function") {
              r2Object.writeHttpMetadata(headers);
            }
            if (r2Object.httpEtag) {
              headers.set("etag", r2Object.httpEtag);
            }
            headers.set("cache-control", "public, max-age=604800");
            if (!headers.has("content-type")) {
              headers.set("content-type", "image/jpeg");
            }
            return new Response(r2Object.body, { headers });
          }
        } catch {
          // Fall through to ASSETS on error
        }
      }
    }

    // 3. Static Assets Bridge (env.ASSETS)
    // Only query static assets for GET/HEAD requests outside /api/* to avoid consuming mutation request bodies
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      !url.pathname.startsWith("/api/") &&
      env.ASSETS &&
      typeof env.ASSETS.fetch === "function"
    ) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch {
        // Fall through to server function on asset miss
      }
    }

    // 4. Expose bindings to global scope for Payload & Next.js adapters
    if (env.DB) globalThis.DB = env.DB;
    if (env.BUCKET) globalThis.BUCKET = env.BUCKET;
    if (env.NEXT_CACHE_WORKERS_KV) globalThis.NEXT_CACHE_WORKERS_KV = env.NEXT_CACHE_WORKERS_KV;

    // 5. Execute Unified OpenNext Server Function within Cloudflare Request Context
    try {
      return await runWithCloudflareRequestContext(request, env, executionCtx, async () => {
        const response = maybeGetSkewProtectionResponse(request);
        if (response) {
          return response;
        }

        // Serve images in development
        if (url.pathname.startsWith("/cdn-cgi/image/")) {
          return handleCdnCgiImageRequest(url, env);
        }

        // Fallback for Next.js default image loader
        if (
          url.pathname ===
          \`\${globalThis.__NEXT_BASE_PATH__}/_next/image\${globalThis.__TRAILING_SLASH__ ? "/" : ""}\`
        ) {
          return await handleImageRequest(url, request.headers, env);
        }

        // Dispatch all routes to unified server function (Storefront + Genuine Payload CMS)
        // @ts-expect-error: resolved by wrangler build
        const { handler } = await import("./server-functions/default/handler.mjs");

        let lastError = "";
        const origError = console.error;
        console.error = (...args) => {
          lastError += args.map((a) => (typeof a === "object" ? (a?.stack || a?.message || JSON.stringify(a)) : String(a))).join(" ") + "\\n";
          origError.apply(console, args);
        };

        try {
          // For mutations (POST/PUT/PATCH/DELETE) or API routes, dispatch directly to server handler
          // to preserve the request body stream and eliminate duplicate stream consumption.
          const isMutation = request.method !== "GET" && request.method !== "HEAD";
          let resp;
          if (isMutation || url.pathname.startsWith("/api/")) {
            resp = await handler(request, env, executionCtx, request.signal);
          } else {
            // Run Next.js edge middleware for GET/HEAD page navigation
            const reqOrResp = await middlewareHandler(request, env, executionCtx);
            if (reqOrResp instanceof Response) {
              return reqOrResp;
            }
            resp = await handler(reqOrResp, env, executionCtx, request.signal);
          }

          if (resp && resp.status >= 500 && lastError) {
            const h = new Headers(resp.headers);
            h.set("x-debug-server-error", encodeURIComponent(lastError.slice(0, 1500)));
            return new Response(resp.body, { status: resp.status, headers: h });
          }
          return resp;
        } finally {
          console.error = origError;
        }
      });
    } catch (err) {
      return new Response(
        \`OpenNext Edge Execution Error: \${err?.message || err}\\n\${err?.stack || ""}\`,
        {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }
      );
    }
  },
};
`;

  fs.writeFileSync(workerJsPath, workerContent, 'utf-8');
  fs.writeFileSync(
    path.join(openNextDir, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2),
    'utf-8'
  );
  const durationMs = Date.now() - startTime;
  const stats = fs.statSync(workerJsPath);

  console.log(
    `✔ Successfully built unified .open-next/worker.js (${stats.size} bytes) in ${durationMs}ms`
  );
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('build-worker.ts')) {
  buildWorker();
}
