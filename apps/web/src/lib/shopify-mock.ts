/**
 * ChrisShop In-Process Shopify Storefront API WireMock / Simulator
 *
 * Provides a mock GraphQL response engine for local development and integration tests
 * without requiring live Shopify credentials.
 * Supports full cart lifecycle (create, add, update, remove, fetch),
 * realistic checkout URLs, and simulated inventory / out-of-stock states.
 */

export interface MockCartLine {
  id?: string;
  merchandiseId: string;
  quantity: number;
}

export interface MockCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: Array<{
    id: string;
    quantity: number;
    merchandise: {
      id: string;
      title: string;
      price: { amount: string; currencyCode: string };
    };
  }>;
}

export class ShopifyStorefrontMockEngine {
  private carts = new Map<string, MockCart>();
  private inventory = new Map<string, number>();
  private outOfStockVariants = new Set<string>();
  private rateLimitRemainingAttempts = 0;
  private rateLimitOptions: { retryAfterSec?: number; errorType?: '429' | 'THROTTLED' } = {};
  public throttledRequestsCount = 0;
  public lastBuyerIp: string | null = null;
  public requestHistory: Array<{ query: string; variables: any; buyerIp?: string }> = [];

  constructor(public domain: string = 'chrishop-dev.myshopify.com') {}

  /**
   * Resets all internal in-memory state (carts, inventory, history)
   */
  reset(): void {
    this.carts.clear();
    this.inventory.clear();
    this.outOfStockVariants.clear();
    this.rateLimitRemainingAttempts = 0;
    this.rateLimitOptions = {};
    this.throttledRequestsCount = 0;
    this.lastBuyerIp = null;
    this.requestHistory = [];
  }

  /**
   * Configures available inventory for a merchandise/variant ID
   */
  setInventory(variantId: string, availableQuantity: number): void {
    this.inventory.set(variantId, availableQuantity);
    if (availableQuantity <= 0) {
      this.outOfStockVariants.add(variantId);
    } else {
      this.outOfStockVariants.delete(variantId);
    }
  }

  /**
   * Simulates an out-of-stock status for a variant
   */
  simulateOutOfStock(variantId: string): void {
    this.outOfStockVariants.add(variantId);
    this.inventory.set(variantId, 0);
  }

  setVariantStock(variantId: string, availableQuantity: number): void {
    this.setInventory(variantId, availableQuantity);
  }

  setVariantSoldOut(variantId: string): void {
    this.simulateOutOfStock(variantId);
  }

  /**
   * Configures the mock engine to simulate rate limiting / throttling for the next N requests.
   */
  simulateRateLimit(
    attempts: number = 1,
    options: { retryAfterSec?: number; errorType?: '429' | 'THROTTLED' } = {}
  ): void {
    this.rateLimitRemainingAttempts = attempts;
    this.rateLimitOptions = {
      retryAfterSec: options.retryAfterSec ?? 1,
      errorType: options.errorType ?? 'THROTTLED',
    };
  }

  getThrottledRequestsCount(): number {
    return this.throttledRequestsCount;
  }

  /**
   * Checks if requested quantity is available for variant
   */
  private checkStock(
    variantId: string,
    quantity: number
  ): { available: boolean; message?: string } {
    if (this.outOfStockVariants.has(variantId)) {
      return { available: false, message: `The item ${variantId} is currently out of stock.` };
    }
    const maxQty = this.inventory.get(variantId);
    if (maxQty !== undefined && quantity > maxQty) {
      return {
        available: false,
        message: `Requested quantity (${quantity}) exceeds available stock (${maxQty}).`,
      };
    }
    return { available: true };
  }

  /**
   * Formats a cart for GraphQL responses
   */
  private formatCart(cart: MockCart) {
    return {
      id: cart.id,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      lines: {
        edges: cart.lines.map((l) => ({ node: l })),
      },
    };
  }

