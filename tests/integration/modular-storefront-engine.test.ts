import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatabaseSync } from 'node:sqlite';

// Import storefront sections
import {
  HeroMinimalistOverlay,
  HeroFieldWorkshop,
  HeroCatalogDirect,
  DropCountdownSection,
  FeaturedCollectionSection,
  CraftsmanshipStorySection,
  MaterialProvenanceSection,
  SectionRenderer,
} from '../../apps/web/src/components/storefront/sections';

// Import Payload Block schemas & globals
import {
  HeroBlock,
  HERO_PRESETS,
  DropCountdownBlock,
  FeaturedCollectionBlock,
  CraftsmanshipStoryBlock,
  MaterialProvenanceBlock,
} from '../../apps/web/src/blocks';
import {
  ThemeSettings,
  FONT_PAIRING_PRESETS,
  SURFACE_CANVAS_OPTIONS,
} from '../../apps/web/src/globals/ThemeSettings';
import { DEFAULT_HOMEPAGE_LAYOUT } from '../../apps/web/src/lib/pages';

describe('Story 3.15: Modular Storefront Page Customization & Hero Template Engine', () => {
  const rootDir = process.cwd();

  // ---------------------------------------------------------------------------
  // 1. Payload CMS Block Schemas & Configuration Integrity
  // ---------------------------------------------------------------------------
  describe('1. Payload CMS Block & Collection Schemas', () => {
    it('HeroBlock must define selectable layout presets: minimalist_overlay, field_workshop, catalog_direct', () => {
      assert.equal(HeroBlock.slug, 'hero');
      const presetField = HeroBlock.fields.find((f: any) => f.name === 'layoutPreset') as any;
      assert.ok(presetField, 'HeroBlock must have layoutPreset field');
      assert.equal(presetField.type, 'select');

      const presetValues = presetField.options.map((opt: any) => opt.value);
      assert.ok(presetValues.includes('minimalist_overlay'), 'Must include minimalist_overlay preset');
      assert.ok(presetValues.includes('field_workshop'), 'Must include field_workshop preset');
      assert.ok(presetValues.includes('catalog_direct'), 'Must include catalog_direct preset');

      // Verify essential editorial fields
      const fieldNames = HeroBlock.fields.map((f: any) => f.name);
      assert.ok(fieldNames.includes('headline'), 'Must include headline');
      assert.ok(fieldNames.includes('subheadline'), 'Must include subheadline');
      assert.ok(fieldNames.includes('ethosStatement'), 'Must include ethosStatement');
      assert.ok(fieldNames.includes('backdropImage'), 'Must include backdropImage');
      assert.ok(fieldNames.includes('badgeText'), 'Must include badgeText');
      assert.ok(fieldNames.includes('provenanceCallout'), 'Must include provenanceCallout');
      assert.ok(fieldNames.includes('ctaButtons'), 'Must include ctaButtons');
    });

    it('DropCountdownBlock must define countdown target date and announcement copy', () => {
      assert.equal(DropCountdownBlock.slug, 'dropCountdown');
      const fieldNames = DropCountdownBlock.fields.map((f: any) => f.name);
      assert.ok(fieldNames.includes('title'), 'Must include title');
      assert.ok(fieldNames.includes('targetDate'), 'Must include targetDate');
      assert.ok(fieldNames.includes('ctaText'), 'Must include ctaText');
    });

    it('FeaturedCollectionBlock must support category filtering and starting price toggles', () => {
      assert.equal(FeaturedCollectionBlock.slug, 'featuredCollection');
      const fieldNames = FeaturedCollectionBlock.fields.map((f: any) => f.name);
      assert.ok(fieldNames.includes('categoryFilter'), 'Must include categoryFilter');
      assert.ok(fieldNames.includes('limit'), 'Must include limit');
      assert.ok(fieldNames.includes('showStartingPrice'), 'Must include showStartingPrice');
    });

    it('CraftsmanshipStoryBlock and MaterialProvenanceBlock must define narrative and technical spec fields', () => {
      assert.equal(CraftsmanshipStoryBlock.slug, 'craftsmanshipStory');
      const storyFields = CraftsmanshipStoryBlock.fields.map((f: any) => f.name);
      assert.ok(storyFields.includes('headline'), 'Must include headline');
      assert.ok(storyFields.includes('pillars'), 'Must include pillars array');

      assert.equal(MaterialProvenanceBlock.slug, 'materialProvenance');
      const matFields = MaterialProvenanceBlock.fields.map((f: any) => f.name);
      assert.ok(matFields.includes('headline'), 'Must include headline');
      assert.ok(matFields.includes('materials'), 'Must include materials array');
    });

    it('ThemeSettings global must define font pairings, surface canvas tokens, and accent colors', () => {
      assert.equal(ThemeSettings.slug, 'themeSettings');
      const fieldNames = ThemeSettings.fields.map((f: any) => f.name);
      assert.ok(fieldNames.includes('fontPreset'), 'Must include fontPreset');
      assert.ok(fieldNames.includes('surfaceCanvas'), 'Must include surfaceCanvas');
      assert.ok(fieldNames.includes('accentColor'), 'Must include accentColor');
      assert.ok(fieldNames.includes('hairlineBorder'), 'Must include hairlineBorder');

      const fontField = ThemeSettings.fields.find((f: any) => f.name === 'fontPreset') as any;
      const fontValues = fontField.options.map((opt: any) => opt.value);
      assert.ok(fontValues.includes('shippori_jakarta'), 'Must include Shippori + Jakarta preset');
      assert.ok(fontValues.includes('space_plex'), 'Must include Space Grotesk + Plex Mono preset');
      assert.ok(fontValues.includes('fraunces_inter'), 'Must include Fraunces + Inter preset');
    });

    it('Payload config must register pages collection and themeSettings global', async () => {
      const configPath = path.join(rootDir, 'apps/web/payload.config.ts');
      assert.ok(fs.existsSync(configPath), 'payload.config.ts must exist');
      const content = fs.readFileSync(configPath, 'utf-8');

      assert.ok(content.includes('Pages'), 'payload.config.ts must import and register Pages');
      assert.ok(content.includes('ThemeSettings'), 'payload.config.ts must import and register ThemeSettings');
      assert.ok(content.includes('globals: [ThemeSettings]'), 'payload.config.ts must register globals');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Database Migration & Local Query Integration
  // ---------------------------------------------------------------------------
  describe('2. D1 SQLite Migration & Pages Collection Persistence', () => {
    const setupTestDatabase = (): DatabaseSync => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = OFF;');

      const migrationDir = path.join(rootDir, 'migrations');
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const m of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationDir, m), 'utf-8');
        db.exec(sql);
      }
      return db;
    };

    it('should verify migration 0008 provisions pages, block subtables, and theme_settings', () => {
      const db = setupTestDatabase();

      // Check pages table
      const pageCols = db.prepare('PRAGMA table_info(pages);').all() as any[];
      const pageColNames = pageCols.map((c) => c.name);
      assert.ok(pageColNames.includes('id'));
      assert.ok(pageColNames.includes('title'));
      assert.ok(pageColNames.includes('slug'));
      assert.ok(pageColNames.includes('status'));

      // Check hero block table
      const heroCols = db.prepare('PRAGMA table_info(pages_blocks_hero);').all() as any[];
      const heroColNames = heroCols.map((c) => c.name);
      assert.ok(heroColNames.includes('layout_preset'));
      assert.ok(heroColNames.includes('headline'));
      assert.ok(heroColNames.includes('ethos_statement'));

      // Check theme_settings table
      const themeCols = db.prepare('PRAGMA table_info(theme_settings);').all() as any[];
      const themeColNames = themeCols.map((c) => c.name);
      assert.ok(themeColNames.includes('font_preset'));
      assert.ok(themeColNames.includes('surface_canvas'));
      assert.ok(themeColNames.includes('accent_color'));

      const pageCount = db.prepare("SELECT COUNT(*) as cnt FROM pages WHERE slug = 'homepage';").get() as any;
      assert.equal(pageCount.cnt, 1, 'Default homepage must be seeded in migration 0008');

      const themeRow = db.prepare('SELECT * FROM theme_settings LIMIT 1;').get() as any;
      assert.ok(themeRow, 'Default theme settings must be seeded');
      assert.equal(themeRow.font_preset, 'shippori_jakarta');
      assert.equal(themeRow.accent_color, '#E55B24');
    });

    it('should query pages collection through Payload local API and persist custom layouts', async () => {
      const db = setupTestDatabase();

      const mod = await import(path.join(rootDir, 'apps/web/payload.config'));
      const config = mod.default;

      const mockD1 = {
        prepare(sql: string) {
          return {
            bind(...params: any[]) {
              return {
                all: async () => ({ results: db.prepare(sql).all(...params), success: true }),
                first: async () => db.prepare(sql).get(...params) || null,
                run: async () => {
                  const res = db.prepare(sql).run(...params);
                  return { success: true, meta: { changes: (res as any).changes } };
                },
                raw: async () => db.prepare(sql).all(...params).map((r: any) => Object.values(r)),
              };
            },
            all: async () => ({ results: db.prepare(sql).all(), success: true }),
            first: async () => db.prepare(sql).get() || null,
            run: async () => {
              const res = db.prepare(sql).run();
              return { success: true, meta: { changes: (res as any).changes } };
            },
            raw: async () => db.prepare(sql).all().map((r: any) => Object.values(r)),
          };
        },
        batch: async (stmts: any[]) => stmts.map(() => ({ results: [], success: true })),
        exec: async (sql: string) => {
          db.exec(sql);
          return { count: 0, duration: 0 };
        },
      };

      (globalThis as any).DB = mockD1;

      const { getPayload } = require(path.join(rootDir, 'apps/web/node_modules/payload'));
      const payload = await getPayload({ config });

      const pages = await payload.find({
        collection: 'pages',
        limit: 5,
      });

      assert.ok(pages.docs.length >= 1, 'Must find at least 1 seeded page');
      const homepage = pages.docs.find((p: any) => p.slug === 'homepage');
      assert.ok(homepage, 'Must find homepage doc');
      assert.equal(homepage.status, 'published');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Storefront Hero Template Rendering & Presets
  // ---------------------------------------------------------------------------
  describe('3. Storefront Hero Presets & Contrast Verification', () => {
    it('Preset 1 (minimalist_overlay) should render full-bleed backdrop with dark vignettes and WCAG 2.1 AA text contrast', () => {
      const html = renderToStaticMarkup(
        React.createElement(HeroMinimalistOverlay, {
          headline: 'Curiosity > Fear.',
          subheadline: 'Hand-Sewn Technical Outdoor Gear',
          badgeText: '⚡ Limited-Run Drop Live',
          productsCount: 4,
        })
      );

      // Verify testid and preset geometry
      assert.ok(html.includes('data-testid="hero-minimalist-overlay"'));
      assert.ok(html.includes('/media/hero/bank-beaters-bg.jpg'), 'Must render background image');

      // Verify multi-tier atmospheric vignettes for WCAG 2.1 AA high contrast
      assert.ok(html.includes('bg-[#0d1015]/65'), 'Must render dark wash vignette layer');
      assert.ok(html.includes('radial-gradient'), 'Must render radial vignette gradient');
      assert.ok(html.includes('text-white'), 'Headline must be stark white for contrast');
      assert.ok(html.includes('drop-shadow'), 'Text elements must include drop shadow');

      // Verify interactive controls satisfy 44px touch targets
      assert.ok(html.includes('min-h-[48px]') || html.includes('min-h-[44px]'), 'Buttons must satisfy min 44px tap targets');
      assert.ok(html.includes('Explore Gear Roster (4)'), 'Must render product count CTA');
    });

    it('Preset 2 (field_workshop) should render split editorial layout with Leadville provenance metadata', () => {
      const html = renderToStaticMarkup(
        React.createElement(HeroFieldWorkshop, {
          headline: 'Hand-Sewn at 10,152 Feet.',
          productsCount: 3,
        })
      );

      assert.ok(html.includes('data-testid="hero-field-workshop"'));
      assert.ok(html.includes('10,152 FT'), 'Must display Leadville elevation metadata');
      assert.ok(html.includes('Juki Single-Needle'), 'Must specify industrial sewing rig');
      assert.ok(html.includes('Bonded Nylon V-69'), 'Must specify thread spec');
      assert.ok(html.includes('2–4 Serialized'), 'Must specify micro-batch size');
      assert.ok(html.includes('Lifetime Repair'), 'Must specify lifetime repair guarantee');
    });

    it('Preset 3 (catalog_direct) should render direct equipment roster header with category pathways', () => {
      const html = renderToStaticMarkup(
        React.createElement(HeroCatalogDirect, {
          headline: 'Field Equipment Roster.',
          productsCount: 6,
        })
      );

      assert.ok(html.includes('data-testid="hero-catalog-direct"'));
      assert.ok(html.includes('Outerwear &amp; Shells') || html.includes('Outerwear & Shells'));
      assert.ok(html.includes('Packs &amp; Carry Rigs') || html.includes('Packs & Carry Rigs'));
      assert.ok(html.includes('Field Accessories'));
      assert.ok(html.includes('Inspect All Silhouettes (6)'));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Composable Section Ordering & SectionRenderer Engine
  // ---------------------------------------------------------------------------
  describe('4. Composable SectionRenderer Engine', () => {
    it('SectionRenderer should dynamically render sections in exact custom layout order', () => {
      const customLayout = [
        {
          blockType: 'hero',
          layoutPreset: 'field_workshop',
          headline: 'Custom Workshop Hero',
        },
        {
          blockType: 'materialProvenance',
          headline: 'Armor Specifications',
        },
        {
          blockType: 'craftsmanshipStory',
          headline: 'The Alpine Workbench',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(SectionRenderer, {
          layout: customLayout,
          products: [],
        })
      );

      // Verify all 3 custom sections rendered
      assert.ok(html.includes('data-testid="hero-field-workshop"'), 'Hero section must render');
      assert.ok(html.includes('data-testid="section-material-provenance"'), 'Material section must render');
      assert.ok(html.includes('data-testid="section-craftsmanship-story"'), 'Story section must render');

      // Verify layout ordering
      const heroIdx = html.indexOf('data-testid="hero-field-workshop"');
      const matIdx = html.indexOf('data-testid="section-material-provenance"');
      const storyIdx = html.indexOf('data-testid="section-craftsmanship-story"');

      assert.ok(heroIdx < matIdx, 'Hero must precede Material section');
      assert.ok(matIdx < storyIdx, 'Material must precede Story section');
    });

    it('SectionRenderer should render drop countdown and featured collection sections', () => {
      const dropLayout = [
        {
          blockType: 'dropCountdown',
          title: 'May 2026 Alpine Drop',
          subtitle: 'Scheduled Batch 04',
          targetDate: '2026-05-15T18:00:00Z',
        },
        {
          blockType: 'featuredCollection',
          title: 'Active Outerwear Roster',
          categoryFilter: 'outerwear',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(SectionRenderer, {
          layout: dropLayout,
          products: [
            {
              id: 'prod-anorak',
              title: 'The Bushwhack Storm Anorak',
              slug: 'bushwhack-storm-anorak',
              base_price: 340,
              status: 'published',
              category: { id: 'cat-1', name: 'Outerwear', slug: 'outerwear' },
            } as any,
          ],
        })
      );

      assert.ok(html.includes('data-testid="section-drop-countdown"'));
      assert.ok(html.includes('May 2026 Alpine Drop'));
      assert.ok(html.includes('data-testid="section-featured-collection"'));
      assert.ok(html.includes('The Bushwhack Storm Anorak'));
      assert.ok(html.includes('$340.00'));
    });
  });
});
