import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { getEffectivePrice, type Product, type ProductVariation } from '@chrishop/types';

describe('Directus Schema Snapshot & Seed Integrity', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const infraSnapshotPath = path.join(repoRoot, 'infra/directus/snapshot.yaml');
  const cmsSnapshotPath = path.join(repoRoot, 'apps/cms/snapshot.yaml');

  it('should have infra/directus/snapshot.yaml', () => {
    assert.ok(fs.existsSync(infraSnapshotPath), 'infra/directus/snapshot.yaml must exist');
  });

  it('should have apps/cms/snapshot.yaml in sync with infra/directus/snapshot.yaml', () => {
    assert.ok(fs.existsSync(cmsSnapshotPath), 'apps/cms/snapshot.yaml must exist');
    const infraContent = fs.readFileSync(infraSnapshotPath, 'utf-8');
    const cmsContent = fs.readFileSync(cmsSnapshotPath, 'utf-8');
    assert.equal(cmsContent, infraContent, 'Both snapshots must have identical content');
  });

  it('should define all 6 required collections in the snapshot', () => {
    const rawYaml = fs.readFileSync(infraSnapshotPath, 'utf-8');
    const snapshot = parse(rawYaml);

    assert.equal(snapshot.version, 1);
    assert.ok(Array.isArray(snapshot.collections), 'collections array must exist');

    const collectionNames = snapshot.collections.map((c: any) => c.collection);
    const requiredCollections = [
      'categories',
      'products',
      'product_variations',
      'orders',
      'order_items',
      'processed_stripe_events',
    ];

    for (const req of requiredCollections) {
      assert.ok(collectionNames.includes(req), `Collection '${req}' must be defined in snapshot`);
    }
  });

  it('should define foreign key relations between core collections', () => {
    const rawYaml = fs.readFileSync(infraSnapshotPath, 'utf-8');
    const snapshot = parse(rawYaml);

    assert.ok(Array.isArray(snapshot.relations), 'relations array must exist');
    assert.ok(snapshot.relations.length >= 8, 'At least 8 relations must be registered');

    const hasCategoryRelation = snapshot.relations.some(
      (r: any) => r.collection === 'products' && r.field === 'category_id'
    );
    assert.ok(hasCategoryRelation, 'products.category_id relation must exist');

    const hasProductRelation = snapshot.relations.some(
      (r: any) => r.collection === 'product_variations' && r.field === 'product_id'
    );
    assert.ok(hasProductRelation, 'product_variations.product_id relation must exist');

    const hasOrderRelation = snapshot.relations.some(
      (r: any) => r.collection === 'order_items' && r.field === 'order_id'
    );
    assert.ok(hasOrderRelation, 'order_items.order_id relation must exist');
  });

  it('should evaluate price fallback resolution rule correctly', () => {
    const product: Product = {
      id: 'p-1',
      title: 'Obsidian Beast',
      slug: 'obsidian-beast',
      base_price: 350.0,
      status: 'published',
    };

    const variationWithOverride: Partial<ProductVariation> = {
      price_override: 495.0,
    };
    assert.equal(getEffectivePrice(product, variationWithOverride as ProductVariation), 495.0);

    const variationWithoutOverride: Partial<ProductVariation> = {
      price_override: null,
    };
    assert.equal(getEffectivePrice(product, variationWithoutOverride as ProductVariation), 350.0);
  });
});
