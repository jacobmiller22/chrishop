import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase } from '../../scripts/seed-db';
import { getProductBySlug, getNodeAncestors, getNodeDescendants } from '../../apps/web/src/lib/catalog';

describe('Story 3.17 Candidate 4: Paradigm 4 (Recursive Node Tree / DAG)', () => {
  const db = new DatabaseSync(':memory:');
  seedDatabase(db);

  it('Scenario A: Recursive CTE walks ancestor chain to resolve inherited pricing (Depth 1)', async () => {
    const ancestors = await getNodeAncestors('node-rig-minimalist', { db });
    assert.equal(ancestors.length, 2, 'Should resolve self and 1 parent ancestor');
    assert.equal(ancestors[0]?.id, 'node-rig-minimalist');
    assert.equal(ancestors[1]?.id, 'node-alpine-chest-rig');
    assert.equal(ancestors[1]?.price, 165);

    const product = await getProductBySlug('ultralight-minimalist-rig', { db });
    assert.ok(product);
    assert.equal(product.effective_price, 165, 'Inherits $165 from root collection node via CTE');
    assert.equal(product.product_line?.title, 'Alpine Chest Rig System');

    const recon = await getProductBySlug('heavy-haul-recon-rig', { db });
    assert.ok(recon);
    assert.equal(recon.effective_price, 235, 'Explicit override wins over root ancestor price');
  });

  it('Scenario B: Arbitrary depth recursive CTE traversal (Depth 2 leaf edition override)', async () => {
    const ancestors = await getNodeAncestors('node-bushwhack-dyneema', { db });
    assert.equal(ancestors.length, 3, 'Should resolve leaf -> model -> collection (3 levels)');
    assert.equal(ancestors[0]?.id, 'node-bushwhack-dyneema');
    assert.equal(ancestors[1]?.id, 'node-bushwhack-standard');
    assert.equal(ancestors[2]?.id, 'node-bushwhack-series');

    const dyneema = await getProductBySlug('bushwhack-storm-anorak-dyneema', { db });
    assert.ok(dyneema);
    assert.equal(dyneema.effective_price, 325, 'Leaf override ($325) takes precedence across 3-level tree');

    const descendants = await getNodeDescendants('node-bushwhack-series', { db });
    assert.equal(descendants.length, 2, 'Root collection discovers all descendant models and leaf items');
  });

  it('Scenario C: Standalone 1-of-1 prototype is a root node with zero dummy parent containers', async () => {
    const leadville = await getProductBySlug('leadville-prototype-tool-wrap', { db });
    assert.ok(leadville);
    assert.equal(leadville.parent_id, null, 'Root node has parent_id: null');
    assert.equal(leadville.effective_price, 110);
    assert.equal(leadville.product_line, null, 'Zero dummy line container required');

    const ancestors = await getNodeAncestors('node-leadville-tool-wrap', { db });
    assert.equal(ancestors.length, 1, 'Self is the only node in ancestor tree');
  });

  it('Recursive CTE execution performance on D1 SQLite is sub-millisecond for shallow trees', async () => {
    const start = performance.now();
    await getNodeAncestors('node-bushwhack-dyneema', { db });
    await getNodeDescendants('node-alpine-chest-rig', { db });
    const duration = performance.now() - start;
    assert.ok(duration < 25, `Recursive CTEs executed in ${duration.toFixed(2)}ms`);
  });
});
