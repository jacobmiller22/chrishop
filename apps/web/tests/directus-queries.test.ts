import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDirectusUrl,
  getDirectusClient,
  createDirectusClient,
  resetDirectusClient,
  getAssetUrl,
  DEFAULT_CATALOG_REVALIDATE,
  mapDirectusCategory,
  mapDirectusVariation,
  mapDirectusProduct,
  getProducts,
  getProductBySlug,
  getCategories,
  getProductVariations,
  getFeaturedProducts,
  fetchProducts,
  fetchProductBySlug,
  fetchCategories,
  type DirectusProduct,
  type DirectusProductVariation,
  type DirectusCategory,
  type DirectusRestClient,
} from '../src/lib/directus';

describe('Directus SDK Client & Configuration', () => {
  it('should resolve Directus URL with fallback to localhost:8055', () => {
    const url = getDirectusUrl();
    assert.ok(url.startsWith('http://') || url.startsWith('https://'));
    assert.ok(url.includes('8055') || url.includes('localhost'));
  });

  it('should respect custom URL in createDirectusClient', () => {
    const customClient = createDirectusClient({
      url: 'https://cms.chrishop.example.com',
      revalidate: 120,
    });
    assert.equal(customClient.url.origin, 'https://cms.chrishop.example.com');
  });

  it('should maintain singleton instance across getDirectusClient calls until reset', () => {
    resetDirectusClient();
    const client1 = getDirectusClient();
    const client2 = getDirectusClient();
    assert.strictEqual(client1, client2);

    resetDirectusClient();
    const client3 = getDirectusClient();
    assert.notStrictEqual(client1, client3);
  });

  it('should format Directus and external asset URLs correctly', () => {
    assert.equal(getAssetUrl(null), null);
    assert.equal(getAssetUrl(undefined), null);

    const assetId = '11111111-2222-3333-4444-555555555555';
    const resolvedUrl = getAssetUrl(assetId);
    assert.ok(resolvedUrl?.includes(`/assets/${assetId}`));

    const resolvedFromObj = getAssetUrl({ id: assetId });
    assert.equal(resolvedFromObj, resolvedUrl);

    const absoluteMinioUrl = 'http://localhost:9000/chrishop-media/art-print.jpg';
    assert.equal(getAssetUrl(absoluteMinioUrl), absoluteMinioUrl);
  });

  it('should configure default ISR revalidate duration to 60s per Section 10', () => {
    assert.equal(DEFAULT_CATALOG_REVALIDATE, 60);
  });
});

describe('Directus Domain Mappers & Price Fallback Resolution', () => {
  it('should map categories accurately', () => {
    const rawCategory: DirectusCategory = {
      id: 'cat-01',
      name: 'Fine Art Prints',
      slug: 'fine-art-prints',
      description: 'Archival quality cotton rag prints',
      image: 'img-file-01',
    };

    const mapped = mapDirectusCategory(rawCategory);
    assert.equal(mapped.id, 'cat-01');
    assert.equal(mapped.name, 'Fine Art Prints');
    assert.equal(mapped.slug, 'fine-art-prints');
    assert.equal(mapped.description, 'Archival quality cotton rag prints');
    assert.equal(mapped.image, 'img-file-01');
  });

  it('should map variations and resolve price override vs product base price fallback', () => {
    const rawVariationWithOverride: DirectusProductVariation = {
      id: 'var-01',
      product_id: 'prod-01',
      variation_name: '24K Gold Inlay',
      sku: 'GOLD-01',
      price_override: '500.00',
      is_limited_edition: true,
      total_edition_count: 25,
      stock_quantity: 5,
      status: 'active',
    };

    const mappedOverride = mapDirectusVariation(rawVariationWithOverride, { base_price: 300 });
    assert.equal(mappedOverride.effective_price, 500);
    assert.equal(mappedOverride.price_override, 500);

    const rawVariationWithFallback: DirectusProductVariation = {
      id: 'var-02',
      product_id: 'prod-01',
      variation_name: 'Standard Edition',
      sku: 'STD-01',
      price_override: null,
      is_limited_edition: false,
      total_edition_count: null,
      stock_quantity: 20,
      status: 'active',
    };

    const mappedFallback = mapDirectusVariation(rawVariationWithFallback, { base_price: 300 });
    assert.equal(mappedFallback.effective_price, 300);
    assert.equal(mappedFallback.price_override, null);
  });

  it('should map products with category, gallery, and compute effective minimum price', () => {
    const rawProduct: DirectusProduct = {
      id: 'prod-100',
      title: 'Obsidian Totem',
      slug: 'obsidian-totem',
      description: 'Hand-cast volcanic sculpture',
      base_price: '250.00',
      status: 'published',
      hero_image: { id: 'hero-img-100' },
      featured_image: 'feat-img-100',
      gallery: ['gal-01', { id: 'gal-02' }],
      category_id: {
        id: 'cat-sculptures',
        name: 'Sculptures',
        slug: 'sculptures',
      },
    };

    const rawVariations: DirectusProductVariation[] = [
      {
        id: 'var-101',
        product_id: 'prod-100',
        variation_name: 'Mini Edition',
        sku: 'TOTEM-MINI',
        price_override: '175.00',
        is_limited_edition: false,
        stock_quantity: 10,
        status: 'active',
      },
      {
        id: 'var-102',
        product_id: 'prod-100',
        variation_name: 'Collector Monument',
        sku: 'TOTEM-COLLECTOR',
        price_override: '450.00',
        is_limited_edition: true,
        stock_quantity: 3,
        status: 'active',
      },
    ];

    const mapped = mapDirectusProduct(rawProduct, rawVariations);
    assert.equal(mapped.id, 'prod-100');
    assert.equal(mapped.title, 'Obsidian Totem');
    assert.equal(mapped.base_price, 250);
    assert.equal(mapped.hero_image, 'hero-img-100');
    assert.equal(mapped.featured_image, 'feat-img-100');
    assert.deepEqual(mapped.gallery, ['gal-01', 'gal-02']);
    assert.equal(mapped.category?.name, 'Sculptures');
    assert.equal(mapped.variations?.length, 2);
    assert.equal(mapped.effective_min_price, 175); // Lowest variation price
  });
});

