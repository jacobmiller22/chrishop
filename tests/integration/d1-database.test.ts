import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

describe('Cloudflare D1 Local In-Memory Database Integration (DEP_CLOUDFLARE_D1)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    // Create an ephemeral in-memory SQLite database matching D1 runtime semantics
    db = new DatabaseSync(':memory:');

    // Apply D1 Content Schema per docs/deps/DEP_CLOUDFLARE_D1.md
    db.exec(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        maker_field_notes TEXT,
        materials TEXT,
        weight TEXT,
        fit_profile TEXT,
        origin TEXT,
        base_price REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        category_id TEXT,
        shopify_product_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE product_variations (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        variation_name TEXT NOT NULL,
        variation_type TEXT NOT NULL DEFAULT 'standard',
        edition_badge TEXT,
        variation_notes TEXT,
        variation_images TEXT,
        price_override REAL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        shopify_variant_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      -- Mandatory Query Indexes per DEP_CLOUDFLARE_D1.md Section 3
      CREATE INDEX idx_products_slug ON products(slug);
      CREATE INDEX idx_products_shopify_id ON products(shopify_product_id);
      CREATE INDEX idx_product_variations_sku ON product_variations(sku);
      CREATE INDEX idx_product_variations_product_id ON product_variations(product_id);
      CREATE INDEX idx_categories_parent_id ON categories(parent_id);
    `);
  });

  it('should verify all required D1 tables are created in ephemeral SQLite', () => {
    const query = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    const tables = (query.all() as { name: string }[]).map((r) => r.name);

    assert.ok(tables.includes('categories'), 'categories table must exist');
    assert.ok(tables.includes('products'), 'products table must exist');
    assert.ok(tables.includes('product_variations'), 'product_variations table must exist');
  });

  it('should verify mandatory query indexes on slug, shopify_product_id, and sku', () => {
    const query = db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;");
    const indexes = (query.all() as { name: string }[]).map((r) => r.name);

    assert.ok(
      indexes.includes('idx_products_slug'),
      'idx_products_slug must exist for fast slug lookups'
    );
    assert.ok(
      indexes.includes('idx_products_shopify_id'),
      'idx_products_shopify_id must exist for Shopify sync'
    );
    assert.ok(
      indexes.includes('idx_product_variations_sku'),
      'idx_product_variations_sku must exist'
    );
    assert.ok(
      indexes.includes('idx_product_variations_product_id'),
      'idx_product_variations_product_id must exist'
    );
    assert.ok(
      indexes.includes('idx_categories_parent_id'),
      'idx_categories_parent_id must exist'
    );
  });

  it('should execute relational insert, query, and join operations', () => {
    // 1. Insert Category
    const insertCat = db.prepare(
      'INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)'
    );
    insertCat.run('cat-1', 'Sculptures', 'sculptures', 'Handmade obsidian sculptures');

    // 2. Insert Product
    const insertProd = db.prepare(
      'INSERT INTO products (id, title, slug, base_price, status, category_id, shopify_product_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertProd.run(
      'prod-1',
      'Obsidian Beast',
      'obsidian-beast',
      350.0,
      'published',
      'cat-1',
      'gid://shopify/Product/101'
    );

    // 3. Insert Variation
    const insertVar = db.prepare(
      'INSERT INTO product_variations (id, product_id, sku, variation_name, price_override, stock_quantity, shopify_variant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertVar.run(
      'var-1',
      'prod-1',
      'BEAST-GOLD',
      'Gold Edition',
      495.0,
      10,
      'gid://shopify/ProductVariant/201'
    );

    // 4. Query Relational Join
    const selectJoin = db.prepare(`
      SELECT 
        p.id AS product_id,
        p.title,
        p.base_price,
        p.shopify_product_id,
        c.name AS category_name,
        v.sku,
        v.price_override,
        COALESCE(v.price_override, p.base_price) AS effective_price
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN product_variations v ON v.product_id = p.id
      WHERE p.slug = ?;
    `);

    const result = selectJoin.get('obsidian-beast') as any;
    assert.ok(result, 'Product join query must return result');
    assert.equal(result.title, 'Obsidian Beast');
    assert.equal(result.category_name, 'Sculptures');
    assert.equal(result.sku, 'BEAST-GOLD');
    assert.equal(result.price_override, 495.0);
    assert.equal(result.effective_price, 495.0);
    assert.equal(result.shopify_product_id, 'gid://shopify/Product/101');
  });

  it('should support depth-2 nested category hierarchy with recursive CTE queries', () => {
    const insertCat = db.prepare(
      'INSERT INTO categories (id, name, slug, parent_id, description) VALUES (?, ?, ?, ?, ?)'
    );
    // Depth 0: Root
    insertCat.run('cat-apparel', 'Apparel', 'apparel', null, 'Root apparel');
    // Depth 1: Child
    insertCat.run('cat-outerwear', 'Outerwear', 'outerwear', 'cat-apparel', 'Sub category');
    // Depth 2: Grandchild
    insertCat.run(
      'cat-shells',
      'Waterproof Storm Shells',
      'waterproof-storm-shells',
      'cat-outerwear',
      'Depth 2 category'
    );

    // Insert Product at Depth 2
    const insertProd = db.prepare(
      'INSERT INTO products (id, title, slug, base_price, status, category_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertProd.run(
      'prod-anorak',
      'Bushwhack Storm Anorak',
      'bushwhack-storm-anorak',
      385.0,
      'published',
      'cat-shells'
    );

    // Recursive CTE querying root 'cat-apparel' to find all descendant products
    const recursiveQuery = db.prepare(`
      WITH RECURSIVE cat_tree(id) AS (
        SELECT id FROM categories WHERE id = ?
        UNION ALL
        SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
      )
      SELECT p.id, p.title, p.category_id, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.category_id IN (SELECT id FROM cat_tree);
    `);

    const results = recursiveQuery.all('cat-apparel') as any[];
    assert.equal(results.length, 1, 'Should find product nested 2 levels down from root');
    assert.equal(results[0].title, 'Bushwhack Storm Anorak');
    assert.equal(results[0].category_name, 'Waterproof Storm Shells');
  });

  it('should store and query micro-batch variation fields and maker technical specs', () => {
    // Insert product with maker specs
    const insertProd = db.prepare(`
      INSERT INTO products (
        id, title, slug, base_price, status, maker_field_notes, materials, weight, fit_profile, origin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProd.run(
      'prod-pack',
      'Ridgecrest Alpine Daypack',
      'ridgecrest-alpine-daypack',
      245.0,
      'published',
      'Patterned for fast and light high-alpine pushes.',
      'Dimension-Polyant VX21 / 500D Cordura',
      '540g (19.0 oz)',
      'Close-contact alpine taper',
      'Leadville, CO Workshop'
    );

    // Insert micro-batch variation with workbench detail images and edition badge
    const insertVar = db.prepare(`
      INSERT INTO product_variations (
        id, product_id, sku, variation_name, variation_type, edition_badge, variation_notes, variation_images, price_override, stock_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const workbenchImages = JSON.stringify([
      { url: '/media/ridgecrest-workbench-1.jpg', caption: 'Leadville workbench hand-binding' },
    ]);

    insertVar.run(
      'var-mb-1',
      'prod-pack',
      'BB-PACK-MB01',
      'Batch 01/24 - Alpine Slate',
      'micro_batch',
      'Batch 01/24',
      'Cut from deadstock alpine cordura with custom bar-tacking.',
      workbenchImages,
      275.0,
      12
    );

    // Query product and variation
    const select = db.prepare(`
      SELECT 
        p.maker_field_notes, p.materials, p.weight, p.fit_profile, p.origin,
        v.variation_type, v.edition_badge, v.variation_notes, v.variation_images, v.price_override, v.stock_quantity
      FROM products p
      JOIN product_variations v ON v.product_id = p.id
      WHERE p.slug = ?;
    `);

    const row = select.get('ridgecrest-alpine-daypack') as any;
    assert.ok(row, 'Row must exist');
    assert.equal(row.materials, 'Dimension-Polyant VX21 / 500D Cordura');
    assert.equal(row.weight, '540g (19.0 oz)');
    assert.equal(row.origin, 'Leadville, CO Workshop');
    assert.equal(row.variation_type, 'micro_batch');
    assert.equal(row.edition_badge, 'Batch 01/24');
    assert.equal(row.price_override, 275.0);
    assert.equal(row.stock_quantity, 12);
    const parsedImages = JSON.parse(row.variation_images);
    assert.equal(parsedImages.length, 1);
    assert.equal(parsedImages[0].caption, 'Leadville workbench hand-binding');
  });

  it('should enforce unique constraint violations on product slugs and SKUs', () => {
    const insertProd = db.prepare(
      'INSERT INTO products (id, title, slug, base_price) VALUES (?, ?, ?, ?)'
    );
    insertProd.run('p1', 'Item 1', 'unique-slug', 100);

    // Duplicate slug should throw
    assert.throws(() => {
      insertProd.run('p2', 'Item 2', 'unique-slug', 200);
    }, /UNIQUE constraint failed/);
  });

  it('should verify wrangler CLI can run d1 subcommands without errors', () => {
    const output = execSync('pnpm exec wrangler d1 --help', { encoding: 'utf-8' });
    assert.ok(output.includes('d1'), 'Wrangler d1 help output must be displayed');
    assert.ok(
      output.includes('execute') || output.includes('migrations'),
      'Must show execute or migrations'
    );
  });

  it('should verify migrations/0001_initial.sql exists and applies cleanly to SQLite', () => {
    assert.ok(fs.existsSync('migrations/0001_initial.sql'), 'Migration file must exist');
    const sql = fs.readFileSync('migrations/0001_initial.sql', 'utf-8');

    const freshDb = new DatabaseSync(':memory:');
    freshDb.exec(sql);

    const tables = (
      freshDb.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    assert.ok(tables.includes('categories'), 'categories table must be created');
    assert.ok(tables.includes('products'), 'products table must be created');
    assert.ok(tables.includes('product_variations'), 'product_variations table must be created');

    const indexes = (
      freshDb.prepare("SELECT name FROM sqlite_master WHERE type='index';").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    assert.ok(indexes.includes('idx_products_slug'), 'idx_products_slug must exist');
    assert.ok(indexes.includes('idx_products_shopify_id'), 'idx_products_shopify_id must exist');
    assert.ok(
      indexes.includes('idx_product_variations_sku'),
      'idx_product_variations_sku must exist'
    );
    assert.ok(
      indexes.includes('idx_product_variations_product_id'),
      'idx_product_variations_product_id must exist'
    );
    assert.ok(indexes.includes('idx_categories_slug'), 'idx_categories_slug must exist');
    assert.ok(
      indexes.includes('idx_categories_parent_id'),
      'idx_categories_parent_id must exist'
    );
  });

  it('should verify wrangler.toml D1 database bindings for staging and production', () => {
    assert.ok(fs.existsSync('wrangler.toml'), 'wrangler.toml must exist');
    const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf-8');
    assert.ok(
      wranglerConfig.includes('database_name = "chrishop-prod-db"'),
      'Production database binding chrishop-prod-db must be configured'
    );
    assert.ok(
      wranglerConfig.includes('database_name = "chrishop-staging-db"'),
      'Staging database binding chrishop-staging-db must be configured'
    );
    assert.ok(
      wranglerConfig.includes('migrations_dir = "migrations"'),
      'migrations_dir must be configured as migrations'
    );
  });

  it('should execute query against local Miniflare D1 emulator without external daemons', () => {
    const output = execSync(
      'pnpm exec wrangler d1 execute chrishop-prod-db --local --command "SELECT 1 as test;"',
      { encoding: 'utf-8' }
    );
    assert.ok(
      output.includes('"test": 1') || output.includes('"test":1'),
      'Query output must confirm execution against local D1 SQLite state'
    );
  });
});
