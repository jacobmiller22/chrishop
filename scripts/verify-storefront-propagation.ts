#!/usr/bin/env tsx
/**
 * ChrisShop Storefront Mutation & Propagation Verification Script
 *
 * Story 4.22: End-to-End Payload CMS Mutation & Live Storefront Propagation Integration Test Harness
 *
 * Executes end-to-end verification that editorial mutations made in Payload CMS v3
 * (backed by Cloudflare D1 SQLite) reactively propagate to the customer-facing
 * storefront data layer and trigger on-demand ISR cache purges without stale data anomalies.
 *
 * Usage:
 *   pnpm run propagation:verify
 */

import {
  createPayloadStorefrontHarness,
  type PayloadStorefrontHarness,
} from '../tests/fixtures/payload-storefront-harness';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface StepResult {
  name: string;
  durationMs: number;
  passed: boolean;
  error?: string;
}

const results: StepResult[] = [];

function printBanner() {
  console.log(
    `\n${colors.bold}${colors.cyan}================================================================${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}  🔄 ChrisShop Payload CMS Mutation & Storefront Propagation    ${colors.reset}`
  );
  console.log(
    `${colors.bold}${colors.cyan}================================================================${colors.reset}\n`
  );
}

async function runStep(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  process.stdout.write(`${colors.blue}▶ [RUN]${colors.reset} ${name}... `);
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    console.log(
      `${colors.green}✔ PASS${colors.reset} ${colors.dim}(${(durationMs / 1000).toFixed(2)}s)${colors.reset}`
    );
    results.push({ name, durationMs, passed: true });
    return true;
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(
      `${colors.red}✖ FAIL${colors.reset} ${colors.dim}(${(durationMs / 1000).toFixed(2)}s)${colors.reset}`
    );
    results.push({ name, durationMs, passed: false, error: err?.message || String(err) });
    return false;
  }
}

