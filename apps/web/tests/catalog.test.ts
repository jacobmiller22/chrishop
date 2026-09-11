import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  getCategories,
  getProducts,
  getProductBySlug,
  getProductVariations,
  getFeaturedProducts,
  getAssetUrl,
  fetchProducts,
  fetchProductBySlug,
  fetchCategories,
} from '../src/lib/catalog';
import { getEffectivePrice, type Product, type ProductVariation } from '@chrishop/types';

describe('Catalog Data Access Layer & Price Resolution', () => {
  // Setup in-memory test database
  const testDb = new DatabaseSync(':memory:');
  testDb.exec('PRAGMA foreign_keys = ON;');

  testDb.exec(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      artist_statement TEXT,
      base_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      category_id TEXT,
      shopify_product_id TEXT UNIQUE,
      featured_image TEXT,
      gallery TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE product_variations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      shopify_variant_id TEXT UNIQUE,
      variation_name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      price_override REAL,
      is_limited_edition INTEGER NOT NULL DEFAULT 1,
      total_edition_count INTEGER,
      release_date TEXT,
      status TEXT NOT NULL DEFAULT 'coming_soon',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    INSERT INTO categories (id, name, slug, description) VALUES
      ('c-1', 'Sculptures', 'sculptures', 'Physical artifacts'),
      ('c-2', 'Prints', 'prints', 'Fine art prints');

    INSERT INTO products (id, title, slug, base_price, status, category_id, shopify_product_id, featured_image, gallery) VALUES
      ('p-1', 'Obsidian Beast', 'obsidian-beast', 350.0, 'published', 'c-1', 'gid://shopify/Product/1', 'beast.webp', '["beast-1.webp"]'),
      ('p-2', 'Solar Corona', 'solar-corona', 120.0, 'published', 'c-2', 'gid://shopify/Product/2', 'corona.webp', '[]'),
      ('p-3', 'Draft Model', 'draft-model', 99.0, 'draft', 'c-1', 'gid://shopify/Product/3', NULL, '[]');

    INSERT INTO product_variations (id, product_id, sku, variation_name, price_override, is_limited_edition, status) VALUES
      ('v-1', 'p-1', 'BEAST-STD', 'Standard Edition', NULL, 1, 'active'),
      ('v-2', 'p-1', 'BEAST-GLD', 'Gold Edition', 495.0, 1, 'active'),
      ('v-3', 'p-2', 'CORONA-A2', 'A2 Print', NULL, 0, 'active');
  `);

  describe('Cloudflare R2 Media Asset URL Resolver', () => {
    it('should format relative keys to canonical R2 media URLs', () => {
      const url = getAssetUrl('products/sculpture-01.webp');
      assert.ok(url?.includes('products/sculpture-01.webp'));
      assert.ok(url?.startsWith('http://') || url?.startsWith('https://'));
    });

    it('should pass through absolute URLs unchanged', () => {
      const abs = 'https://pub-r2.example.com/asset.jpg';
      assert.equal(getAssetUrl(abs), abs);
    });

    it('should return null for empty or nullish inputs', () => {
      assert.equal(getAssetUrl(null), null);
      assert.equal(getAssetUrl(undefined), null);
      assert.equal(getAssetUrl(''), null);
    });
  });

  describe('Price Fallback Resolution Formula', () => {
    it('should fall back to product base_price when price_override is null', () => {
      const prod: Pick<Product, 'base_price'> = { base_price: 350.0 };
      const variation: Pick<ProductVariation, 'price_override'> = { price_override: null };
      assert.equal(getEffectivePrice(prod, variation), 350.0);
    });

    it('should use price_override when explicitly provided', () => {
      const prod: Pick<Product, 'base_price'> = { base_price: 350.0 };
      const variation: Pick<ProductVariation, 'price_override'> = { price_override: 495.0 };
      assert.equal(getEffectivePrice(prod, variation), 495.0);
    });
  });

  describe('Catalog Queries', () => {
    it('getCategories: should return all categories sorted by name', async () => {
      const cats = await getCategories({ db: testDb });
      assert.equal(cats.length, 2);
      assert.equal(cats[0]?.slug, 'prints');
      assert.equal(cats[1]?.slug, 'sculptures');
    });

    it('getProducts: should return published products and attach variations and categories', async () => {
      const prods = await getProducts({ db: testDb });
      assert.equal(prods.length, 2);

      const beast = prods.find((p) => p.slug === 'obsidian-beast');
      assert.ok(beast);
      assert.equal(beast.title, 'Obsidian Beast');
      assert.equal(beast.category?.name, 'Sculptures');
      assert.equal(beast.variations?.length, 2);
      assert.equal(beast.effective_min_price, 350.0);
    });

    it('getProducts: should filter by category slug', async () => {
      const prods = await getProducts({ db: testDb, category: 'prints' });
      assert.equal(prods.length, 1);
      assert.equal(prods[0]?.slug, 'solar-corona');
    });

    it('getProductBySlug: should return complete product with effective minimum price', async () => {
      const product = await getProductBySlug('obsidian-beast', { db: testDb });
      assert.ok(product);
      assert.equal(product.slug, 'obsidian-beast');
      assert.equal(product.variations?.length, 2);
      const std = product.variations?.find((v) => v.sku === 'BEAST-STD');
      const gld = product.variations?.find((v) => v.sku === 'BEAST-GLD');
      assert.equal(std?.effective_price, 350.0);
      assert.equal(gld?.effective_price, 495.0);
      assert.equal(product.effective_min_price, 350.0);
    });

    it('getProductBySlug: should return null when slug not found', async () => {
      const product = await getProductBySlug('nonexistent', { db: testDb });
      assert.equal(product, null);
    });

    it('getProductVariations: should return variations for a specific product', async () => {
      const variations = await getProductVariations('p-1', { db: testDb });
      assert.equal(variations.length, 2);
      assert.ok(variations.some((v) => v.sku === 'BEAST-STD'));
      assert.ok(variations.some((v) => v.sku === 'BEAST-GLD'));
    });

    it('getFeaturedProducts: should limit returned products', async () => {
      const prods = await getFeaturedProducts(1, { db: testDb });
      assert.equal(prods.length, 1);
    });

    it('compatibility aliases fetchProducts, fetchProductBySlug, fetchCategories work consistently', async () => {
      assert.equal(typeof fetchProducts, 'function');
      assert.equal(typeof fetchProductBySlug, 'function');
      assert.equal(typeof fetchCategories, 'function');

      const cats = await fetchCategories({ db: testDb });
      assert.equal(cats.length, 2);
    });
  });
});
