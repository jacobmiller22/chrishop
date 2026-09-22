/**
 * Shopify Admin API Client & In-Process Mock Engine
 *
 * Provides bidirectional communication with the Shopify Admin GraphQL API
 * for editorial product synchronization (Story 2.22).
 *
 * CRITICAL ARCHITECTURAL INVARIANT (Zero Inventory Overwrites):
 * Under NO circumstances does this client update, sync, or mutate Shopify
 * inventory quantities, variant stock levels, or available quantities.
 * Shopify is the sole authoritative source of truth for inventory.
 */

export interface ShopifyAdminProductInput {
  id?: string;
  title: string;
  descriptionHtml?: string;
  tags?: string[];
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  handle?: string;
}

export interface ShopifyAdminProductResponse {
  id: string;
  title: string;
  handle?: string;
  tags?: string[];
  status?: string;
  descriptionHtml?: string;
}

export interface ShopifyAdminMutationResult {
  success: boolean;
  product?: ShopifyAdminProductResponse;
  userErrors?: Array<{ field: string[]; message: string }>;
  error?: string;
}

export interface ShopifyAdminClientConfig {
  storeDomain?: string;
  adminToken?: string;
  apiVersion?: string;
  useMock?: boolean;
}

// ============================================================================
// 1. Strict Domain Isolation Guard
// ============================================================================

const FORBIDDEN_INVENTORY_KEYS = [
  'inventoryquantities',
  'inventoryitem',
  'availablequantity',
  'stock_quantity',
  'inventory_quantity',
  'inventorylevels',
  'variants',
];

/**
 * Validates that an input payload strictly excludes any inventory-altering fields.
 * Throws a SecurityError if inventory fields are detected.
 */
export function assertNoInventoryFields(input: Record<string, unknown>): void {
  const keys = Object.keys(input);
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_INVENTORY_KEYS.includes(lower)) {
      throw new Error(
        `[ShopifyAdmin:SecurityViolation] Prohibited inventory field "${key}" detected in editorial sync payload. ` +
          `Shopify is the sole authoritative source of truth for stock; Payload CMS must NEVER overwrite inventory levels.`
      );
    }
  }
}

// ============================================================================
// 2. In-Process Mock Engine for Local Dev & Testing
// ============================================================================

export class ShopifyAdminMockEngine {
  private mockProducts = new Map<string, ShopifyAdminProductResponse>();
  public createdHistory: ShopifyAdminProductInput[] = [];
  public updatedHistory: ShopifyAdminProductInput[] = [];
  private nextMockId = 9182736450;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    this.mockProducts.set('gid://shopify/Product/8849102837461', {
      id: 'gid://shopify/Product/8849102837461',
      title: 'Chest Rig System - Standard Edition',
      handle: 'chest-rig-standard',
      tags: ['category:packs', 'edition:standard', 'bankbeaters'],
      status: 'ACTIVE',
      descriptionHtml: '<p>Ultralight field-tested chest rig</p>',
    });
  }

  public reset(): void {
    this.mockProducts.clear();
    this.createdHistory = [];
    this.updatedHistory = [];
    this.nextMockId = 9182736450;
    this.seedDefaults();
  }

  public createProduct(input: ShopifyAdminProductInput): ShopifyAdminMutationResult {
    assertNoInventoryFields(input as unknown as Record<string, unknown>);

    this.createdHistory.push({ ...input });
    const id = `gid://shopify/Product/${this.nextMockId++}`;
    const product: ShopifyAdminProductResponse = {
      id,
      title: input.title,
      handle: input.handle || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tags: input.tags || [],
      status: input.status || 'ACTIVE',
      descriptionHtml: input.descriptionHtml,
    };

    this.mockProducts.set(id, product);
    return { success: true, product };
  }

  public updateProduct(input: ShopifyAdminProductInput): ShopifyAdminMutationResult {
    assertNoInventoryFields(input as unknown as Record<string, unknown>);

    if (!input.id) {
      return {
        success: false,
        error: 'Product ID is required for productUpdate mutation',
        userErrors: [{ field: ['id'], message: 'Product ID must be provided' }],
      };
    }

    this.updatedHistory.push({ ...input });
    const existing = this.mockProducts.get(input.id);
    const updated: ShopifyAdminProductResponse = {
      id: input.id,
      title: input.title ?? existing?.title ?? 'Updated Product',
      handle: input.handle ?? existing?.handle,
      tags: input.tags ?? existing?.tags ?? [],
      status: input.status ?? existing?.status ?? 'ACTIVE',
      descriptionHtml: input.descriptionHtml ?? existing?.descriptionHtml,
    };

    this.mockProducts.set(input.id, updated);
    return { success: true, product: updated };
  }

  public getProduct(id: string): ShopifyAdminProductResponse | null {
    return this.mockProducts.get(id) || null;
  }
}

export const defaultShopifyAdminMock = new ShopifyAdminMockEngine();

// ============================================================================
// 3. Unified Shopify Admin Client (GraphQL API)
// ============================================================================

export class ShopifyAdminClient {
  private storeDomain: string;
  private adminToken: string;
  private apiVersion: string;
  private explicitMock?: boolean;
  public mockEngine: ShopifyAdminMockEngine;

