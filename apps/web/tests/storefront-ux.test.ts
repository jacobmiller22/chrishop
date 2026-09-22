import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AboutPage from '../src/app/(storefront)/about/page';
import ProductDetailClient from '../src/app/(storefront)/products/[slug]/ProductDetailClient';
import type { StorefrontProduct } from '../src/lib/catalog';

// Mock product adhering to StorefrontProduct schema
const MOCK_FIXTURE_PRODUCT: StorefrontProduct = {
  id: 'prod-storm-anorak',
  title: 'Bushwhack Technical Storm Anorak',
  slug: 'bushwhack-technical-storm-anorak',
  description: 'Patagonia-grade 3-layer waterproof alpine anorak built for wet wading and bushwhacking remote riverbanks.',
  materials: 'Toray 3-Layer 20k/20k membrane · YKK AquaGuard® zips · 500D Cordura® high-wear elbows',
  weight: '462 grams (16.3 oz)',
  fit_profile: 'Active Alpine Utility',
  origin: 'Leadville, CO (Elevation 10,152 ft)',
  maker_field_notes: 'Tested in torrential Colorado canyon rains. Patterned with deep articulated sleeves for double-haul fly casting.',
  base_price: 385,
  effective_min_price: 385,
  status: 'published',
  category: {
    id: 'cat-outerwear',
    name: 'Technical Outerwear',
    slug: 'outerwear',
    description: 'Alpine waterproof shells',
  },
  featured_image: 'media/anorak/silhouette.jpg',
  hero_image: 'media/anorak/field-action.jpg',
  gallery: ['media/anorak/bench-seam.jpg'],
  variations: [
    {
      id: 'var-anorak-standard',
      product_id: 'prod-storm-anorak',
      variation_name: 'Leadville Granite / Standard Run',
      sku: 'BB-ANO-GRN-STD',
      variation_type: 'standard',
      effective_price: 385,
      is_limited_edition: false,
      status: 'active',
      stock_quantity: 8,
      edition_badge: 'Standard Run · 8 in Stock',
    },
    {
      id: 'var-anorak-deadstock',
      product_id: 'prod-storm-anorak',
      variation_name: 'Deadstock Duck Camo Pocket / Micro-Batch',
      sku: 'BB-ANO-DMC-MB',
      variation_type: 'micro_batch',
      price_override: 425,
      effective_price: 425,
      is_limited_edition: true,
      total_edition_count: 3,
      status: 'active',
      stock_quantity: 2,
      edition_badge: 'Batch of 3 · 2 Remaining',
      variation_notes: 'Front kangaroo pouch cut from 1980s deadstock military duck canvas.',
    },
  ],
};

describe('Story 1.16: Storefront UX Overhaul Suite (apps/web)', () => {
  // ---------------------------------------------------------------------------
  // 1. Dedicated /about Page (The Maker's Story & Workshop Vault)
  // ---------------------------------------------------------------------------
  describe('/about: The Maker\'s Story & Workshop Vault', () => {
    it('should render cinematic R2 hero photograph with Colorado workshop attribution', () => {
      const html = renderToStaticMarkup(React.createElement(AboutPage, null));
      assert.ok(
        html.includes('/media/hero/bank-beaters-hero.jpg'),
        'Must feature authentic brand photography'
      );
      assert.ok(html.includes('Leadville, CO · Elev. 10,152 FT'), 'Must state Leadville elevation');
      assert.ok(html.includes('Built for the Miles Off-Trail.'), 'Must display hero headline');
    });

    it('should detail the 6 core BankBeaters technical textiles and hardware specs', () => {
      const html = renderToStaticMarkup(React.createElement(AboutPage, null));
      assert.ok(html.includes('Toray 3-Layer Membrane'), 'Must specify Toray waterproof membrane');
      assert.ok(html.includes('Mil-Spec Cordura® Nylon'), 'Must specify Cordura nylon');
      assert.ok(html.includes('X-Pac® Sailcloth'), 'Must specify X-Pac sailcloth');
      assert.ok(html.includes('Waxed Army Duck Canvas'), 'Must specify Martexin waxed canvas');
      assert.ok(html.includes('YKK AquaGuard®'), 'Must specify AquaGuard zippers');
      assert.ok(html.includes('Single-Needle'), 'Must specify lockstitching craftsmanship');
    });

    it('should articulate the Micro-Batch Promise and Lifetime Repair Guarantee', () => {
      const html = renderToStaticMarkup(React.createElement(AboutPage, null));
      assert.ok(html.includes('The Micro-Batch Promise'), 'Must feature Micro-Batch section');
      assert.ok(html.includes('The Lifetime Repair Guarantee'), 'Must feature Lifetime Guarantee section');
      assert.ok(html.includes('Explore Equipment Catalog →'), 'Must provide clear CTA to products');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Product Detail Page (PDP): High-Conversion Craft Architecture
  // ---------------------------------------------------------------------------
  describe('PDP High-Conversion Craft Architecture & Scannability', () => {
    it('should render the Quick Spec // Field Gist summary panel above the fold', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProductDetailClient, { product: MOCK_FIXTURE_PRODUCT })
      );
      assert.ok(html.includes('Quick Spec // Field Gist'), 'Must render Quick Spec summary panel header');
      assert.ok(html.includes('Utility:'), 'Must include Utility summary bullet');
      assert.ok(html.includes('Textiles &amp; Hardware:') || html.includes('Textiles & Hardware:'), 'Must include Textiles bullet');
      assert.ok(html.includes('Field Specs:'), 'Must include Field Specs bullet');
      assert.ok(html.includes('Toray 3-Layer'), 'Must display materials in gist panel');
    });

    it('should render dynamic variation options with micro-batch pills and pricing overrides', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProductDetailClient, { product: MOCK_FIXTURE_PRODUCT })
      );
      assert.ok(html.includes('Leadville Granite / Standard Run'), 'Must list standard variation');
      assert.ok(html.includes('Deadstock Duck Camo Pocket'), 'Must list micro-batch variation');
      assert.ok(html.includes('$385.00'), 'Must render standard base price');
      assert.ok(html.includes('Batch of 3 · 2 Remaining'), 'Must render limited edition badge');
    });

    it('should render Maker\'s Field Notes with quote styling and signature attribution', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProductDetailClient, { product: MOCK_FIXTURE_PRODUCT })
      );
      assert.ok(
        html.includes('Maker&#x27;s Field Notes') ||
          html.includes('Maker&apos;s Field Notes') ||
          html.includes("Maker's Field Notes"),
        'Must include field notes banner'
      );
      assert.ok(html.includes('Chris, Lead Builder'), 'Must credit Chris');
    });

  });
});
