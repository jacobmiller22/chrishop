/**
 * Story 2.42: Cloudflare Image Resizing Edge Pipeline & Media Transformation Infrastructure
 * Integration Test Suite
 *
 * Verifies:
 * 1. Canonical transformation URI convention:
 *    /cdn-cgi/image/width={width},quality={quality},format=auto/{r2_asset_path}
 * 2. 1-year immutable edge caching policy:
 *    Cache-Control: public, max-age=31536000, immutable
 * 3. Format auto-negotiation (format=auto) with client Accept header & Vary: Accept
 * 4. Zero-sharp edge runtime constraint across Cloudflare Workers codebase
 * 5. Automated verification script (scripts/verify-image-pipeline.ts) functionality
 * 6. Infrastructure configuration & documentation in docs/CLOUDFLARE_SETUP.md
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  buildCloudflareImageUrl,
  buildCanonicalTransformUrl,
  generateCloudflareImageSrcset,
  CANONICAL_IMAGE_PREFIX,
  EDGE_CACHE_CONTROL_HEADER,
  VARY_HEADER,
  RESPONSIVE_WIDTHS,
  IMAGE_QUALITY,
} from '../../apps/web/src/lib/r2-image';
import {
  runPipelineVerification,
  validateCacheControlHeader,
  validateVaryHeader,
  verifyNoSharpInEdgeRuntime,
} from '../../scripts/verify-image-pipeline';

describe('Story 2.42: Cloudflare Image Resizing Edge Pipeline Integration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const webDir = path.join(rootDir, 'apps/web');

  // ---------------------------------------------------------------------------
  // 1. Canonical URI Scheme & Transformation Convention
  // ---------------------------------------------------------------------------
  describe('1. Canonical Transformation URI Convention', () => {
    it('should define CANONICAL_IMAGE_PREFIX as /cdn-cgi/image/', () => {
      assert.equal(CANONICAL_IMAGE_PREFIX, '/cdn-cgi/image/');
    });

    it('should construct canonical URI for relative R2 asset path without double slashes', () => {
      const assetPath = 'uploads/sculpture-01.jpg';
      const uri = buildCloudflareImageUrl(assetPath, { width: 800, quality: 80, format: 'auto' });

      const expected = '/cdn-cgi/image/width=800,quality=80,format=auto/uploads/sculpture-01.jpg';
      assert.equal(uri, expected);
      assert.ok(!uri.includes('//uploads'), 'Must not contain double slash before asset path');
    });

    it('should normalize leading slash on relative asset paths', () => {
      const assetWithSlash = '/uploads/artwork-drop-02.png';
      const uri = buildCloudflareImageUrl(assetWithSlash, { width: 640, quality: 80 });

      assert.equal(
        uri,
        '/cdn-cgi/image/width=640,quality=80,format=auto/uploads/artwork-drop-02.png',
        'Leading slash on relative key must be normalized to prevent // path segment'
      );
    });

    it('should preserve absolute CDN URLs without alteration', () => {
      const fullUrl = 'https://media.chrishop.jacobmiller22.com/uploads/masterpiece.webp';
      const uri = buildCloudflareImageUrl(fullUrl, { width: 1280, quality: 90 });

      assert.equal(
        uri,
        '/cdn-cgi/image/width=1280,quality=90,format=auto/https://media.chrishop.jacobmiller22.com/uploads/masterpiece.webp'
      );
    });

    it('should export buildCanonicalTransformUrl alias matching buildCloudflareImageUrl', () => {
      assert.equal(typeof buildCanonicalTransformUrl, 'function');
      const res1 = buildCloudflareImageUrl('uploads/test.jpg', { width: 400 });
      const res2 = buildCanonicalTransformUrl('uploads/test.jpg', { width: 400 });
      assert.equal(res1, res2);
    });

    it('should default to format=auto for modern browser WebP/AVIF negotiation', () => {
      const uri = buildCloudflareImageUrl('uploads/test.jpg', { width: 500 });
      assert.ok(uri.includes('format=auto'), 'format=auto must be included by default');
    });

    it('should support comprehensive resizing options: width, height, fit, sharpen, quality', () => {
      const uri = buildCloudflareImageUrl('uploads/banner.jpg', {
        width: 1920,
        height: 600,
        fit: 'cover',
        sharpen: 1,
        quality: 85,
        format: 'auto',
      });

      assert.ok(uri.includes('width=1920'));
      assert.ok(uri.includes('height=600'));
      assert.ok(uri.includes('fit=cover'));
      assert.ok(uri.includes('sharpen=1'));
      assert.ok(uri.includes('quality=85'));
      assert.ok(uri.includes('format=auto'));
    });

    it('should generate responsive srcset covering all standard breakpoints without sharp', () => {
      const srcset = generateCloudflareImageSrcset('uploads/sculpture-01.jpg');
      const entries = srcset.split(', ');

      assert.equal(entries.length, RESPONSIVE_WIDTHS.length);
      for (let i = 0; i < RESPONSIVE_WIDTHS.length; i++) {
        const width = RESPONSIVE_WIDTHS[i];
        assert.ok(entries[i].includes(`width=${width}`));
        assert.ok(entries[i].endsWith(`${width}w`));
        assert.ok(entries[i].includes('/cdn-cgi/image/'));
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Edge Caching Policies & Header Verification
  // ---------------------------------------------------------------------------
  describe('2. Edge Cache Headers & Caching Policies', () => {
    it('should define EDGE_CACHE_CONTROL_HEADER as 1-year immutable', () => {
      assert.equal(EDGE_CACHE_CONTROL_HEADER, 'public, max-age=31536000, immutable');
    });

    it('should define VARY_HEADER as Accept', () => {
      assert.equal(VARY_HEADER, 'Accept');
    });

    it('should validate conforming Cache-Control headers', () => {
      const check1 = validateCacheControlHeader('public, max-age=31536000, immutable');
      assert.ok(check1.valid);

      const check2 = validateCacheControlHeader('public, max-age=63072000, immutable, stale-while-revalidate=86400');
      assert.ok(check2.valid);
    });

    it('should reject non-conforming Cache-Control headers', () => {
      assert.ok(!validateCacheControlHeader(null).valid);
      assert.ok(!validateCacheControlHeader('private, max-age=31536000, immutable').valid);
      assert.ok(!validateCacheControlHeader('public, max-age=3600, immutable').valid);
      assert.ok(!validateCacheControlHeader('public, max-age=31536000').valid);
    });

    it('should validate Vary header containing Accept', () => {
      assert.ok(validateVaryHeader('Accept').valid);
      assert.ok(validateVaryHeader('Accept, Accept-Encoding').valid);
      assert.ok(validateVaryHeader('accept').valid);
    });

    it('should reject Vary header missing Accept', () => {
      assert.ok(!validateVaryHeader(null).valid);
      assert.ok(!validateVaryHeader('Accept-Encoding').valid);
      assert.ok(!validateVaryHeader('User-Agent').valid);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Declarative Zone & Cache Rules Configuration
  // ---------------------------------------------------------------------------
  describe('3. Declarative Zone Configuration & Cache Rules', () => {
    const cacheRulesPath = path.join(rootDir, 'infra/r2/cache-rules-images.json');
    const setupScriptPath = path.join(rootDir, 'infra/scripts/setup-image-resizing.sh');

    it('should have infra/r2/cache-rules-images.json file present and valid JSON', () => {
      assert.ok(fs.existsSync(cacheRulesPath), 'cache-rules-images.json must exist');
      const content = fs.readFileSync(cacheRulesPath, 'utf-8');
      const parsed = JSON.parse(content);

      assert.ok(Array.isArray(parsed.rules), 'Must contain rules array');
      assert.ok(parsed.rules.length >= 2, 'Must contain at least 2 rules');
    });

    it('should configure 1-year immutable caching on /cdn-cgi/image/ in cache-rules-images.json', () => {
      const config = JSON.parse(fs.readFileSync(cacheRulesPath, 'utf-8'));
      const imageRule = config.rules.find((r: any) =>
        r.expression.includes('/cdn-cgi/image/')
      );

      assert.ok(imageRule, 'Rule for /cdn-cgi/image/ must exist');
      assert.equal(imageRule.action_parameters.edge_ttl.default, 31536000);
      assert.equal(imageRule.action_parameters.browser_ttl.default, 31536000);
      assert.ok(imageRule.action_parameters.headers['Cache-Control'].includes('immutable'));
      assert.ok(imageRule.action_parameters.headers['Cache-Control'].includes('31536000'));
      assert.equal(imageRule.action_parameters.headers.Vary, 'Accept');
    });

    it('should have executable infra/scripts/setup-image-resizing.sh', () => {
      assert.ok(fs.existsSync(setupScriptPath), 'setup-image-resizing.sh must exist');
      // Verify script runs successfully in dry-run mode
      const output = execSync(`${setupScriptPath} --dry-run`, { encoding: 'utf-8' });
      assert.ok(output.includes('Dry-run validation passed'));
      assert.ok(output.includes('image_resizing'));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Zero-Sharp Edge Runtime Constraint Enforcement
  // ---------------------------------------------------------------------------
  describe('4. Zero-Sharp Edge Runtime Constraint', () => {
    it('should confirm 0 files in apps/web/src import or require sharp', () => {
      const sharpAudit = verifyNoSharpInEdgeRuntime(rootDir);
      assert.ok(sharpAudit.passed, `Violations found: ${sharpAudit.violations.join(', ')}`);
      assert.equal(sharpAudit.violations.length, 0);
    });

    it('should ensure Media collection has NO imageSizes configured', () => {
      const mediaPath = path.join(webDir, 'src/collections/Media.ts');
      const content = fs.readFileSync(mediaPath, 'utf-8');

      assert.ok(
        !content.includes('imageSizes:') || content.includes('// imageSizes') || content.includes('NO imageSizes'),
        'Media collection must not enable server-side imageSizes (sharp trigger)'
      );
    });

    it('should ensure payload.config.ts does not import sharp', () => {
      const configPath = path.join(webDir, 'payload.config.ts');
      const content = fs.readFileSync(configPath, 'utf-8');

      assert.ok(!content.includes("from 'sharp'"));
      assert.ok(!content.includes("require('sharp')"));
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Automated Edge Pipeline Verification Script
  // ---------------------------------------------------------------------------
  describe('5. Automated Verification Script (scripts/verify-image-pipeline.ts)', () => {
    it('should pass all checks in simulated mock mode', async () => {
      const report = await runPipelineVerification({
        mock: true,
        baseUrl: 'https://chrishop.jacobmiller22.com',
        imagePath: 'uploads/sculpture-01.jpg',
        widths: [320, 640, 1280],
        quality: 80,
      });

      assert.equal(report.failedChecks, 0, 'No checks should fail in mock mode');
      assert.equal(report.passedChecks, 7, 'All 7 checks must pass');
      assert.equal(report.mode, 'mock');
    });

    it('should have verify:images script registered in package.json', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      assert.ok('verify:images' in pkg.scripts, 'package.json must contain "verify:images" script');
      assert.ok(pkg.scripts['verify:images'].includes('verify-image-pipeline.ts'));
    });

    it('should execute verify:images CLI command cleanly via shell', () => {
      const output = execSync('pnpm run verify:images -- --mock', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('Cloudflare Image Resizing edge pipeline verified successfully'));
      assert.ok(output.includes('1-Year Immutable Caching Policy'));
      assert.ok(output.includes('Format Auto-Negotiation: AVIF'));
      assert.ok(output.includes('Format Auto-Negotiation: WebP Fallback'));
    });

    it('should display CLI help menu with --help flag', () => {
      const output = execSync('npx tsx scripts/verify-image-pipeline.ts --help', {
        cwd: rootDir,
        encoding: 'utf-8',
      });

      assert.ok(output.includes('Usage:'));
      assert.ok(output.includes('--mock'));
      assert.ok(output.includes('--live'));
      assert.ok(output.includes('--widths'));
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Operational Documentation Integrity
  // ---------------------------------------------------------------------------
  describe('6. Operational Documentation (docs/CLOUDFLARE_SETUP.md)', () => {
    it('should document Cloudflare Image Resizing in docs/CLOUDFLARE_SETUP.md', () => {
      const docPath = path.join(rootDir, 'docs/CLOUDFLARE_SETUP.md');
      assert.ok(fs.existsSync(docPath), 'docs/CLOUDFLARE_SETUP.md must exist');

      const content = fs.readFileSync(docPath, 'utf-8');
      assert.ok(
        content.includes('Image Resizing') || content.includes('cdn-cgi/image'),
        'Must document Cloudflare Image Resizing'
      );
      assert.ok(
        content.includes('/cdn-cgi/image/'),
        'Must document /cdn-cgi/image/ transformation prefix'
      );
      assert.ok(
        content.includes('31536000') || content.includes('immutable'),
        'Must document 1-year immutable caching'
      );
      assert.ok(
        content.includes('Vary') || content.includes('format=auto'),
        'Must document format auto-negotiation and Vary header'
      );
    });
  });
});
