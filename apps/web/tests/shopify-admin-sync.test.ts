import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  shopifyAdmin,
  defaultShopifyAdminMock,
  ShopifyAdminClient,
  assertNoInventoryFields,
  type ShopifyAdminProductInput,
} from '../src/lib/shopify-admin';
import { syncProductToShopify } from '../src/collections/hooks/syncProductToShopify';

describe('Story 2.22: Payload CMS afterChange Product Sync to Shopify Admin API', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    defaultShopifyAdminMock.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    defaultShopifyAdminMock.reset();
  });

  // ==========================================================================
  // 1. Strict Domain Isolation (Zero Inventory Overwrites)
  // ==========================================================================
  describe('1. Strict Domain Isolation Guard', () => {
    it('should permit clean editorial product metadata without inventory keys', () => {
      const cleanInput: Record<string, unknown> = {
        title: 'Leadville Anorak',
        descriptionHtml: '<p>Ultralight waterproof-breathable shell</p>',
        tags: ['category:apparel', 'bankbeaters'],
        status: 'ACTIVE',
        handle: 'leadville-anorak',
      };

      assert.doesNotThrow(() => {
        assertNoInventoryFields(cleanInput);
      });
    });

    it('should throw SecurityViolation if inventoryQuantities is included', () => {
      const hostileInput: Record<string, unknown> = {
        title: 'Leadville Anorak',
        inventoryQuantities: [{ availableQuantity: 10, locationId: '123' }],
      };

      assert.throws(
        () => assertNoInventoryFields(hostileInput),
        /Prohibited inventory field "inventoryQuantities" detected/
      );
    });

    it('should throw SecurityViolation if stock_quantity or inventory_quantity is included', () => {
      const inputWithStock = {
        title: 'Reel Pouch',
        stock_quantity: 5,
      };

      assert.throws(
        () => assertNoInventoryFields(inputWithStock),
        /Prohibited inventory field "stock_quantity" detected/
      );

      const inputWithInventory = {
        title: 'Reel Pouch',
        inventory_quantity: 5,
      };

      assert.throws(
        () => assertNoInventoryFields(inputWithInventory),
        /Prohibited inventory field "inventory_quantity" detected/
      );
    });

    it('should throw SecurityViolation if variants array is included in editorial payload', () => {
      const inputWithVariants = {
        title: 'Titanium Reel',
        variants: [{ sku: 'REEL-01', price: '320.00' }],
      };

      assert.throws(
        () => assertNoInventoryFields(inputWithVariants),
        /Prohibited inventory field "variants" detected/
      );
    });
  });

  // ==========================================================================
  // 2. Shopify Admin Mock Engine & Client
  // ==========================================================================
  describe('2. Shopify Admin Client & Mock Engine', () => {
    it('should provision a new product and return a valid Shopify GID in mock mode', async () => {
      const input: ShopifyAdminProductInput = {
        title: 'Alpine Chest Pack v2',
        descriptionHtml: '<p>Handmade in Leadville workshop</p>',
        tags: ['category:packs', 'origin:Leadville'],
        status: 'ACTIVE',
        handle: 'alpine-chest-pack-v2',
      };

      const result = await shopifyAdmin.createProduct(input);
      assert.equal(result.success, true);
      assert.ok(result.product);
      assert.match(result.product.id, /^gid:\/\/shopify\/Product\/\d+$/);
      assert.equal(result.product.title, 'Alpine Chest Pack v2');
      assert.deepEqual(result.product.tags, ['category:packs', 'origin:Leadville']);

      assert.equal(defaultShopifyAdminMock.createdHistory.length, 1);
      assert.equal(defaultShopifyAdminMock.createdHistory[0].title, 'Alpine Chest Pack v2');
    });

    it('should update an existing product editorial metadata in mock mode', async () => {
      const targetId = 'gid://shopify/Product/8849102837461';
      const input: ShopifyAdminProductInput = {
        id: targetId,
        title: 'Chest Rig System - Mark II Refined',
        tags: ['category:packs', 'edition:mark-ii', 'bankbeaters'],
        status: 'ACTIVE',
      };

      const result = await shopifyAdmin.updateProduct(input);
      assert.equal(result.success, true);
      assert.ok(result.product);
      assert.equal(result.product.id, targetId);
      assert.equal(result.product.title, 'Chest Rig System - Mark II Refined');

      assert.equal(defaultShopifyAdminMock.updatedHistory.length, 1);
      assert.equal(defaultShopifyAdminMock.updatedHistory[0].id, targetId);
    });

    it('should return error when attempting to update without a product ID', async () => {
      const input: ShopifyAdminProductInput = {
        title: 'Missing ID Product',
      };

      const result = await shopifyAdmin.updateProduct(input);
      assert.equal(result.success, false);
      assert.ok(result.error);
    });

    it('should force mock mode when FLAG_ENABLE_WIREMOCK is true', () => {
      process.env.FLAG_ENABLE_WIREMOCK = 'true';
      process.env.SHOPIFY_ADMIN_TOKEN = 'shpat_authentic_token_value_99999';

      const client = new ShopifyAdminClient();
      assert.equal(client.isMockMode(), true);
    });
  });

  // ==========================================================================
  // 3. Payload CMS afterChange Collection Hook (syncProductToShopify)
  // ==========================================================================
  describe('3. Payload CMS syncProductToShopify afterChange Hook', () => {
    it('should provision product in Shopify and persist GID to D1 when shopify_product_id is missing', async () => {
      const updatedD1Records: Array<{ collection?: string; id: string; data: any; context?: any }> = [];

      const mockReq: any = {
        context: {},
        payload: {
          update: async (args: any) => {
            updatedD1Records.push(args);
            return args.data;
          },
        },
      };

      const doc = {
        id: 'prod-alpine-anorak',
        title: 'Alpine Storm Anorak',
        slug: 'alpine-storm-anorak',
        category: 'apparel',
        materials: 'Dyneema Composite Fabric',
        status: 'active',
        maker_field_notes: 'Tested in 40kt gusts on Mount Massive',
        shopify_product_id: null,
      };

      const returnedDoc = await (syncProductToShopify as any)({
        doc,
        req: mockReq,
        operation: 'create',
        collection: { slug: 'products' },
        previousDoc: null,
      });

      // 1. Verify returned doc has Shopify GID attached
      assert.ok(returnedDoc.shopify_product_id);
      assert.match(returnedDoc.shopify_product_id, /^gid:\/\/shopify\/Product\/\d+$/);

      // 2. Verify D1 persistence call was dispatched
      assert.equal(updatedD1Records.length, 1);
      assert.equal(updatedD1Records[0].collection, 'products');
      assert.equal(updatedD1Records[0].id, 'prod-alpine-anorak');
      assert.equal(updatedD1Records[0].data.shopify_product_id, returnedDoc.shopify_product_id);
      assert.equal(updatedD1Records[0].context.skipShopifySync, true, 'Must skip sync to prevent infinite loop');

      // 3. Verify Shopify Admin mock engine recorded creation
      assert.equal(defaultShopifyAdminMock.createdHistory.length, 1);
      const created = defaultShopifyAdminMock.createdHistory[0];
      assert.equal(created.title, 'Alpine Storm Anorak');
      assert.ok(created.tags?.includes('category:apparel'));
      assert.ok(created.tags?.includes('material:Dyneema Composite Fabric'));
      assert.equal(created.status, 'ACTIVE');

      // 4. Invariant: ZERO inventory or variant stock fields passed
      assert.equal((created as any).variants, undefined);
      assert.equal((created as any).inventoryQuantities, undefined);
    });

    it('should update editorial metadata in Shopify when shopify_product_id already exists', async () => {
      const existingGid = 'gid://shopify/Product/8849102837461';

      const mockReq: any = {
        context: {},
        payload: {
          update: async () => {},
        },
      };

      const doc = {
        id: 'prod-chest-rig',
        title: 'Chest Rig System - Field Spec Update',
        slug: 'chest-rig-standard',
        category: 'packs',
        materials: 'Ultra-PE 200d',
        origin: 'Leadville, CO',
        status: 'active',
        shopify_product_id: existingGid,
        description: {
          root: {
            children: [
              {
                children: [{ text: 'Updated field notes and weatherproofing.' }],
              },
            ],
          },
        },
      };

      const returnedDoc = await (syncProductToShopify as any)({
        doc,
        req: mockReq,
        operation: 'update',
        collection: { slug: 'products' } as any,
        previousDoc: null,
      });

      assert.equal(returnedDoc.shopify_product_id, existingGid);

      // Verify update mutation was dispatched
      assert.equal(defaultShopifyAdminMock.updatedHistory.length, 1);
      const updated = defaultShopifyAdminMock.updatedHistory[0];
      assert.equal(updated.id, existingGid);
      assert.equal(updated.title, 'Chest Rig System - Field Spec Update');
      assert.ok(updated.tags?.includes('category:packs'));
      assert.ok(updated.tags?.includes('material:Ultra-PE 200d'));
      assert.ok(updated.descriptionHtml?.includes('Updated field notes and weatherproofing'));

      // Invariant: ZERO inventory fields
      assert.equal((updated as any).variants, undefined);
      assert.equal((updated as any).inventoryQuantities, undefined);
    });

    it('should respect req.context.skipShopifySync to avoid recursion', async () => {
      const mockReq: any = {
        context: { skipShopifySync: true },
      };

      const doc = {
        id: 'prod-skip-test',
        title: 'Recursive Prevention Test',
        shopify_product_id: null,
      };

      const returnedDoc = await (syncProductToShopify as any)({
        doc,
        req: mockReq,
        operation: 'update',
        collection: { slug: 'products' } as any,
        previousDoc: null,
      });

      assert.equal(returnedDoc.shopify_product_id, null);
      assert.equal(defaultShopifyAdminMock.createdHistory.length, 0);
      assert.equal(defaultShopifyAdminMock.updatedHistory.length, 0);
    });

    it('should gracefully handle Shopify Admin API errors without crashing Payload save', async () => {
      // Mock createProduct failure
      const originalCreate = shopifyAdmin.createProduct;
      (shopifyAdmin as any).createProduct = async () => {
        return {
          success: false,
          error: 'Shopify Admin rate limit exceeded (HTTP 429)',
        };
      };

      try {
        const mockReq: any = {
          context: {},
          payload: { update: async () => {} },
        };

        const doc = {
          id: 'prod-failing-sync',
          title: 'Resilient Failure Item',
          shopify_product_id: null,
        };

        // Must NOT throw
        const returnedDoc = await (syncProductToShopify as any)({
          doc,
          req: mockReq,
          operation: 'create',
          collection: { slug: 'products' } as any,
          previousDoc: null,
        });

        assert.equal(returnedDoc.title, 'Resilient Failure Item');
        assert.equal(returnedDoc.shopify_product_id, null);
      } finally {
        (shopifyAdmin as any).createProduct = originalCreate;
      }
    });

    it('should map draft status to Shopify DRAFT and archived to ARCHIVED', async () => {
      const docDraft = {
        id: 'prod-draft',
        title: 'Draft Prototype Rig',
        status: 'draft',
        shopify_product_id: null,
      };

      await (syncProductToShopify as any)({
        doc: docDraft,
        req: { context: {} } as any,
        operation: 'create',
        collection: { slug: 'products' } as any,
        previousDoc: null,
      });

      assert.equal(defaultShopifyAdminMock.createdHistory[0].status, 'DRAFT');

      const docArchived = {
        id: 'prod-archived',
        title: 'Archived Legacy Pack',
        status: 'archived',
        shopify_product_id: null,
      };

      await (syncProductToShopify as any)({
        doc: docArchived,
        req: { context: {} } as any,
        operation: 'create',
        collection: { slug: 'products' } as any,
        previousDoc: null,
      });

      assert.equal(defaultShopifyAdminMock.createdHistory[1].status, 'ARCHIVED');
    });
  });
});
