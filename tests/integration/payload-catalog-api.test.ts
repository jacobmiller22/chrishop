import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase } from '../../scripts/seed-db';

// Ensure CJS/ESM interop for @next/env under tsx/esbuild
try {
  const nextEnv = require('../../apps/web/node_modules/@next/env');
  if (nextEnv && !nextEnv.default) {
    nextEnv.default = nextEnv;
  }
} catch {}

describe('Story 3.17 Candidate 4: Pure Recursive Node Tree Payload Local API & Relational Schema', () => {
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

    // 1. Execute migrations 0001 through 0006 sequentially
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

    // 2. Seed administrative users for Payload CMS
    db.prepare(`
      INSERT INTO users (email, salt, hash, login_attempts, created_at, updated_at)
      VALUES ('admin@chrishop.jacobmiller22.com', 'salt', 'hash', 0, '2026-09-13 18:57:38', '2026-09-13 18:57:38')
      ON CONFLICT(email) DO NOTHING;
    `).run();

    // 3. Seed native recursive tree catalog nodes (Scenarios A, B, C)
    seedDatabase(db);

    return db;
  };

  it('should verify payload_locked_documents_rels has "order", "parent_id", "categories_id", and "products_id" columns', () => {
    const db = setupTestDatabase();
    const columns = db.prepare('PRAGMA table_info(payload_locked_documents_rels);').all() as any[];
    const colNames = columns.map((c) => c.name);

    assert.ok(colNames.includes('order'), 'payload_locked_documents_rels must have "order" column');
    assert.ok(colNames.includes('parent_id'), 'payload_locked_documents_rels must have "parent_id" column');
    assert.ok(colNames.includes('categories_id'), 'must have categories_id column');
    assert.ok(colNames.includes('products_id'), 'must have products_id column');
  });

  it('should query categories collection through Payload local API', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'categories',
      limit: 10,
    });

    assert.ok(result.docs.length >= 3, 'Must find seeded categories');
    const apparel = result.docs.find((c: any) => c.id === 'cat-apparel');
    assert.ok(apparel, 'Must find cat-apparel');
    assert.equal(apparel.name, 'Apparel');
    assert.equal(apparel.slug, 'apparel');
  });

  it('should query products collection through Payload local API without Lexical parse errors', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'products',
      limit: 20,
    });

    assert.ok(result.docs.length >= 7, 'Must find at least 7 seeded recursive nodes');
    const series = result.docs.find((p: any) => p.id === 'node-bushwhack-series');
    assert.ok(series, 'Must find node-bushwhack-series');
    assert.equal(series.title, 'Bushwhack Series');
    assert.equal(series.status, 'active');
    assert.ok(series.description, 'Description must exist');
    assert.equal(typeof series.description, 'object', 'Description must be Lexical editor JSON object');
  });

  it('should query products covering the recursive hierarchy (Root Collection, Model Branch, Leaf Item)', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    // 1. Root Collection Node (node_role: 'collection', parent_id: null)
    const rootNode: any = await payload.findByID({
      collection: 'products',
      id: 'node-bushwhack-series',
    });
    assert.ok(rootNode, 'Root collection node must exist');
    assert.equal(rootNode.node_role, 'collection', 'Root node role must be collection');
    assert.equal(rootNode.parent_id, null, 'Root collection node must have parent_id: null');
    assert.equal(rootNode.base_price, 285);

    // 2. Model Branch Node (node_role: 'model', parent_id: <collection-id>)
    const modelNode: any = await payload.findByID({
      collection: 'products',
      id: 'node-bushwhack-standard',
    });
    assert.ok(modelNode, 'Model branch node must exist');
    assert.equal(modelNode.node_role, 'model', 'Branch node role must be model');
    const modelParentId = typeof modelNode.parent_id === 'object' ? modelNode.parent_id?.id : modelNode.parent_id;
    assert.equal(modelParentId, 'node-bushwhack-series', 'Model parent_id must point to root collection');
    assert.equal(modelNode.sku, 'BWK-ANR-STD');

    // 3. Item / SKU Leaf Node (node_role: 'item', parent_id: <model-id>)
    const leafNode: any = await payload.findByID({
      collection: 'products',
      id: 'node-bushwhack-dyneema',
    });
    assert.ok(leafNode, 'Leaf item node must exist');
    assert.equal(leafNode.node_role, 'item', 'Leaf node role must be item');
    const leafParentId = typeof leafNode.parent_id === 'object' ? leafNode.parent_id?.id : leafNode.parent_id;
    assert.equal(leafParentId, 'node-bushwhack-standard', 'Item parent_id must point to model');
    assert.equal(leafNode.sku, 'BWK-ANR-DYN');
    assert.equal(leafNode.price, 325);

    // 4. Standalone 1-of-1 Root Model (zero dummy containers)
    const standaloneNode: any = await payload.findByID({
      collection: 'products',
      id: 'node-leadville-tool-wrap',
    });
    assert.ok(standaloneNode, 'Standalone model node must exist');
    assert.equal(standaloneNode.node_role, 'model');
    assert.equal(standaloneNode.parent_id, null, 'Standalone prototype has parent_id: null');
    assert.equal(standaloneNode.price, 110);
  });

  it('should query leaf items via Payload where filter: { node_role: { equals: "item" } }', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    const result = await payload.find({
      collection: 'products',
      where: {
        node_role: {
          equals: 'item',
        },
      },
    });

    assert.ok(result.docs.length >= 1, 'Must find at least 1 leaf item');
    for (const doc of result.docs as any[]) {
      assert.equal(doc.node_role, 'item', 'All returned docs must have node_role === item');
      assert.ok(doc.sku, 'All leaf items must have a SKU');
      assert.ok(doc.parent_id, 'Leaf items must have a parent node');
    }

    const dyneema = result.docs.find((d: any) => d.id === 'node-bushwhack-dyneema');
    assert.ok(dyneema, 'Should find node-bushwhack-dyneema via where filter');
    assert.equal((dyneema as any).sku, 'BWK-ANR-DYN');
  });

  it('should update documents with document locking on root and leaf nodes without SQLite errors', async () => {
    const db = setupTestDatabase();
    const payload = await getPayloadInstance(db);

    // Update root collection node
    const updatedRoot = await payload.update({
      collection: 'products',
      id: 'node-bushwhack-series',
      data: {
        title: 'Bushwhack Series — Redesigned',
        base_price: 295,
      },
    });
    assert.equal(updatedRoot.title, 'Bushwhack Series — Redesigned');
    assert.equal(updatedRoot.base_price, 295);

    // Update leaf item node
    const updatedLeaf = await payload.update({
      collection: 'products',
      id: 'node-bushwhack-dyneema',
      data: {
        price: 345,
      },
    });
    assert.equal(updatedLeaf.price, 345);

    // Update category
    const updatedCat = await payload.update({
      collection: 'categories',
      id: 'cat-packs',
      data: {
        name: 'Packs & Carry (Updated)',
      },
    });
    assert.equal(updatedCat.name, 'Packs & Carry (Updated)');
  });
});
