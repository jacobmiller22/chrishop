import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase } from '../../scripts/seed-db';
import { getProducts, getProductBySlug, getProductsByLine } from '../../apps/web/src/lib/catalog';

describe('Story 3.17 Candidate 2: Paradigm 2 (Flat Typed Tags)', () => {
  const db = new DatabaseSync(':memory:');
  seedDatabase(db);

  it('Scenario A: Chest Rig System groups dynamically via line:alpine-chest-rig tag with flat pricing', async () => {
    const products = await getProductsByLine('alpine-chest-rig', { db });
    assert.equal(products.length, 2, 'Should find 2 chest rig products via line tag');

    const minimalist = products.find((p) => p.slug === 'ultralight-minimalist-rig');
    assert.ok(minimalist, 'Minimalist rig must exist');
    assert.equal(minimalist.base_price, 165, 'Flat base price is $165');
    assert.equal(minimalist.effective_price, 165, 'Effective price is $165 (flat, no inheritance)');
    assert.ok(minimalist.tags?.includes('line:alpine-chest-rig'), 'Must contain line tag');
    assert.ok(minimalist.tags?.includes('mat:cordura-500d'), 'Must contain material tag');

    const recon = products.find((p) => p.slug === 'heavy-haul-recon-rig');
    assert.ok(recon, 'Recon rig must exist');
    assert.equal(recon.base_price, 235, 'Flat base price is $235');
    assert.equal(recon.effective_price, 235);
    assert.ok(recon.tags?.includes('type:heavy-duty'), 'Must contain heavy-duty tag');
  });

  it('Scenario B: Bushwhack Anorak groups via line:bushwhack-series with distinct flat SKU pricing', async () => {
    const products = await getProductsByLine('bushwhack-series', { db });
    assert.equal(products.length, 2, 'Should find 2 anoraks via line tag');

    const standard = products.find((p) => p.slug === 'bushwhack-storm-anorak-standard');
    assert.ok(standard, 'Standard anorak must exist');
    assert.equal(standard.base_price, 285);
    assert.equal(standard.effective_price, 285);
    assert.ok(standard.tags?.includes('mat:ripstop-3l'));

    const dyneema = products.find((p) => p.slug === 'bushwhack-storm-anorak-dyneema');
    assert.ok(dyneema, 'Dyneema edition must exist');
    assert.equal(dyneema.base_price, 325);
    assert.equal(dyneema.effective_price, 325);
    assert.ok(dyneema.tags?.includes('mat:dyneema'));
  });

  it('Scenario C: Leadville 1-of-1 prototype is standalone with zero line tags and no dummy container', async () => {
    const leadville = await getProductBySlug('leadville-prototype-tool-wrap', { db });
    assert.ok(leadville, 'Leadville prototype must exist');
    assert.equal(leadville.base_price, 110, 'Standalone flat price is $110');
    assert.equal(leadville.effective_price, 110);
    assert.ok(leadville.tags?.includes('edition:1-of-1'), 'Has 1-of-1 edition tag');
    assert.ok(leadville.tags?.includes('type:prototype'), 'Has prototype tag');
    assert.ok(!leadville.tags?.some((t) => t.startsWith('line:')), 'Must have ZERO line tags');
  });

  it('Cross-cutting tag faceting: query by material tag mat:dyneema works across categories', async () => {
    const dyneemaItems = await getProducts({ tag: 'mat:dyneema', db });
    assert.equal(dyneemaItems.length, 1, 'Should find dyneema items across all categories');
    assert.equal(dyneemaItems[0]?.slug, 'bushwhack-storm-anorak-dyneema');
  });

  it('Zero relational joins: single flat table query executes with minimal latency', async () => {
    const start = performance.now();
    const products = await getProducts({ db });
    const duration = performance.now() - start;
    assert.equal(products.length, 5, 'Should load all 5 products from single flat table');
    assert.ok(duration < 20, `Flat query should execute in < 20ms (took ${duration.toFixed(2)}ms)`);
  });
});
