/**
 * Shared Data Model Interfaces for Chris's Shop E-Commerce Platform
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
}

export type ProductStatus = 'draft' | 'published' | 'archived';

export interface Product {
  id: string;
  title: string;
  slug: string;
  description?: string;
  base_price: number;
  status: ProductStatus;
  /** High-resolution hero/banner image URL or Cloudflare R2 asset key */
  hero_image?: string;
  /** Primary catalog thumbnail / card preview image URL or Cloudflare R2 asset key */
  featured_image?: string;
  gallery?: string[];
  category_id?: string;
}

export type VariationStatus = 'coming_soon' | 'active' | 'sold_out' | 'archived';

export interface ProductVariation {
  id: string;
  product_id: string;
  name?: string;
  variation_name: string;
  sku: string;
  price_override?: number | null;
  is_limited_edition: boolean;
  total_edition_count?: number | null;
  stock_quantity: number;
  release_date?: string | null;
  status: VariationStatus;
}

// Alias Variation for convenience
export type Variation = ProductVariation;

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export type OrderStatus =
  'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type ShippingStatus = 'unfulfilled' | 'shipped' | 'delivered';

export interface Order {
  id: string;
  shopify_order_id?: string;
  shopify_order_number?: string;
  shopify_checkout_url?: string;
  customer_email: string;
  customer_name?: string;
  shipping_name: string;
  shipping_address: ShippingAddress;
  order_status: OrderStatus;
  shipping_status: ShippingStatus;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  shippo_transaction_id?: string;
  label_url?: string;
  rate_id?: string;
  amount_subtotal?: number;
  amount_tax?: number;
  amount_shipping?: number;
  amount_total: number;
  currency?: string;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variation_id: string;
  shopify_variant_id?: string;
  unit_price: number;
  quantity: number;
}

export interface ProcessedShopifyEvent {
  id: string;
  event_type: string;
  processed_at: string;
}

/**
 * Price Fallback Resolution Rule (HIGH_LEVEL_DESIGN Section 3.2):
 * effective_price = COALESCE(variation.price_override, product.base_price)
 *
 * Resolves the unit price by falling back to the parent product's base_price
 * if the variation does not specify an explicit price_override.
 *
 * @param product - Base product object containing base_price
 * @param variation - Product variation object optionally containing price_override
 * @returns The effective numeric purchase price
 */
export function getEffectivePrice(
  product: Pick<Product, 'base_price'>,
  variation?: Pick<ProductVariation, 'price_override'> | null
): number {
  if (variation?.price_override != null && !Number.isNaN(Number(variation.price_override))) {
    return Number(variation.price_override);
  }
  return Number(product.base_price);
}
