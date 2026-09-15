/**
 * ChrisShop In-Process Shopify Storefront API WireMock / Simulator
 *
 * Provides a mock GraphQL response engine for local development and integration tests
 * without requiring live Shopify credentials.
 */

export interface MockCartLine {
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
  public lastBuyerIp: string | null = null;
  public requestHistory: Array<{ query: string; variables: any; buyerIp?: string }> = [];

  constructor(public domain: string = 'chrishop-dev.myshopify.com') {}

  createCart(lines: MockCartLine[] = []): MockCart {
    const cartId = `gid://shopify/Cart/mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const checkoutUrl = `https://${this.domain}/checkouts/c/${encodeURIComponent(cartId)}?key=mock_key`;

    const cart: MockCart = {
      id: cartId,
      checkoutUrl,
      totalQuantity: lines.reduce((sum, l) => sum + (l.quantity || 1), 0),
      lines: lines.map((l, idx) => ({
        id: `gid://shopify/CartLine/${idx + 1}`,
        quantity: l.quantity,
        merchandise: {
          id: l.merchandiseId,
          title: 'The Bushwhack Storm Anorak',
          price: { amount: '340.00', currencyCode: 'USD' },
        },
      })),
    };

    this.carts.set(cartId, cart);
    return cart;
  }

  getCart(cartId: string): MockCart | null {
    return this.carts.get(cartId) || null;
  }

  async handleGraphQLRequest(query: string, variables: any = {}, buyerIp?: string): Promise<any> {
    this.lastBuyerIp = buyerIp || null;
    this.requestHistory.push({ query, variables, buyerIp });

    // 1. cartCreate mutation
    if (query.includes('cartCreate')) {
      const lines = variables?.input?.lines || [];
      const cart = this.createCart(lines);
      return {
        data: {
          cartCreate: {
            cart: {
              id: cart.id,
              checkoutUrl: cart.checkoutUrl,
              totalQuantity: cart.totalQuantity,
              lines: {
                edges: cart.lines.map((l) => ({ node: l })),
              },
            },
            userErrors: [],
          },
        },
      };
    }

    // 2. cartLinesAdd mutation
    if (query.includes('cartLinesAdd')) {
      const cartId = variables?.cartId;
      const newLines: MockCartLine[] = variables?.lines || [];
      let cart = this.getCart(cartId);
      if (!cart) {
        cart = this.createCart(newLines);
      }
      return {
        data: {
          cartLinesAdd: {
            cart: {
              id: cart.id,
              checkoutUrl: cart.checkoutUrl,
              totalQuantity: cart.totalQuantity + newLines.reduce((s, l) => s + l.quantity, 0),
            },
            userErrors: [],
          },
        },
      };
    }

    // 3. Products query
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

    return { data: {} };
  }
}

export const defaultShopifyMock = new ShopifyStorefrontMockEngine();
