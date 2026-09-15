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

describe('Story 3.17 Candidate 3: Strict 3-Tier Hierarchy Payload CMS Catalog API & D1 Relational Schema', () => {
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

  it('should verify payload_locked_documents_rels has "order" and "parent_id" columns and 3-tier relation columns', () => {
    const db = setupTestDatabase();
    const columns = db.prepare('PRAGMA table_info(payload_locked_documents_rels);').all() as any[];
    const colNames = columns.map((c) => c.name);

    assert.ok(colNames.includes('order'), 'payload_locked_documents_rels must have "order" column');
    assert.ok(colNames.includes('parent_id'), 'payload_locked_documents_rels must have "parent_id" column');
    assert.ok(colNames.includes('categories_id'), 'must have categories_id column');
    assert.ok(colNames.includes('product_lines_id'), 'must have product_lines_id column (Tier 1)');
    assert.ok(colNames.includes('products_id'), 'must have products_id column (Tier 2)');
    assert.ok(colNames.includes('product_variations_id'), 'must have product_variations_id column (Tier 3)');
  });

  it('should query product_lines collection (Tier 1) through Payload local API', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'product_lines',
      limit: 10,
    });

    assert.ok(result.docs.length >= 3, 'Must find at least 3 seeded product lines');
    const bushwhackSeries = result.docs.find((l: any) => l.id === 'line-bushwhack-series');
    assert.ok(bushwhackSeries, 'Must find line-bushwhack-series');
    assert.equal(bushwhackSeries.title, 'Bushwhack Series');
    assert.equal(bushwhackSeries.slug, 'bushwhack-series');
    assert.equal(bushwhackSeries.default_price, 285);

    const alpineRig = result.docs.find((l: any) => l.id === 'line-alpine-chest-rig');
    assert.ok(alpineRig, 'Must find line-alpine-chest-rig');
    assert.equal(alpineRig.title, 'Alpine Chest Rig System');
    assert.equal(alpineRig.default_price, 165);

    const archive = result.docs.find((l: any) => l.id === 'line-bench-archive');
    assert.ok(archive, 'Must find line-bench-archive');
    assert.equal(archive.title, 'Bench Prototypes & One-Off Archive');
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

  it('should query products collection (Tier 2) through Payload local API and verify mandatory parent relation to product_lines', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'products',
      limit: 10,
    });

    assert.ok(result.docs.length >= 6, 'Must find at least 6 seeded products');

    // Verify that every product has a mandatory parent product_line_id relation in Candidate 3
    for (const p of result.docs as any[]) {
      assert.ok(p.product_line_id, `Product [${p.id}] MUST have a mandatory parent relation to product_lines`);
      const lineId = typeof p.product_line_id === 'object' ? p.product_line_id.id : p.product_line_id;
      assert.ok(
        ['line-alpine-chest-rig', 'line-bushwhack-series', 'line-bench-archive'].includes(lineId),
        `Product [${p.id}] linked to valid product line [${lineId}]`
      );
    }

    const anorak = result.docs.find((p: any) => p.id === 'prod-bushwhack-anorak');
    assert.ok(anorak, 'Must find prod-bushwhack-anorak');
    assert.equal(anorak.title, 'The Bushwhack Storm Anorak');
    assert.equal(anorak.status, 'active');
    assert.ok(anorak.description, 'Description must exist');
    assert.equal(typeof anorak.description, 'object', 'Description must be Lexical editor JSON object');
    assert.equal(
      typeof anorak.product_line_id === 'object' ? anorak.product_line_id.id : anorak.product_line_id,
      'line-bushwhack-series',
      'Anorak must belong to Bushwhack Series'
    );

    const rig = result.docs.find((p: any) => p.id === 'prod-minimalist-chest-rig');
    assert.ok(rig, 'Must find prod-minimalist-chest-rig');
    assert.equal(
      typeof rig.product_line_id === 'object' ? rig.product_line_id.id : rig.product_line_id,
      'line-alpine-chest-rig',
      'Minimalist rig must belong to Alpine Chest Rig System'
    );
  });

  it('should query product_variations collection (Tier 3) through Payload local API and verify parent relation to products', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'product_variations',
      limit: 20,
    });

    assert.ok(result.docs.length >= 13, 'Must find at least 13 seeded variations');

    // Verify all variations enforce parent relation to Tier 2 Product
    for (const v of result.docs as any[]) {
      assert.ok(v.product_id, `Variation [${v.id}] MUST have a parent product_id in Strict 3-Tier`);
      const prodId = typeof v.product_id === 'object' ? v.product_id.id : v.product_id;
      assert.ok(prodId.startsWith('prod-'), `Variation [${v.id}] linked to valid product`);
    }

    const camoAnorak = result.docs.find((v: any) => v.id === 'var-anorak-camo-micro');
    assert.ok(camoAnorak, 'Must find var-anorak-camo-micro');
    assert.equal(camoAnorak.variation_type, 'micro_batch');
    assert.equal(camoAnorak.sku, 'BWK-ANRK-CAMO-LTD');
    assert.equal(
      typeof camoAnorak.product_id === 'object' ? camoAnorak.product_id.id : camoAnorak.product_id,
      'prod-bushwhack-anorak',
      'Camo anorak variation must link to parent prod-bushwhack-anorak'
    );

    // Transitive Tier 1 verification via populated relationship
    if (typeof camoAnorak.product_id === 'object' && camoAnorak.product_id.product_line_id) {
      const line = camoAnorak.product_id.product_line_id;
      const lineId = typeof line === 'object' ? line.id : line;
      assert.equal(lineId, 'line-bushwhack-series', 'Transitive Tier 1 link verified');
    }
  });

  it('should test document locking and updates across Tier 1, Tier 2, and Tier 3 collections without SQLite errors', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const updatedCat = await payload.update({
      collection: 'categories',
      id: 'cat-accessories',
      data: { name: 'Field Accessories Updated' },
    });
    assert.equal(updatedCat.name, 'Field Accessories Updated');

    const updatedLine = await payload.update({
      collection: 'product_lines',
      id: 'line-alpine-chest-rig',
      data: { default_price: 180 },
    });
    assert.equal(updatedLine.default_price, 180);

    const updatedProd = await payload.update({
      collection: 'products',
      id: 'prod-bushwhack-anorak',
      data: { base_price: 360 },
    });
    assert.equal(updatedProd.base_price, 360);

    const updatedVar = await payload.update({
      collection: 'product_variations',
      id: 'var-anorak-camo-micro',
      data: { price_override: 395 },
    });
    assert.equal(updatedVar.price_override, 395);

    // Document locking verification across Tier 1, Tier 2, and Tier 3
    db.exec(`
      INSERT INTO payload_locked_documents (id, global_slug, updated_at, created_at) VALUES (1, NULL, datetime('now'), datetime('now'));
      INSERT INTO payload_locked_documents_rels (id, _order, _parent_id, "order", parent_id, path, product_lines_id) VALUES (1, 1, 1, 1, 1, 'product_lines', 'line-alpine-chest-rig');
      INSERT INTO payload_locked_documents_rels (id, _order, _parent_id, "order", parent_id, path, products_id) VALUES (2, 2, 1, 2, 1, 'products', 'prod-bushwhack-anorak');
      INSERT INTO payload_locked_documents_rels (id, _order, _parent_id, "order", parent_id, path, product_variations_id) VALUES (3, 3, 1, 3, 1, 'product_variations', 'var-anorak-camo-micro');
    `);

    const locks = db.prepare('SELECT * FROM payload_locked_documents_rels ORDER BY id ASC').all() as any[];
    assert.equal(locks.length, 3, 'Must record locks across all 3 tiers');
    assert.equal(locks[0].product_lines_id, 'line-alpine-chest-rig', 'Tier 1 lock recorded');
    assert.equal(locks[1].products_id, 'prod-bushwhack-anorak', 'Tier 2 lock recorded');
    assert.equal(locks[2].product_variations_id, 'var-anorak-camo-micro', 'Tier 3 lock recorded');
  });
});
