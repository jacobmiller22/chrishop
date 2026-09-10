import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Categories,
  Products,
  ProductVariations,
  Media,
  Users,
} from '../src/collections/index';
import payloadConfig, { getD1Binding, d1Adapter } from '../payload.config';
import type { Field } from 'payload';

describe('Story 2.18: Payload CMS v3 Collections & Schema Specification', () => {
  describe('Categories Collection', () => {
    it('should have correct slug and admin title settings', () => {
      assert.equal(Categories.slug, 'categories');
      assert.equal(Categories.admin?.useAsTitle, 'name');
    });

    it('should define required taxonomy fields per HLD Section 3.2', () => {
      const fieldMap = new Map((Categories.fields as Field[]).map((f: any) => [f.name, f]));

      // name
      const nameField: any = fieldMap.get('name');
      assert.ok(nameField, 'name field must exist');
      assert.equal(nameField.type, 'text');
      assert.equal(nameField.required, true);

      // slug
      const slugField: any = fieldMap.get('slug');
      assert.ok(slugField, 'slug field must exist');
      assert.equal(slugField.type, 'text');
      assert.equal(slugField.required, true);
      assert.equal(slugField.unique, true);
      assert.equal(slugField.index, true);

      // description
      const descField: any = fieldMap.get('description');
      assert.ok(descField, 'description field must exist');
      assert.equal(descField.type, 'textarea');

      // image (upload relation to media)
      const imageField: any = fieldMap.get('image');
      assert.ok(imageField, 'image field must exist');
      assert.equal(imageField.type, 'upload');
      assert.equal(imageField.relationTo, 'media');
    });
  });

  describe('Products Collection', () => {
    it('should have correct slug and admin title settings', () => {
      assert.equal(Products.slug, 'products');
      assert.equal(Products.admin?.useAsTitle, 'title');
    });

    it('should define core editorial fields per HLD Section 3.2', () => {
      const fieldMap = new Map((Products.fields as Field[]).map((f: any) => [f.name, f]));

      // title
      const titleField: any = fieldMap.get('title');
      assert.ok(titleField, 'title field must exist');
      assert.equal(titleField.type, 'text');
      assert.equal(titleField.required, true);

      // slug
      const slugField: any = fieldMap.get('slug');
      assert.ok(slugField, 'slug field must exist');
      assert.equal(slugField.type, 'text');
      assert.equal(slugField.required, true);
      assert.equal(slugField.unique, true);
      assert.equal(slugField.index, true);

      // shopify_product_id
      const shopifyIdField: any = fieldMap.get('shopify_product_id');
      assert.ok(shopifyIdField, 'shopify_product_id field must exist');
      assert.equal(shopifyIdField.type, 'text');
      assert.equal(shopifyIdField.unique, true);
      assert.equal(shopifyIdField.index, true);

      // base_price
      const priceField: any = fieldMap.get('base_price');
      assert.ok(priceField, 'base_price field must exist');
      assert.equal(priceField.type, 'number');
      assert.equal(priceField.required, true);
      assert.equal(priceField.min, 0);

      // status
      const statusField: any = fieldMap.get('status');
      assert.ok(statusField, 'status field must exist');
      assert.equal(statusField.type, 'select');
      assert.equal(statusField.required, true);
      assert.equal(statusField.defaultValue, 'draft');
      const statusOptions = statusField.options.map((opt: any) =>
        typeof opt === 'string' ? opt : opt.value
      );
      assert.deepEqual(statusOptions, ['draft', 'scheduled', 'active', 'archived']);

      // category_id
      const catField: any = fieldMap.get('category_id');
      assert.ok(catField, 'category_id field must exist');
      assert.equal(catField.type, 'relationship');
      assert.equal(catField.relationTo, 'categories');

      // featured_image & gallery
      const featField: any = fieldMap.get('featured_image');
      assert.ok(featField, 'featured_image field must exist');
      assert.equal(featField.type, 'upload');
      assert.equal(featField.relationTo, 'media');

      const galleryField: any = fieldMap.get('gallery');
      assert.ok(galleryField, 'gallery field must exist');
      assert.equal(galleryField.type, 'array');

      // artist_statement & description
      const statementField: any = fieldMap.get('artist_statement');
      assert.ok(statementField, 'artist_statement field must exist');
      assert.equal(statementField.type, 'textarea');

      const descField: any = fieldMap.get('description');
      assert.ok(descField, 'description field must exist');
      assert.equal(descField.type, 'richText');
    });
  });

  describe('ProductVariations Collection & Architecture Invariants', () => {
    it('should have correct slug and admin title settings', () => {
      assert.equal(ProductVariations.slug, 'product_variations');
      assert.equal(ProductVariations.admin?.useAsTitle, 'variation_name');
    });

    it('should define variation fields matching HLD Section 3.2', () => {
      const fieldMap = new Map((ProductVariations.fields as Field[]).map((f: any) => [f.name, f]));

      // product_id
      const prodField: any = fieldMap.get('product_id');
      assert.ok(prodField, 'product_id field must exist');
      assert.equal(prodField.type, 'relationship');
      assert.equal(prodField.relationTo, 'products');
      assert.equal(prodField.required, true);

      // shopify_variant_id
      const varIdField: any = fieldMap.get('shopify_variant_id');
      assert.ok(varIdField, 'shopify_variant_id field must exist');
      assert.equal(varIdField.type, 'text');
      assert.equal(varIdField.unique, true);
      assert.equal(varIdField.index, true);

      // variation_name
      const nameField: any = fieldMap.get('variation_name');
      assert.ok(nameField, 'variation_name field must exist');
      assert.equal(nameField.type, 'text');
      assert.equal(nameField.required, true);

      // sku
      const skuField: any = fieldMap.get('sku');
      assert.ok(skuField, 'sku field must exist');
      assert.equal(skuField.type, 'text');
      assert.equal(skuField.required, true);
      assert.equal(skuField.unique, true);
      assert.equal(skuField.index, true);

      // price_override
      const priceField: any = fieldMap.get('price_override');
      assert.ok(priceField, 'price_override field must exist');
      assert.equal(priceField.type, 'number');
      assert.equal(priceField.min, 0);

      // is_limited_edition & total_edition_count
      const ltdField: any = fieldMap.get('is_limited_edition');
      assert.ok(ltdField, 'is_limited_edition field must exist');
      assert.equal(ltdField.type, 'checkbox');
      assert.equal(ltdField.defaultValue, true);

      const countField: any = fieldMap.get('total_edition_count');
      assert.ok(countField, 'total_edition_count field must exist');
      assert.equal(countField.type, 'number');

      // release_date
      const dateField: any = fieldMap.get('release_date');
      assert.ok(dateField, 'release_date field must exist');
      assert.equal(dateField.type, 'date');

      // status
      const statusField: any = fieldMap.get('status');
      assert.ok(statusField, 'status field must exist');
      assert.equal(statusField.type, 'select');
      assert.equal(statusField.required, true);
      assert.equal(statusField.defaultValue, 'coming_soon');
      const statusOptions = statusField.options.map((opt: any) =>
        typeof opt === 'string' ? opt : opt.value
      );
      assert.deepEqual(statusOptions, ['coming_soon', 'active', 'sold_out', 'archived']);
    });

    it('ENFORCES ARCHITECTURAL INVARIANT: Mutable live inventory is NOT stored in D1 schema', () => {
      const fieldNames = (ProductVariations.fields as Field[]).map((f: any) => f.name);

      // Assert that live stock quantity column is strictly absent from the D1 schema
      // to eliminate dual-write split-brain anomalies with Shopify
      assert.ok(
        !fieldNames.includes('stock_quantity'),
        'stock_quantity must NOT be stored in D1 schema (queried dynamically from Shopify)'
      );
      assert.ok(
        !fieldNames.includes('inventory_quantity'),
        'inventory_quantity must NOT be stored in D1 schema'
      );
      assert.ok(
        !fieldNames.includes('live_stock'),
        'live_stock must NOT be stored in D1 schema'
      );
    });
  });

  describe('Supporting Collections (Media & Users)', () => {
    it('should configure Media collection with upload enabled', () => {
      assert.equal(Media.slug, 'media');
      assert.ok(Media.upload, 'Media collection must have upload enabled');
    });

    it('should configure Users collection with auth enabled', () => {
      assert.equal(Users.slug, 'users');
      assert.ok(Users.auth, 'Users collection must have auth enabled');
      assert.equal(Users.admin?.useAsTitle, 'email');
    });
  });

  describe('Payload Configuration & D1 Adapter Binding', () => {
    it('should export d1Adapter alias matching DEP_PAYLOAD_CMS.md', () => {
      assert.equal(typeof d1Adapter, 'function');
    });

    it('should resolve D1 binding gracefully across environments', () => {
      const binding = getD1Binding();
      assert.ok(typeof binding === 'object' || typeof binding === 'string');
    });

    it('should successfully build sanitized Payload config with D1 adapter and registered collections', async () => {
      const config = await payloadConfig;
      assert.ok(config, 'Config should build successfully');

      // Verify registered collection slugs
      const slugs = config.collections.map((c) => c.slug);
      assert.ok(slugs.includes('categories'), 'categories collection registered');
      assert.ok(slugs.includes('products'), 'products collection registered');
      assert.ok(slugs.includes('product_variations'), 'product_variations collection registered');
      assert.ok(slugs.includes('media'), 'media collection registered');
      assert.ok(slugs.includes('users'), 'users collection registered');

      // Verify db adapter
      assert.ok(config.db, 'Database adapter must be configured');
      assert.equal(config.db.name, 'd1-sqlite', 'Database adapter should be d1-sqlite');

      // Verify admin user
      assert.equal(config.admin.user, 'users');

      // Verify secret is non-empty
      assert.ok(config.secret && config.secret.length >= 32);
    });
  });
});
