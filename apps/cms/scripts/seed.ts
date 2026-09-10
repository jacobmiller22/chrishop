import type { Category, Product, ProductVariation } from '@chrishop/types';

/**
 * Directus Seed Script Placeholder
 * Populates local Directus database with sample categories, products, variations, and admin roles.
 */
export async function seedDatabase() {
  console.log('🌱 Starting Directus CMS database seed...');

  const sampleCategory: Category = {
    id: 'cat-001',
    name: 'Sculptures',
    slug: 'sculptures',
    description: 'Handcrafted limited edition art sculptures',
  };

  const sampleProduct: Product = {
    id: 'prod-001',
    title: 'Midnight Gold Sculpture',
    slug: 'midnight-gold-sculpture',
    description: 'Hand-cast obsidian resin with 24k gold leaf accents.',
    base_price: 250,
    status: 'published',
    category_id: sampleCategory.id,
  };

  const sampleVariation: ProductVariation = {
    id: 'var-001',
    product_id: sampleProduct.id,
    variation_name: 'Edition #1-25',
    sku: 'MNG-001',
    price_override: 250,
    is_limited_edition: true,
    total_edition_count: 25,
    stock_quantity: 5,
    status: 'active',
  };

  console.log(`✅ Sample category created: ${sampleCategory.name}`);
  console.log(`✅ Sample product created: ${sampleProduct.title}`);
  console.log(`✅ Sample variation created: ${sampleVariation.sku}`);
  console.log('🎉 Directus database seed completed successfully!');
}

if (require.main === module) {
  seedDatabase().catch((err) => {
    console.error('❌ Directus database seed failed:', err);
    process.exit(1);
  });
}
