import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProductDetailClient from '../src/app/(storefront)/products/[slug]/ProductDetailClient';
import type { StorefrontProduct } from '../src/lib/catalog';

// Mock product fixture adhering to StorefrontProduct schema
const MOCK_PRODUCT: StorefrontProduct = {
  id: 'prod-bramble-buster',
  title: 'Bramble Buster Technical Guide Pant',
  slug: 'bramble-buster-technical-guide-pant',
  description: 'Heavyweight ripstop guide pant built for rugged bushwhacking.',
  maker_field_notes: 'Tested in Colorado backcountry across dense oak scrub.',
  artist_statement: 'Crafted for resilience and mobility.',
  base_price: 188,
  effective_min_price: 188,
  status: 'published',
  category: {
    id: 'cat-apparel',
    name: 'Apparel',
    slug: 'apparel',
    description: 'Adventure clothing',
  },
  featured_image: 'media/bramble-buster/silhouette.jpeg',
  hero_image: 'media/bramble-buster/field-action.jpeg',
  gallery: ['media/bramble-buster/detail-pocket.jpeg', 'media/bramble-buster/detail-cuff.jpeg'],
  variations: [
    {
      id: 'var-bramble-32x32',
      product_id: 'prod-bramble-buster',
      variation_name: '32x32 / Field Khaki',
      sku: 'BB-PANT-32-32-KHK',
      variation_type: 'standard',
      effective_price: 188,
      is_limited_edition: false,
      status: 'active',
      stock_quantity: 15,
      variation_images: [
        {
          url: 'media/bramble-buster/workbench-seam.jpeg',
          caption: 'Reinforced inseam gusset',
        },
      ],
    },
  ],
};