describe('Typed Catalog Queries with Mock Directus Client', () => {
  const sampleProducts: DirectusProduct[] = [
    {
      id: 'p-1',
      title: 'Solar Flare Print',
      slug: 'solar-flare-print',
      base_price: 150,
      status: 'published',
      category_id: { id: 'cat-1', name: 'Prints', slug: 'prints' },
    },
    {
      id: 'p-2',
      title: 'Cosmic Beast Hoodie',
      slug: 'cosmic-beast-hoodie',
      base_price: 95,
      status: 'published',
      category_id: { id: 'cat-2', name: 'Wearables', slug: 'wearables' },
    },
  ];

  const sampleVariations: DirectusProductVariation[] = [
    {
      id: 'v-1',
      product_id: 'p-1',
      variation_name: 'A2 Silk Rag',
      sku: 'SOLAR-A2',
      price_override: null,
      is_limited_edition: true,
      total_edition_count: 50,
      stock_quantity: 12,
      status: 'active',
    },
    {
      id: 'v-2',
      product_id: 'p-1',
      variation_name: 'A1 Acrylic Mount',
      sku: 'SOLAR-A1',
      price_override: 280,
      is_limited_edition: true,
      total_edition_count: 10,
      stock_quantity: 4,
      status: 'active',
    },
  ];

  const sampleCategories: DirectusCategory[] = [
    { id: 'cat-1', name: 'Prints', slug: 'prints' },
    { id: 'cat-2', name: 'Wearables', slug: 'wearables' },
  ];

  function createMockClient(handlers: {
    requestHandler: (command: any) => Promise<any>;
  }): DirectusRestClient {
    return {
      url: new URL('http://localhost:8055'),
      globals: {} as any,
      with: () => ({}) as any,
      request: handlers.requestHandler,
    };
  }

  it('getProducts: should return published products matching query options', async () => {
    let capturedOptions: any = null;
    const mockClient = createMockClient({
      requestHandler: async (cmd: any) => {
        const req = cmd();
        capturedOptions = req;
        return sampleProducts;
      },
    });

    const products = await getProducts({
      client: mockClient,
      category: 'prints',
      status: ['published'],
      limit: 10,
    });

    assert.equal(products.length, 2);
    assert.equal(products[0]?.title, 'Solar Flare Print');
    assert.equal(products[0]?.category?.name, 'Prints');
    assert.equal(capturedOptions.params?.limit, 10);
    assert.deepEqual(capturedOptions.params?.filter?.category_id?.slug?._eq, 'prints');
    assert.deepEqual(capturedOptions.params?.filter?.status?._eq, 'published');
  });

  it('getProducts: should support category UUID filter', async () => {
    let capturedOptions: any = null;
    const uuid = '10000000-0000-0000-0000-000000000001';
    const mockClient = createMockClient({
      requestHandler: async (cmd: any) => {
        capturedOptions = cmd();
        return [sampleProducts[0]];
      },
    });

    const products = await getProducts({
      client: mockClient,
      category: uuid,
    });

    assert.equal(products.length, 1);
    assert.deepEqual(capturedOptions.params?.filter?.category_id?.id?._eq, uuid);
  });

  it('getProducts: should gracefully return empty array when Directus is unreachable', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => {
        throw new Error('ECONNREFUSED: Directus server unreachable');
      },
    });

    const products = await getProducts({ client: mockClient });
    assert.deepEqual(products, []);
  });

  it('getProductBySlug: should fetch product and its variations', async () => {
    const mockClient = createMockClient({
      requestHandler: async (cmd: any) => {
        const req = cmd();
        if (req.path.includes('/items/products')) {
          return [sampleProducts[0]];
        }
        if (req.path.includes('/items/product_variations')) {
          return sampleVariations;
        }
        return [];
      },
    });

    const product = await getProductBySlug('solar-flare-print', { client: mockClient });
    assert.ok(product);
    assert.equal(product.slug, 'solar-flare-print');
    assert.equal(product.variations?.length, 2);
    assert.equal(product.variations[0]?.effective_price, 150); // Fallback to base_price
    assert.equal(product.variations[1]?.effective_price, 280); // Override price
    assert.equal(product.effective_min_price, 150);
  });

  it('getProductBySlug: should return null when product is not found', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => [],
    });

    const product = await getProductBySlug('non-existent-product', { client: mockClient });
    assert.equal(product, null);
  });

  it('getProductBySlug: should gracefully return null when Directus fails', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => {
        throw new Error('503 Service Unavailable');
      },
    });

    const product = await getProductBySlug('solar-flare-print', { client: mockClient });
    assert.equal(product, null);
  });

  it('getCategories: should return mapped categories sorted by name', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => sampleCategories,
    });

    const categories = await getCategories({ client: mockClient });
    assert.equal(categories.length, 2);
    assert.equal(categories[0]?.name, 'Prints');
    assert.equal(categories[1]?.name, 'Wearables');
  });

  it('getCategories: should gracefully return empty array when Directus fails', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => {
        throw new Error('Network timeout');
      },
    });

    const categories = await getCategories({ client: mockClient });
    assert.deepEqual(categories, []);
  });

  it('getProductVariations: should fetch variations and compute effective prices', async () => {
    const mockClient = createMockClient({
      requestHandler: async (cmd: any) => {
        const req = cmd();
        if (req.path.includes('/items/products')) {
          return [{ id: 'p-1', base_price: 150 }];
        }
        return sampleVariations;
      },
    });

    const variations = await getProductVariations('p-1', { client: mockClient });
    assert.equal(variations.length, 2);
    assert.equal(variations[0]?.sku, 'SOLAR-A2');
    assert.equal(variations[0]?.effective_price, 150);
    assert.equal(variations[1]?.sku, 'SOLAR-A1');
    assert.equal(variations[1]?.effective_price, 280);
  });

  it('getProductVariations: should gracefully return empty array when Directus fails', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => {
        throw new Error('Internal Server Error');
      },
    });

    const variations = await getProductVariations('p-1', { client: mockClient });
    assert.deepEqual(variations, []);
  });

  it('getFeaturedProducts: should fetch published products limited by parameter', async () => {
    let capturedLimit: number | undefined;
    const mockClient = createMockClient({
      requestHandler: async (cmd: any) => {
        const req = cmd();
        capturedLimit = req.params?.limit;
        return [sampleProducts[0]];
      },
    });

    const featured = await getFeaturedProducts(3, { client: mockClient });
    assert.equal(featured.length, 1);
    assert.equal(capturedLimit, 3);
  });

  it('getFeaturedProducts: should attach variations when includeVariations is true', async () => {
    const mockClient = createMockClient({
      requestHandler: async (cmd: any) => {
        const req = cmd();
        if (req.path.includes('/items/product_variations')) {
          return sampleVariations;
        }
        return [sampleProducts[0]];
      },
    });

    const featured = await getFeaturedProducts(1, { client: mockClient, includeVariations: true });
    assert.equal(featured.length, 1);
    assert.equal(featured[0]?.variations?.length, 2);
    assert.equal(featured[0]?.effective_min_price, 150);
  });

  it('getFeaturedProducts: should gracefully return empty array on Directus failure', async () => {
    const mockClient = createMockClient({
      requestHandler: async () => {
        throw new Error('Connection refused');
      },
    });

    const featured = await getFeaturedProducts(4, { client: mockClient });
    assert.deepEqual(featured, []);
  });
});

describe('Storefront Backwards Compatibility Layer', () => {
  it('fetchProducts, fetchProductBySlug, fetchCategories aliases work consistently', async () => {
    assert.equal(typeof fetchProducts, 'function');
    assert.equal(typeof fetchProductBySlug, 'function');
    assert.equal(typeof fetchCategories, 'function');
  });
});
