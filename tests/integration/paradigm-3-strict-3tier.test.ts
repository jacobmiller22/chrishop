import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase } from '../../scripts/seed-db';
import { getProducts, getProductBySlug, getProductVariations } from '../../apps/web/src/lib/catalog';

describe('Story 3.17 Candidate 3: Paradigm 3 (Strict 3-Tier Hierarchy)', () => {
  const db = new DatabaseSync(':memory:');
  seedDatabase(db);

  it('Scenario A: Cascading 3-tier price inheritance (Line Default -> Product Base -> Variation)', async () => {
    const minimalist = await getProductBySlug('ultralight-minimalist-rig', { db });
    assert.ok(minimalist, 'Minimalist rig must exist');
    assert.equal(minimalist.product_line?.title, 'Alpine Chest Rig System');
    assert.equal(minimalist.product_line?.default_price, 165);
    assert.equal(minimalist.effective_min_price, 165, 'Inherits $165 line default down to variations');

    const variations = await getProductVariations(minimalist.id, { db, basePrice: minimalist.effective_price });
    assert.equal(variations.length, 2);
    assert.equal(variations[0]?.effective_price, 165, 'Variation inherits line default price');
    assert.equal(variations[1]?.effective_price, 165);

    const recon = await getProductBySlug('heavy-haul-recon-rig', { db });
    assert.ok(recon, 'Recon rig must exist');
    assert.equal(recon.effective_min_price, 235, 'Tier 2 overrides Tier 1 ($165 -> $235)');
  });

  it('Scenario B: Tier 3 variation override takes final precedence in 3-tier cascade', async () => {
    const anorak = await getProductBySlug('bushwhack-storm-anorak-standard', { db });
    assert.ok(anorak, 'Anorak must exist');
    assert.equal(anorak.product_line?.default_price, 285);

    const variations = await getProductVariations(anorak.id, { db, basePrice: anorak.effective_price });
    assert.equal(variations.length, 2);

    const std = variations.find((v) => v.sku === 'BWK-ANR-STD');
    assert.ok(std);
    assert.equal(std.effective_price, 285, 'Standard run inherits Tier 1 default $285');

    const dyn = variations.find((v) => v.sku === 'BWK-ANR-DYN');
    assert.ok(dyn);
    assert.equal(dyn.effective_price, 325, 'Tier 3 override ($325) wins over Tier 2 & Tier 1');
  });

  it('Scenario C: Solo-maker 1-of-1 prototype requires mandatory dummy parent line and SKU variation', async () => {
    const leadville = await getProductBySlug('leadville-prototype-tool-wrap', { db });
    assert.ok(leadville, 'Leadville product must exist');
    assert.ok(leadville.product_line, 'In strict 3-tier, product MUST have a parent line container');
    assert.equal(leadville.product_line.id, 'line-bench-archive', 'Forced into dummy archive line');

    const variations = await getProductVariations(leadville.id, { db, basePrice: leadville.effective_price });
    assert.equal(variations.length, 1, 'In strict 3-tier, a child variation is required for checkout');
    assert.equal(variations[0]?.sku, 'LDV-WR-01');
    assert.equal(variations[0]?.effective_price, 110);
  });

  it('Strict relational hierarchy: 3-tier joined queries execute across normalized tables', async () => {
    const start = performance.now();
    const products = await getProducts({ db });
    const duration = performance.now() - start;
    assert.equal(products.length, 4, 'Should load 4 products joined with lines and variations');
    assert.ok(duration < 30, `3-tier joined query executed in ${duration.toFixed(2)}ms`);
  });
});
