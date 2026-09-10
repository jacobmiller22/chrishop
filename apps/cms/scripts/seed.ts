import { createDirectus, rest, staticToken, readItem, createItem, updateItem } from '@directus/sdk';
import { getEffectivePrice } from '@chrishop/types';
import { getDirectusConfig } from './directus-client';

export interface SeedReport {
  categoriesCount: number;
  productsCount: number;
  variationsCount: number;
  ordersCount: number;
}

/**
 * Helper to idempotently create or update an item by primary key.
 */
async function upsertItem(client: any, collection: string, id: string, payload: any): Promise<any> {
  try {
    await client.request((readItem as any)(collection, id));
    return await client.request((updateItem as any)(collection, id, payload));
  } catch {
    return await client.request((createItem as any)(collection, payload));
  }
}

/**
 * Directus Seed Script using @directus/sdk.
 * Populates local Directus database with sample categories, products,
 * variations, and test checkout transactions.
 *
 * Implements price fallback resolution:
 * effective_price = COALESCE(variation.price_override, product.base_price)
 */
export async function seedDatabase(): Promise<SeedReport> {
  const config = getDirectusConfig();
  console.log(`🌱 [Directus Seed] Connecting to Directus at ${config.url}...`);

  const client = createDirectus(config.url)
    .with(staticToken(config.token || 'chrishop-admin-token'))
    .with(rest());

  // ---------------------------------------------------------------------------
  // 1. Categories (4 Categories: Sculptures, Prints, Wearables, Digital)
  // ---------------------------------------------------------------------------
  console.log('📦 Seeding Categories...');
  const categoryDefs = [
    {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Sculptures',
      slug: 'sculptures',
      description: 'Handcrafted limited edition art sculptures, figurines, and tangible artifacts.',
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      name: 'Prints',
      slug: 'prints',
      description: 'Museum-grade archival pigment prints and fine art reproductions on cotton rag.',
    },
    {
      id: '10000000-0000-0000-0000-000000000003',
      name: 'Wearables',
      slug: 'wearables',
      description: 'Exclusive apparel, embroidered heavyweight streetwear, and artisan jewelry.',
    },
    {
      id: '10000000-0000-0000-0000-000000000004',
      name: 'Digital Editions',
      slug: 'digital-editions',
      description: 'Generative digital collectibles, 3D assets, and interactive media.',
    },
  ];

  const categoryMap = new Map<string, any>();
  for (const cat of categoryDefs) {
    const record = await upsertItem(client, 'categories', cat.id, cat);
    categoryMap.set(cat.slug, record);
    console.log(`  Processed category: ${cat.name}`);
  }

  // ---------------------------------------------------------------------------
  // 2. Products (6 Products)
  // ---------------------------------------------------------------------------
  console.log('🎨 Seeding Products...');
  const productDefs = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      title: 'Midnight Obsidian Beast',
      slug: 'midnight-obsidian-beast',
      description:
        'Hand-cast obsidian resin sculpture finished with 24k gold leaf accents. Limited collector run.',
      base_price: 350.0,
      status: 'published',
      category_id: categoryMap.get('sculptures')?.id,
    },
    {
      id: '20000000-0000-0000-0000-000000000002',
      title: 'Solar Eclipse Figurine',
      slug: 'solar-eclipse-figurine',
      description:
        'Polymer resin celestial figurine capturing the luminous corona during a total solar eclipse.',
      base_price: 275.0,
      status: 'published',
      category_id: categoryMap.get('sculptures')?.id,
    },
    {
      id: '20000000-0000-0000-0000-000000000003',
      title: 'Neon Tokyo Dreams Archival Print',
      slug: 'neon-tokyo-dreams-print',
      description:
        '12-color archival giclée print on 310gsm German etching paper. Hand-signed and numbered by Chris.',
      base_price: 120.0,
      status: 'published',
      category_id: categoryMap.get('prints')?.id,
    },
    {
      id: '20000000-0000-0000-0000-000000000004',
      title: 'Astral Horizon Holographic Print',
      slug: 'astral-horizon-holographic-print',
      description:
        'Custom screen-printed holographic foil artwork with shifting iridescent chromatic tones.',
      base_price: 95.0,
      status: 'published',
      category_id: categoryMap.get('prints')?.id,
    },
    {
      id: '20000000-0000-0000-0000-000000000005',
      title: 'Cyberpunk Heavyweight Hoodie',
      slug: 'cyberpunk-heavyweight-hoodie',
      description:
        '500gsm heavyweight french terry cotton hoodie featuring custom high-density chenille embroidery.',
      base_price: 140.0,
      status: 'published',
      category_id: categoryMap.get('wearables')?.id,
    },
    {
      id: '20000000-0000-0000-0000-000000000006',
      title: 'Glitch Artifact Ring',
      slug: 'glitch-artifact-ring',
      description:
        'Solid .925 sterling silver cast ring inspired by parametric digital distortion patterns.',
      base_price: 210.0,
      status: 'published',
      category_id: categoryMap.get('wearables')?.id,
    },
  ];

  const productMap = new Map<string, any>();
  for (const prod of productDefs) {
    const record = await upsertItem(client, 'products', prod.id, prod);
    productMap.set(prod.slug, record);
    console.log(`  Processed product: ${prod.title}`);
  }

  // ---------------------------------------------------------------------------
  // 3. Product Variations (13 Variations across 6 Products)
  // ---------------------------------------------------------------------------
  console.log('🏷️ Seeding Product Variations & Validating Price Fallback Rule...');
  const variationDefs = [
    // Midnight Obsidian Beast
    {
      id: '30000000-0000-0000-0000-000000000001',
      product_id: productMap.get('midnight-obsidian-beast')?.id,
      product_slug: 'midnight-obsidian-beast',
      sku: 'BEAST-OBS-STD',
      name: 'Standard Obsidian Edition',
      variation_name: 'Standard Obsidian Edition',
      price_override: null, // Fallback to 350.00
      stock_quantity: 15,
      is_limited_edition: true,
      total_edition_count: 50,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000002',
      product_id: productMap.get('midnight-obsidian-beast')?.id,
      product_slug: 'midnight-obsidian-beast',
      sku: 'BEAST-GLD-LTD',
      name: '24K Gold Leaf Inlay Edition',
      variation_name: '24K Gold Leaf Inlay Edition',
      price_override: 495.0, // Override: 495.00
      stock_quantity: 5,
      is_limited_edition: true,
      total_edition_count: 10,
      status: 'active',
    },

    // Solar Eclipse Figurine
    {
      id: '30000000-0000-0000-0000-000000000003',
      product_id: productMap.get('solar-eclipse-figurine')?.id,
      product_slug: 'solar-eclipse-figurine',
      sku: 'SOLAR-MTE-001',
      name: 'Matte Eclipse Edition',
      variation_name: 'Matte Eclipse Edition',
      price_override: null, // Fallback to 275.00
      stock_quantity: 20,
      is_limited_edition: true,
      total_edition_count: 30,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000004',
      product_id: productMap.get('solar-eclipse-figurine')?.id,
      product_slug: 'solar-eclipse-figurine',
      sku: 'SOLAR-CRM-002',
      name: 'Crimson Corona Edition',
      variation_name: 'Crimson Corona Edition',
      price_override: 310.0, // Override: 310.00
      stock_quantity: 8,
      is_limited_edition: true,
      total_edition_count: 15,
      status: 'active',
    },

    // Neon Tokyo Dreams Archival Print
    {
      id: '30000000-0000-0000-0000-000000000005',
      product_id: productMap.get('neon-tokyo-dreams-print')?.id,
      product_slug: 'neon-tokyo-dreams-print',
      sku: 'NTD-PRT-A2',
      name: 'A2 Archival Sheet (16x24)',
      variation_name: 'A2 Archival Sheet (16x24)',
      price_override: null, // Fallback to 120.00
      stock_quantity: 45,
      is_limited_edition: false,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000006',
      product_id: productMap.get('neon-tokyo-dreams-print')?.id,
      product_slug: 'neon-tokyo-dreams-print',
      sku: 'NTD-PRT-A1-FRM',
      name: "A1 Custom Framed Collector's Edition (24x36)",
      variation_name: "A1 Custom Framed Collector's Edition (24x36)",
      price_override: 260.0, // Override: 260.00
      stock_quantity: 10,
      is_limited_edition: true,
      total_edition_count: 25,
      status: 'active',
    },

    // Astral Horizon Holographic Print
    {
      id: '30000000-0000-0000-0000-000000000007',
      product_id: productMap.get('astral-horizon-holographic-print')?.id,
      product_slug: 'astral-horizon-holographic-print',
      sku: 'AST-HOLO-A3',
      name: 'A3 Holographic Foil (12x18)',
      variation_name: 'A3 Holographic Foil (12x18)',
      price_override: null, // Fallback to 95.00
      stock_quantity: 75,
      is_limited_edition: false,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000008',
      product_id: productMap.get('astral-horizon-holographic-print')?.id,
      product_slug: 'astral-horizon-holographic-print',
      sku: 'AST-HOLO-A2-LTD',
      name: 'A2 Limited Metallic Master (16x24)',
      variation_name: 'A2 Limited Metallic Master (16x24)',
      price_override: 165.0, // Override: 165.00
      stock_quantity: 20,
      release_date: '2026-10-15T18:00:00.000Z',
      is_limited_edition: true,
      total_edition_count: 25,
      status: 'coming_soon',
    },

    // Cyberpunk Heavyweight Hoodie
    {
      id: '30000000-0000-0000-0000-000000000009',
      product_id: productMap.get('cyberpunk-heavyweight-hoodie')?.id,
      product_slug: 'cyberpunk-heavyweight-hoodie',
      sku: 'CP-HD-BLK-M',
      name: 'Size Medium',
      variation_name: 'Size Medium',
      price_override: null, // Fallback to 140.00
      stock_quantity: 25,
      is_limited_edition: true,
      total_edition_count: 100,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000010',
      product_id: productMap.get('cyberpunk-heavyweight-hoodie')?.id,
      product_slug: 'cyberpunk-heavyweight-hoodie',
      sku: 'CP-HD-BLK-L',
      name: 'Size Large',
      variation_name: 'Size Large',
      price_override: null, // Fallback to 140.00
      stock_quantity: 30,
      is_limited_edition: true,
      total_edition_count: 100,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000011',
      product_id: productMap.get('cyberpunk-heavyweight-hoodie')?.id,
      product_slug: 'cyberpunk-heavyweight-hoodie',
      sku: 'CP-HD-BLK-XL',
      name: 'Size XL (Sold Out Edition)',
      variation_name: 'Size XL (Sold Out Edition)',
      price_override: null, // Fallback to 140.00
      stock_quantity: 0,
      is_limited_edition: true,
      total_edition_count: 50,
      status: 'sold_out',
    },

    // Glitch Artifact Ring
    {
      id: '30000000-0000-0000-0000-000000000012',
      product_id: productMap.get('glitch-artifact-ring')?.id,
      product_slug: 'glitch-artifact-ring',
      sku: 'GLITCH-RNG-09',
      name: 'Size 9 / US',
      variation_name: 'Size 9 / US',
      price_override: null, // Fallback to 210.00
      stock_quantity: 12,
      is_limited_edition: true,
      total_edition_count: 25,
      status: 'active',
    },
    {
      id: '30000000-0000-0000-0000-000000000013',
      product_id: productMap.get('glitch-artifact-ring')?.id,
      product_slug: 'glitch-artifact-ring',
      sku: 'GLITCH-RNG-10',
      name: 'Size 10 / US',
      variation_name: 'Size 10 / US',
      price_override: null, // Fallback to 210.00
      stock_quantity: 14,
      is_limited_edition: true,
      total_edition_count: 25,
      status: 'active',
    },
  ];

  for (const { product_slug, ...v } of variationDefs) {
    const parentProduct = productMap.get(product_slug);
    const effectivePrice = getEffectivePrice(parentProduct, v);
    await upsertItem(client, 'product_variations', v.id, v);
    console.log(
      `  Variation: [${v.sku}] ${v.name} -> Effective Price: $${effectivePrice.toFixed(2)}`
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Sample Test Order & Order Items
  // ---------------------------------------------------------------------------
  console.log('📦 Seeding Sample Test Order & Order Items...');
  const sampleOrder = {
    id: '40000000-0000-0000-0000-000000000001',
    stripe_checkout_session_id: 'cs_test_seed_session_001',
    stripe_payment_intent_id: 'pi_test_seed_intent_001',
    customer_email: 'art.collector@example.com',
    customer_name: 'Eleanor Vance',
    shipping_name: 'Eleanor Vance',
    shipping_address: {
      street: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'OR',
      postal_code: '97477',
      country: 'US',
    },
    amount_subtotal: 495.0,
    amount_tax: 39.6,
    amount_shipping: 0.0,
    amount_total: 534.6,
    total_amount: 534.6,
    status: 'paid',
    order_status: 'paid',
    shipping_status: 'unfulfilled',
    carrier: 'USPS',
    created_at: new Date().toISOString(),
  };

  const orderRecord = await upsertItem(client, 'orders', sampleOrder.id, sampleOrder);
  console.log(`  Processed sample order: #${orderRecord.id.slice(0, 8)}`);

  const sampleOrderItem = {
    id: '50000000-0000-0000-0000-000000000001',
    order_id: orderRecord.id,
    product_variation_id: '30000000-0000-0000-0000-000000000002', // 24K Gold Leaf Inlay Edition
    variation_id: '30000000-0000-0000-0000-000000000002',
    quantity: 1,
    unit_price: 495.0,
  };

  await upsertItem(client, 'order_items', sampleOrderItem.id, sampleOrderItem);
  console.log('  Processed sample order item');

  // ---------------------------------------------------------------------------
  // 5. Sample Processed Stripe Event
  // ---------------------------------------------------------------------------
  console.log('⚡ Seeding Processed Stripe Event (Idempotency Log)...');
  const sampleEvent = {
    id: 'evt_test_seed_webhook_001',
    event_type: 'checkout.session.completed',
    processed_at: new Date().toISOString(),
  };

  await upsertItem(client, 'processed_stripe_events', sampleEvent.id, sampleEvent);
  console.log(`  Processed idempotency event log: ${sampleEvent.id}`);

  console.log('\n🎉 Directus CMS database seed completed successfully!');
  console.log(`Summary:`);
  console.log(`  - Categories: ${categoryDefs.length}`);
  console.log(`  - Products: ${productDefs.length}`);
  console.log(`  - Product Variations: ${variationDefs.length}`);
  console.log(`  - Sample Orders: 1`);

  return {
    categoriesCount: categoryDefs.length,
    productsCount: productDefs.length,
    variationsCount: variationDefs.length,
    ordersCount: 1,
  };
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase().catch((err) => {
    console.error('❌ Directus database seed failed:', err);
    process.exit(1);
  });
}
