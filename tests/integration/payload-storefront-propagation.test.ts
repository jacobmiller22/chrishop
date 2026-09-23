import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPayloadStorefrontHarness,
  type PayloadStorefrontHarness,
} from '../fixtures/payload-storefront-harness';

describe('Story 4.22: End-to-End Payload CMS Mutation & Live Storefront Propagation Integration Test Harness', () => {
  let harness: PayloadStorefrontHarness;

  before(async () => {
    harness = await createPayloadStorefrontHarness();
  });

  after(async () => {
    if (harness) {
      await harness.teardown();
    }
  });

  it('1. Programmatically creates a category, product, and variations via Payload Local API in D1 SQLite', async () => {
    // 1. Create Test Category
    const categoryDoc = await harness.createCategory({
      id: 'cat-e2e-alpine-gear',
      name: 'Alpine & Expedition Gear',
      slug: 'alpine-expedition-gear',
      description: 'Rugged technical packs and expedition rigs tested in high-alpine environments.',
    });

    assert.equal(categoryDoc.id, 'cat-e2e-alpine-gear');
    assert.equal(categoryDoc.name, 'Alpine & Expedition Gear');
    assert.equal(categoryDoc.slug, 'alpine-expedition-gear');

    // 2. Create Test Product with Rich Attributes & Lexical Description
    const productDoc = await harness.createProduct({
      id: 'prod-e2e-alpine-pack',
      title: 'Summit Ridge 35L Expedition Pack',
      slug: 'summit-ridge-35l-pack',
      base_price: 285,
      category: 'packs',
      category_id: 'cat-e2e-alpine-gear',
      status: 'active',
      description: 'Ultralight alpine summit pack constructed with waterproof X-Pac VX21 sailcloth and mil-spec Cordura.',
      maker_field_notes: 'Hand-sewn on the workbench in Leadville, Colorado. Patterned for steep couloir approaches and multi-day high-altitude ridge traverses.',
      materials: 'Waterproof X-Pac® VX21 / 500D Cordura (Packs & Slings)',
      weight: '31.2 oz (885g)',
      fit_profile: 'Custom Spec / Workbench Fit',
      options: [
        { name: 'Edition', value: 'Standard Alpine', sku_suffix: 'ALP' },
        { name: 'Edition', value: 'Blaze Limited', sku_suffix: 'BLZ' },
      ],
    });

    assert.equal(productDoc.id, 'prod-e2e-alpine-pack');
    assert.equal(productDoc.title, 'Summit Ridge 35L Expedition Pack');
    assert.equal(productDoc.slug, 'summit-ridge-35l-pack');
    assert.equal(productDoc.base_price, 285);
    assert.equal(productDoc.status, 'active');

    // 3. Create Standard Variation
    const standardVar = await harness.createVariation({
      id: 'var-e2e-pack-alpine',
      variation_name: 'Standard Alpine Gunmetal',
      sku: 'SUM-35L-ALP-STD',
      product_id: 'prod-e2e-alpine-pack',
      variation_type: 'standard',
      edition_badge: 'Standard Production',
      variation_notes: 'Workbench production spec with AquaGuard closures.',
      price_override: undefined,
      stock_quantity: 20,
      is_limited_edition: false,
      status: 'active',
    });

    assert.equal(standardVar.id, 'var-e2e-pack-alpine');
    assert.equal(standardVar.sku, 'SUM-35L-ALP-STD');

    // 4. Create Micro-Batch Limited Edition Variation
    const limitedVar = await harness.createVariation({
      id: 'var-e2e-pack-blaze',
      variation_name: 'Blaze Orange Micro-Batch',
      sku: 'SUM-35L-BLZ-LTD',
      product_id: 'prod-e2e-alpine-pack',
      variation_type: 'micro_batch',
      edition_badge: 'Only 25 Crafted',
      variation_notes: 'Strictly limited 25-unit run crafted from 420D Hi-Vis Blaze Orange packcloth.',
      price_override: 320,
      stock_quantity: 7,
      is_limited_edition: true,
      total_edition_count: 25,
      status: 'active',
    });

    assert.equal(limitedVar.id, 'var-e2e-pack-blaze');
    assert.equal(limitedVar.price_override, 320);
    assert.equal(limitedVar.is_limited_edition, true);
  });

  it('2. Asserts reactive propagation to customer-facing storefront data layer (fetchProductBySlug & fetchProducts)', async () => {
    // 1. Query Storefront Single Product Detail by Slug
    const product = await harness.queryStorefrontProduct('summit-ridge-35l-pack');
    assert.ok(product, 'Storefront query must return the newly created product');
    assert.equal(product.id, 'prod-e2e-alpine-pack');
    assert.equal(product.title, 'Summit Ridge 35L Expedition Pack');
    assert.equal(product.slug, 'summit-ridge-35l-pack');
    assert.equal(product.base_price, 285);
    assert.equal(product.maker_field_notes, 'Hand-sewn on the workbench in Leadville, Colorado. Patterned for steep couloir approaches and multi-day high-altitude ridge traverses.');
    assert.equal(product.status, 'active');

    // Verify Technical Specs
    assert.ok(product.technical_specs, 'Must populate technical specs');
    assert.equal(product.technical_specs?.weight, '31.2 oz (885g)');
    assert.equal(product.materials, 'Waterproof X-Pac® VX21 / 500D Cordura (Packs & Slings)');

    // Verify Variations and Effective Pricing
    assert.ok(product.variations, 'Must populate variations array');
    assert.equal(product.variations.length, 2, 'Must have exactly 2 variations');

    const stdVar = product.variations.find((v) => v.id === 'var-e2e-pack-alpine');
    assert.ok(stdVar, 'Standard variation must be populated');
    assert.equal(stdVar.effective_price, 285, 'Standard variation inherits base price');
    assert.equal(stdVar.is_limited_edition, false);

    const ltdVar = product.variations.find((v) => v.id === 'var-e2e-pack-blaze');
    assert.ok(ltdVar, 'Limited variation must be populated');
    assert.equal(ltdVar.effective_price, 320, 'Limited variation uses price override');
    assert.equal(ltdVar.is_limited_edition, true);
    assert.equal(ltdVar.total_edition_count, 25);
    assert.equal(ltdVar.edition_badge, 'Only 25 Crafted');

    // Verify Storefront Catalog List includes the product
    const allProducts = await harness.queryStorefrontProducts();
    const foundInList = allProducts.find((p) => p.id === 'prod-e2e-alpine-pack');
    assert.ok(foundInList, 'Newly created product must be returned in the full storefront products list');
    assert.equal(foundInList.title, 'Summit Ridge 35L Expedition Pack');
  });

  it('3. Mutates product in Payload CMS, asserts live storefront update and ISR cache purge triggering', async () => {
    harness.clearRevalidationHistory();

    // 1. Mutate Product in Payload CMS: price revision and title enhancement
    const updated = await harness.updateProduct('prod-e2e-alpine-pack', {
      title: 'Summit Ridge 35L Expedition Pack Pro',
      base_price: 310,
      maker_field_notes: 'Updated revision MK II with hypalon gear lash points and magnetic sternum buckle.',
    });

    assert.equal(updated.title, 'Summit Ridge 35L Expedition Pack Pro');
    assert.equal(updated.base_price, 310);

    // 2. Assert ISR Cache Purge and SingleFlight eviction hooks triggered
    const history = harness.getRevalidationHistory();
    const productEvents = history.filter(
      (e) => e.collection === 'products' && e.action === 'change' && e.id === 'prod-e2e-alpine-pack'
    );
    assert.ok(productEvents.length >= 1, 'Must record at least 1 cache revalidation event for mutated product');
    const latestEvent = productEvents[productEvents.length - 1];
    assert.ok(latestEvent.revalidatedPaths.includes('/products'), 'Must revalidate /products path');
    assert.ok(latestEvent.revalidatedPaths.includes('/products/summit-ridge-35l-pack'), 'Must revalidate product detail path');
    assert.ok(latestEvent.revalidatedTags.includes('products'), 'Must revalidate products tag');
    assert.ok(latestEvent.revalidatedTags.includes('product-summit-ridge-35l-pack'), 'Must revalidate product tag');

    // 3. Assert Storefront query immediately reflects the mutated title, price, and maker notes
    const mutatedProduct = await harness.queryStorefrontProduct('summit-ridge-35l-pack');
    assert.ok(mutatedProduct, 'Product must still be queryable');
    assert.equal(mutatedProduct.title, 'Summit Ridge 35L Expedition Pack Pro');
    assert.equal(mutatedProduct.base_price, 310);
    assert.equal(mutatedProduct.maker_field_notes, 'Updated revision MK II with hypalon gear lash points and magnetic sternum buckle.');
  });

  it('4. Mutates variation price override, asserts storefront reflects variation pricing changes', async () => {
    harness.clearRevalidationHistory();

    // Mutate variation price override: $320 -> $345
    const updatedVar = await harness.updateVariation('var-e2e-pack-blaze', {
      price_override: 345,
      edition_badge: 'Final Batch — Only 25 Crafted',
    });

    assert.equal(updatedVar.price_override, 345);
    assert.equal(updatedVar.edition_badge, 'Final Batch — Only 25 Crafted');

    // Assert revalidation event fired for variation
    const history = harness.getRevalidationHistory();
    const varEvents = history.filter(
      (e) => e.collection === 'product_variations' && e.action === 'change' && e.id === 'var-e2e-pack-blaze'
    );
    assert.ok(varEvents.length >= 1, 'Must record cache revalidation event for variation change');

    // Assert storefront reflects new price override
    const product = await harness.queryStorefrontProduct('summit-ridge-35l-pack');
    assert.ok(product);
    const blazeVar = product.variations?.find((v) => v.id === 'var-e2e-pack-blaze');
    assert.ok(blazeVar);
    assert.equal(blazeVar.effective_price, 345, 'Storefront must reflect updated variation price override');
    assert.equal(blazeVar.edition_badge, 'Final Batch — Only 25 Crafted');
  });

  it('5. Unpublishes / archives product in Payload CMS, asserts exclusion from active storefront catalog', async () => {
    // Update status to 'draft'
    await harness.updateProduct('prod-e2e-alpine-pack', {
      status: 'draft',
    });

    // Active storefront catalog query (default status: ['published', 'active'])
    const activeProducts = await harness.queryStorefrontProducts();
    const foundInActive = activeProducts.find((p) => p.id === 'prod-e2e-alpine-pack');
    assert.equal(foundInActive, undefined, 'Draft or archived products must NOT be returned in active storefront catalog');
  });

  it('6. Cleans up test fixtures and verifies idempotent teardown leaves database clean', async () => {
    await harness.teardown();

    // Verify D1 tables no longer contain test artifacts
    const prodRow = harness.db.prepare("SELECT * FROM products WHERE id = 'prod-e2e-alpine-pack';").get();
    assert.ok(!prodRow, 'Test product must be deleted from D1');

    const varRows = harness.db.prepare("SELECT * FROM product_variations WHERE product_id = 'prod-e2e-alpine-pack';").all();
    assert.equal(varRows.length, 0, 'Test variations must be deleted from D1');

    const catRow = harness.db.prepare("SELECT * FROM categories WHERE id = 'cat-e2e-alpine-gear';").get();
    assert.ok(!catRow, 'Test category must be deleted from D1');
  });
});
