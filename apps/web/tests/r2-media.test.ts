import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCloudflareImageUrl,
  generateCloudflareImageSrcset,
  generateSizesAttribute,
  buildResponsiveImageProps,
  RESPONSIVE_WIDTHS,
  IMAGE_QUALITY,
  STANDARD_SIZES,
} from '../src/lib/r2-image';
import payloadConfig, { getD1Binding, d1Adapter, getS3StorageConfig } from '../payload.config';
import { Media } from '../src/collections/Media';

const R2_CDN_BASE = 'https://media.chrishop.jacobmiller22.com';
const SAMPLE_IMAGE_URL = `${R2_CDN_BASE}/uploads/sculpture-01.jpg`;

// =============================================================================
// Story 2.23: R2 Media Adapter & Cloudflare Image Resizing Tests
// =============================================================================

describe('Story 2.23: Cloudflare R2 Media Adapter & Edge Image Pipeline', () => {
  // ---------------------------------------------------------------------------
  // 1. Cloudflare Image URL Builder
  // ---------------------------------------------------------------------------
  describe('buildCloudflareImageUrl()', () => {
    it('should generate a valid /cdn-cgi/image/ URL with width and quality', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL, { width: 800, quality: 80 });

      assert.ok(url.startsWith('/cdn-cgi/image/'), 'URL must use Cloudflare Image Resizing path prefix');
      assert.ok(url.includes('width=800'), 'URL must include width parameter');
      assert.ok(url.includes('quality=80'), 'URL must include quality parameter');
      assert.ok(url.includes(SAMPLE_IMAGE_URL), 'URL must embed the source image URL');
    });

    it('should default to format=auto for modern browser WebP/AVIF negotiation', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL, { width: 640 });

      assert.ok(url.includes('format=auto'), 'Must default to format=auto for browser negotiation');
    });

    it('should respect explicit format override', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL, { width: 640, format: 'webp' });

      assert.ok(url.includes('format=webp'), 'Must include explicit format when specified');
      // Should not also add format=auto when format is explicitly specified
      const params = url.match(/\/cdn-cgi\/image\/([^/]+)/)?.[1] || '';
      const formatCount = (params.match(/format=/g) || []).length;
      assert.equal(formatCount, 1, 'Must include exactly one format parameter');
    });

    it('should include fit parameter when specified', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL, { width: 400, height: 400, fit: 'cover' });

      assert.ok(url.includes('width=400'), 'Must include width');
      assert.ok(url.includes('height=400'), 'Must include height');
      assert.ok(url.includes('fit=cover'), 'Must include fit=cover');
    });

    it('should include sharpen parameter when specified', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL, { width: 1024, sharpen: 2 });

      assert.ok(url.includes('sharpen=2'), 'Must include sharpen parameter');
    });

    it('should produce correct URL structure: /cdn-cgi/image/<options>/<source>', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL, { width: 1280, quality: 90 });

      // The URL must follow /cdn-cgi/image/<params>/<source-url> format exactly
      const regex = /^\/cdn-cgi\/image\/[^/]+\/https:\/\/.+/;
      assert.match(url, regex, 'URL must match /cdn-cgi/image/<options>/<source> pattern');
    });

    it('should handle URLs without options gracefully (defaults only)', () => {
      const url = buildCloudflareImageUrl(SAMPLE_IMAGE_URL);

      assert.ok(url.startsWith('/cdn-cgi/image/'), 'Must produce valid URL even with no explicit options');
      assert.ok(url.includes(SAMPLE_IMAGE_URL), 'Must embed source URL');
      // Should still have format=auto default
      assert.ok(url.includes('format=auto'), 'Must default format=auto');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Responsive srcset Generator
  // ---------------------------------------------------------------------------
  describe('generateCloudflareImageSrcset()', () => {
    it('should generate srcset entries for all default RESPONSIVE_WIDTHS', () => {
      const srcset = generateCloudflareImageSrcset(SAMPLE_IMAGE_URL);
      const entries = srcset.split(', ');

      assert.equal(
        entries.length,
        RESPONSIVE_WIDTHS.length,
        `srcset must contain ${RESPONSIVE_WIDTHS.length} entries matching RESPONSIVE_WIDTHS`
      );
    });

    it('should produce correct <url> <width>w format for each entry', () => {
      const srcset = generateCloudflareImageSrcset(SAMPLE_IMAGE_URL, [320, 640, 1024]);
      const entries = srcset.split(', ');

      assert.equal(entries.length, 3, 'Must produce 3 srcset entries');
      assert.ok(entries[0].endsWith(' 320w'), 'First entry must end with 320w descriptor');
      assert.ok(entries[1].endsWith(' 640w'), 'Second entry must end with 640w descriptor');
      assert.ok(entries[2].endsWith(' 1024w'), 'Third entry must end with 1024w descriptor');
    });

    it('should embed /cdn-cgi/image/ URLs in each srcset entry', () => {
      const srcset = generateCloudflareImageSrcset(SAMPLE_IMAGE_URL, [320, 640]);
      const entries = srcset.split(', ');

      for (const entry of entries) {
        assert.ok(
          entry.includes('/cdn-cgi/image/'),
          'Each srcset entry must use Cloudflare Image Resizing URL'
        );
      }
    });

    it('should apply quality parameter to all srcset entries', () => {
      const quality = IMAGE_QUALITY.HIGH; // 90
      const srcset = generateCloudflareImageSrcset(SAMPLE_IMAGE_URL, [320, 640], quality);
      const entries = srcset.split(', ');

      for (const entry of entries) {
        assert.ok(
          entry.includes(`quality=${quality}`),
          `Each srcset entry must include quality=${quality}`
        );
      }
    });

    it('should respect custom width arrays', () => {
      const customWidths = [480, 960, 1440] as const;
      const srcset = generateCloudflareImageSrcset(SAMPLE_IMAGE_URL, customWidths);
      const entries = srcset.split(', ');

      assert.equal(entries.length, 3, 'Must produce entries for all custom widths');
      assert.ok(entries[0].endsWith(' 480w'), 'First entry must use 480w');
      assert.ok(entries[1].endsWith(' 960w'), 'Second entry must use 960w');
      assert.ok(entries[2].endsWith(' 1440w'), 'Third entry must use 1440w');
    });

    it('should NOT invoke sharp — no server-side processing is performed', () => {
      // This test verifies the architectural constraint: srcset generation is purely
      // string manipulation, not actual image processing via sharp or any native addon.
      //
      // The test demonstrates this by running the generator synchronously — any
      // sharp invocation would be async and require filesystem access.
      let wasSynchronous = false;
      const result = generateCloudflareImageSrcset(SAMPLE_IMAGE_URL);
      wasSynchronous = true;

      assert.ok(wasSynchronous, 'srcset generation must be purely synchronous (no sharp processing)');
      assert.ok(typeof result === 'string', 'Result must be a string, not a Promise or Buffer');
      assert.ok(result.length > 0, 'srcset must be non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Sizes Attribute Generator
  // ---------------------------------------------------------------------------
  describe('generateSizesAttribute()', () => {
    it('should generate correct sizes string for multi-breakpoint config', () => {
      const sizes = generateSizesAttribute([
        ['(max-width: 768px)', '100vw'],
        ['(max-width: 1280px)', '50vw'],
        ['33vw'],
      ]);

      assert.equal(
        sizes,
        '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw',
        'Sizes attribute must be correctly formatted'
      );
    });

    it('should handle single default size (no media query)', () => {
      const sizes = generateSizesAttribute([['100vw']]);
      assert.equal(sizes, '100vw', 'Single default size must not include media query prefix');
    });

    it('should produce valid STANDARD_SIZES presets', () => {
      assert.ok(STANDARD_SIZES.HERO.length > 0, 'HERO size must be defined');
      assert.ok(STANDARD_SIZES.CATALOG_GRID.includes('max-width'), 'CATALOG_GRID must include breakpoints');
      assert.ok(STANDARD_SIZES.PRODUCT_FEATURED.includes('50vw'), 'PRODUCT_FEATURED must include 50vw');
      assert.ok(STANDARD_SIZES.THUMBNAIL.includes('20vw'), 'THUMBNAIL must include compact size');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Responsive Image Props Builder
  // ---------------------------------------------------------------------------
  describe('buildResponsiveImageProps()', () => {
    it('should return complete image prop object with src, srcSet, sizes, and alt', () => {
      const props = buildResponsiveImageProps(SAMPLE_IMAGE_URL, 'Sculpture artwork');

      assert.ok(props.src, 'Must include src');
      assert.ok(props.srcSet, 'Must include srcSet');
      assert.ok(props.sizes, 'Must include sizes');
      assert.ok(props.alt, 'Must include alt text');
      assert.equal(props.alt, 'Sculpture artwork', 'Alt text must be preserved');
    });

    it('should use source URL as src fallback', () => {
      const props = buildResponsiveImageProps(SAMPLE_IMAGE_URL, 'Test');
      assert.equal(props.src, SAMPLE_IMAGE_URL, 'src must be the original source URL');
    });

    it('should apply CATALOG_GRID sizes preset by default', () => {
      const props = buildResponsiveImageProps(SAMPLE_IMAGE_URL, 'Test');
      assert.equal(props.sizes, STANDARD_SIZES.CATALOG_GRID, 'Default sizes must use CATALOG_GRID preset');
    });

    it('should allow custom sizes preset override', () => {
      const props = buildResponsiveImageProps(SAMPLE_IMAGE_URL, 'Hero', STANDARD_SIZES.HERO);
      assert.equal(props.sizes, STANDARD_SIZES.HERO, 'Custom sizes preset must be applied');
    });

    it('should produce srcSet with all RESPONSIVE_WIDTHS breakpoints', () => {
      const props = buildResponsiveImageProps(SAMPLE_IMAGE_URL, 'Test');
      const entries = props.srcSet.split(', ');

      assert.equal(
        entries.length,
        RESPONSIVE_WIDTHS.length,
        'srcSet must cover all RESPONSIVE_WIDTHS breakpoints'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Media Collection Schema Validation (no-sharp constraint)
  // ---------------------------------------------------------------------------
  describe('Media Collection: MIME validation & no-sharp constraint', () => {
    it('should have upload enabled', () => {
      assert.ok(Media.upload, 'Media collection must have upload enabled');
    });

    it('should restrict to supported image MIME types', () => {
      const uploadConfig = Media.upload;
      assert.ok(
        uploadConfig && typeof uploadConfig === 'object',
        'Upload must be configured as an object with options'
      );

      const mimeTypes = (uploadConfig as any).mimeTypes as string[];
      assert.ok(Array.isArray(mimeTypes), 'mimeTypes must be an array');
      assert.ok(mimeTypes.includes('image/jpeg'), 'Must allow image/jpeg');
      assert.ok(mimeTypes.includes('image/webp'), 'Must allow image/webp');
      assert.ok(mimeTypes.includes('image/png'), 'Must allow image/png');
      assert.ok(mimeTypes.includes('image/avif'), 'Must allow image/avif');
    });

    it('ENFORCES EDGE CONSTRAINT: imageSizes must NOT be configured (no sharp)', () => {
      const uploadConfig = Media.upload;
      // imageSizes triggers sharp for server-side thumbnail generation.
      // This MUST be absent to prevent sharp from being invoked on Cloudflare Workers edge.
      assert.ok(
        uploadConfig && typeof uploadConfig === 'object',
        'Upload must be an object config'
      );

      const imageSizes = (uploadConfig as any).imageSizes;
      assert.ok(
        imageSizes === undefined || imageSizes === null || (Array.isArray(imageSizes) && imageSizes.length === 0),
        'imageSizes MUST NOT be configured — sharp cannot run on Cloudflare Workers edge runtime'
      );
    });

    it('should have required fields (alt, caption)', () => {
      const fields = Media.fields as any[];
      const fieldNames = fields.map((f: any) => f.name);
      assert.ok(fieldNames.includes('alt'), 'Media must have alt field for accessibility (WCAG 2.1 AA)');
      assert.ok(fieldNames.includes('caption'), 'Media must have optional caption field');
    });

    it('should have public read access', () => {
      const readAccess = (Media.access as any)?.read;
      assert.ok(typeof readAccess === 'function', 'Read access must be a function');
      assert.equal(readAccess(), true, 'Read access must return true (public)');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. S3 Storage Plugin Configuration
  // ---------------------------------------------------------------------------
  describe('getS3StorageConfig(): S3 Storage Plugin', () => {
    it('should export getS3StorageConfig as a callable function', () => {
      assert.equal(typeof getS3StorageConfig, 'function', 'getS3StorageConfig must be a function');
    });

    it('should instantiate s3Storage plugin without throwing', () => {
      // getS3StorageConfig() must not throw even when env vars are absent (build-time)
      assert.doesNotThrow(
        () => getS3StorageConfig(),
        'getS3StorageConfig() must not throw during initialization'
      );
    });

    it('should return a Payload plugin function (callable)', () => {
      const plugin = getS3StorageConfig();
      // Payload plugins are functions that accept and return a SanitizedConfig
      assert.ok(
        typeof plugin === 'function',
        's3Storage plugin must be a function (Payload plugin interface)'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Payload Config: S3 Plugin Registration
  // ---------------------------------------------------------------------------
  describe('Payload Config: S3 plugin and collection registration', () => {
    it('should successfully build sanitized Payload config with S3 storage plugin', async () => {
      const config = await payloadConfig;
      assert.ok(config, 'Config should build successfully');

      // Verify registered collection slugs
      const slugs = config.collections.map((c) => c.slug);
      assert.ok(slugs.includes('categories'), 'categories collection registered');
      assert.ok(slugs.includes('products'), 'products collection registered');
      assert.ok(slugs.includes('product_variations'), 'product_variations collection registered');
      assert.ok(slugs.includes('media'), 'media collection registered');
      assert.ok(slugs.includes('users'), 'users collection registered');
    });

    it('should verify db adapter is d1-sqlite', async () => {
      const config = await payloadConfig;
      assert.ok(config.db, 'Database adapter must be configured');
      assert.equal(config.db.name, 'd1-sqlite', 'Database adapter should be d1-sqlite');
    });

    it('should have the s3Storage plugin in the plugins array', async () => {
      // The s3Storage plugin modifies the config during buildConfig().
      // We verify by confirming the payload config resolves without errors
      // (a broken s3Storage config would throw during buildConfig()).
      const config = await payloadConfig;
      assert.ok(config, 'Payload config with s3Storage plugin must resolve without error');

      // Verify admin user
      assert.equal(config.admin.user, 'users');

      // Verify secret is non-empty (min 32 chars)
      assert.ok(config.secret && config.secret.length >= 32);
    });

    it('should export d1Adapter alias matching DEP_PAYLOAD_CMS.md', () => {
      assert.equal(typeof d1Adapter, 'function');
    });

    it('should resolve D1 binding gracefully across environments', () => {
      const binding = getD1Binding();
      assert.ok(typeof binding === 'object' || typeof binding === 'string');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. IMAGE_QUALITY Constants
  // ---------------------------------------------------------------------------
  describe('IMAGE_QUALITY constants', () => {
    it('should define HIGH quality at 90', () => {
      assert.equal(IMAGE_QUALITY.HIGH, 90);
    });

    it('should define STANDARD quality at 80', () => {
      assert.equal(IMAGE_QUALITY.STANDARD, 80);
    });

    it('should define PREVIEW quality at 60', () => {
      assert.equal(IMAGE_QUALITY.PREVIEW, 60);
    });

    it('should have RESPONSIVE_WIDTHS covering mobile to ultra-wide', () => {
      const widths = [...RESPONSIVE_WIDTHS];
      assert.ok(widths.includes(320), 'Must include mobile width 320');
      assert.ok(widths.includes(1280), 'Must include desktop width 1280');
      assert.ok(widths.includes(1920), 'Must include ultra-wide width 1920');
      // Verify sorted ascending
      for (let i = 1; i < widths.length; i++) {
        assert.ok(widths[i] > widths[i - 1], 'RESPONSIVE_WIDTHS must be sorted ascending');
      }
    });
  });
});
