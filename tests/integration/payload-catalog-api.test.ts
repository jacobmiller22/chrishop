import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Ensure CJS/ESM interop for @next/env under tsx/esbuild
try {
  const nextEnv = require('../../apps/web/node_modules/@next/env');
  if (nextEnv && !nextEnv.default) {
    nextEnv.default = nextEnv;
  }
} catch {}

describe('Story 3.1 & Story 3.17: Payload CMS Catalog API & Candidate 1 (Hybrid Product-First)', () => {
  const rootDir = process.cwd();

  const getPayloadInstance = async (db: DatabaseSync) => {
    const mod = await import('../../apps/web/payload.config');
    const config = mod.default;

    // Attach mock D1 driver backed by in-memory SQLite
    const mockD1 = {
      prepare(sql: string) {
        return {
          bind(...params: any[]) {
            return {
              all: async () => ({ results: db.prepare(sql).all(...params), success: true }),
              first: async () => db.prepare(sql).get(...params) || null,
              run: async () => {
                const res = db.prepare(sql).run(...params);
                return { success: true, meta: { changes: (res as any).changes } };
              },
              raw: async () => db.prepare(sql).all(...params).map((r: any) => Object.values(r)),
            };
          },
          all: async () => ({ results: db.prepare(sql).all(), success: true }),
          first: async () => db.prepare(sql).get() || null,
          run: async () => {
            const res = db.prepare(sql).run();
            return { success: true, meta: { changes: (res as any).changes } };
          },
          raw: async () => db.prepare(sql).all().map((r: any) => Object.values(r)),
        };
      },
      batch: async (stmts: any[]) => stmts.map(() => ({ results: [], success: true })),
      exec: async (sql: string) => {
        db.exec(sql);
        return { count: 0, duration: 0 };
      },
    };

    (globalThis as any).DB = mockD1;

    const { getPayload } = require('../../apps/web/node_modules/payload');
    return getPayload({ config });
  };

  const setupTestDatabase = (): DatabaseSync => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = OFF;');

    const migrationDir = path.join(rootDir, 'migrations');
    if (fs.existsSync(migrationDir)) {
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const m of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationDir, m), 'utf-8');
        db.exec(sql);
      }
    }

    const seedSql = fs.readFileSync(path.join(rootDir, 'scripts/seed.sql'), 'utf-8');
    db.exec(seedSql);

    return db;
  };

  it('should verify payload_locked_documents_rels has "order", "parent_id", and "product_lines_id" columns', () => {
    const db = setupTestDatabase();
    const columns = db.prepare('PRAGMA table_info(payload_locked_documents_rels);').all() as any[];
    const colNames = columns.map((c) => c.name);

    assert.ok(colNames.includes('order'), 'payload_locked_documents_rels must have "order" column');
    assert.ok(colNames.includes('parent_id'), 'payload_locked_documents_rels must have "parent_id" column');
    assert.ok(colNames.includes('categories_id'), 'must have categories_id column');
    assert.ok(colNames.includes('products_id'), 'must have products_id column');
    assert.ok(colNames.includes('product_variations_id'), 'must have product_variations_id column');
    assert.ok(colNames.includes('product_lines_id'), 'must have product_lines_id column');
  });

  it('should query products collection with product_line_id relationship, options array, and category select', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'products',
      limit: 10,
      depth: 1,
    });

    assert.ok(result.docs.length >= 6, 'Must find at least 6 seeded products');

    // Test product linked to product_line
    const anorak = result.docs.find((p: any) => p.id === 'prod-bushwhack-anorak');
    assert.ok(anorak, 'Must find prod-bushwhack-anorak');
    assert.equal(anorak.title, 'The Bushwhack Storm Anorak');
    assert.equal(anorak.status, 'active');
    assert.equal(anorak.category, 'apparel', 'Product category select should be apparel');
    assert.ok(anorak.product_line_id, 'prod-bushwhack-anorak must have product_line_id populated');
    assert.equal(typeof anorak.product_line_id, 'object');
    assert.equal(anorak.product_line_id.id, 'line-bushwhack-series');
    assert.equal(anorak.product_line_id.title, 'Bushwhack Series');
    assert.ok(Array.isArray(anorak.options), 'Product options must be an array');
    assert.ok(anorak.options.length >= 2, 'prod-bushwhack-anorak should have 2 options');
    const colorOpt = anorak.options.find((o: any) => o.name === 'Colorway' && o.value === 'Field Olive');
    assert.ok(colorOpt, 'Should have Colorway Field Olive option');
    assert.equal(colorOpt.sku_suffix, 'OLV');
    assert.equal(typeof anorak.description, 'object', 'Description must be Lexical editor JSON object');

    // Test product in packs category linked to chest rig line
    const chestRig = result.docs.find((p: any) => p.id === 'prod-minimalist-chest-rig');
    assert.ok(chestRig, 'Must find prod-minimalist-chest-rig');
    assert.equal(chestRig.category, 'packs', 'Product category select should be packs');
    assert.ok(chestRig.product_line_id, 'prod-minimalist-chest-rig must have product_line_id populated');
    assert.equal(chestRig.product_line_id.id, 'line-alpine-chest-rig');
    assert.equal(chestRig.product_line_id.title, 'Alpine Chest Rig System');
    assert.ok(chestRig.options.length >= 2, 'Chest rig should have 2 options');

    // Test standalone product with null product_line_id
    const toolRoll = result.docs.find((p: any) => p.id === 'prod-waxed-tool-roll');
    assert.ok(toolRoll, 'Must find prod-waxed-tool-roll');
    assert.equal(toolRoll.category, 'accessories', 'Product category select should be accessories');
    assert.equal(toolRoll.product_line_id, null, 'Standalone product should have null product_line_id');
    assert.ok(Array.isArray(toolRoll.options), 'Options must be an array');
    assert.equal(toolRoll.options.length, 1);
    assert.equal(toolRoll.options[0].name, 'Edition');
  });

  it('should query product_lines collection through Payload local API', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'product_lines',
      limit: 10,
    });

    assert.ok(result.docs.length >= 2, 'Must find at least 2 seeded product lines');
    const alpineLine = result.docs.find((l: any) => l.id === 'line-alpine-chest-rig');
    assert.ok(alpineLine, 'Must find line-alpine-chest-rig');
    assert.equal(alpineLine.title, 'Alpine Chest Rig System');
    assert.equal(alpineLine.slug, 'alpine-chest-rig-system');
    assert.equal(alpineLine.default_price, 165);
    assert.ok(alpineLine.story, 'Product line story must exist');

    const bushwhackLine = result.docs.find((l: any) => l.id === 'line-bushwhack-series');
    assert.ok(bushwhackLine, 'Must find line-bushwhack-series');
    assert.equal(bushwhackLine.title, 'Bushwhack Series');
    assert.equal(bushwhackLine.default_price, 285);
  });

  it('should query categories collection through Payload local API', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'categories',
      limit: 20,
    });

    assert.ok(result.docs.length >= 14, 'Must find at least 14 seeded categories');
    const stormShells = result.docs.find((c: any) => c.id === 'cat-storm-shells');
    assert.ok(stormShells, 'Must find cat-storm-shells');
    assert.equal(stormShells.slug, 'waterproof-storm-shells');
  });

  it('should query product_variations collection through Payload local API', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'product_variations',
      limit: 20,
    });

    assert.ok(result.docs.length >= 13, 'Must find at least 13 seeded variations');
    const camoAnorak = result.docs.find((v: any) => v.id === 'var-anorak-camo-micro');
    assert.ok(camoAnorak, 'Must find var-anorak-camo-micro');
    assert.equal(camoAnorak.variation_type, 'micro_batch');
    assert.equal(camoAnorak.sku, 'BWK-ANRK-CAMO-LTD');
  });

  it('should update documents with document locking across products, product_lines, and categories without SQLite errors', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    // 1. Update Category with document locking
    const updatedCat = await payload.update({
      collection: 'categories',
      id: 'cat-accessories',
      data: { name: 'Field Accessories Updated' },
    });
    assert.equal(updatedCat.name, 'Field Accessories Updated');

    // 2. Update Product Line with document locking
    const updatedLine = await payload.update({
      collection: 'product_lines',
      id: 'line-alpine-chest-rig',
      data: {
        title: 'Alpine Chest Rig System MK II',
        default_price: 180,
      },
    });
    assert.equal(updatedLine.title, 'Alpine Chest Rig System MK II');
    assert.equal(updatedLine.default_price, 180);

    // 3. Update Product with document locking
    const updatedProd = await payload.update({
      collection: 'products',
      id: 'prod-bushwhack-anorak',
      data: {
        base_price: 360,
        price: 360,
        category: 'apparel',
      },
    });
    assert.equal(updatedProd.base_price, 360);
    assert.equal(updatedProd.price, 360);

    // 4. Update Product Variation with document locking
    const updatedVar = await payload.update({
      collection: 'product_variations',
      id: 'var-anorak-camo-micro',
      data: { price_override: 395 },
    });
    assert.equal(updatedVar.price_override, 395);

    // 5. Verify payload_locked_documents_rels relational integrity across collections
    const insertLock = db.prepare(`
      INSERT INTO payload_locked_documents (global_slug, updated_at, created_at)
      VALUES (NULL, datetime('now'), datetime('now'));
    `);
    const lockRes = insertLock.run();
    const lockId = lockRes.lastInsertRowid;

    const insertRel = db.prepare(`
      INSERT INTO payload_locked_documents_rels (_order, "order", _parent_id, parent_id, path, product_lines_id, products_id, categories_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    insertRel.run(1, 1, lockId, lockId, 'product_lines', 'line-alpine-chest-rig', null, null);
    insertRel.run(2, 2, lockId, lockId, 'products', null, 'prod-bushwhack-anorak', null);
    insertRel.run(3, 3, lockId, lockId, 'categories', null, null, 'cat-accessories');

    const lockRows = db.prepare('SELECT * FROM payload_locked_documents_rels WHERE parent_id = ?;').all(lockId) as any[];
    assert.equal(lockRows.length, 3, 'Should successfully record lock relations for product_lines, products, and categories');
    assert.equal(lockRows[0].product_lines_id, 'line-alpine-chest-rig');
    assert.equal(lockRows[1].products_id, 'prod-bushwhack-anorak');
    assert.equal(lockRows[2].categories_id, 'cat-accessories');
  });
});
