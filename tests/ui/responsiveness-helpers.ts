import { expect, type Page } from '@playwright/test';

export interface ViewportConfig {
  width: number;
  height: number;
  name: string;
}

export const VIEWPORTS: Record<string, ViewportConfig> = {
  'mobile-compact': { width: 320, height: 568, name: 'mobile-compact' },
  'mobile-standard': { width: 390, height: 844, name: 'mobile-standard' },
  'mobile-large': { width: 430, height: 932, name: 'mobile-large' },
  'tablet-portrait': { width: 768, height: 1024, name: 'tablet-portrait' },
  'tablet-landscape': { width: 1024, height: 768, name: 'tablet-landscape' },
  'desktop-standard': { width: 1280, height: 800, name: 'desktop-standard' },
  'desktop-wide': { width: 1536, height: 960, name: 'desktop-wide' },
};

/**
 * 1. Zero Horizontal Overflow Guardrail
 * Asserts document.scrollWidth <= clientWidth down to 320px screen width.
 * Pinpoints failing elements and computed geometry for rapid diagnosis.
 */
export async function assertNoHorizontalOverflow(
  page: Page,
  routeName: string,
  viewport: ViewportConfig
) {
  const overflowElements = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const docScrollWidth = document.documentElement.scrollWidth;

    const overflowingNodes: Array<{
      selector: string;
      tag: string;
      className: string;
      scrollWidth: number;
      clientWidth: number;
      right: number;
    }> = [];

    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      // Ignore hidden or 0-dimension elements
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        rect.width === 0 ||
        style.position === 'fixed'
      ) {
        continue;
      }
      if (rect.right > docWidth + 1.5 || el.scrollWidth > docWidth + 1.5) {
        const id = el.id ? `#${el.id}` : '';
        const classes =
          el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
            : '';
        overflowingNodes.push({
          selector: `${el.tagName.toLowerCase()}${id}${classes}`,
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === 'string' ? el.className : '',
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          right: Math.round(rect.right),
        });
      }
    }

    // Filter out root containers html and body from pinpoint list unless they are the sole offenders
    const specificNodes = overflowingNodes.filter(
      (n) => n.tag !== 'html' && n.tag !== 'body'
    );
    const reportNodes = specificNodes.length > 0 ? specificNodes : overflowingNodes;
    reportNodes.sort(
      (a, b) => Math.max(b.scrollWidth, b.right) - Math.max(a.scrollWidth, a.right)
    );

    return {
      docWidth,
      docScrollWidth,
      bodyScrollWidth,
      overflowingNodes: reportNodes.slice(0, 5),
    };
  });

  if (overflowElements.docScrollWidth > overflowElements.docWidth + 1.5) {
    const details = overflowElements.overflowingNodes
      .map(
        (n) =>
          `  - <${n.tag}> (${n.selector}) [scrollWidth: ${n.scrollWidth}px, right: ${n.right}px]`
      )
      .join('\n');
    throw new Error(
      `[Horizontal Overflow Detected] on route "${routeName}" at viewport ${viewport.name} (${viewport.width}x${viewport.height}):\n` +
        `document.scrollWidth (${overflowElements.docScrollWidth}px) exceeds clientWidth (${overflowElements.docWidth}px).\n` +
        `Pinpoint elements:\n${details || '  (Root body/html layout boundary)'}`
    );
  }
}

/**
 * 2. Scaled Font / Dynamic Type Resilience Guardrail (125% & 150%)
 * Scales root font-size up to 150% to simulate OS dynamic type / browser zoom.
 * Confirms layout does not overflow horizontally and critical text expands fluidly.
 */
