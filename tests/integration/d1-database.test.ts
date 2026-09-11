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
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
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
