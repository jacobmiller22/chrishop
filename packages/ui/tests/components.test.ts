import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  Badge,
  Card,
  Header,
  ArtworkMedia,
  ArtworkCard,
  ProductGallery,
  HeroMedia,
  ARTWORK_MEDIA_SIZES,
  generateTinyBlurSvg,
} from '../src/index';

describe('UI Design System Components (@chrishop/ui)', () => {
  it('should render Button with primary variant styles and children', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: 'primary', size: 'md' }, 'Buy Now')
    );
    assert.ok(html.includes('<button'), 'Should render a button element');
    assert.ok(html.includes('Buy Now'), 'Should contain child text');
    assert.ok(html.includes('bg-amber-600'), 'Should contain primary background class');
  });

  it('should render Button with custom variant and size', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: 'outline', size: 'sm', disabled: true }, 'Disabled')
    );
    assert.ok(html.includes('border-slate-600'), 'Should contain outline border class');
    assert.ok(html.includes('text-sm'), 'Should contain sm size class');
    assert.ok(
      html.includes('disabled=""') || html.includes('disabled'),
      'Should have disabled attribute'
    );
  });

  it('should render Badge with default and custom variants', () => {
    const defaultBadge = renderToStaticMarkup(React.createElement(Badge, null, 'Limited Edition'));
    assert.ok(defaultBadge.includes('Limited Edition'));

    const successBadge = renderToStaticMarkup(
      React.createElement(Badge, { variant: 'success' }, 'In Stock')
    );
    assert.ok(successBadge.includes('In Stock'));
    assert.ok(
      successBadge.includes('bg-emerald') ||
        successBadge.includes('green') ||
        successBadge.includes('emerald')
    );
  });

  it('should render Card container with children and custom className', () => {
    const cardHtml = renderToStaticMarkup(
      React.createElement(
        Card,
        { className: 'custom-card-class' },
        React.createElement('span', null, 'Card Body')
      )
    );
    assert.ok(cardHtml.includes('custom-card-class'));
    assert.ok(cardHtml.includes('Card Body'));
  });

  it('should render Header component with logo and navigation items', () => {
    const headerHtml = renderToStaticMarkup(React.createElement(Header, null));
    assert.ok(
      headerHtml.includes('<header') || headerHtml.includes('<nav'),
      'Should render header/nav container'
    );
  });

  // ---------------------------------------------------------------------------
  // Responsive Media & Artwork Component Test Suite (Story 2.43)
  // ---------------------------------------------------------------------------
  describe('Responsive Artwork Media Components (Story 2.43)', () => {
    it('should generate valid tiny blur SVG data URI', () => {
      const blurSvg = generateTinyBlurSvg();
      assert.ok(blurSvg.startsWith('data:image/svg+xml'), 'Must be a data URI');
      assert.ok(blurSvg.length > 20, 'Should have content');
    });

    it('should export standard ARTWORK_MEDIA_SIZES presets', () => {
      assert.equal(ARTWORK_MEDIA_SIZES.HERO, '100vw');
      assert.equal(
        ARTWORK_MEDIA_SIZES.CATALOG_GRID,
        '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
      );
      assert.equal(ARTWORK_MEDIA_SIZES.PRODUCT_DETAIL, '(max-width: 768px) 100vw, 50vw');
      assert.equal(ARTWORK_MEDIA_SIZES.THUMBNAIL, '(max-width: 640px) 20vw, 80px');
    });

    it('should render ArtworkMedia with explicit sizes, alt text, and blur placeholder backdrop', () => {
      const html = renderToStaticMarkup(
        React.createElement(ArtworkMedia, {
          src: 'https://media.chrishop.jacobmiller22.com/uploads/bronze-sculpture.jpg',
          alt: 'Handcrafted Bronze Sculpture',
          sizes: ARTWORK_MEDIA_SIZES.CATALOG_GRID,
          aspectRatio: 'square',
        })
      );

      assert.ok(html.includes('src="https://media.chrishop.jacobmiller22.com/uploads/bronze-sculpture.jpg"'));
      assert.ok(html.includes('alt="Handcrafted Bronze Sculpture"'));
      assert.ok(html.includes('sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"'));
      assert.ok(html.includes('data-placeholder-loaded="false"'));
      assert.ok(html.includes('aspect-square'));
    });

    it('should render ArtworkMedia fallback icon when src is empty', () => {
      const html = renderToStaticMarkup(
        React.createElement(ArtworkMedia, {
          src: '',
          alt: 'Placeholder',
          aspectRatio: 'square',
        })
      );

      assert.ok(html.includes('🎨'));
      assert.ok(!html.includes('<img'));
    });

    it('should render ArtworkMedia with custom asImage component', () => {
      const MockImage: React.FC<any> = (props) =>
        React.createElement('span', { 'data-mock-image': 'true', 'data-src': props.src, 'data-sizes': props.sizes });

      const html = renderToStaticMarkup(
        React.createElement(ArtworkMedia, {
          src: '/uploads/art.jpg',
          alt: 'Mock Art',
          asImage: MockImage,
          sizes: ARTWORK_MEDIA_SIZES.PRODUCT_DETAIL,
        })
      );

      assert.ok(html.includes('data-mock-image="true"'));
      assert.ok(html.includes('data-src="/uploads/art.jpg"'));
      assert.ok(html.includes('data-sizes="(max-width: 768px) 100vw, 50vw"'));
    });

    it('should render ArtworkCard with explicit catalog sizes, title, price, and blur placeholder', () => {
      const html = renderToStaticMarkup(
        React.createElement(ArtworkCard, {
          title: 'Monolith Study No. 4',
          description: 'Cast bronze study finished with sulfur patina.',
          imageUrl: 'https://media.chrishop.jacobmiller22.com/uploads/monolith-4.jpg',
          categoryName: 'Sculptures',
          price: 1850,
          href: '/products/monolith-study-no-4',
        })
      );

      assert.ok(html.includes('Monolith Study No. 4'));
      assert.ok(html.includes('$1850.00'));
      assert.ok(html.includes('Sculptures'));
      assert.ok(html.includes('sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"'));
      assert.ok(html.includes('href="/products/monolith-study-no-4"'));
    });

    it('should render ProductGallery with main detail image and thumbnail strip with correct sizes', () => {
      const galleryItems = [
        { id: '1', url: 'https://media.chrishop.jacobmiller22.com/uploads/totem-1.webp', label: 'Front View' },
        { id: '2', url: 'https://media.chrishop.jacobmiller22.com/uploads/totem-2.webp', label: 'Detail View' },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ProductGallery, {
          items: galleryItems,
          title: 'Bronze Totem',
        })
      );

      // Main image should have product detail sizes: (max-width: 768px) 100vw, 50vw
      assert.ok(html.includes('sizes="(max-width: 768px) 100vw, 50vw"'));
      // Thumbnail strip should have thumbnail sizes: (max-width: 640px) 20vw, 80px
      assert.ok(html.includes('sizes="(max-width: 640px) 20vw, 80px"'));
      assert.ok(html.includes('role="tablist"'));
      assert.ok(html.includes('aria-label="View Front View"'));
      assert.ok(html.includes('aria-label="View Detail View"'));
    });

    it('should render HeroMedia with full-width sizes (100vw) and priority loading', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          HeroMedia,
          {
            src: 'https://media.chrishop.jacobmiller22.com/uploads/hero-banner.jpg',
            alt: 'Hero Artwork Drop',
            priority: true,
            aspectRatio: 'wide',
          },
          React.createElement('h1', null, 'Exclusive Fine Art Releases')
        )
      );

      assert.ok(html.includes('sizes="100vw"'));
      assert.ok(html.includes('loading="eager"'));
      assert.ok(html.includes('Exclusive Fine Art Releases'));
      assert.ok(html.includes('aspect-[21/9]'));
    });
  });
});