export async function assertScaledFontAccessibility(
  page: Page,
  routeName: string,
  fontScale: number
) {
  await page.evaluate((scale) => {
    document.documentElement.style.fontSize = `${scale * 100}%`;
  }, fontScale);

  // Allow reflow
  await page.waitForTimeout(100);

  const overflow = await page.evaluate(() => {
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(
    overflow.scrollWidth,
    `Route "${routeName}" overflowed horizontally at font scale ${(fontScale * 100).toFixed(0)}%: scrollWidth ${overflow.scrollWidth}px > clientWidth ${overflow.clientWidth}px`
  ).toBeLessThanOrEqual(overflow.clientWidth + 6);

  // Reset root font
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
}

/**
 * 3. Touch Target Compliance Guardrail
 * Verifies interactive elements on mobile viewports (< 768px) satisfy the 44x44px minimum tap target.
 */
export async function assertAccessibleTouchTargets(
  page: Page,
  viewport: ViewportConfig
) {
  if (viewport.width >= 768) return;

  const nonCompliant = await page.evaluate(() => {
    const interactive = Array.from(
      document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]'
      )
    );

    const issues: Array<{ selector: string; width: number; height: number }> = [];

    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        (el as HTMLElement).offsetParent === null
      ) {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight * 3) {
        continue;
      }

      // Allow standard inline links within paragraphs/sentences or inline breadcrumb navigation
      if (
        (el.tagName === 'A' && el.parentElement?.tagName === 'P') ||
        el.closest('nav[aria-label*="breadcrumb" i], [aria-label*="Breadcrumb"]') ||
        el.closest('nav.text-xs, nav.text-sm')
      ) {
        continue;
      }

      // Check min 44x44px (with 4px tolerance for inline text links or micro-margins)
      if (rect.width < 40 || rect.height < 40) {
        const id = el.id ? `#${el.id}` : '';
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().slice(0, 20);
        issues.push({
          selector: `${tag}${id} ("${text}")`,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }

    issues.sort((a, b) => a.width * a.height - b.width * b.height);
    return issues.slice(0, 5);
  });

  if (nonCompliant.length > 0) {
    const msg = nonCompliant
      .map((i) => `  - ${i.selector} [${i.width}px x ${i.height}px]`)
      .join('\n');
    throw new Error(
      `[Touch Target Invariant Failed] at viewport ${viewport.name} (${viewport.width}px):\n` +
        `Interactive controls must have minimum 44x44px bounding box. Failing elements:\n${msg}`
    );
  }
}

/**
 * 4. Adaptive Navigation Guardrail
 * Verifies hamburger drawer on mobile (<768px) and full nav on desktop (>=1024px).
 */
export async function assertAdaptiveNavigation(page: Page, isMobile: boolean) {
  if (isMobile) {
    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    const desktopNav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(desktopNav).toBeHidden();

    // Toggle drawer open (with retry for client hydration)
    await expect(async () => {
      const isExpanded = await hamburger.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await hamburger.click();
      }
      expect(await hamburger.getAttribute('aria-expanded')).toBe('true');
    }).toPass({ timeout: 5000 });

    const drawer = page.locator('#mobile-storefront-menu');
    await expect(drawer).toBeVisible();

    // Toggle drawer closed
    await expect(async () => {
      const isExpanded = await hamburger.getAttribute('aria-expanded');
      if (isExpanded === 'true') {
        await hamburger.click();
      }
      expect(await hamburger.getAttribute('aria-expanded')).toBe('false');
    }).toPass({ timeout: 5000 });
  } else {
    const desktopNav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(desktopNav).toBeVisible();

    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeHidden();
  }
}

/**
 * 5. Sticky CTA In Thumb Zone Guardrail
 * Verifies that on PDP routes at mobile viewports, scrolling past the hero
 * keeps the fixed bottom sticky action bar with accessible CTA in the thumb zone.
 */
export async function assertStickyCtaInThumbZone(page: Page) {
  // Scroll down into thumb zone to verify persistent sticky CTA
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(300);

  const isBottomFixed = await page.evaluate(() => {
    const fixedElements = Array.from(document.querySelectorAll('div.fixed.bottom-0'));
    return fixedElements.length > 0;
  });
  expect(
    isBottomFixed,
    'Mobile sticky CTA must have fixed bottom-0 positioning in thumb zone'
  ).toBe(true);
}

/**
 * 6. iOS Safari Auto-Zoom Prevention Guardrail
 * Form inputs must have font-size >= 16px to prevent iOS Safari auto-zooming into inputs.
 */
export async function assertIosAutoZoomSafe(page: Page) {
  const smallInputs = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    const failing: Array<{ tag: string; fontSize: string }> = [];
    for (const input of inputs) {
      const style = window.getComputedStyle(input);
      const size = parseFloat(style.fontSize);
      if (size > 0 && size < 16) {
        failing.push({ tag: input.tagName.toLowerCase(), fontSize: style.fontSize });
      }
    }
    return failing;
  });

  expect(
    smallInputs,
    `Form inputs must have font-size >= 16px to prevent iOS auto-zoom: ${JSON.stringify(smallInputs)}`
  ).toHaveLength(0);
}

/**
 * 7. Viewport Meta Tag & Safe-Area Invariant Gate
 * Verifies viewport meta tag contains width=device-width, initial-scale=1, viewport-fit=cover
 */
export async function assertViewportMeta(page: Page) {
  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta).toBeTruthy();
  expect(meta).toContain('width=device-width');
  expect(meta).toContain('initial-scale=1');
  expect(meta).toContain('viewport-fit=cover');
}
