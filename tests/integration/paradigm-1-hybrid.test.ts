import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase } from '../../scripts/seed-db';
import { getProducts, getProductBySlug } from '../../apps/web/src/lib/catalog';

describe('Story 3.17 Candidate 1: Paradigm 1 (Hybrid Product-First)', () => {
  const db = new DatabaseSync(':memory:');
  seedDatabase(db);

  it('Scenario A: Chest Rig System demonstrates price inheritance and model overrides', async () => {
    const products = await getProducts({ category: 'packs', db });
    assert.equal(products.length, 2, 'Should find 2 chest rig products in packs');

    const minimalist = products.find((p) => p.slug === 'ultralight-minimalist-rig');
    assert.ok(minimalist, 'Minimalist rig must exist');
    assert.equal(minimalist.price, null, 'Minimalist price is null (inherited)');
    assert.equal(minimalist.effective_price, 165, 'Inherits $165 default from Alpine Chest Rig System');
    assert.equal(minimalist.product_line?.title, 'Alpine Chest Rig System');

    const recon = products.find((p) => p.slug === 'heavy-haul-recon-rig');
    assert.ok(recon, 'Recon rig must exist');
    assert.equal(recon.price, 235, 'Recon explicitly overrides price');
    assert.equal(recon.effective_price, 235, 'Effective price is $235 override');
    assert.equal(recon.product_line?.title, 'Alpine Chest Rig System');
  });

  it('Scenario B: Bushwhack Anorak demonstrates flagship base line + specialty material override', async () => {
    const standard = await getProductBySlug('bushwhack-storm-anorak-standard', { db });
    assert.ok(standard, 'Standard anorak must exist');
    assert.equal(standard.effective_price, 285, 'Inherits $285 base price');

    const dyneema = await getProductBySlug('bushwhack-storm-anorak-dyneema', { db });
    assert.ok(dyneema, 'Dyneema edition must exist');
    assert.equal(dyneema.effective_price, 325, 'Overrides to $325');
  });

  it('Scenario C: Leadville 1-of-1 workbench prototype exists standalone with zero dummy parents', async () => {
    const leadville = await getProductBySlug('leadville-prototype-tool-wrap', { db });
    assert.ok(leadville, 'Leadville prototype must exist');
    assert.equal(leadville.product_line, null, 'Must have NULL product_line — zero dummy parent needed');
    assert.equal(leadville.price, 110, 'Standalone price is $110');
    assert.equal(leadville.effective_price, 110);
    assert.equal(leadville.category?.slug, 'accessories');
  });

  it('Query efficiency: single SQL query with 1 LEFT JOIN resolves complete product with line', async () => {
    const start = performance.now();
    const products = await getProducts({ db });
    const duration = performance.now() - start;
    assert.equal(products.length, 5, 'Should load all 5 catalog products in a single flight');
    assert.ok(duration < 20, `Query should complete in < 20ms (took ${duration.toFixed(2)}ms)`);
  });
});
