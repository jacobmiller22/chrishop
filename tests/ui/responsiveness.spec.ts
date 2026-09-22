import { test, expect } from '@playwright/test';
import {
  VIEWPORTS,
  assertNoHorizontalOverflow,
  assertScaledFontAccessibility,
  assertAccessibleTouchTargets,
  assertAdaptiveNavigation,
  assertStickyCtaInThumbZone,
  assertIosAutoZoomSafe,
  assertViewportMeta,
  type ViewportConfig,
} from './responsiveness-helpers';

const ROUTES = [
  { name: 'Homepage', path: '/' },
  { name: 'Equipment Catalog', path: '/products' },
  { name: 'Product Detail Page', path: '/products/bushwhack-storm-anorak' },
  { name: 'The Maker Story', path: '/about' },
];

test.describe('Story 1.24: Automated Storefront Responsiveness Guardrails', () => {
  // 1. Viewport Meta Tag & Safe-Area Gate
  test('Storefront document declares compliant mobile viewport and safe-area metadata', async ({
    page,
  }) => {
    await page.goto('/');
    await assertViewportMeta(page);
  });

  // 2. Multi-Viewport Sweep: Zero Horizontal Overflow & Touch Target Compliance
  for (const [vpKey, vp] of Object.entries(VIEWPORTS)) {
    test.describe(`Viewport Tier: ${vpKey} (${vp.width}x${vp.height})`, () => {
      for (const route of ROUTES) {
        test(`Route "${route.name}" (${route.path}) maintains zero horizontal overflow`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(route.path, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(300);

          await assertNoHorizontalOverflow(page, route.name, vp);
        });

        if (vp.width < 768) {
          test(`Route "${route.name}" satisfies mobile touch target minimums (44x44px)`, async ({
            page,
          }) => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto(route.path, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(200);

            await assertAccessibleTouchTargets(page, vp);
          });
        }
      }
    });
  }

  // 3. Scaled Font / Dynamic Type Resilience (125% & 150%)
  test.describe('Scaled Font / Dynamic Type Resilience', () => {
    const scales = [1.25, 1.5];

    for (const scale of scales) {
      test(`Core routes maintain zero overflow under ${(scale * 100).toFixed(0)}% root font scale`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        for (const route of ROUTES) {
          await page.goto(route.path, { waitUntil: 'domcontentloaded' });
          await assertScaledFontAccessibility(page, route.name, scale);
        }
      });
    }
  });

  // 4. Adaptive Navigation: Mobile Drawer vs Desktop Bar
  test.describe('Adaptive Navigation Contracts', () => {
    test('Mobile viewports (< 768px) render accessible hamburger drawer and hide desktop nav', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await assertAdaptiveNavigation(page, true);
    });

    test('Desktop viewports (≥ 1024px) render full desktop nav and hide mobile hamburger', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await assertAdaptiveNavigation(page, false);
    });
  });

  // 5. PDP Sticky CTA in Mobile Thumb Zone
  test.describe('Mobile Conversion Invariant: PDP Sticky CTA', () => {
    test('Sticky bottom action bar appears when main purchase block is scrolled out of view', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/products/bushwhack-storm-anorak');
      await page.waitForTimeout(300);

      await assertStickyCtaInThumbZone(page);
    });
  });

  // 6. iOS Safari Auto-Zoom Prevention
  test.describe('iOS Safari Auto-Zoom Prevention Gate', () => {
    test('Form inputs enforce font-size >= 16px across storefront pages', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of ROUTES) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await assertIosAutoZoomSafe(page);
      }
    });
  });

  // 7. Actionable Diagnostics Verification (Acceptance Criteria 6)
  test.describe('Actionable Diagnostics Engine', () => {
    test('assertNoHorizontalOverflow immediately throws with pinpoint selector when horizontal defect is injected', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/');

      // Inject a deliberate 800px wide defect container
      await page.evaluate(() => {
        const rogue = document.createElement('div');
        rogue.id = 'rogue-overflow-box';
        rogue.className = 'rogue-test-class';
        rogue.style.width = '800px';
        rogue.style.height = '50px';
        rogue.style.background = 'red';
        rogue.textContent = 'Simulated Defect Box';
        document.body.appendChild(rogue);
      });

      let thrownError: Error | null = null;
      try {
        await assertNoHorizontalOverflow(page, 'Diagnostic Route', VIEWPORTS['mobile-compact']);
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain('[Horizontal Overflow Detected]');
      expect(thrownError?.message).toContain('rogue-overflow-box');
    });

    test('assertAccessibleTouchTargets throws with pinpoint element when undersized interactive control is injected', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');

      // Inject a miniature button
      await page.evaluate(() => {
        const miniBtn = document.createElement('button');
        miniBtn.id = 'micro-tap-button';
        miniBtn.style.width = '20px';
        miniBtn.style.height = '20px';
        miniBtn.textContent = 'Tiny';
        document.body.prepend(miniBtn);
      });

      let thrownError: Error | null = null;
      try {
        await assertAccessibleTouchTargets(page, VIEWPORTS['mobile-standard']);
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toContain('[Touch Target Invariant Failed]');
      expect(thrownError?.message).toContain('micro-tap-button');
    });
  });
});