  createCart(lines: MockCartLine[] = []): { cart: MockCart | null; userErrors: any[] } {
    // Validate inventory for each line
    for (const l of lines) {
      const stock = this.checkStock(l.merchandiseId, l.quantity || 1);
      if (!stock.available) {
        return {
          cart: null,
          userErrors: [
            {
              code: 'OUT_OF_STOCK',
              field: ['lines', 'merchandiseId'],
              message: stock.message || 'The requested quantity is not available.',
            },
          ],
        };
      }
    }

    const cartId = `gid://shopify/Cart/mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const checkoutUrl = `https://${this.domain}/checkouts/c/${encodeURIComponent(cartId)}?key=mock_key`;

    const cart: MockCart = {
      id: cartId,
      checkoutUrl,
      totalQuantity: lines.reduce((sum, l) => sum + (l.quantity || 1), 0),
      lines: lines.map((l, idx) => ({
        id: l.id || `gid://shopify/CartLine/${idx + 1}`,
        quantity: l.quantity || 1,
        merchandise: {
          id: l.merchandiseId,
          title: 'The Bushwhack Storm Anorak',
          price: { amount: '340.00', currencyCode: 'USD' },
        },
      })),
    };

    this.carts.set(cartId, cart);
    return { cart, userErrors: [] };
  }

  getCart(cartId: string): MockCart | null {
    return this.carts.get(cartId) || null;
  }

  addCartLines(
    cartId: string,
    newLines: MockCartLine[]
  ): { cart: MockCart | null; userErrors: any[] } {
    let cart = this.getCart(cartId);
    if (!cart) {
      return this.createCart(newLines);
    }

    for (const l of newLines) {
      const stock = this.checkStock(l.merchandiseId, l.quantity || 1);
      if (!stock.available) {
        return {
          cart: null,
          userErrors: [
            {
              code: 'OUT_OF_STOCK',
              field: ['lines', 'merchandiseId'],
              message: stock.message || 'The requested quantity is not available.',
            },
          ],
        };
      }
    }

    for (const l of newLines) {
      const existing = cart.lines.find((line) => line.merchandise.id === l.merchandiseId);
      if (existing) {
        existing.quantity += l.quantity || 1;
      } else {
        const nextId = `gid://shopify/CartLine/${cart.lines.length + 1}`;
        cart.lines.push({
          id: nextId,
          quantity: l.quantity || 1,
          merchandise: {
            id: l.merchandiseId,
            title: 'The Bushwhack Storm Anorak',
            price: { amount: '340.00', currencyCode: 'USD' },
          },
        });
      }
    }

    cart.totalQuantity = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
    return { cart, userErrors: [] };
  }

  updateCartLines(
    cartId: string,
    lines: Array<{ id: string; quantity: number }>
  ): { cart: MockCart | null; userErrors: any[] } {
    const cart = this.getCart(cartId);
    if (!cart) {
      return {
        cart: null,
        userErrors: [{ code: 'CART_NOT_FOUND', field: ['cartId'], message: 'Cart not found' }],
      };
    }

    for (const item of lines) {
      const targetLine = cart.lines.find((l) => l.id === item.id);
      if (targetLine) {
        if (item.quantity <= 0) {
          cart.lines = cart.lines.filter((l) => l.id !== item.id);
        } else {
          const stock = this.checkStock(targetLine.merchandise.id, item.quantity);
          if (!stock.available) {
            return {
              cart: null,
              userErrors: [
                {
                  code: 'OUT_OF_STOCK',
                  field: ['lines', 'quantity'],
                  message: stock.message || 'The requested quantity is not available.',
                },
              ],
            };
          }
          targetLine.quantity = item.quantity;
        }
      }
    }

    cart.totalQuantity = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
    return { cart, userErrors: [] };
  }

  removeCartLines(cartId: string, lineIds: string[]): { cart: MockCart | null; userErrors: any[] } {
    const cart = this.getCart(cartId);
    if (!cart) {
      return {
        cart: null,
        userErrors: [{ code: 'CART_NOT_FOUND', field: ['cartId'], message: 'Cart not found' }],
      };
    }

    const removeSet = new Set(lineIds);
    cart.lines = cart.lines.filter((l) => !removeSet.has(l.id));
    cart.totalQuantity = cart.lines.reduce((sum, l) => sum + l.quantity, 0);

    return { cart, userErrors: [] };
  }