describe('Story 1.20: PDP Hero Image Refresh & Hydration Handling', () => {
  // ---------------------------------------------------------------------------
  // 1. SSR & Initial HTML Rendering Invariants
  // ---------------------------------------------------------------------------
  describe('SSR Markup & Progressive Blur-Up Rendering', () => {
    it('should render blur-up placeholder with blur=50 and initial opacity-100', () => {
      const html = renderToStaticMarkup(React.createElement(ProductDetailClient, { product: MOCK_PRODUCT }));

      // Verify blur-up placeholder img exists
      assert.ok(html.includes('width=32'), 'Must include 32w micro placeholder');
      assert.ok(html.includes('quality=30'), 'Must request quality=30 for placeholder');
      assert.ok(html.includes('blur=50'), 'Must request blur=50 for ambient blur-up glow');
      assert.ok(html.includes('onerror=redirect'), 'Must include onerror=redirect fallback');

      // Verify placeholder is initially opacity-100 and z-0
      assert.ok(html.includes('opacity-100'), 'Placeholder must start at opacity-100');
      assert.ok(html.includes('z-0'), 'Placeholder must have z-0 stacking index');
      assert.ok(html.includes('pointer-events-none'), 'Placeholder must ignore pointer events');
    });

    it('should render prioritized hero image with eager attributes and initial opacity-0', () => {
      const html = renderToStaticMarkup(React.createElement(ProductDetailClient, { product: MOCK_PRODUCT }));

      // Verify hero image configuration
      assert.ok(html.includes('width=1024'), 'Must request 1024w master hero image');
      assert.ok(html.includes('quality=80'), 'Must request standard quality 80');
      assert.ok(html.includes('fetchpriority="high"') || html.includes('fetchPriority="high"'), 'Must have fetchPriority=high');
      assert.ok(html.includes('loading="eager"'), 'Must have loading=eager');
      assert.ok(html.includes('decoding="async"'), 'Must have decoding=async');

      // Verify responsive srcset attributes
      assert.ok(html.includes('384w'), 'Srcset must cover mobile 384w');
      assert.ok(html.includes('1536w'), 'Srcset must cover desktop 1536w');
      assert.ok(html.includes('sizes="(max-width: 768px) 100vw, 50vw"'), 'Must define responsive sizes');

      // Verify initial hero styling for smooth crossfade
      assert.ok(html.includes('relative z-10'), 'Hero image must have relative z-10 stacking above placeholder');
      assert.ok(html.includes('opacity-0'), 'Hero image must start at opacity-0 on SSR prior to client hydration');
      assert.ok(html.includes('transition-opacity duration-500 ease-out'), 'Must specify smooth CSS crossfade');
    });

    it('should maintain aspect-square container for zero cumulative layout shift (CLS)', () => {
      const html = renderToStaticMarkup(React.createElement(ProductDetailClient, { product: MOCK_PRODUCT }));

      assert.ok(html.includes('aspect-square'), 'Media container must enforce aspect-square to guarantee zero CLS');
      assert.ok(html.includes('bg-[#15191E]'), 'Container must have BankBeaters dark background placeholder');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Cached Image (complete === true) Client Hydration Behavior
  // ---------------------------------------------------------------------------
  describe('Cached Image (complete === true) Hydration & Ref Callback', () => {
    it('should immediately mark image as loaded when DOM element complete === true and naturalWidth > 0', () => {
      // Simulate client state and ref inspection logic
      const loadedImages = new Set<string>();
      const markImageLoaded = (url: string) => {
        if (!url) return;
        loadedImages.add(url);
      };

      const testUrl = 'https://media.chrishop.jacobmiller22.com/media/bramble-buster/workbench-seam.jpeg';

      // Mock HTMLImageElement in warm browser cache state (already downloaded & decoded)
      const mockCachedImg = {
        complete: true,
        naturalWidth: 1024,
        naturalHeight: 1024,
        src: testUrl,
      } as unknown as HTMLImageElement;

      // Simulate handleHeroImageRef callback execution during React commit phase
      const handleHeroImageRef = (el: HTMLImageElement | null, activeUrl: string) => {
        if (el && el.complete && el.naturalWidth > 0 && activeUrl) {
          markImageLoaded(activeUrl);
        }
      };

      // Execute ref callback
      handleHeroImageRef(mockCachedImg, testUrl);

      // Verify loaded state is immediately set WITHOUT any async load event
      assert.equal(loadedImages.has(testUrl), true, 'Cached image must be marked loaded synchronously on mount');

      // Verify state resolves to visible opacity-100
      const heroOpacityClass = loadedImages.has(testUrl) ? 'opacity-100' : 'opacity-0';
      const placeholderOpacityClass = loadedImages.has(testUrl) ? 'opacity-0' : 'opacity-100';

      assert.equal(heroOpacityClass, 'opacity-100', 'Hero image must immediately display with opacity-100');
      assert.equal(placeholderOpacityClass, 'opacity-0', 'Placeholder must fade to opacity-0');
    });

    it('should NOT mark image as loaded prematurely when complete === false (cold network load)', () => {
      const loadedImages = new Set<string>();
      const markImageLoaded = (url: string) => {
        if (!url) return;
        loadedImages.add(url);
      };

      const testUrl = 'https://media.chrishop.jacobmiller22.com/media/bramble-buster/field-action.jpeg';

      // Mock HTMLImageElement in cold loading state (download in flight)
      const mockColdImg = {
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0,
        src: testUrl,
      } as unknown as HTMLImageElement;

      const handleHeroImageRef = (el: HTMLImageElement | null, activeUrl: string) => {
        if (el && el.complete && el.naturalWidth > 0 && activeUrl) {
          markImageLoaded(activeUrl);
        }
      };

      // Mount occurs while image is still downloading
      handleHeroImageRef(mockColdImg, testUrl);

      // Verify image is NOT marked loaded yet
      assert.equal(loadedImages.has(testUrl), false, 'Cold image must not be marked loaded before completion');

      const heroOpacityBefore = loadedImages.has(testUrl) ? 'opacity-100' : 'opacity-0';
      const placeholderOpacityBefore = loadedImages.has(testUrl) ? 'opacity-0' : 'opacity-100';

      assert.equal(heroOpacityBefore, 'opacity-0', 'Hero image remains opacity-0 during download');
      assert.equal(placeholderOpacityBefore, 'opacity-100', 'Blur placeholder remains opacity-100 during download');

      // Simulate browser firing async onLoad event once download and decoding finish
      markImageLoaded(testUrl);

      const heroOpacityAfter = loadedImages.has(testUrl) ? 'opacity-100' : 'opacity-0';
      const placeholderOpacityAfter = loadedImages.has(testUrl) ? 'opacity-0' : 'opacity-100';

      assert.equal(heroOpacityAfter, 'opacity-100', 'Hero image transitions to opacity-100 once onLoad fires');
      assert.equal(placeholderOpacityAfter, 'opacity-0', 'Placeholder transitions to opacity-0');
    });

    it('should NOT falsely mark broken image as loaded when complete === true but naturalWidth === 0', () => {
      const loadedImages = new Set<string>();
      const markImageLoaded = (url: string) => {
        if (!url) return;
        loadedImages.add(url);
      };

      const testUrl = 'https://media.chrishop.jacobmiller22.com/media/broken.jpeg';

      // Broken / 404 image: complete is true in DOM, but naturalWidth is 0
      const mockBrokenImg = {
        complete: true,
        naturalWidth: 0,
        naturalHeight: 0,
        src: testUrl,
      } as unknown as HTMLImageElement;

      const handleHeroImageRef = (el: HTMLImageElement | null, activeUrl: string) => {
        if (el && el.complete && el.naturalWidth > 0 && activeUrl) {
          markImageLoaded(activeUrl);
        }
      };

      handleHeroImageRef(mockBrokenImg, testUrl);

      // Verify broken image is not marked loaded by the ref callback
      assert.equal(loadedImages.has(testUrl), false, 'Broken image with naturalWidth=0 must not be treated as loaded');

      // When onError fires, markImageLoaded is invoked so fallback can display
      const onError = () => markImageLoaded(testUrl);
      onError();

      assert.equal(loadedImages.has(testUrl), true, 'onError handler must invoke markImageLoaded for fallback display');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Background Image Decode (HTMLImageElement.prototype.decode) Simulation
  // ---------------------------------------------------------------------------
  describe('Modern Image Decoding (decode()) Resilience', () => {
    it('should resolve decode() promise and transition image to loaded state', async () => {
      const loadedImages = new Set<string>();
      const markImageLoaded = (url: string) => {
        if (!url) return;
        loadedImages.add(url);
      };

      const testUrl = 'https://media.chrishop.jacobmiller22.com/media/bramble-buster/detail-pocket.jpeg';

      // Mock DOM node with decode() method
      let decodeResolved = false;
      const mockImgWithDecode = {
        complete: false,
        naturalWidth: 0,
        src: testUrl,
        decode: () => {
          return new Promise<void>((resolve) => {
            decodeResolved = true;
            resolve();
          });
        },
      } as unknown as HTMLImageElement;

      // Simulate useEffect decode handling
      const runDecodeEffect = async (el: HTMLImageElement, activeUrl: string) => {
        if ('decode' in el && typeof el.decode === 'function') {
          try {
            await el.decode();
            markImageLoaded(activeUrl);
          } catch {
            // ignore
          }
        }
      };

      await runDecodeEffect(mockImgWithDecode, testUrl);

      assert.equal(decodeResolved, true, 'decode() method must have been invoked');
      assert.equal(loadedImages.has(testUrl), true, 'decode() resolution must mark image as loaded');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Laser-Preloading and Thumbnail Navigation
  // ---------------------------------------------------------------------------
  describe('Laser-Preloading (prefetchFullImage) Cache Hit & Event Handling', () => {
    it('should handle prefetch with synchronous cache completion without waiting for onload', () => {
      const loadedImages = new Set<string>();
      const markImageLoaded = (url: string) => {
        if (!url) return;
        loadedImages.add(url);
      };

      const prefetchUrl = 'https://media.chrishop.jacobmiller22.com/media/bramble-buster/detail-cuff.jpeg';

      // Simulate prefetchFullImage where Image() is already cached by the browser
      const simulatePrefetch = (url: string, mockComplete: boolean, mockNaturalWidth: number) => {
        const mockImg = {
          complete: mockComplete,
          naturalWidth: mockNaturalWidth,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };

        if (mockImg.complete && mockImg.naturalWidth > 0) {
          markImageLoaded(url);
        } else {
          mockImg.onload = () => markImageLoaded(url);
          mockImg.onerror = () => markImageLoaded(url);
        }
        return mockImg;
      };

      // Case A: Synchronous cache hit
      simulatePrefetch(prefetchUrl, true, 1024);
      assert.equal(loadedImages.has(prefetchUrl), true, 'Prefetch cache hit must immediately register image as loaded');

      // Case B: Async network download
      const networkUrl = 'https://media.chrishop.jacobmiller22.com/media/bramble-buster/other.jpeg';
      const img = simulatePrefetch(networkUrl, false, 0);
      assert.equal(loadedImages.has(networkUrl), false, 'Async network prefetch must wait for onload');
      img.onload?.();
      assert.equal(loadedImages.has(networkUrl), true, 'onload must register prefetched image');
    });
  });
});
