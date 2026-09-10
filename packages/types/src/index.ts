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
  featured_image?: string;
  gallery?: string[];
  category_id?: string;
}

export type VariationStatus = 'coming_soon' | 'active' | 'sold_out' | 'archived';

export interface ProductVariation {
  id: string;
  product_id: string;
  variation_name: string;
  sku: string;
  price_override?: number;
  is_limited_edition: boolean;
  total_edition_count?: number;
  stock_quantity: number;
  release_date?: string;
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

export type OrderStatus = 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type ShippingStatus = 'unfulfilled' | 'shipped' | 'delivered';

export interface Order {
  id: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  customer_email: string;
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
  amount_subtotal: number;
  amount_tax: number;
  amount_shipping: number;
  amount_total: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variation_id: string;
  unit_price: number;
  quantity: number;
}

export interface ProcessedStripeEvent {
  id: string;
  event_type: string;
  processed_at: string;
}
