/**
 * Integration Test Suite: Automated Screen Tour Suite & Demo Crawler
 *
 * Story 4.11 (#153): Cloudflare Browser Rendering Automated Screen Tour Suite
 *
 * Validates:
 * 1. Screen tour manifest registry structure, selector assertions, and metadata
 * 2. Production safety target detection and error handling
 * 3. Screen filtering by category and focus areas
 * 4. Interactive markdown report formatting (tables, slides, provenance)
 * 5. Simulated crawler execution across local and remote routes
 * 6. Package.json script registration and runbook documentation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCREEN_TOUR_MANIFEST,
  filterScreens,
} from '../../apps/web/src/lib/screen-tour-manifest';
import {
  isProductionTarget,
  formatDemoWalkthroughMarkdown,
  runScreenTourSuite,
  ProductionSafetyError,
} from '../../apps/web/src/lib/demo-crawler';

describe('Story 4.11: Automated Screen Tour Suite & Demo Crawler', () => {
  describe('Screen Tour Manifest Registry', () => {
    it('should register at least 12 key application screens across storefront, admin, and ops', () => {
      assert.ok(SCREEN_TOUR_MANIFEST.length >= 12, `Expected >= 12 screens, got ${SCREEN_TOUR_MANIFEST.length}`);
    });

    it('should cover all required personas: shopper, creator, engineering', () => {
      const personas = new Set(SCREEN_TOUR_MANIFEST.map((s) => s.persona));
      assert.ok(personas.has('shopper'));
      assert.ok(personas.has('creator'));
      assert.ok(personas.has('engineering'));
    });

    it('should ensure all registered screens have selectors, route, and story provenance', () => {
      for (const screen of SCREEN_TOUR_MANIFEST) {
        assert.ok(screen.id, 'Screen must have an ID');
        assert.ok(screen.name, 'Screen must have a name');
        assert.ok(screen.route.startsWith('/'), `Route must start with slash: ${screen.route}`);
        assert.ok(screen.criticalSelectors.length > 0, `Screen ${screen.id} must have critical selectors`);
        assert.ok(screen.provenance.length > 0, `Screen ${screen.id} must have story provenance`);
        assert.equal(screen.safetyTier, 'safe_read', 'Demo tour screens must default to safe_read');
      }
    });

    it('should correctly filter screens by focus area', () => {
      const storefrontScreens = filterScreens('storefront');
      assert.ok(storefrontScreens.length > 0);
      assert.ok(storefrontScreens.every((s) => s.category === 'storefront'));

      const adminScreens = filterScreens('admin');
      assert.ok(adminScreens.length > 0);
      assert.ok(adminScreens.every((s) => s.category === 'admin'));

      const opsScreens = filterScreens('ops');
      assert.ok(opsScreens.length > 0);
      assert.ok(opsScreens.every((s) => s.category === 'ops'));

      const allScreens = filterScreens('all');
      assert.equal(allScreens.length, SCREEN_TOUR_MANIFEST.length);
    });
  });

  describe('Production Safety Enforcer', () => {
    it('should identify production domains requiring strict read-only lock', () => {
      assert.equal(isProductionTarget('https://chrishop.com'), true);
      assert.equal(isProductionTarget('https://www.chrishop.com'), true);
      assert.equal(isProductionTarget('https://chrishop.jacobmiller22.com'), true);
      assert.equal(isProductionTarget('https://chrishop.jacobmiller22.com/products'), true);
    });

    it('should allow staging, preview, and local hosts without automatic production lock', () => {
      assert.equal(isProductionTarget('http://localhost:3000'), false);
      assert.equal(isProductionTarget('http://127.0.0.1:8787'), false);
      assert.equal(isProductionTarget('https://staging.chrishop.jacobmiller22.com'), false);
      assert.equal(isProductionTarget('https://pr-153-chrishop.jacobmiller22.com'), false);
    });

    it('should instantiate ProductionSafetyError with proper name and message', () => {
      const err = new ProductionSafetyError('Mutating request prohibited');
      assert.equal(err.name, 'ProductionSafetyError');
      assert.equal(err.message, 'Mutating request prohibited');
    });
  });

  describe('Interactive Markdown Walkthrough Formatter', () => {
    it('should format a complete markdown artifact with summary table and visual slides', () => {
      const summary = {
        targetUrl: 'https://staging.chrishop.jacobmiller22.com',
        environment: 'staging',
        timestamp: '2026-09-22T12:00:00.000Z',
        totalDurationMs: 3200,
        passed: true,
        mode: 'remote_cdp',
        results: [
          {
            screen: SCREEN_TOUR_MANIFEST[0],
            passed: true,
            status: 200,
            durationMs: 250,
            desktopScreenshot: 'docs/demos/screenshots/storefront.home-desktop.png',
            mobileScreenshot: 'docs/demos/screenshots/storefront.home-mobile.png',
            consoleErrors: [],
            networkErrors: [],
            criticalSelectorsFound: true,
          },
        ],
      };

      const md = formatDemoWalkthroughMarkdown(summary);
      assert.ok(md.includes('# ChrisShop Automated Screen Tour & Interactive Demo Walkthrough'));
      assert.ok(md.includes('Target Environment**: `staging`'));
      assert.ok(md.includes('Execution Mode**: `remote_cdp`'));
      assert.ok(md.includes('✅ **TOUR PASSED (100% HEALTHY)**'));
      assert.ok(md.includes('## 1. Executive Screen Verification Summary'));
      assert.ok(md.includes('| ✔ PASS | **Storefront Home** (`/`) | shopper | HTTP 200 | 250ms | ✔ All Verified | 0 errors |'));
      assert.ok(md.includes('## 2. Interactive Visual Deck & Screen Tour Highlights'));
      assert.ok(md.includes('| Desktop Viewport (1280x800) | Mobile Viewport (390x844 - iPhone 14) |'));
      assert.ok(md.includes('![Storefront Home Desktop](docs/demos/screenshots/storefront.home-desktop.png)'));
      assert.ok(md.includes('![Storefront Home Mobile](docs/demos/screenshots/storefront.home-mobile.png)'));
      assert.ok(md.includes('## 3. Production Safety & Architecture Audit'));
    });

    it('should display regression alert when a screen fails in the tour', () => {
      const summary = {
        targetUrl: 'http://localhost:3000',
        environment: 'local',
        timestamp: '2026-09-22T12:00:00.000Z',
        totalDurationMs: 1500,
        passed: false,
        mode: 'simulated',
        results: [
          {
            screen: SCREEN_TOUR_MANIFEST[0],
            passed: false,
            status: 500,
            durationMs: 1500,
            consoleErrors: ['Uncaught exception in root layout'],
            networkErrors: [],
            criticalSelectorsFound: false,
          },
        ],
      };

      const md = formatDemoWalkthroughMarkdown(summary);
      assert.ok(md.includes('⚠️ **TOUR COMPLETED WITH REGRESSIONS**'));
      assert.ok(md.includes('| ✖ FAIL | **Storefront Home** (`/`) | shopper | HTTP 500 | 1500ms | ✖ Missing | ⚠️ 1 errors |'));
    });
  });

  describe('Simulated Screen Tour Suite Execution', () => {
    it('should successfully execute simulated screen tour and report structured summary', async () => {
      const summary = await runScreenTourSuite({
        targetUrl: 'http://localhost:3000',
        environment: 'local',
        focus: 'ops',
        captureScreenshots: false,
        config: { mode: 'simulated' },
      });

      assert.ok(summary);
      assert.equal(summary.environment, 'local');
      assert.ok(summary.totalDurationMs >= 0);
      assert.ok(summary.results.length > 0);
      assert.ok(summary.markdownReport.length > 0);
    });
  });

  describe('Package Registration & Operational Runbook', () => {
    it('should have demo and demo:verify registered in package.json', () => {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      assert.equal(pkg.scripts['demo'], 'tsx scripts/demo-crawler.ts');
      assert.equal(pkg.scripts['demo:verify'], 'tsx scripts/verify-demo-crawler.ts');
    });

    it('should have comprehensive operational runbook in docs/runbooks/AUTOMATED_DEMO_WALKTHROUGH.md', () => {
      const runbookPath = path.resolve(__dirname, '../../docs/runbooks/AUTOMATED_DEMO_WALKTHROUGH.md');
      assert.ok(fs.existsSync(runbookPath), 'Runbook must exist');

      const content = fs.readFileSync(runbookPath, 'utf8');
      assert.ok(content.includes('Cloudflare Browser Rendering'));
      assert.ok(content.includes('Production Safety Enforcer'));
      assert.ok(content.includes('Dual-Viewport Capture'));
      assert.ok(content.includes('Screen Tour Manifest Registry'));
      assert.ok(content.includes('CLI Reference & Usage'));
    });
  });
});
