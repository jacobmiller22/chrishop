import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  extractLexicalText,
} from '../src/lib/catalog';
import { getEffectivePrice, type Product, type ProductVariation } from '@chrishop/types';

describe('Catalog Data Access Layer & Price Resolution', () => {
  // Setup in-memory test database using canonical migrations
  const testDb = new DatabaseSync(':memory:');
  const migrationPath = fileURLToPath(
    new URL('../../../migrations/0001_initial.sql', import.meta.url)
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  testDb.exec(migrationSql);

  testDb.exec(`

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

  describe('Lexical RichText Serializer (extractLexicalText)', () => {
    it('should return plain text unchanged', () => {
      assert.equal(extractLexicalText('Simple string description'), 'Simple string description');
    });

    it('should extract plain text from Lexical AST JSON string', () => {
      const lexicalJson = JSON.stringify({
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Patagonia-grade 3-layer waterproof storm shell.' },
              ],
            },
          ],
        },
      });
      assert.equal(
        extractLexicalText(lexicalJson),
        'Patagonia-grade 3-layer waterproof storm shell.'
      );
    });

    it('should extract text from Lexical AST object directly', () => {
      const ast = {
        root: {
          children: [
            {
              children: [
                { text: 'First paragraph.' },
                { text: 'Second sentence.' },
              ],
            },
          ],
        },
      };
      assert.equal(extractLexicalText(ast), 'First paragraph. Second sentence.');
    });
  });

  describe('Payload CMS v3 D1 Relational Schema Queries', () => {
    const payloadDb = new DatabaseSync(':memory:');
    payloadDb.exec('PRAGMA foreign_keys = ON;');

    payloadDb.exec(`
      CREATE TABLE media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alt TEXT,
        filename TEXT NOT NULL,
        mime_type TEXT DEFAULT 'image/jpeg',
        url TEXT
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id TEXT,
        description TEXT,
        image_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE SET NULL
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        shopify_product_id TEXT,
        base_price REAL NOT NULL,
        status TEXT DEFAULT 'draft',
        category_id_id TEXT,
        featured_image_id INTEGER,
        maker_field_notes TEXT,
        artist_statement TEXT,
        materials TEXT,
        weight TEXT,
        fit_profile TEXT,
        origin TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (category_id_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (featured_image_id) REFERENCES media(id) ON DELETE SET NULL
      );

      CREATE TABLE products_gallery (
        _order INTEGER NOT NULL,
        _parent_id TEXT NOT NULL,
        id TEXT PRIMARY KEY,
        image_id INTEGER NOT NULL,
        FOREIGN KEY (_parent_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE CASCADE
      );

      CREATE TABLE product_variations (
        id TEXT PRIMARY KEY,
        product_id_id TEXT NOT NULL,
        shopify_variant_id TEXT,
        variation_name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        variation_type TEXT DEFAULT 'standard',
        edition_badge TEXT,
        variation_notes TEXT,
        price_override REAL,
        is_limited_edition INTEGER DEFAULT 1,
        total_edition_count INTEGER,
        release_date TEXT,
        status TEXT DEFAULT 'coming_soon',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE product_variations_variation_images (
        _order INTEGER NOT NULL,
        _parent_id TEXT NOT NULL,
        id TEXT PRIMARY KEY,
        image_id INTEGER NOT NULL,
        caption TEXT,
        FOREIGN KEY (_parent_id) REFERENCES product_variations(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE CASCADE
      );

      INSERT INTO media (id, alt, filename, url) VALUES
        (1, 'Anorak Hero', 'bushwhack-storm-anorak-hero.jpeg', '/api/media/file/bushwhack-storm-anorak-hero.jpeg'),
        (2, 'Anorak Action', 'bushwhack-storm-anorak-field-action.jpeg', '/api/media/file/bushwhack-storm-anorak-field-action.jpeg'),
        (3, 'Camo Pocket Detail', 'bushwhack-storm-anorak-camo-variation.jpeg', '/api/media/file/bushwhack-storm-anorak-camo-variation.jpeg');

      INSERT INTO categories (id, name, slug, description, image_id) VALUES
        ('cat-apparel', 'Apparel', 'apparel', 'Outerwear and garments', NULL),
        ('cat-storm-shells', 'Waterproof Storm Shells', 'waterproof-storm-shells', 'Technical shells', 1);

      INSERT INTO products (
        id, title, slug, base_price, status, category_id_id, featured_image_id,
        materials, weight, origin, description
      ) VALUES (
        'prod-bushwhack-anorak',
        'The Bushwhack Storm Anorak',
        'bushwhack-storm-anorak',
        340.0,
        'active',
        'cat-storm-shells',
        1,
        '3-Layer Toray Ripstop',
        '21.4 oz',
        'Hand-cut in workshop',
        '{"root":{"type":"root","children":[{"children":[{"text":"Patagonia-grade 3-layer waterproof storm shell."}]}]}}'
      );

      INSERT INTO products_gallery (_order, _parent_id, id, image_id) VALUES
        (1, 'prod-bushwhack-anorak', 'pg-1', 2);

      INSERT INTO product_variations (
        id, product_id_id, sku, variation_name, price_override, is_limited_edition, status
      ) VALUES
        ('var-anorak-olive', 'prod-bushwhack-anorak', 'BWK-OLV', 'Field Olive', NULL, 1, 'active'),
        ('var-anorak-camo', 'prod-bushwhack-anorak', 'BWK-CAMO', 'Deadstock Duck Camo', 385.0, 1, 'active');

      INSERT INTO product_variations_variation_images (_order, _parent_id, id, image_id, caption) VALUES
        (1, 'var-anorak-camo', 'vi-1', 3, 'Bench shot: Camo pocket');
    `);

    it('getCategories: should resolve relational media URL for category image', async () => {
      const cats = await getCategories({ db: payloadDb });
      assert.equal(cats.length, 2);
      const shells = cats.find((c) => c.id === 'cat-storm-shells');
      assert.ok(shells);
      assert.equal(shells.image, '/api/media/file/bushwhack-storm-anorak-hero.jpeg');
    });

    it('getProducts: should return active products with category_id_id and featured_image_id resolved', async () => {
      const prods = await getProducts({ db: payloadDb });
      assert.equal(prods.length, 1);
      const anorak = prods[0];
      assert.ok(anorak);
      assert.equal(anorak.id, 'prod-bushwhack-anorak');
      assert.equal(anorak.title, 'The Bushwhack Storm Anorak');
      assert.equal(anorak.status, 'active');
      assert.equal(anorak.category?.id, 'cat-storm-shells');
      assert.equal(anorak.featured_image, '/api/media/file/bushwhack-storm-anorak-hero.jpeg');
      assert.equal(anorak.description, 'Patagonia-grade 3-layer waterproof storm shell.');
      assert.equal(anorak.variations?.length, 2);
      assert.equal(anorak.effective_min_price, 340.0);
    });

    it('getProductBySlug: should retrieve product with relational gallery and variations', async () => {
      const anorak = await getProductBySlug('bushwhack-storm-anorak', { db: payloadDb });
      assert.ok(anorak);
      assert.equal(anorak.id, 'prod-bushwhack-anorak');
      assert.equal(anorak.gallery?.length, 1);
      assert.equal(anorak.gallery?.[0], '/api/media/file/bushwhack-storm-anorak-field-action.jpeg');
      assert.equal(anorak.materials, '3-Layer Toray Ripstop');
      assert.equal(anorak.weight, '21.4 oz');

      const camoVar = anorak.variations?.find((v) => v.id === 'var-anorak-camo');
      assert.ok(camoVar);
      assert.equal(camoVar.effective_price, 385.0);
      assert.equal(camoVar.variation_images?.length, 1);
      assert.equal(camoVar.variation_images?.[0]?.url, '/api/media/file/bushwhack-storm-anorak-camo-variation.jpeg');
      assert.equal(camoVar.variation_images?.[0]?.caption, 'Bench shot: Camo pocket');
    });
  });
});