  constructor(config: ShopifyAdminClientConfig = {}) {
    this.storeDomain = config.storeDomain || process.env.SHOPIFY_STORE_DOMAIN || 'chrishop-dev.myshopify.com';
    this.adminToken = config.adminToken || process.env.SHOPIFY_ADMIN_TOKEN || '';
    this.apiVersion = config.apiVersion || '2025-01';
    this.explicitMock = config.useMock;
    this.mockEngine = defaultShopifyAdminMock;
  }

  public isMockMode(): boolean {
    if (typeof this.explicitMock === 'boolean') {
      return this.explicitMock;
    }

    const flagMock =
      process.env.FLAG_ENABLE_WIREMOCK === 'true' ||
      process.env.FLAG_ENABLE_WIREMOCK === '1' ||
      process.env.SHOPIFY_USE_MOCK === 'true';

    if (flagMock) {
      return true;
    }

    // Default to mock mode if token is missing or placeholder
    if (!this.adminToken || this.adminToken.includes('placeholder') || this.adminToken.includes('mock')) {
      return true;
    }

    if (this.storeDomain.includes('placeholder') || this.storeDomain.includes('mock')) {
      return true;
    }

    return false;
  }

  /**
   * Creates a new product on Shopify with editorial metadata only.
   * Strips/blocks any inventory fields to preserve Shopify as the sole inventory authority.
   */
  public async createProduct(input: ShopifyAdminProductInput): Promise<ShopifyAdminMutationResult> {
    assertNoInventoryFields(input as unknown as Record<string, unknown>);

    if (this.isMockMode()) {
      return this.mockEngine.createProduct(input);
    }

    const mutation = `
      mutation ProductCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            tags
            status
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const cleanInput: Record<string, unknown> = {
      title: input.title,
      status: input.status || 'ACTIVE',
    };
    if (input.descriptionHtml) cleanInput.descriptionHtml = input.descriptionHtml;
    if (input.tags && input.tags.length > 0) cleanInput.tags = input.tags;
    if (input.handle) cleanInput.handle = input.handle;

    try {
      const endpoint = `https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.adminToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { input: cleanInput },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        return {
          success: false,
          error: `Shopify Admin API HTTP ${response.status}: ${errorText}`,
        };
      }

      const json = (await response.json()) as any;
      if (json.errors && json.errors.length > 0) {
        return {
          success: false,
          error: json.errors.map((e: any) => e.message).join('; '),
        };
      }

      const userErrors = json.data?.productCreate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        return {
          success: false,
          userErrors,
          error: userErrors.map((e: any) => e.message).join('; '),
        };
      }

      const product = json.data?.productCreate?.product;
      return {
        success: true,
        product,
      };
    } catch (err: any) {
      console.error('[ShopifyAdmin:CreateProductException]', err);
      return {
        success: false,
        error: err?.message || String(err),
      };
    }
  }

  /**
   * Updates existing product editorial metadata on Shopify.
   * Strips/blocks any inventory fields to preserve Shopify as the sole inventory authority.
   */
  public async updateProduct(input: ShopifyAdminProductInput): Promise<ShopifyAdminMutationResult> {
    assertNoInventoryFields(input as unknown as Record<string, unknown>);

    if (!input.id) {
      return {
        success: false,
        error: 'Product ID is required for productUpdate',
      };
    }

    if (this.isMockMode()) {
      return this.mockEngine.updateProduct(input);
    }

    const mutation = `
      mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
            tags
            status
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const cleanInput: Record<string, unknown> = {
      id: input.id,
      title: input.title,
    };
    if (input.descriptionHtml) cleanInput.descriptionHtml = input.descriptionHtml;
    if (input.tags) cleanInput.tags = input.tags;
    if (input.status) cleanInput.status = input.status;
    if (input.handle) cleanInput.handle = input.handle;

    try {
      const endpoint = `https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.adminToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { input: cleanInput },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        return {
          success: false,
          error: `Shopify Admin API HTTP ${response.status}: ${errorText}`,
        };
      }

      const json = (await response.json()) as any;
      if (json.errors && json.errors.length > 0) {
        return {
          success: false,
          error: json.errors.map((e: any) => e.message).join('; '),
        };
      }

      const userErrors = json.data?.productUpdate?.userErrors;
      if (userErrors && userErrors.length > 0) {
        return {
          success: false,
          userErrors,
          error: userErrors.map((e: any) => e.message).join('; '),
        };
      }

      const product = json.data?.productUpdate?.product;
      return {
        success: true,
        product,
      };
    } catch (err: any) {
      console.error('[ShopifyAdmin:UpdateProductException]', err);
      return {
        success: false,
        error: err?.message || String(err),
      };
    }
  }

  /**
   * Retrieves product editorial metadata by GID.
   */
  public async getProduct(id: string): Promise<ShopifyAdminProductResponse | null> {
    if (this.isMockMode()) {
      return this.mockEngine.getProduct(id);
    }

    const query = `
      query ProductGet($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          tags
          status
          descriptionHtml
        }
      }
    `;

    try {
      const endpoint = `https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.adminToken,
        },
        body: JSON.stringify({
          query,
          variables: { id },
        }),
      });

      if (!response.ok) return null;
      const json = (await response.json()) as any;
      return json.data?.product || null;
    } catch (err) {
      console.error('[ShopifyAdmin:GetProductException]', err);
      return null;
    }
  }
}

export const shopifyAdmin = new ShopifyAdminClient();