async function main() {
  printBanner();

  let harness: PayloadStorefrontHarness | null = null;

  try {
    await runStep('1. Initialize D1 SQLite and boot Payload CMS Local API', async () => {
      harness = await createPayloadStorefrontHarness();
      if (!harness || !harness.payload) {
        throw new Error('Failed to initialize Payload Local API harness');
      }
    });

    if (!harness) return;

    await runStep('2. Provision test category, product, and variations in Payload CMS', async () => {
      // 1. Create Category
      await harness!.createCategory({
        id: 'cat-e2e-expedition',
        name: 'Expedition Alpine Gear',
        slug: 'expedition-alpine-gear',
        description: 'Alpine climbing and bushwhacking equipment.',
      });

      // 2. Create Product
      await harness!.createProduct({
        id: 'prod-e2e-alpine-rucksack',
        title: 'Expedition Alpine Rucksack 45L',
        slug: 'expedition-alpine-rucksack-45l',
        base_price: 325,
        category: 'packs',
        category_id: 'cat-e2e-expedition',
        status: 'active',
        description: 'Patagonia-grade 45L technical rucksack constructed with waterproof X-Pac composite sailcloth.',
        maker_field_notes: 'Hand-sewn on the workbench in Leadville. Reinforced stress points and ice axe haul loops.',
        materials: 'Waterproof X-Pac® VX21 / 500D Cordura (Packs & Slings)',
        weight: '38.4 oz (1088g)',
        fit_profile: 'Custom Spec / Workbench Fit',
        options: [
          { name: 'Edition', value: 'Alpine Shadow', sku_suffix: 'SHD' },
          { name: 'Edition', value: 'Blaze Orange', sku_suffix: 'BLZ' },
        ],
      });

      // 3. Create Standard Variation
      await harness!.createVariation({
        id: 'var-e2e-ruck-shadow',
        variation_name: 'Alpine Shadow Spec',
        sku: 'RUK-45L-SHD-STD',
        product_id: 'prod-e2e-alpine-rucksack',
        variation_type: 'standard',
        edition_badge: 'Standard Production',
        stock_quantity: 18,
        is_limited_edition: false,
        status: 'active',
      });

      // 4. Create Micro-Batch Variation
      await harness!.createVariation({
        id: 'var-e2e-ruck-blaze',
        variation_name: 'Blaze Orange Limited Micro-Batch',
        sku: 'RUK-45L-BLZ-LTD',
        product_id: 'prod-e2e-alpine-rucksack',
        variation_type: 'micro_batch',
        edition_badge: 'Only 30 Crafted',
        price_override: 360,
        stock_quantity: 9,
        is_limited_edition: true,
        total_edition_count: 30,
        status: 'active',
      });
    });

    await runStep('3. Verify reactive propagation to storefront data layer', async () => {
      const product = await harness!.queryStorefrontProduct('expedition-alpine-rucksack-45l');
      if (!product) {
        throw new Error('Product not found in storefront query by slug');
      }
      if (product.title !== 'Expedition Alpine Rucksack 45L') {
        throw new Error(`Unexpected product title: ${product.title}`);
      }
      if (product.base_price !== 325) {
        throw new Error(`Unexpected product base_price: ${product.base_price}`);
      }
      if (!product.variations || product.variations.length !== 2) {
        throw new Error(`Expected 2 variations, got: ${product.variations?.length}`);
      }

      const blaze = product.variations.find((v) => v.id === 'var-e2e-ruck-blaze');
      if (!blaze || blaze.effective_price !== 360) {
        throw new Error(`Blaze variation price override incorrect: ${blaze?.effective_price}`);
      }
      if (!blaze.is_limited_edition || blaze.edition_badge !== 'Only 30 Crafted') {
        throw new Error('Blaze limited edition badge not properly populated');
      }

      const all = await harness!.queryStorefrontProducts();
      if (!all.some((p) => p.id === 'prod-e2e-alpine-rucksack')) {
        throw new Error('Product not present in queryStorefrontProducts');
      }
    });

    await runStep('4. Mutate product in Payload CMS and verify live storefront reflection & ISR purge', async () => {
      harness!.clearRevalidationHistory();

      // Mutate Product: $325 -> $350, update title & maker notes
      await harness!.updateProduct('prod-e2e-alpine-rucksack', {
        title: 'Expedition Alpine Rucksack 45L MK II',
        base_price: 350,
        maker_field_notes: 'Revision MK II with enhanced shoulder harness ergonomics and titanium hardware.',
      });

      // Verify revalidation history
      const history = harness!.getRevalidationHistory();
      const productEvents = history.filter(
        (e) => e.collection === 'products' && e.action === 'change' && e.id === 'prod-e2e-alpine-rucksack'
      );
      if (productEvents.length === 0) {
        throw new Error('Expected at least one ISR revalidation event for product mutation');
      }

      const latest = productEvents[productEvents.length - 1];
      if (!latest.revalidatedPaths.includes('/products') || !latest.revalidatedPaths.includes('/products/expedition-alpine-rucksack-45l')) {
        throw new Error(`Missing expected revalidated paths: ${JSON.stringify(latest.revalidatedPaths)}`);
      }

      // Verify storefront reflects mutation immediately
      const product = await harness!.queryStorefrontProduct('expedition-alpine-rucksack-45l');
      if (!product || product.title !== 'Expedition Alpine Rucksack 45L MK II' || product.base_price !== 350) {
        throw new Error(`Storefront did not reflect mutated product: ${JSON.stringify(product)}`);
      }
    });

    await runStep('5. Mutate variation price override and verify variation pricing propagation', async () => {
      harness!.clearRevalidationHistory();

      await harness!.updateVariation('var-e2e-ruck-blaze', {
        price_override: 395,
        edition_badge: 'Final 5 Crafted',
      });

      const history = harness!.getRevalidationHistory();
      if (!history.some((e) => e.collection === 'product_variations' && e.id === 'var-e2e-ruck-blaze')) {
        throw new Error('Expected variation revalidation event');
      }

      const product = await harness!.queryStorefrontProduct('expedition-alpine-rucksack-45l');
      const blaze = product?.variations?.find((v) => v.id === 'var-e2e-ruck-blaze');
      if (!blaze || blaze.effective_price !== 395 || blaze.edition_badge !== 'Final 5 Crafted') {
        throw new Error(`Variation price override did not propagate: ${JSON.stringify(blaze)}`);
      }
    });

    await runStep('6. Unpublish product and verify storefront exclusion', async () => {
      await harness!.updateProduct('prod-e2e-alpine-rucksack', {
        status: 'draft',
      });

      const active = await harness!.queryStorefrontProducts();
      if (active.some((p) => p.id === 'prod-e2e-alpine-rucksack')) {
        throw new Error('Unpublished draft product was returned in active storefront query');
      }
    });

    await runStep('7. Execute idempotent teardown and verify D1 cleanliness', async () => {
      await harness!.teardown();

      const prod = harness!.db.prepare("SELECT * FROM products WHERE id = 'prod-e2e-alpine-rucksack';").get();
      if (prod) throw new Error('Product record leaked in D1 after teardown');

      const vars = harness!.db.prepare("SELECT * FROM product_variations WHERE product_id = 'prod-e2e-alpine-rucksack';").all();
      if (vars.length > 0) throw new Error('Variation records leaked in D1 after teardown');

      const cat = harness!.db.prepare("SELECT * FROM categories WHERE id = 'cat-e2e-expedition';").get();
      if (cat) throw new Error('Category record leaked in D1 after teardown');
    });
  } finally {
    if (harness) {
      await harness.teardown();
    }
  }

  // Summary
  console.log(
    `\n${colors.bold}----------------------------------------------------------------${colors.reset}`
  );
  console.log(
    `${colors.bold}            Storefront Propagation Results Summary              ${colors.reset}`
  );
  console.log(
    `----------------------------------------------------------------${colors.reset}`
  );

  for (const res of results) {
    const statusIcon = res.passed
      ? `${colors.green}PASSED ${colors.reset}`
      : `${colors.red}FAILED ${colors.reset}`;
    console.log(`  ${statusIcon} | ${res.name.padEnd(42)} | ${(res.durationMs / 1000).toFixed(2)}s`);
    if (res.error) {
      console.log(`    ${colors.red}Error: ${res.error}${colors.reset}`);
    }
  }

  console.log(
    `----------------------------------------------------------------${colors.reset}`
  );

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log(
      `\n${colors.bold}${colors.green}✔ ALL STOREFRONT PROPAGATION CHECKS PASSED!${colors.reset}\n`
    );
    process.exit(0);
  } else {
    console.log(
      `\n${colors.bold}${colors.red}✖ PROPAGATION CHECKS FAILED.${colors.reset}\n`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in propagation verification:', err);
  process.exit(1);
});