  async handleGraphQLRequest(query: string, variables: any = {}, buyerIp?: string): Promise<any> {
    this.lastBuyerIp = buyerIp || null;
    this.requestHistory.push({ query, variables, buyerIp });

    if (this.rateLimitRemainingAttempts > 0) {
      this.rateLimitRemainingAttempts--;
      this.throttledRequestsCount++;
      if (this.rateLimitOptions.errorType === '429') {
        const err: any = new Error('Shopify Storefront API error: 429 Too Many Requests');
        err.status = 429;
        err.headers = {
          'Retry-After': String(this.rateLimitOptions.retryAfterSec ?? 1),
        };
        throw err;
      }
      return {
        data: null,
        errors: [
          {
            message: 'Throttled by Shopify Storefront API rate limiter (leaky bucket bucket exhausted)',
            extensions: {
              code: 'THROTTLED',
              documentation: 'https://shopify.dev/docs/api/usage/rate-limits',
            },
          },
        ],
      };
    }

    // 1. cartCreate mutation
    if (query.includes('cartCreate')) {
      const lines = variables?.input?.lines || [];
      const result = this.createCart(lines);
      return {
        data: {
          cartCreate: {
            cart: result.cart ? this.formatCart(result.cart) : null,
            userErrors: result.userErrors,
          },
        },
      };
    }

    // 2. cartLinesAdd mutation
    if (query.includes('cartLinesAdd')) {
      const cartId = variables?.cartId;
      const newLines: MockCartLine[] = variables?.lines || [];
      const result = this.addCartLines(cartId, newLines);
      return {
        data: {
          cartLinesAdd: {
            cart: result.cart ? this.formatCart(result.cart) : null,
            userErrors: result.userErrors,
          },
        },
      };
    }

    // 3. cartLinesUpdate mutation
    if (query.includes('cartLinesUpdate')) {
      const cartId = variables?.cartId;
      const lines = variables?.lines || [];
      const result = this.updateCartLines(cartId, lines);
      return {
        data: {
          cartLinesUpdate: {
            cart: result.cart ? this.formatCart(result.cart) : null,
            userErrors: result.userErrors,
          },
        },
      };
    }

    // 4. cartLinesRemove mutation
    if (query.includes('cartLinesRemove')) {
      const cartId = variables?.cartId;
      const lineIds = variables?.lineIds || [];
      const result = this.removeCartLines(cartId, lineIds);
      return {
        data: {
          cartLinesRemove: {
            cart: result.cart ? this.formatCart(result.cart) : null,
            userErrors: result.userErrors,
          },
        },
      };
    }

    // 4b. cartBuyerIdentityUpdate mutation
    if (query.includes('cartBuyerIdentityUpdate')) {
      const cartId = variables?.cartId;
      const buyerIdentity = variables?.buyerIdentity;
      const cart = this.getCart(cartId);
      if (!cart) {
        return {
          data: {
            cartBuyerIdentityUpdate: {
              cart: null,
              userErrors: [{ code: 'CART_NOT_FOUND', field: ['cartId'], message: 'Cart not found' }],
            },
          },
        };
      }
      if (buyerIdentity?.countryCode) {
        const separator = cart.checkoutUrl.includes('?') ? '&' : '?';
        cart.checkoutUrl = `${cart.checkoutUrl}${separator}locale=${buyerIdentity.countryCode.toLowerCase()}`;
      }
      return {
        data: {
          cartBuyerIdentityUpdate: {
            cart: this.formatCart(cart),
            userErrors: [],
          },
        },
      };
    }

    // 5. cart query (getCart)
    if (query.includes('cart(') || query.includes('query getCart') || query.includes('cart(id:')) {
      const cartId = variables?.id || variables?.cartId;
      const cart = this.getCart(cartId);
      return {
        data: {
          cart: cart ? this.formatCart(cart) : null,
        },
      };
    }

    // 6. Product price and availability query
    if (
      query.includes('getProductPriceAndAvailability') ||
      (query.includes('product(') &&
        (query.includes('priceRange') || query.includes('availableForSale')))
    ) {
      const productId = variables?.id || 'gid://shopify/Product/101';
      const variant1Stock = this.outOfStockVariants.has('gid://shopify/ProductVariant/201')
        ? 0
        : (this.inventory.get('gid://shopify/ProductVariant/201') ?? 12);
      const variant2Stock = this.outOfStockVariants.has('gid://shopify/ProductVariant/202')
        ? 0
        : (this.inventory.get('gid://shopify/ProductVariant/202') ?? 3);

      return {
        data: {
          product: {
            id: productId,
            title: 'The Bushwhack Storm Anorak',
            availableForSale: variant1Stock > 0 || variant2Stock > 0,
            priceRange: {
              minVariantPrice: { amount: '340.00', currencyCode: 'USD' },
              maxVariantPrice: { amount: '385.00', currencyCode: 'USD' },
            },
            variants: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/201',
                    title: 'Field Olive — Standard Run',
                    sku: 'BB-ANO-OLV-001',
                    availableForSale: variant1Stock > 0,
                    quantityAvailable: variant1Stock,
                    price: { amount: '340.00', currencyCode: 'USD' },
                  },
                },
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/202',
                    title: 'Deadstock Duck Camo Pocket Edition',
                    sku: 'BB-ANO-CAM-002',
                    availableForSale: variant2Stock > 0,
                    quantityAvailable: variant2Stock,
                    price: { amount: '385.00', currencyCode: 'USD' },
                  },
                },
              ],
            },
          },
        },
      };
    }

    // 7. Variant stock / Node query
    if (
      query.includes('getVariantStock') ||
      (query.includes('node(') && query.includes('ProductVariant'))
    ) {
      const variantId = variables?.id || 'gid://shopify/ProductVariant/201';
      const isOutOfStock = this.outOfStockVariants.has(variantId);
      const qty = isOutOfStock ? 0 : (this.inventory.get(variantId) ?? 10);

      return {
        data: {
          node: {
            id: variantId,
            title: 'Field Olive — Standard Run',
            sku: 'BB-ANO-OLV-001',
            availableForSale: !isOutOfStock && qty > 0,
            quantityAvailable: qty,
            price: { amount: '340.00', currencyCode: 'USD' },
          },
        },
      };
    }

    // 8. Products query
    if (query.includes('products')) {
      return {
        data: {
          products: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/Product/101',
                  title: 'The Bushwhack Storm Anorak',
                  handle: 'bushwhack-storm-anorak',
                  variants: {
                    edges: [
                      {
                        node: {
                          id: 'gid://shopify/ProductVariant/201',
                          title: 'Field Olive — Standard Run',
                          availableForSale: true,
                          price: { amount: '340.00', currencyCode: 'USD' },
                        },
                      },
                      {
                        node: {
                          id: 'gid://shopify/ProductVariant/202',
                          title: 'Deadstock Duck Camo Pocket Edition',
                          availableForSale: true,
                          price: { amount: '385.00', currencyCode: 'USD' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      };
    }

    // 9. Shop info query
    if (query.includes('shop') && !query.includes('Product')) {
      return {
        data: {
          shop: {
            id: 'gid://shopify/Shop/8291029384',
            name: 'ChrisShop Leadville Workshop',
            description: 'Handcrafted alpine angling gear and fine art',
            primaryDomain: {
              host: this.domain,
              url: `https://${this.domain}`,
            },
            paymentSettings: {
              currencyCode: 'USD',
              countryCode: 'US',
              supportedCardBrands: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS'],
            },
            shipsToCountries: ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'],
          },
        },
      };
    }

    return { data: {} };
  }
}

export const defaultShopifyMock = new ShopifyStorefrontMockEngine();
