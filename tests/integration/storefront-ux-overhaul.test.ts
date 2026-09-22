import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, Badge, Card, Header, Footer } from '../../packages/ui/src/index';

describe('Story 1.16: BankBeaters Storefront UX/UI Design Overhaul Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');

  // ---------------------------------------------------------------------------
  // 1. Design System Tokens & Components (@chrishop/ui)
  // ---------------------------------------------------------------------------
  describe('Design System Tokens & Accessibility Gates (@chrishop/ui)', () => {
    it('should enforce primary button design specs with Signal Orange and min 44px tap target', () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { variant: 'primary', size: 'md' }, 'Deploy Gear')
      );
      assert.ok(html.includes('bg-[#E55B24]'), 'Primary button must use Signal Hazard Orange');
      assert.ok(html.includes('min-h-[44px]'), 'Must enforce minimum 44px touch target height');
      assert.ok(html.includes('uppercase'), 'Must use uppercase typography per design guide');
      assert.ok(html.includes('tracking-wider'), 'Must use wider tracking');
      assert.ok(html.includes('shadow-lg shadow-orange-950/40'), 'Must include ambient drop shadow');
    });

    it('should render Card container adhering to Tier 1 Surface Hierarchy (#15191E)', () => {
      const html = renderToStaticMarkup(
        React.createElement(Card, { className: 'spec-card' }, 'Card Content')
      );
      assert.ok(html.includes('bg-[#15191E]'), 'Card must use Tier 1 surface background #15191E');
      assert.ok(html.includes('border-stone-800/80'), 'Card must use hairline stone border');
      assert.ok(html.includes('rounded-2xl'), 'Card must use rounded-2xl geometry');
    });

    it('should render responsive Header with accessible mobile hamburger menu trigger', () => {
      const html = renderToStaticMarkup(React.createElement(Header, { cartCount: 2 }));
      assert.ok(html.includes('aria-label="Toggle navigation menu"'), 'Must have accessible mobile toggle');
      assert.ok(html.includes('min-w-[44px] min-h-[44px]'), 'Mobile hamburger must satisfy 44x44px touch target');
      assert.ok(html.includes('Gear Roll'), 'Must display Gear Roll cart link');
      assert.ok(html.includes('2'), 'Must display cartCount badge');
    });

    it('should render authentic Footer with Leadville workshop origin and provenance links', () => {
      const html = renderToStaticMarkup(React.createElement(Footer, null));
      assert.ok(html.includes('Leadville, CO'), 'Footer must prominently display Leadville, Colorado origin');
      assert.ok(html.includes('10,152 ft'), 'Must specify Leadville elevation');
      assert.ok(html.includes('Curiosity &gt; Fear') || html.includes('Curiosity > Fear'), 'Must display brand motto');
      assert.ok(html.includes('/about'), 'Must link to The Maker\'s Story');
      assert.ok(html.includes('Toray 3-Layer'), 'Must showcase technical textile credentials');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Static Template Integrity & Design Guide Conformance
  // ---------------------------------------------------------------------------
  describe('Storefront Page Architectures & Template Conformance', () => {
    it('Homepage (/) should incorporate Visual Category Pathways and Maker\'s Story CTA', () => {
      const homePagePath = path.join(rootDir, 'apps/web/src/app/(storefront)/page.tsx');
      assert.ok(fs.existsSync(homePagePath), 'Homepage file must exist');
      const content = fs.readFileSync(homePagePath, 'utf8');

      assert.ok(content.includes('Equipment Categories'), 'Must include Equipment Categories section');
      assert.ok(content.includes('Technical Outerwear'), 'Must include Technical Outerwear category tile');
      assert.ok(content.includes('Packs & Carry Systems') || content.includes('Packs &amp; Carry Systems'), 'Must include Packs category tile');
      assert.ok(content.includes('Field Accessories'), 'Must include Field Accessories category tile');
      assert.ok(content.includes('/about'), 'Must link to /about');
    });

    it('Dedicated About Page (/about) must exist and feature R2 hero and technical textiles', () => {
      const aboutPagePath = path.join(rootDir, 'apps/web/src/app/(storefront)/about/page.tsx');
      assert.ok(fs.existsSync(aboutPagePath), 'About page file must exist');
      const content = fs.readFileSync(aboutPagePath, 'utf8');

      assert.ok(content.includes('/media/hero/bank-beaters-hero.jpg'), 'Must reference R2 hero image');
      assert.ok(content.includes('Built for the Miles Off-Trail.'), 'Must feature hero statement');
      assert.ok(content.includes('Toray 3-Layer Membrane'), 'Must specify Toray');
      assert.ok(content.includes('Mil-Spec Cordura'), 'Must specify Cordura');
      assert.ok(content.includes('X-Pac'), 'Must specify X-Pac');
      assert.ok(content.includes('Martexin'), 'Must specify Martexin');
      assert.ok(content.includes('YKK AquaGuard'), 'Must specify YKK AquaGuard');
      assert.ok(content.includes('The Lifetime Repair Guarantee'), 'Must include guarantee');
      assert.ok(content.includes('The Micro-Batch Promise'), 'Must include micro-batch promise');
    });

    it('Catalog (/products) must enforce 4:5 portrait card ratio and min 44px tap targets', () => {
      const productsPagePath = path.join(rootDir, 'apps/web/src/app/(storefront)/products/page.tsx');
      assert.ok(fs.existsSync(productsPagePath), 'Products catalog page must exist');
      const content = fs.readFileSync(productsPagePath, 'utf8');

      assert.ok(content.includes('aspect-[4/5]'), 'Must enforce 4:5 portrait aspect ratio');
      assert.ok(content.includes('min-h-[44px]'), 'Must enforce min 44px tap target on Inspect Gear button');
      assert.ok(content.includes('Starting at'), 'Must display starting price');
    });

    it('Product Detail Page (ProductDetailClient) must include Quick Spec panel and Mobile Sticky Action Bar', () => {
      const pdpClientPath = path.join(rootDir, 'apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx');
      assert.ok(fs.existsSync(pdpClientPath), 'ProductDetailClient file must exist');
      const content = fs.readFileSync(pdpClientPath, 'utf8');

      assert.ok(content.includes('Quick Spec // Field Gist'), 'Must include Quick Spec summary panel');
      assert.ok(content.includes('Utility:'), 'Must include Utility in quick spec');
      assert.ok(content.includes('Textiles & Hardware') || content.includes('Textiles &amp; Hardware'), 'Must include Textiles in quick spec');
      assert.ok(content.includes('Field Specs:'), 'Must include Field Specs in quick spec');
      assert.ok(content.includes('isStickyVisible'), 'Must support mobile sticky action bar state');
      assert.ok(content.includes('IntersectionObserver'), 'Must observe buy button for sticky bar docking');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Asset Verification (R2 & Hero Images)
  // ---------------------------------------------------------------------------
  describe('Brand Photographic Assets', () => {
    it('should have authentic R2 hero image and logo on disk with valid file size', () => {
      const heroDir = path.join(rootDir, 'apps/web/public/media/hero');
      const heroPath = path.join(heroDir, 'bank-beaters-hero.jpg');
      const logoPath = path.join(heroDir, 'bank-beaters-logo-white.png');

      assert.ok(fs.existsSync(heroPath), 'Hero photo must exist on disk');
      assert.ok(fs.existsSync(logoPath), 'White brand logo must exist on disk');

      const heroStats = fs.statSync(heroPath);
      assert.ok(heroStats.size > 50000, 'Hero photo must be high-res (>50KB)');
    });
  });
});
