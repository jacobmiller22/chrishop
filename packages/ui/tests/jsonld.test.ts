import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ProductJsonLd,
  BreadcrumbJsonLd,
  createProductJsonLd,
  createBreadcrumbJsonLd,
  resolveAvailability,
} from '../src/index';

describe('Schema.org JSON-LD Structured Data (@chrishop/ui)', () => {
  it('should resolve availability states correctly', () => {
    // Future drop date -> PreOrder
    const futureDate = new Date(Date.now() + 10000000).toISOString();
    assert.equal(resolveAvailability('active', 5, futureDate), 'https://schema.org/PreOrder');

    // coming_soon -> PreOrder
    assert.equal(resolveAvailability('coming_soon', 10, null), 'https://schema.org/PreOrder');

    // sold_out status -> OutOfStock
    assert.equal(resolveAvailability('sold_out', 10, null), 'https://schema.org/OutOfStock');

    // stock_quantity 0 -> OutOfStock
    assert.equal(resolveAvailability('active', 0, null), 'https://schema.org/OutOfStock');

    // archived -> Discontinued
    assert.equal(resolveAvailability('archived', 0, null), 'https://schema.org/Discontinued');

    // active with stock -> InStock
    assert.equal(resolveAvailability('active', 12, null), 'https://schema.org/InStock');
  });

  it('should generate valid Product JSON-LD schema with single offer', () => {
    const data = createProductJsonLd({
      product: {
        title: 'Leadville Alpine Chest Rig',
        slug: 'leadville-alpine-chest-rig',
        description: 'Alpine-ready chest rig handcrafted in Leadville, CO.',
        sku: 'BB-CR-01',
        base_price: 185,
        status: 'published',
        featured_image: '/media/chest-rig-thumb.jpg',
      },
      baseUrl: 'https://chrishop.jacobmiller22.com',
    });

    assert.equal(data['@context'], 'https://schema.org');
    assert.equal(data['@type'], 'Product');
    assert.equal(data.name, 'Leadville Alpine Chest Rig');
    assert.equal(data.sku, 'BB-CR-01');
    assert.deepEqual(data.brand, { '@type': 'Brand', name: 'BankBeaters' });
    assert.deepEqual(data.image, [
      'https://chrishop.jacobmiller22.com/media/chest-rig-thumb.jpg',
    ]);
    assert.equal(data.offers['@type'], 'Offer');
    assert.equal(data.offers.price, '185.00');
    assert.equal(data.offers.priceCurrency, 'USD');
    assert.equal(data.offers.availability, 'https://schema.org/InStock');
    assert.equal(
      data.offers.url,
      'https://chrishop.jacobmiller22.com/products/leadville-alpine-chest-rig'
    );
  });

  it('should generate valid Product JSON-LD schema with variation offers', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const data = createProductJsonLd({
      product: {
        title: 'Bushwhack Storm Anorak',
        slug: 'bushwhack-storm-anorak',
        description: 'Breathable 3-layer storm shell.',
        base_price: 320,
        variations: [
          {
            id: 'v1',
            sku: 'BB-BSA-SLT-M',
            variation_name: 'Slate Grey / M',
            effective_price: 320,
            status: 'active',
            stock_quantity: 4,
          },
          {
            id: 'v2',
            sku: 'BB-BSA-OCN-L',
            variation_name: 'Alpine Ocean / L',
            effective_price: 350,
            status: 'sold_out',
            stock_quantity: 0,
          },
          {
            id: 'v3',
            sku: 'BB-BSA-DRP-S',
            variation_name: 'Colorado Ochre / S',
            effective_price: 340,
            status: 'active',
            stock_quantity: 10,
            release_date: futureDate,
          },
        ],
      },
      baseUrl: 'https://chrishop.jacobmiller22.com',
    });

    assert.ok(Array.isArray(data.offers));
    assert.equal(data.offers.length, 3);

    // Variation 1: InStock
    assert.equal(data.offers[0].name, 'Bushwhack Storm Anorak - Slate Grey / M');
    assert.equal(data.offers[0].sku, 'BB-BSA-SLT-M');
    assert.equal(data.offers[0].price, '320.00');
    assert.equal(data.offers[0].availability, 'https://schema.org/InStock');

    // Variation 2: OutOfStock
    assert.equal(data.offers[1].name, 'Bushwhack Storm Anorak - Alpine Ocean / L');
    assert.equal(data.offers[1].price, '350.00');
    assert.equal(data.offers[1].availability, 'https://schema.org/OutOfStock');

    // Variation 3: PreOrder (future release_date)
    assert.equal(data.offers[2].name, 'Bushwhack Storm Anorak - Colorado Ochre / S');
    assert.equal(data.offers[2].price, '340.00');
    assert.equal(data.offers[2].availability, 'https://schema.org/PreOrder');
  });

  it('should generate valid BreadcrumbList JSON-LD schema', () => {
    const breadcrumbs = createBreadcrumbJsonLd([
      { name: 'Home', url: 'https://chrishop.jacobmiller22.com' },
      { name: 'Field Gear', url: 'https://chrishop.jacobmiller22.com/products' },
      {
        name: 'Leadville Alpine Chest Rig',
        url: 'https://chrishop.jacobmiller22.com/products/leadville-alpine-chest-rig',
      },
    ]);

    assert.equal(breadcrumbs['@context'], 'https://schema.org');
    assert.equal(breadcrumbs['@type'], 'BreadcrumbList');
    assert.equal(breadcrumbs.itemListElement.length, 3);
    assert.equal(breadcrumbs.itemListElement[0].position, 1);
    assert.equal(breadcrumbs.itemListElement[0].name, 'Home');
    assert.equal(breadcrumbs.itemListElement[2].position, 3);
    assert.equal(breadcrumbs.itemListElement[2].name, 'Leadville Alpine Chest Rig');
  });

  it('should render ProductJsonLd component to valid HTML script tag', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductJsonLd, {
        product: {
          title: 'Leadville Fly Reel',
          slug: 'leadville-fly-reel',
          base_price: 240,
        },
      })
    );

    assert.ok(html.includes('<script type="application/ld+json">'));
    const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    assert.ok(jsonMatch && jsonMatch[1]);
    const parsed = JSON.parse(jsonMatch[1]);
    assert.equal(parsed['@type'], 'Product');
    assert.equal(parsed.name, 'Leadville Fly Reel');
    assert.equal(parsed.offers.price, '240.00');
  });

  it('should render BreadcrumbJsonLd component to valid HTML script tag', () => {
    const html = renderToStaticMarkup(
      React.createElement(BreadcrumbJsonLd, {
        items: [
          { name: 'Home', url: 'https://chrishop.jacobmiller22.com' },
          { name: 'Drops', url: 'https://chrishop.jacobmiller22.com/drops' },
        ],
      })
    );

    assert.ok(html.includes('<script type="application/ld+json">'));
    const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    assert.ok(jsonMatch && jsonMatch[1]);
    const parsed = JSON.parse(jsonMatch[1]);
    assert.equal(parsed['@type'], 'BreadcrumbList');
    assert.equal(parsed.itemListElement.length, 2);
  });
});
