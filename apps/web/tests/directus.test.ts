import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDirectusUrl,
  getAssetUrl,
  mapDirectusProduct,
  getDirectusClient,
  type DirectusProduct,
  type DirectusProductVariation,
} from '../src/lib/directus';

describe('Storefront Directus CMS Integration & Mappings', () => {
  it('should resolve the configured Directus URL with fallback to localhost:8055', () => {
    const url = getDirectusUrl();
    assert.ok(url.startsWith('http://') || url.startsWith('https://'));
    assert.ok(url.includes('8055') || url.includes('localhost'));
  });

  it('should format Directus / MinIO asset URLs correctly', () => {
    // Nullish or empty
    assert.equal(getAssetUrl(null), null);
    assert.equal(getAssetUrl(undefined), null);

    // Directus file ID string
    const assetId = '11111111-2222-3333-4444-555555555555';
    const resolvedUrl = getAssetUrl(assetId);
    assert.ok(resolvedUrl?.includes(`/assets/${assetId}`));

    // Directus file object with id
    const resolvedFromObj = getAssetUrl({ id: assetId });
    assert.equal(resolvedFromObj, resolvedUrl);

    // Pre-existing absolute MinIO URL
    const absoluteMinioUrl = 'http://localhost:9000/chrishop-media/art-print.jpg';
    assert.equal(getAssetUrl(absoluteMinioUrl), absoluteMinioUrl);
  });

  it('should map Directus product and variations with price fallback resolution', () => {
    const rawProduct: DirectusProduct = {
      id: 'prod-001',
      title: 'Midnight Obsidian Beast',
      slug: 'midnight-obsidian-beast',
      description: 'Handcrafted resin sculpture',
      base_price: '350.00',
      status: 'published',
      category_id: {
        id: 'cat-001',
        name: 'Sculptures',
        slug: 'sculptures',
        description: 'Physical art pieces',
        image: null,
      },
      featured_image: 'file-feat-001',
      hero_image: 'file-hero-001',
    };

    const rawVariations: DirectusProductVariation[] = [
      {
        id: 'var-001',
        product_id: 'prod-001',
        sku: 'BEAST-OBS-STD',
        name: 'Standard Obsidian Edition',
        variation_name: 'Standard Obsidian Edition',
        price_override: null, // Fallback to base_price (350)
        stock_quantity: 15,
        is_limited_edition: true,
        total_edition_count: 50,
        status: 'active',
      },
      {
        id: 'var-002',
        product_id: 'prod-001',
        sku: 'BEAST-GLD-LTD',
        name: '24K Gold Leaf Inlay Edition',
        variation_name: '24K Gold Leaf Inlay Edition',
        price_override: '495.00', // Override price
        stock_quantity: 5,
        is_limited_edition: true,
        total_edition_count: 10,
        status: 'active',
      },
    ];

    const mapped = mapDirectusProduct(rawProduct, rawVariations);

    // Check product mapping
    assert.equal(mapped.id, 'prod-001');
    assert.equal(mapped.title, 'Midnight Obsidian Beast');
    assert.equal(mapped.base_price, 350);
    assert.equal(mapped.category?.name, 'Sculptures');
    assert.equal(mapped.category?.slug, 'sculptures');
    assert.equal(mapped.featured_image, 'file-feat-001');

    // Check variations and price fallback
    assert.equal(mapped.variations?.length, 2);

    const stdVariation = mapped.variations?.[0];
    assert.equal(stdVariation?.sku, 'BEAST-OBS-STD');
    assert.equal(stdVariation?.price_override, null);
    assert.equal(stdVariation?.effective_price, 350.0); // Fallback applied

    const ldtVariation = mapped.variations?.[1];
    assert.equal(ldtVariation?.sku, 'BEAST-GLD-LTD');
    assert.equal(ldtVariation?.price_override, 495.0);
    assert.equal(ldtVariation?.effective_price, 495.0); // Override applied

    // Check effective minimum price
    assert.equal(mapped.effective_min_price, 350.0);
  });

  it('should instantiate typed Directus client using REST transport', () => {
    const client = getDirectusClient();
    assert.ok(client, 'Client should be instantiated');
    assert.ok(typeof client.request === 'function', 'Client should have request method');
  });
});
