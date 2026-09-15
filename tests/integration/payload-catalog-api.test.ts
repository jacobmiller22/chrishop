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

describe('Story 3.17 Candidate 2: Payload CMS Catalog API & Flat Typed Tags Schema', () => {
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
    const migrationFiles = [
      '0001_initial.sql',
      '0002_payload_tables.sql',
      '0003_payload_catalog_tables.sql',
      '0004_payload_catalog_compatibility.sql',
      '0005_payload_locked_documents_order_parent.sql',
      '0006_story_3_17_flat_tags.sql',
    ];

    for (const m of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationDir, m), 'utf-8');
      db.exec(sql);
    }

    const seedSql = fs.readFileSync(path.join(rootDir, 'scripts/seed.sql'), 'utf-8');
    db.exec(seedSql);

    return db;
  };

  it('should verify payload_locked_documents_rels and products_tags schema alignment', () => {
    const db = setupTestDatabase();

    // Verify locked documents rels columns
    const relColumns = db.prepare('PRAGMA table_info(payload_locked_documents_rels);').all() as any[];
    const relColNames = relColumns.map((c) => c.name);
    assert.ok(relColNames.includes('order'), 'payload_locked_documents_rels must have "order" column');
    assert.ok(relColNames.includes('parent_id'), 'payload_locked_documents_rels must have "parent_id" column');
    assert.ok(relColNames.includes('categories_id'), 'must have categories_id column');
    assert.ok(relColNames.includes('products_id'), 'must have products_id column');
    assert.ok(relColNames.includes('product_variations_id'), 'must have product_variations_id column');

    // Verify products table has sku column (Paradigm 2)
    const productColumns = db.prepare('PRAGMA table_info(products);').all() as any[];
    const productColNames = productColumns.map((c) => c.name);
    assert.ok(productColNames.includes('sku'), 'products table must have "sku" column');
    assert.ok(productColNames.includes('base_price'), 'products table must have "base_price" column');

    // Verify products_tags array subtable exists (Paradigm 2)
    const tagColumns = db.prepare('PRAGMA table_info(products_tags);').all() as any[];
    const tagColNames = tagColumns.map((c) => c.name);
    assert.ok(tagColNames.includes('_order'), 'products_tags must have "_order" column');
    assert.ok(tagColNames.includes('_parent_id'), 'products_tags must have "_parent_id" column');
    assert.ok(tagColNames.includes('id'), 'products_tags must have "id" column');
    assert.ok(tagColNames.includes('tag'), 'products_tags must have "tag" column');
  });

  it('should query products collection through Payload local API and verify tags array structure, sku, and flat pricing', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'products',
      limit: 10,
    });

    assert.ok(result.docs.length >= 6, 'Must find at least 6 seeded products');
    const anorak = result.docs.find((p: any) => p.id === 'prod-bushwhack-anorak');
    assert.ok(anorak, 'Must find prod-bushwhack-anorak');
    assert.equal(anorak.title, 'The Bushwhack Storm Anorak');
    assert.equal(anorak.status, 'active');
    assert.equal(anorak.sku, 'BWK-ANR-STD', 'SKU must match seeded value');
    assert.equal(anorak.base_price, 340, 'Flat base price must be $340 without inheritance');
    assert.ok(anorak.description, 'Description must exist');
    assert.equal(typeof anorak.description, 'object', 'Description must be Lexical editor JSON object');

    // Verify Flat Typed Tags array structure
    assert.ok(Array.isArray(anorak.tags), 'Tags must be returned as an array');
    assert.ok(anorak.tags.length >= 3, 'Must have at least 3 structured tags');

    const tagValues = anorak.tags.map((t: any) => t.tag);
    assert.ok(tagValues.includes('line:bushwhack'), 'Must contain line:bushwhack tag');
    assert.ok(tagValues.includes('mat:dyneema'), 'Must contain mat:dyneema tag');
    assert.ok(tagValues.includes('cat:apparel'), 'Must contain cat:apparel tag');

    // Verify tag item object structure contains both id and tag
    const firstTag = anorak.tags[0];
    assert.ok(firstTag.id, 'Tag item must have an id');
    assert.ok(firstTag.tag, 'Tag item must have a tag value');
  });

  it('should query and filter products by tag using Payload query operators', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    // 1. Filter by line tag: line:alpine-chest-rig
    const chestRigResult = await payload.find({
      collection: 'products',
      where: {
        'tags.tag': {
          equals: 'line:alpine-chest-rig',
        },
      },
    });

    assert.equal(chestRigResult.docs.length, 1, 'Should find 1 product with line:alpine-chest-rig');
    const rig = chestRigResult.docs[0];
    assert.equal(rig.id, 'prod-minimalist-chest-rig');
    assert.equal(rig.sku, 'RIG-MIN-01');
    assert.equal(rig.base_price, 135, 'Flat pricing for minimalist chest rig is $135');

    const rigTags = rig.tags.map((t: any) => t.tag);
    assert.ok(rigTags.includes('line:alpine-chest-rig'));
    assert.ok(rigTags.includes('cat:packs'));
    assert.ok(rigTags.includes('mat:cordura-500d'));

    // 2. Cross-cutting filter by material tag: mat:dyneema
    const dyneemaResult = await payload.find({
      collection: 'products',
      where: {
        'tags.tag': {
          equals: 'mat:dyneema',
        },
      },
    });

    assert.equal(dyneemaResult.docs.length, 1, 'Should find 1 product with mat:dyneema');
    assert.equal(dyneemaResult.docs[0].id, 'prod-bushwhack-anorak');

    // 3. Cross-cutting filter by category tag: cat:apparel
    const apparelResult = await payload.find({
      collection: 'products',
      where: {
        'tags.tag': {
          equals: 'cat:apparel',
        },
      },
    });

    assert.ok(apparelResult.docs.length >= 2, 'Should find at least 2 products with cat:apparel');
    const apparelIds = apparelResult.docs.map((p: any) => p.id);
    assert.ok(apparelIds.includes('prod-bushwhack-anorak'));
    assert.ok(apparelIds.includes('prod-bramble-buster-pant'));
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

  it('should update documents with document locking and update products with tags without throwing SQLite errors', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    // 1. Update category
    const updatedCat = await payload.update({
      collection: 'categories',
      id: 'cat-accessories',
      data: { name: 'Field Accessories Updated' },
    });
    assert.equal(updatedCat.name, 'Field Accessories Updated');

    // 2. Update product variation
    const updatedVar = await payload.update({
      collection: 'product_variations',
      id: 'var-anorak-camo-micro',
      data: { price_override: 395 },
    });
    assert.equal(updatedVar.price_override, 395);

    // 3. Update product base_price and tags array with document locking
    const updatedProd = await payload.update({
      collection: 'products',
      id: 'prod-bushwhack-anorak',
      data: {
        base_price: 360,
        tags: [
          { tag: 'line:bushwhack' },
          { tag: 'mat:dyneema' },
          { tag: 'cat:apparel' },
          { tag: 'status:limited-edition' },
        ],
      },
    });

    assert.equal(updatedProd.base_price, 360);
    assert.ok(Array.isArray(updatedProd.tags), 'Updated tags must be an array');
    assert.equal(updatedProd.tags.length, 4, 'Must have 4 tags after update');
    const updatedTagValues = updatedProd.tags.map((t: any) => t.tag);
    assert.ok(updatedTagValues.includes('status:limited-edition'));

    // Verify re-fetching reflects the updated tags and price
    const reFetched = await payload.findByID({
      collection: 'products',
      id: 'prod-bushwhack-anorak',
    });
    assert.equal(reFetched.base_price, 360);
    assert.equal(reFetched.tags.length, 4);
  });
});
