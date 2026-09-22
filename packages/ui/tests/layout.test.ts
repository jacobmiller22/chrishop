import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SiteHeader,
  Header,
  SiteFooter,
  Footer,
  MobileNav,
} from '../src/index';

describe('Story 3.1g: Storefront Layout, Navigation & Responsive Shell (@chrishop/ui)', () => {
  describe('1. SiteHeader Component', () => {
    it('should render brand title and link to root', () => {
      const html = renderToStaticMarkup(
        React.createElement(SiteHeader, { title: 'BankBeaters' })
      );
      assert.ok(html.includes('BankBeaters'));
      assert.ok(html.includes('href="/"'));
      assert.ok(html.includes('aria-label="BankBeaters Adventure Gear Home"'));
    });

    it('should render desktop navigation items with accessible tap targets', () => {
      const html = renderToStaticMarkup(
        React.createElement(SiteHeader, {
          navItems: [
            { label: 'Active Drops', href: '/' },
            { label: 'Drop Schedule', href: '/drops' },
            { label: 'Field Gear', href: '/products' },
          ],
        })
      );
      assert.ok(html.includes('Active Drops'));
      assert.ok(html.includes('Drop Schedule'));
      assert.ok(html.includes('Field Gear'));
      assert.ok(html.includes('min-h-[44px]'));
    });

    it('should render cart indicator with item count badge', () => {
      const html = renderToStaticMarkup(
        React.createElement(SiteHeader, { cartCount: 3 })
      );
      assert.ok(html.includes('Gear Roll'));
      assert.ok(html.includes('3'));
      assert.ok(html.includes('href="/cart"'));
    });

    it('should render mobile menu toggle button with accessibility attributes', () => {
      const html = renderToStaticMarkup(React.createElement(SiteHeader, null));
      assert.ok(html.includes('aria-label="Toggle navigation menu"'));
      assert.ok(html.includes('aria-controls="mobile-storefront-menu"'));
      assert.ok(html.includes('aria-expanded="false"'));
      assert.ok(html.includes('min-w-[44px]'));
      assert.ok(html.includes('min-h-[44px]'));
    });

    it('should maintain backward compatibility with Header alias', () => {
      assert.equal(Header, SiteHeader);
    });
  });

  describe('2. MobileNav Slide-over Drawer Component', () => {
    it('should not render when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileNav, {
          isOpen: false,
          onClose: () => {},
        })
      );
      assert.equal(html, '');
    });

    it('should render accessible dialog and close button when isOpen is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileNav, {
          isOpen: true,
          onClose: () => {},
          cartCount: 2,
          navItems: [
            { label: 'Active Drops', href: '/' },
            { label: 'Drop Schedule', href: '/drops' },
            { label: 'Field Gear', href: '/products' },
          ],
        })
      );

      assert.ok(html.includes('role="dialog"'));
      assert.ok(html.includes('aria-modal="true"'));
      assert.ok(html.includes('aria-label="Mobile Navigation Menu"'));
      assert.ok(html.includes('aria-label="Close navigation menu"'));
      assert.ok(html.includes('min-w-[44px]'));
      assert.ok(html.includes('min-h-[44px]'));
      assert.ok(html.includes('Active Drops'));
      assert.ok(html.includes('Drop Schedule'));
      assert.ok(html.includes('Field Gear'));
      assert.ok(html.includes('Gear Roll'));
      assert.ok(html.includes('2'));
      assert.ok(html.includes('Leadville, CO · 10,152 FT'));
      assert.ok(html.includes('Curiosity &gt; Fear'));
    });
  });

  describe('3. SiteFooter Component', () => {
    it('should render brand provenance and Leadville workshop details', () => {
      const html = renderToStaticMarkup(React.createElement(SiteFooter, null));
      assert.ok(html.includes('BankBeaters'));
      assert.ok(html.includes('Leadville, Colorado'));
      assert.ok(html.includes('10,152 ft'));
      assert.ok(html.includes('Curiosity &gt; Fear'));
    });

    it('should render social and community channels with secure target and rel attributes', () => {
      const html = renderToStaticMarkup(React.createElement(SiteFooter, null));
      assert.ok(html.includes('href="https://instagram.com/bankbeaters"'));
      assert.ok(html.includes('href="https://youtube.com/@bankbeaters"'));
      assert.ok(html.includes('target="_blank"'));
      assert.ok(html.includes('rel="noopener noreferrer"'));
      assert.ok(html.includes('min-h-[44px]'));
    });

    it('should render technical textiles and copyright info', () => {
      const html = renderToStaticMarkup(React.createElement(SiteFooter, null));
      assert.ok(html.includes('Toray 3-Layer'));
      assert.ok(html.includes('500D Cordura'));
      assert.ok(html.includes('X-Pac'));
      assert.ok(html.includes(new Date().getFullYear().toString()));
    });

    it('should maintain backward compatibility with Footer alias', () => {
      assert.equal(Footer, SiteFooter);
    });
  });
});
