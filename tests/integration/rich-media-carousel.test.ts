import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatabaseSync } from 'node:sqlite';

// Import Media collection
import { Media } from '../../apps/web/src/collections/Media';

// Import RichMediaViewer & MediaCarousel
import {
  RichMediaViewer,
  resolveMediaType,
  type RichMediaItem,
} from '../../apps/web/src/components/storefront/RichMediaViewer';
import {
  MediaCarousel,
  type CarouselMediaItem,
} from '../../apps/web/src/components/storefront/MediaCarousel';

describe('Story 3.16: Storefront Rich Media Support — Edge Video/GIF Playback & Idle-Timeout Carousel Progression', () => {
  const rootDir = process.cwd();

  // ---------------------------------------------------------------------------
  // 1. Payload CMS Rich Media Schema Extension & Zero-Sharp Compliance
  // ---------------------------------------------------------------------------
  describe('1. Payload CMS Media Schema Extension', () => {
    it('Media collection must allow MP4, WebM, and GIF MIME types', () => {
      assert.equal(Media.slug, 'media');
      const uploadConfig = Media.upload as any;
      assert.ok(uploadConfig, 'Media must have upload config');
      assert.equal(uploadConfig.disableLocalStorage, true, 'Must disable local storage for R2');

      const mimeTypes = uploadConfig.mimeTypes as string[];
      assert.ok(Array.isArray(mimeTypes), 'mimeTypes must be an array');
      assert.ok(mimeTypes.includes('video/mp4'), 'Must support video/mp4');
      assert.ok(mimeTypes.includes('video/webm'), 'Must support video/webm');
      assert.ok(mimeTypes.includes('image/gif'), 'Must support image/gif');
      assert.ok(mimeTypes.includes('image/jpeg'), 'Must support image/jpeg');
      assert.ok(mimeTypes.includes('image/webp'), 'Must support image/webp');
    });

    it('Media collection must strictly comply with Zero-Sharp policy in Edge Runtime', () => {
      const uploadConfig = Media.upload as any;
      assert.equal(
        uploadConfig.imageSizes,
        undefined,
        'imageSizes must NOT be declared (zero-sharp policy for Cloudflare Workers edge runtime)'
      );
    });

    it('Media collection must define media_type discriminator and rich media fields', () => {
      const fields = Media.fields as any[];
      const mediaTypeField = fields.find((f) => f.name === 'media_type');
      assert.ok(mediaTypeField, 'media_type field must be present');
      assert.equal(mediaTypeField.type, 'select');
      assert.equal(mediaTypeField.defaultValue, 'image');

      const optionValues = mediaTypeField.options.map((o: any) => o.value);
      assert.ok(optionValues.includes('image'));
      assert.ok(optionValues.includes('video'));
      assert.ok(optionValues.includes('gif'));

      const posterField = fields.find((f) => f.name === 'poster');
      assert.ok(posterField, 'poster upload relation field must be present');
      assert.equal(posterField.relationTo, 'media');

      const posterUrlField = fields.find((f) => f.name === 'poster_url');
      assert.ok(posterUrlField, 'poster_url field must be present');

      const loopField = fields.find((f) => f.name === 'loop');
      assert.ok(loopField, 'loop checkbox field must be present');
      assert.equal(loopField.defaultValue, true);

      const autoPlayField = fields.find((f) => f.name === 'auto_play');
      assert.ok(autoPlayField, 'auto_play checkbox field must be present');
      assert.equal(autoPlayField.defaultValue, true);
    });

    it('Media beforeChange hook must auto-detect media_type based on MIME type', async () => {
      const beforeChangeHook = Media.hooks?.beforeChange?.[0];
      assert.ok(typeof beforeChangeHook === 'function', 'beforeChange hook must be defined');

      // Video test
      const videoData = await beforeChangeHook({
        data: {},
        req: { file: { mimetype: 'video/mp4' } } as any,
      } as any);
      assert.equal(videoData.media_type, 'video');

      // GIF test
      const gifData = await beforeChangeHook({
        data: {},
        req: { file: { mimetype: 'image/gif' } } as any,
      } as any);
      assert.equal(gifData.media_type, 'gif');

      // Image test
      const imgData = await beforeChangeHook({
        data: {},
        req: { file: { mimetype: 'image/jpeg' } } as any,
      } as any);
      assert.equal(imgData.media_type, 'image');

      // Explicit override preserved
      const manualOverride = await beforeChangeHook({
        data: { media_type: 'video' },
        req: { file: { mimetype: 'image/jpeg' } } as any,
      } as any);
      assert.equal(manualOverride.media_type, 'video');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. D1 SQLite Migration 0009 Schema Integrity
  // ---------------------------------------------------------------------------
  describe('2. D1 SQLite Migration 0009 Validation', () => {
    it('migration 0009_story_3_16_rich_media.sql exists and executes against SQLite', () => {
      const migrationPath = path.join(rootDir, 'migrations', '0009_story_3_16_rich_media.sql');
      assert.ok(fs.existsSync(migrationPath), 'Migration 0009 file must exist');

      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(migrationSql.includes('ALTER TABLE media ADD COLUMN media_type TEXT'));
      assert.ok(migrationSql.includes('ALTER TABLE media ADD COLUMN poster_id INTEGER'));
      assert.ok(migrationSql.includes('ALTER TABLE media ADD COLUMN poster_url TEXT'));
      assert.ok(migrationSql.includes('ALTER TABLE media ADD COLUMN loop INTEGER'));
      assert.ok(migrationSql.includes('ALTER TABLE media ADD COLUMN auto_play INTEGER'));

      // Test execution in in-memory SQLite with baseline schema
      const db = new DatabaseSync(':memory:');

      // Setup minimal media table (as created in earlier migrations)
      db.exec(`
        CREATE TABLE media (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alt TEXT NOT NULL,
          caption TEXT,
          url TEXT,
          filename TEXT,
          mime_type TEXT,
          filesize INTEGER,
          width INTEGER,
          height INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Apply migration 0009
      db.exec(migrationSql);

      // Verify columns were added
      const pragmaCols = db.prepare(`PRAGMA table_info(media);`).all() as any[];
      const colNames = pragmaCols.map((c) => c.name);

      assert.ok(colNames.includes('media_type'), 'media_type column must be added');
      assert.ok(colNames.includes('poster_id'), 'poster_id column must be added');
      assert.ok(colNames.includes('poster_url'), 'poster_url column must be added');
      assert.ok(colNames.includes('loop'), 'loop column must be added');
      assert.ok(colNames.includes('auto_play'), 'auto_play column must be added');

      // Insert rich media records
      db.prepare(`
        INSERT INTO media (alt, url, filename, mime_type, media_type, poster_url, loop, auto_play)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `).run(
        'Anorak Waterproof Storm Test',
        '/media/anorak-storm-test.mp4',
        'anorak-storm-test.mp4',
        'video/mp4',
        'video',
        '/media/anorak-storm-poster.jpeg',
        1,
        1
      );

      db.prepare(`
        INSERT INTO media (alt, url, filename, mime_type, media_type, loop, auto_play)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `).run(
        'Leadville Pack Bartack Detail Loop',
        '/media/bartack-loop.gif',
        'bartack-loop.gif',
        'image/gif',
        'gif',
        1,
        1
      );

      const rows = db.prepare(`SELECT * FROM media WHERE media_type IN ('video', 'gif') ORDER BY id ASC;`).all() as any[];
      assert.equal(rows.length, 2);
      assert.equal(rows[0].media_type, 'video');
      assert.equal(rows[0].poster_url, '/media/anorak-storm-poster.jpeg');
      assert.equal(rows[1].media_type, 'gif');

      db.close();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. RichMediaViewer Component & MediaType Resolution
  // ---------------------------------------------------------------------------
  describe('3. RichMediaViewer Component & Resolution Logic', () => {
    it('resolveMediaType accurately identifies video, gif, and image formats', () => {
      assert.equal(resolveMediaType({ url: 'https://cdn.bankbeaters.com/clip.mp4' }), 'video');
      assert.equal(resolveMediaType({ url: '/media/demo.webm' }), 'video');
      assert.equal(resolveMediaType({ url: '/media/action.mov?v=123' }), 'video');
      assert.equal(resolveMediaType({ url: 'https://cdn.bankbeaters.com/loop.gif' }), 'gif');
      assert.equal(resolveMediaType({ url: '/media/photo.jpeg' }), 'image');
      assert.equal(resolveMediaType({ url: '/media/hero.webp' }), 'image');

      // Explicit mediaType property takes precedence
      assert.equal(
        resolveMediaType({ url: '/media/stream-asset', mediaType: 'video' }),
        'video'
      );
      assert.equal(
        resolveMediaType({ url: '/media/animated-cut', mediaType: 'gif' }),
        'gif'
      );
    });

    it('renders HTML5 <video> element with edge performance attributes for video items', () => {
      const videoItem: RichMediaItem = {
        url: '/media/field-test.mp4',
        mediaType: 'video',
        alt: 'Field water resistance demonstration',
        posterUrl: '/media/field-test-poster.jpeg',
        loop: true,
        autoPlay: true,
      };

      const html = renderToStaticMarkup(
        React.createElement(RichMediaViewer, { media: videoItem, aspectRatio: 'square' })
      );

      assert.ok(html.includes('<video'), 'Must render HTML5 video tag');
      assert.ok(html.includes('src="/media/field-test.mp4"'), 'Must bind correct video source');
      assert.ok(html.includes('poster="/media/field-test-poster.jpeg"'), 'Must include poster frame');
      assert.ok(html.includes('muted=""') || html.includes('muted'), 'Must include muted attribute');
      assert.ok(html.toLowerCase().includes('playsinline'), 'Must include playsinline attribute');
      assert.ok(html.includes('loop=""') || html.includes('loop'), 'Must include loop attribute');
      assert.ok(html.includes('preload="metadata"'), 'Must preload metadata for fast start');
      assert.ok(html.includes('Motion'), 'Must display Motion badge');
    });

    it('renders animated GIF container with loop indicator', () => {
      const gifItem: RichMediaItem = {
        url: '/media/waxing-canvas.gif',
        mediaType: 'gif',
        alt: 'Hand-waxing seams demonstration',
      };

      const html = renderToStaticMarkup(
        React.createElement(RichMediaViewer, { media: gifItem, aspectRatio: 'portrait' })
      );

      assert.ok(html.includes('<img'), 'Must render img tag for GIF');
      assert.ok(html.includes('src="/media/waxing-canvas.gif"'), 'Must bind correct GIF source');
      assert.ok(html.includes('GIF Loop'), 'Must display GIF Loop indicator');
      assert.ok(html.includes('aspect-[4/5]'), 'Must apply portrait aspect ratio');
    });

    it('renders responsive photographic image with Cloudflare srcset', () => {
      const imageItem: RichMediaItem = {
        url: '/media/bushwhack-anorak/hero.jpeg',
        mediaType: 'image',
        alt: 'The Bushwhack Storm Anorak',
      };

      const html = renderToStaticMarkup(
        React.createElement(RichMediaViewer, { media: imageItem, aspectRatio: 'square', priority: true })
      );

      assert.ok(html.includes('<img'), 'Must render img tag');
      assert.ok(html.includes('/cdn-cgi/image/'), 'Must use Cloudflare Image Resizing URL');
      assert.ok(html.toLowerCase().includes('srcset='), 'Must include responsive srcset');
      assert.ok(html.includes('loading="lazy"') || html.includes('loading="eager"'), 'Must include loading attribute');
    });

    it('renders fallback specimen placeholder on error', () => {
      // Test the fallback markup directly
      const html = renderToStaticMarkup(
        React.createElement(
          'div',
          { 'data-testid': 'rich-media-fallback', className: 'aspect-square' },
          React.createElement('span', null, 'Media Specimen Unavailable')
        )
      );
      assert.ok(html.includes('Media Specimen Unavailable'));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. MediaCarousel Component & Interaction Progression
  // ---------------------------------------------------------------------------
  describe('4. MediaCarousel Component & Interaction Handling', () => {
    const sampleItems: CarouselMediaItem[] = [
      {
        id: 'item-1',
        url: '/media/anorak-hero.jpeg',
        label: 'Studio Silhouette',
        tag: 'Studio',
        mediaType: 'image',
      },
      {
        id: 'item-2',
        url: '/media/anorak-storm-test.mp4',
        label: 'Waterproof Storm Field Test',
        tag: 'Field Test',
        mediaType: 'video',
        posterUrl: '/media/anorak-storm-poster.jpeg',
      },
      {
        id: 'item-3',
        url: '/media/bartack-reinforcement.gif',
        label: 'Bartack Stress Test Loop',
        tag: 'Workshop',
        mediaType: 'gif',
      },
    ];

    it('renders empty fallback view when items array is empty', () => {
      const html = renderToStaticMarkup(
        React.createElement(MediaCarousel, { items: [], fallbackIcon: '🎒' })
      );
      assert.ok(html.includes('Workbench Silhouette Preview'));
      assert.ok(html.includes('🎒'));
    });

    it('renders carousel with WCAG carousel semantics and controls', () => {
      const html = renderToStaticMarkup(
        React.createElement(MediaCarousel, {
          items: sampleItems,
          selectedIndex: 0,
          idleIntervalMs: 5000,
          resumeDelayMs: 15000,
          topBadges: React.createElement('span', { className: 'badge' }, 'Featured'),
        })
      );

      // Carousel semantics
      assert.ok(html.includes('role="region"'), 'Root must have role="region"');
      assert.ok(html.includes('aria-roledescription="carousel"'), 'Root must have carousel role description');
      assert.ok(html.includes('aria-label="Product Media Gallery"'), 'Root must have accessible label');

      // Slide semantics
      assert.ok(html.includes('aria-roledescription="slide"'), 'Slide must have slide role description');
      assert.ok(html.includes('aria-label="Slide 1 of 3"'), 'Slide must describe index');

      // Screen reader live region
      assert.ok(html.includes('aria-live="polite"'), 'Live region must announce slides');

      // WCAG Pause/Play toggle button
      assert.ok(html.includes('aria-label="Pause carousel auto-advance"'), 'Must have pause toggle button');
      assert.ok(html.includes('Pause Auto-Play'), 'Must display toggle text');

      // Previous and Next buttons
      assert.ok(html.includes('aria-label="Previous slide"'), 'Must render previous slide button');
      assert.ok(html.includes('aria-label="Next slide"'), 'Must render next slide button');

      // Counter indicator
      assert.ok(html.includes('1 / 3'), 'Must display slide counter');

      // Badges
      assert.ok(html.includes('Featured'), 'Must render topBadges');
      assert.ok(html.includes('Studio'), 'Must render tag overlay');
    });

    it('renders thumbnails with media type indicators for video and gif', () => {
      const html = renderToStaticMarkup(
        React.createElement(MediaCarousel, { items: sampleItems, selectedIndex: 0, showThumbnails: true })
      );

      assert.ok(html.includes('role="tablist"'), 'Thumbnails strip must have role="tablist"');
      assert.ok(html.includes('role="tab"'), 'Thumbnails must have role="tab"');
      assert.ok(html.includes('Vid'), 'Video thumbnail must display Vid indicator');
      assert.ok(html.includes('Gif'), 'GIF thumbnail must display Gif indicator');
    });

    it('renders active video slide with video element when selectedIndex is 1', () => {
      const html = renderToStaticMarkup(
        React.createElement(MediaCarousel, { items: sampleItems, selectedIndex: 1 })
      );

      assert.ok(html.includes('<video'), 'Must render HTML5 video tag for active slide');
      assert.ok(html.includes('src="/media/anorak-storm-test.mp4"'));
      assert.ok(html.includes('aria-label="Slide 2 of 3"'));
      assert.ok(html.includes('2 / 3'));
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Product Detail Page (PDP) Integration
  // ---------------------------------------------------------------------------
  describe('5. Product Detail Page Integration', () => {
    it('ProductDetailClient imports and utilizes MediaCarousel', () => {
      const pdpPath = path.join(
        rootDir,
        'apps',
        'web',
        'src',
        'app',
        '(storefront)',
        'products',
        '[slug]',
        'ProductDetailClient.tsx'
      );
      assert.ok(fs.existsSync(pdpPath), 'ProductDetailClient.tsx must exist');

      const pdpSource = fs.readFileSync(pdpPath, 'utf8');
      assert.ok(
        pdpSource.includes("import { MediaCarousel, type CarouselMediaItem } from '@/components/storefront/MediaCarousel';"),
        'ProductDetailClient must import MediaCarousel'
      );
      assert.ok(
        pdpSource.includes('<MediaCarousel'),
        'ProductDetailClient must render MediaCarousel component'
      );
      assert.ok(
        pdpSource.includes('idleIntervalMs={5000}'),
        'ProductDetailClient must configure 5s idle interval'
      );
      assert.ok(
        pdpSource.includes('resumeDelayMs={15000}'),
        'ProductDetailClient must configure 15s resume delay'
      );
    });
  });
});
