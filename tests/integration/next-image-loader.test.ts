/**
 * Story 2.43: Custom Next.js Image Loader & Responsive Artwork Media Component for R2
 * Integration Test Suite
 *
 * Verifies:
 * 1. Next.js custom image loader compliance with Next.js imageLoader specifications:
 *    ({ src, width, quality }) => string
 * 2. Cloudflare Image Resizing URL formatting:
 *    /cdn-cgi/image/width=${width},quality=${quality || 85},format=auto/${normalizedPath}
 * 3. Relative R2 path normalization (stripping leading slashes, preventing double slashes).
 * 4. Preservation of absolute remote CDN / R2 bucket URLs.
 * 5. Direct local file serving fallback for local dev origins (localhost, 127.0.0.1).
 * 6. Local dev fallback in Miniflare local emulation runtime (process.env.MINIFLARE = 'true').
 * 7. Bypass rules for vector graphics (.svg), inline data URIs, and already transformed URLs.
 * 8. Static rendering of Next.js <Image /> with custom loader producing responsive srcset & sizes.
 * 9. next.config.mjs configuration registration (loader: 'custom', loaderFile, remotePatterns).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Image from 'next/image';

import imageLoader, {
  normalizeImagePath,
  isLocalDevUrl,
  isMiniflareMode,
  shouldBypassResizing,
  buildCloudflareLoaderUrl,
} from '../../apps/web/src/lib/image-loader';

describe('Story 2.43: Custom Next.js Image Loader & Responsive Media Integration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const webDir = path.join(rootDir, 'apps/web');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.MINIFLARE;
    delete process.env.NEXT_PUBLIC_MINIFLARE;
    delete process.env.NEXT_PUBLIC_LOCAL_DEV;
    delete process.env.NEXT_PUBLIC_DEV_FALLBACK;
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  // ---------------------------------------------------------------------------
  // 1. Next.js imageLoader Specification & Cloudflare URI Formatting
  // ---------------------------------------------------------------------------
  describe('1. Cloudflare Image Resizing URL Formatting & Dimensions', () => {
    it('should conform to Next.js imageLoader signature ({ src, width, quality }) => string', () => {
      assert.equal(typeof imageLoader, 'function');
      const result = imageLoader({ src: 'uploads/sculpture-01.jpg', width: 640 });
      assert.equal(typeof result, 'string');
    });

    it('should format URLs with width, default quality (85), and format=auto', () => {
      const url = imageLoader({ src: 'uploads/sculpture-01.jpg', width: 800 });
      const expected = '/cdn-cgi/image/width=800,quality=85,format=auto/uploads/sculpture-01.jpg';
      assert.equal(url, expected);
    });

    it('should support custom quality presets (60, 80, 90, 95)', () => {
      const presets = [
        { quality: 60, width: 320 },
        { quality: 80, width: 640 },
        { quality: 90, width: 1280 },
        { quality: 95, width: 1920 },
      ];

      for (const { quality, width } of presets) {
        const url = imageLoader({
          src: 'uploads/artwork.webp',
          width,
          quality,
        });
        assert.ok(url.includes(`width=${width}`), `Must contain width=${width}`);
        assert.ok(url.includes(`quality=${quality}`), `Must contain quality=${quality}`);
        assert.ok(url.includes('format=auto'), 'Must contain format=auto');
      }
    });

    it('should normalize leading slashes on relative R2 asset keys without double slashes', () => {
      const input = '/uploads/monolith-study.png';
      const url = imageLoader({ src: input, width: 1024, quality: 80 });

      assert.equal(
        url,
        '/cdn-cgi/image/width=1024,quality=80,format=auto/uploads/monolith-study.png'
      );
      assert.ok(!url.includes('//uploads'), 'Must not contain double slash segment');
    });

    it('should preserve full remote R2 CDN URLs', () => {
      const remoteUrl = 'https://media.chrishop.jacobmiller22.com/uploads/art-piece-01.jpg';
      const url = imageLoader({ src: remoteUrl, width: 1280, quality: 90 });

      assert.equal(
        url,
        '/cdn-cgi/image/width=1280,quality=90,format=auto/https://media.chrishop.jacobmiller22.com/uploads/art-piece-01.jpg'
      );
    });

    it('should preserve R2 cloudflarestorage.com URLs', () => {
      const r2Url = 'https://chrishop-media.r2.cloudflarestorage.com/uploads/banner.webp';
      const url = imageLoader({ src: r2Url, width: 1920 });

      assert.equal(
        url,
        '/cdn-cgi/image/width=1920,quality=85,format=auto/https://chrishop-media.r2.cloudflarestorage.com/uploads/banner.webp'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Direct Local File Serving & Miniflare Fallback Handling
  // ---------------------------------------------------------------------------
  describe('2. Local Development & Miniflare Fallback', () => {
    it('should identify localhost and 127.0.0.1 as local dev URLs', () => {
      assert.ok(isLocalDevUrl('http://localhost:3000/uploads/art.jpg'));
      assert.ok(isLocalDevUrl('http://localhost:8787/uploads/art.jpg'));
      assert.ok(isLocalDevUrl('http://127.0.0.1:8787/r2/art.jpg'));
      assert.ok(isLocalDevUrl('http://127.0.0.1:3000/uploads/art.jpg'));
      assert.ok(!isLocalDevUrl('https://media.chrishop.jacobmiller22.com/uploads/art.jpg'));
      assert.ok(!isLocalDevUrl('/uploads/art.jpg'));
    });

    it('should pass through local dev URLs un-resized without /cdn-cgi/image/ prefix', () => {
      const localUrls = [
        'http://localhost:3000/uploads/sculpture.png',
        'http://localhost:8787/media/print-01.webp',
        'http://127.0.0.1:8787/r2/bronze-totem.jpg',
      ];

      for (const localUrl of localUrls) {
        const result = imageLoader({ src: localUrl, width: 640, quality: 80 });
        assert.equal(result, localUrl, `Local URL ${localUrl} must pass through un-resized`);
        assert.ok(!result.includes('/cdn-cgi/image/'), 'Must not wrap local dev URL in cdn-cgi');
      }
    });

    it('should pass through relative local file paths when running under Miniflare emulation', () => {
      process.env.MINIFLARE = 'true';
      assert.ok(isMiniflareMode(), 'Miniflare mode must be detected');

      const relativePath = '/uploads/local-artwork.jpg';
      const result = imageLoader({ src: relativePath, width: 800 });

      assert.equal(
        result,
        relativePath,
        'Relative path must pass through un-resized for direct local file serving in Miniflare'
      );
      assert.ok(!result.includes('/cdn-cgi/image/'));
    });

    it('should pass through relative local file paths when NEXT_PUBLIC_LOCAL_DEV is enabled', () => {
      process.env.NEXT_PUBLIC_LOCAL_DEV = 'true';
      assert.ok(isMiniflareMode(), 'Local dev fallback must be detected');

      const relativePath = 'uploads/dev-asset.png';
      const result = imageLoader({ src: relativePath, width: 640 });

      assert.equal(result, relativePath);
      assert.ok(!result.includes('/cdn-cgi/image/'));
    });

    it('should still format remote R2 URLs even if Miniflare mode is active', () => {
      process.env.MINIFLARE = 'true';
      const remoteR2 = 'https://media.chrishop.jacobmiller22.com/uploads/remote.jpg';
      const result = imageLoader({ src: remoteR2, width: 1024 });

      assert.ok(
        result.startsWith('/cdn-cgi/image/'),
        'Remote R2 URLs must still use Cloudflare Image Resizing'
      );
      assert.ok(result.includes(remoteR2));
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Bypass Rules (SVGs, Data URIs, Already Transformed URLs)
  // ---------------------------------------------------------------------------
  describe('3. Bypass Rules & Passthrough Verification', () => {
    it('should pass through SVG files un-resized to preserve vector crispness', () => {
      const svgs = ['/icons/cart.svg', 'uploads/brand-mark.svg', '/logo.svg?v=2'];
      for (const svg of svgs) {
        const result = imageLoader({ src: svg, width: 320 });
        assert.equal(result, svg, `SVG ${svg} must not be resized`);
      }
    });

    it('should pass through inline data URIs and blob URIs', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = imageLoader({ src: dataUri, width: 100 });
      assert.equal(result, dataUri);

      const blobUri = 'blob:http://localhost:3000/1234-5678';
      const blobResult = imageLoader({ src: blobUri, width: 200 });
      assert.equal(blobResult, blobUri);
    });

    it('should not double-wrap URLs already prefixed with /cdn-cgi/image/', () => {
      const existingTransform = '/cdn-cgi/image/width=400,quality=80,format=auto/uploads/art.jpg';
      const result = imageLoader({ src: existingTransform, width: 800 });
      assert.equal(result, existingTransform, 'Must not double-wrap already transformed URL');
    });

    it('should return empty string if empty src is provided', () => {
      assert.equal(imageLoader({ src: '', width: 500 }), '');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Next.js <Image /> Component Integration with Custom Loader
  // ---------------------------------------------------------------------------
  describe('4. Next.js <Image /> Component Integration', () => {
    it('should render <Image /> component producing Cloudflare srcset with explicit sizes', () => {
      const html = renderToStaticMarkup(
        React.createElement(Image, {
          loader: imageLoader,
          src: 'uploads/sculpture-drop.jpg',
          alt: 'Sculpture Drop',
          width: 800,
          height: 800,
          sizes: '(max-width: 768px) 100vw, 50vw',
        })
      );

      assert.ok(html.includes('<img'), 'Must render img element');
      assert.ok(html.includes('alt="Sculpture Drop"'));
      assert.ok(html.includes('sizes="(max-width: 768px) 100vw, 50vw"'));
      assert.ok(html.includes('srcSet="'), 'Must generate srcset attribute');
      assert.ok(
        html.includes('/cdn-cgi/image/width='),
        'Srcset entries must use Cloudflare Image Resizing scheme'
      );
      assert.ok(html.includes('format=auto'), 'Srcset entries must include format=auto');
      assert.ok(html.includes('uploads/sculpture-drop.jpg'));
    });

    it('should render fill layout without client-side distortion', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          'div',
          { style: { position: 'relative', width: '400px', height: '400px' } },
          React.createElement(Image, {
            loader: imageLoader,
            src: 'https://media.chrishop.jacobmiller22.com/uploads/hero.jpg',
            alt: 'Hero Artwork',
            fill: true,
            sizes: '100vw',
          })
        )
      );

      assert.ok(html.includes('sizes="100vw"'));
      assert.ok(html.includes('/cdn-cgi/image/width='));
      assert.ok(html.includes('https://media.chrishop.jacobmiller22.com/uploads/hero.jpg'));
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Next.js Configuration Registration (next.config.mjs)
  // ---------------------------------------------------------------------------
  describe('5. Next.js Configuration Integrity (apps/web/next.config.mjs)', () => {
    const configPath = path.join(webDir, 'next.config.mjs');

    it('should have apps/web/next.config.mjs present', () => {
      assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist');
    });

    it('should register images.loader = "custom" and images.loaderFile = "./src/lib/image-loader.ts"', () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(
        content.includes("loader: 'custom'") || content.includes('loader: "custom"'),
        'next.config.mjs must declare loader: "custom"'
      );
      assert.ok(
        content.includes("loaderFile: './src/lib/image-loader.ts'") ||
          content.includes('loaderFile: "./src/lib/image-loader.ts"'),
        'next.config.mjs must declare loaderFile: "./src/lib/image-loader.ts"'
      );
    });

    it('should configure remote patterns allowing R2 domains and localhost', () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(
        content.includes('media.chrishop.jacobmiller22.com'),
        'Must allow media.chrishop.jacobmiller22.com'
      );
      assert.ok(
        content.includes('*.r2.cloudflarestorage.com'),
        'Must allow *.r2.cloudflarestorage.com'
      );
      assert.ok(content.includes('localhost'), 'Must allow localhost');
      assert.ok(content.includes('127.0.0.1'), 'Must allow 127.0.0.1');
    });
  });
});
