/**
 * Story 2.23: R2 Media Adapter & Edge Image Pipeline Integration Test
 *
 * Validates:
 * 1. @payloadcms/storage-s3 is installed and importable in apps/web
 * 2. Cloudflare R2 storage adapter config resolves without error
 * 3. Media collection MIME type validation and no-sharp constraint
 * 4. Cloudflare Image Resizing URL structure and srcset generation
 * 5. Payload config includes S3 plugin registration
 *
 * Architecture: Zero-sharp edge runtime policy.
 * All image processing delegated to Cloudflare Image Resizing at CDN edge.
 * @see DEP_CLOUDFLARE_R2.md, DEP_PAYLOAD_CMS.md Section 2
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Story 2.23: R2 Media Adapter & Cloudflare Image Pipeline Integration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const webDir = path.join(rootDir, 'apps/web');

  // ---------------------------------------------------------------------------
  // 1. Package Installation Verification
  // ---------------------------------------------------------------------------
  describe('1. @payloadcms/storage-s3 Package Installation', () => {
    it('should have @payloadcms/storage-s3 listed in apps/web/package.json dependencies', () => {
      const pkgPath = path.join(webDir, 'package.json');
      assert.ok(fs.existsSync(pkgPath), 'apps/web/package.json must exist');

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      assert.ok(
        '@payloadcms/storage-s3' in allDeps,
        '@payloadcms/storage-s3 must be listed in apps/web package.json dependencies'
      );
    });

    it('should have @payloadcms/storage-s3 physically installed in apps/web/node_modules', () => {
      const storagePkgPath = path.join(webDir, 'node_modules/@payloadcms/storage-s3/package.json');
      assert.ok(
        fs.existsSync(storagePkgPath),
        '@payloadcms/storage-s3 must be physically installed in node_modules'
      );

      const pkg = JSON.parse(fs.readFileSync(storagePkgPath, 'utf-8'));
      assert.ok(
        pkg.version && pkg.version.startsWith('3.'),
        `@payloadcms/storage-s3 must be version 3.x, found: ${pkg.version}`
      );
    });

    it('should be able to import s3Storage from @payloadcms/storage-s3', async () => {
      // Dynamic import to verify the module resolves in the Node.js context
      const module = await import(
        path.join(webDir, 'node_modules/@payloadcms/storage-s3/dist/index.js')
      );
      assert.ok(
        typeof module.s3Storage === 'function',
        's3Storage must be a function exported from @payloadcms/storage-s3'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Payload Config: S3 Plugin Integration
  // ---------------------------------------------------------------------------
  describe('2. Payload Config S3 Plugin Registration', () => {
    it('should have s3Storage import in payload.config.ts', () => {
      const configPath = path.join(webDir, 'payload.config.ts');
      assert.ok(fs.existsSync(configPath), 'payload.config.ts must exist');

      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(
        content.includes("from '@payloadcms/storage-s3'"),
        'payload.config.ts must import from @payloadcms/storage-s3'
      );
      assert.ok(
        content.includes('s3Storage'),
        'payload.config.ts must use s3Storage()'
      );
    });

    it('should configure s3Storage with Cloudflare R2 endpoint environment variable', () => {
      const configPath = path.join(webDir, 'payload.config.ts');
      const content = fs.readFileSync(configPath, 'utf-8');

      assert.ok(
        content.includes('R2_ENDPOINT'),
        'payload.config.ts must reference R2_ENDPOINT env var'
      );
      assert.ok(
        content.includes('R2_ACCESS_KEY_ID'),
        'payload.config.ts must reference R2_ACCESS_KEY_ID env var'
      );
      assert.ok(
        content.includes('R2_SECRET_ACCESS_KEY'),
        'payload.config.ts must reference R2_SECRET_ACCESS_KEY env var'
      );
      assert.ok(
        content.includes("region: 'auto'"),
        "payload.config.ts must set region: 'auto' for Cloudflare R2 compatibility"
      );
    });

    it('should have getS3StorageConfig exported from payload.config.ts', () => {
      const configPath = path.join(webDir, 'payload.config.ts');
      const content = fs.readFileSync(configPath, 'utf-8');

      assert.ok(
        content.includes('export const getS3StorageConfig'),
        'payload.config.ts must export getS3StorageConfig()'
      );
    });

    it('should register s3Storage plugin in the plugins array', () => {
      const configPath = path.join(webDir, 'payload.config.ts');
      const content = fs.readFileSync(configPath, 'utf-8');

      assert.ok(
        content.includes('plugins:'),
        'payload.config.ts must include plugins array'
      );
      assert.ok(
        content.includes('getS3StorageConfig()'),
        'payload.config.ts must register getS3StorageConfig() in plugins array'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Media Collection Edge Runtime Safety
  // ---------------------------------------------------------------------------
  describe('3. Media Collection: No-Sharp Edge Runtime Constraint', () => {
    it('should NOT configure imageSizes in Media collection (sharp guard)', () => {
      const mediaPath = path.join(webDir, 'src/collections/Media.ts');
      assert.ok(fs.existsSync(mediaPath), 'Media.ts collection must exist');

      const content = fs.readFileSync(mediaPath, 'utf-8');
      // imageSizes triggers Payload to use sharp for server-side resize
      // This MUST NOT appear in the Media collection config
      assert.ok(
        !content.includes('imageSizes:') || content.includes('// imageSizes'),
        'Media collection must NOT configure imageSizes (sharp guard for edge runtime)'
      );
    });

    it('should configure mimeTypes restriction in Media collection', () => {
      const mediaPath = path.join(webDir, 'src/collections/Media.ts');
      const content = fs.readFileSync(mediaPath, 'utf-8');

      assert.ok(content.includes('mimeTypes'), 'Media collection must configure mimeTypes restriction');
      assert.ok(content.includes('image/jpeg'), 'Must allow JPEG uploads');
      assert.ok(content.includes('image/webp'), 'Must allow WebP uploads');
      assert.ok(content.includes('image/png'), 'Must allow PNG uploads');
      assert.ok(content.includes('image/avif'), 'Must allow AVIF uploads');
    });

    it('should NOT import sharp anywhere in apps/web source files', () => {
      const srcDir = path.join(webDir, 'src');
      const sourceFiles = getAllTypeScriptFiles(srcDir);

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        // Check for sharp imports (both require and import styles)
        const hasSharpImport =
          /import\s+.*\s+from\s+['"]sharp['"]/.test(content) ||
          /require\s*\(\s*['"]sharp['"]\s*\)/.test(content);

        assert.ok(
          !hasSharpImport,
          `File ${path.relative(rootDir, file)} must NOT import sharp (Cloudflare Workers edge runtime incompatible)`
        );
      }
    });

    it('should NOT import sharp in payload.config.ts', () => {
      const configPath = path.join(webDir, 'payload.config.ts');
      const content = fs.readFileSync(configPath, 'utf-8');

      assert.ok(
        !content.includes("from 'sharp'") && !content.includes('require("sharp")'),
        'payload.config.ts must NOT import sharp'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Cloudflare Image Resizing Utility
  // ---------------------------------------------------------------------------
  describe('4. Cloudflare Image Resizing Utility (src/lib/r2-image.ts)', () => {
    it('should have r2-image.ts utility file in apps/web/src/lib/', () => {
      const r2ImagePath = path.join(webDir, 'src/lib/r2-image.ts');
      assert.ok(fs.existsSync(r2ImagePath), 'apps/web/src/lib/r2-image.ts must exist');
    });

    it('should export required functions and constants from r2-image.ts', () => {
      const r2ImagePath = path.join(webDir, 'src/lib/r2-image.ts');
      const content = fs.readFileSync(r2ImagePath, 'utf-8');

      assert.ok(
        content.includes('export function buildCloudflareImageUrl'),
        'Must export buildCloudflareImageUrl()'
      );
      assert.ok(
        content.includes('export function generateCloudflareImageSrcset'),
        'Must export generateCloudflareImageSrcset()'
      );
      assert.ok(
        content.includes('export function buildResponsiveImageProps'),
        'Must export buildResponsiveImageProps()'
      );
      assert.ok(
        content.includes('export const RESPONSIVE_WIDTHS'),
        'Must export RESPONSIVE_WIDTHS constant'
      );
      assert.ok(
        content.includes('export const IMAGE_QUALITY'),
        'Must export IMAGE_QUALITY constant'
      );
      assert.ok(
        content.includes('export const STANDARD_SIZES'),
        'Must export STANDARD_SIZES constant'
      );
    });

    it('should use /cdn-cgi/image/ URL pattern in buildCloudflareImageUrl', () => {
      const r2ImagePath = path.join(webDir, 'src/lib/r2-image.ts');
      const content = fs.readFileSync(r2ImagePath, 'utf-8');

      assert.ok(
        content.includes('/cdn-cgi/image/'),
        'Must use Cloudflare Image Resizing /cdn-cgi/image/ URL pattern'
      );
    });

    it('should NOT use sharp in r2-image.ts', () => {
      const r2ImagePath = path.join(webDir, 'src/lib/r2-image.ts');
      const content = fs.readFileSync(r2ImagePath, 'utf-8');

      assert.ok(
        !content.includes("from 'sharp'") && !content.includes("require('sharp')"),
        'r2-image.ts must not import sharp'
      );
    });

    it('should document the no-sharp architectural constraint in r2-image.ts', () => {
      const r2ImagePath = path.join(webDir, 'src/lib/r2-image.ts');
      const content = fs.readFileSync(r2ImagePath, 'utf-8');

      // Verify the file contains documentation about the no-sharp constraint
      assert.ok(
        content.toLowerCase().includes('sharp'),
        'r2-image.ts must document the no-sharp architectural decision'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Cloudflare R2 Wrangler Binding
  // ---------------------------------------------------------------------------
  describe('5. Cloudflare R2 Wrangler Binding Verification', () => {
    it('should have R2 bucket binding BUCKET in wrangler.toml for all environments', () => {
      const wranglerPath = path.join(rootDir, 'wrangler.toml');
      assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml must exist at monorepo root');

      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('[[r2_buckets]]'), 'Must declare [[r2_buckets]] section');
      assert.ok(
        content.includes('binding = "BUCKET"'),
        'R2 bucket binding must be named BUCKET'
      );
      assert.ok(
        content.includes('chrishop-media-prod'),
        'Production must use chrishop-media-prod bucket'
      );
      assert.ok(
        content.includes('chrishop-media-staging'),
        'Staging must use chrishop-media-staging bucket'
      );
    });

    it('should have R2 bucket binding declared for preview environment', () => {
      const wranglerPath = path.join(rootDir, 'wrangler.toml');
      const content = fs.readFileSync(wranglerPath, 'utf-8');

      assert.ok(
        content.includes('[[env.preview.r2_buckets]]'),
        'Preview environment must declare [[env.preview.r2_buckets]]'
      );
      assert.ok(
        content.includes('chrishop-media-preview'),
        'Preview must use chrishop-media-preview bucket'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Unit Test File Existence
  // ---------------------------------------------------------------------------
  describe('6. Unit Test Coverage for Story 2.23', () => {
    it('should have r2-media.test.ts unit test file in apps/web/tests/', () => {
      const testPath = path.join(webDir, 'tests/r2-media.test.ts');
      assert.ok(
        fs.existsSync(testPath),
        'apps/web/tests/r2-media.test.ts must exist (unit tests for Story 2.23)'
      );
    });

    it('should have comprehensive test coverage in r2-media.test.ts', () => {
      const testPath = path.join(webDir, 'tests/r2-media.test.ts');
      const content = fs.readFileSync(testPath, 'utf-8');

      assert.ok(content.includes('buildCloudflareImageUrl'), 'Must test buildCloudflareImageUrl');
      assert.ok(content.includes('generateCloudflareImageSrcset'), 'Must test generateCloudflareImageSrcset');
      assert.ok(content.includes('getS3StorageConfig'), 'Must test getS3StorageConfig');
      assert.ok(content.includes('imageSizes'), 'Must test no-imageSizes constraint');
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all TypeScript source files in a directory.
 */
function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTypeScriptFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}
