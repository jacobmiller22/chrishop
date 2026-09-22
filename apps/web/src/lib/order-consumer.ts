import crypto from 'node:crypto';
import {
  ResendNotificationProvider,
  WebhookNotificationProvider,
  formatCarrierTrackingUrl,
  type OrderReceiptPayload,
  type OrderItemReceipt,
  type ShippingUpdatePayload,
  type EmailDispatchResult,
  type WebhookDispatchResult,
} from '@chrishop/notifications';
import type { Order, ShippingAddress } from '@chrishop/types';

export { formatCarrierTrackingUrl, type ShippingUpdatePayload };

/**
 * Validates Shopify HMAC-SHA256 signature using timing-safe comparison.
 */
export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) {
    return true;
  }
  if (!rawBody || !hmacHeader) {
    return false;
  }

  try {
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    const expectedBuffer = Buffer.from(computedHmac, 'utf8');
    const actualBuffer = Buffer.from(hmacHeader, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

/**
 * Validates Shopify HMAC-SHA256 signature using Web Crypto API (crypto.subtle)
 * with constant-time comparison for Cloudflare Edge and Node.js runtimes.
 */
export async function verifyShopifyWebhookHmacSubtle(
  rawBody: string,
  hmacHeader: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) {
    return true;
  }
  if (!rawBody || !hmacHeader) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const subtle =
      globalThis.crypto?.subtle ||
      ((await import('node:crypto')).webcrypto as unknown as Crypto)?.subtle;

    if (!subtle) {
      return verifyShopifyWebhookHmac(rawBody, hmacHeader, secret);
    }

    const key = await subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const bodyData = encoder.encode(rawBody);
    const signatureBuffer = await subtle.sign('HMAC', key, bodyData);

    const signatureBytes = new Uint8Array(signatureBuffer);
    let binary = '';
    for (let i = 0; i < signatureBytes.byteLength; i++) {
      binary += String.fromCharCode(signatureBytes[i]);
    }
    const computedHmac =
      typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(signatureBuffer).toString('base64');

    const expectedBuffer = Buffer.from(computedHmac, 'utf8');
    const actualBuffer = Buffer.from(hmacHeader, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    const nodeCrypto = await import('node:crypto').catch(() => null);
    if (nodeCrypto && typeof nodeCrypto.timingSafeEqual === 'function') {
      return nodeCrypto.timingSafeEqual(expectedBuffer, actualBuffer);
    }

    let mismatch = 0;
    for (let i = 0; i < expectedBuffer.length; i++) {
      mismatch |= expectedBuffer[i] ^ actualBuffer[i];
    }
    return mismatch === 0;
  } catch (err) {
    console.warn('[ShopifyWebhook:HmacSubtleError]', err);
    return false;
  }
}

// ============================================================================
// 1. Types & Data Contracts
// ============================================================================

export const LOW_STOCK_THRESHOLD = 3;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_INITIAL_RETRY_DELAY_SECONDS = 5;

export interface ShopifyLineItem {
  id?: number | string;
  title: string;
  variant_title?: string;
  name?: string;
  sku?: string;
  quantity: number;
  price: string | number;
  stock_quantity?: number;
  remaining_stock?: number;
  inventory_quantity?: number;
  variant_id?: number | string;
}

export interface ShopifyFulfillment {
  id?: number | string;
  order_id?: number | string;
  status?: string;
  tracking_company?: string;
  carrier?: string;
  tracking_number?: string;
  tracking_numbers?: string[];
  tracking_url?: string;
  tracking_urls?: string[];
  line_items?: ShopifyLineItem[];
  created_at?: string;
  updated_at?: string;
}

export interface ShopifyOrderWebhookPayload {
  id: number | string;
  name?: string;
  order_number?: number | string;
  email?: string;
  contact_email?: string;
  customer_email?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    name?: string;
  };
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    address1?: string;
    address2?: string;
    street?: string;
    city?: string;
    province?: string;
    state?: string;
    zip?: string;
    postal_code?: string;
    country?: string;
  };
  shipping_name?: string;
  customer_name?: string;
  total_price?: string | number;
  amount_total?: number;
  subtotal_price?: string | number;
  amount_subtotal?: number;
  total_shipping?: string | number;
  total_shipping_price_set?: {
    shop_money?: { amount: string };
  };
  amount_shipping?: number;
  total_tax?: string | number;
  amount_tax?: number;
  currency?: string;
  financial_status?: string;
  order_status?: string;
  fulfillment_status?: string | null;
  shipping_status?: string;
  line_items?: ShopifyLineItem[];
  fulfillments?: ShopifyFulfillment[];
  created_at?: string;
  shopify_order_id?: string;
  shopify_order_number?: string;
}

export interface LowStockInventoryTarget {
  productTitle: string;
  variationName: string;
  remainingStock: number;
  sku?: string;
}

export interface OrderQueueMessage {
  topic: 'orders/create' | 'orders/paid' | string;
  order: Order | ShopifyOrderWebhookPayload;
  timestamp?: string;
  eventId?: string;
  remainingStockMap?: Record<string, LowStockInventoryTarget>;
  lowStockItems?: LowStockInventoryTarget[];
}

export interface QueueRetryOptions {
  delaySeconds?: number;
}

export interface QueueMessage<T = unknown> {
  readonly id: string;
  readonly timestamp: Date | string | number;
  readonly body: T;
  readonly attempts: number;
  retry(options?: QueueRetryOptions): void | Promise<void>;
  ack(): void | Promise<void>;
}

export interface QueueMessageBatch<T = unknown> {
  readonly queue: string;
  readonly messages: readonly QueueMessage<T>[];
  retryAll?(options?: QueueRetryOptions): void | Promise<void>;
  ackAll?(): void | Promise<void>;
}

export interface OrderConsumerEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  EMAIL_FROM?: string;
  MERCHANT_ALERT_EMAIL?: string;
  OPS_ALERT_WEBHOOK_URL?: string;
  DISCORD_WEBHOOK_STORE_ORDERS?: string;
  DISCORD_WEBHOOK_ORDERS?: string;
  DISCORD_WEBHOOK_URL?: string;
  NEXT_CACHE_WORKERS_KV?: any;
  SHOPIFY_ORDERS_QUEUE?: {
    send(message: any): Promise<void>;
  };
  SHOPIFY_ORDERS_DLQ?: {
    send(message: any): Promise<void>;
  };
  FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS?: string;
  DISABLE_RESEND_CUSTOMER_RECEIPTS?: string;
  [key: string]: any;
}

export interface OrderConsumerOptions {
  resendProvider?: ResendNotificationProvider;
  webhookProvider?: WebhookNotificationProvider;
  maxRetries?: number;
  initialRetryDelaySeconds?: number;
  backoffMultiplier?: number;
  lowStockThreshold?: number;
  disableCustomerReceipts?: boolean;
}

export interface MessageProcessingResult {
  messageId: string;
  success: boolean;
  action: 'acked' | 'retried' | 'dead_lettered';
  customerEmailSent: boolean;
  merchantAlertSent: boolean;
  lowStockAlertsSent: number;
  opsAlertSent: boolean;
  error?: string;
  retryDelaySeconds?: number;
  attempts: number;
}

export interface OrderConsumerBatchResult {
  total: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
  results: MessageProcessingResult[];
}

// ============================================================================
// 2. Normalization Helpers
// ============================================================================

/**
 * Normalizes raw Shopify order webhooks or normalized Order domain entities
 * into standardized representations for Resend receipts and merchant alerts.
 */
export function normalizeOrderEvent(
  orderInput: Order | ShopifyOrderWebhookPayload
): {
  order: Order;
  receipt: OrderReceiptPayload;
  rawLineItems: ShopifyLineItem[];
} {
  const anyOrder = orderInput as any;

  // 1. Order Identification
  const rawId = String(anyOrder.id || anyOrder.shopify_order_id || 'unknown');
  const orderId = rawId.includes('/') ? rawId.split('/').pop() || rawId : rawId;
  const orderNumber =
    anyOrder.shopify_order_number ||
    anyOrder.name ||
    (anyOrder.order_number ? `#${anyOrder.order_number}` : `#${orderId.slice(0, 8)}`);

  // 2. Customer Email & Name Resolution
  const customerEmail =
    anyOrder.customer_email ||
    anyOrder.email ||
    anyOrder.contact_email ||
    anyOrder.customer?.email ||
    'customer@example.com';

  const customerName =
    anyOrder.customer_name ||
    anyOrder.shipping_name ||
    (anyOrder.customer?.first_name
      ? `${anyOrder.customer.first_name} ${anyOrder.customer.last_name || ''}`.trim()
      : anyOrder.shipping_address?.name) ||
    'Customer';

  // 3. Shipping Address Resolution
  const rawAddr = anyOrder.shipping_address || {};
  const shippingAddress: ShippingAddress = {
    street:
      rawAddr.street ||
      rawAddr.address1 ||
      (rawAddr.address2 ? `${rawAddr.address1} ${rawAddr.address2}` : '') ||
      '123 Gallery Way',
    city: rawAddr.city || 'Los Angeles',
    state: rawAddr.state || rawAddr.province || 'CA',
    postal_code: rawAddr.postal_code || rawAddr.zip || '90210',
    country: rawAddr.country || 'US',
  };

  // 4. Financial Calculations
  const amountTotal =
    typeof anyOrder.amount_total === 'number'
      ? anyOrder.amount_total
      : parseFloat(String(anyOrder.total_price || '0')) || 0;

  const amountSubtotal =
    typeof anyOrder.amount_subtotal === 'number'
      ? anyOrder.amount_subtotal
      : parseFloat(String(anyOrder.subtotal_price || '0')) || amountTotal;

  const amountShipping =
    typeof anyOrder.amount_shipping === 'number'
      ? anyOrder.amount_shipping
      : parseFloat(
          String(
            anyOrder.total_shipping ||
              anyOrder.total_shipping_price_set?.shop_money?.amount ||
              '0'
          )
        ) || 0;

  const amountTax =
    typeof anyOrder.amount_tax === 'number'
      ? anyOrder.amount_tax
      : parseFloat(String(anyOrder.total_tax || '0')) || 0;

  // 5. Line Items Extraction
  const rawLineItems: ShopifyLineItem[] = Array.isArray(anyOrder.line_items)
    ? anyOrder.line_items
    : [
        {
          title: 'Artwork Drop Edition',
          quantity: 1,
          price: amountTotal,
          sku: 'ART-DROP-01',
        },
      ];

  const receiptItems: OrderItemReceipt[] = rawLineItems.map((item) => {
    const unitPrice =
      typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0')) || 0;
    return {
      title: item.title || item.name || 'Artwork Item',
      variation_name: item.variant_title || undefined,
      sku: item.sku || 'SKU-PENDING',
      quantity: Number(item.quantity) || 1,
      unit_price: unitPrice,
    };
  });

  // 6. Normalized Order Entity
  const normalizedOrder: Order = {
    id: orderId,
    shopify_order_id: anyOrder.shopify_order_id || `gid://shopify/Order/${orderId}`,
    shopify_order_number: orderNumber,
    customer_email: customerEmail,
    customer_name: customerName,
    shipping_name: customerName,
    shipping_address: shippingAddress,
    order_status: (anyOrder.order_status || anyOrder.financial_status === 'paid'
      ? 'paid'
      : 'processing') as any,
    shipping_status: (anyOrder.shipping_status || anyOrder.fulfillment_status || 'unfulfilled') as any,
    amount_subtotal: amountSubtotal,
    amount_shipping: amountShipping,
    amount_tax: amountTax,
    amount_total: amountTotal,
    currency: anyOrder.currency || 'USD',
    created_at: anyOrder.created_at || new Date().toISOString(),
  };

  // 7. Receipt Payload for Customer Email
  const receiptPayload: OrderReceiptPayload = {
    order_id: orderId,
    order_number: orderNumber,
    customer_name: customerName,
    customer_email: customerEmail,
    items: receiptItems,
    amount_subtotal: amountSubtotal,
    amount_shipping: amountShipping,
    amount_tax: amountTax,
    amount_total: amountTotal,
    shipping_address: shippingAddress,
    created_at: normalizedOrder.created_at,
  };

  return {
    order: normalizedOrder,
    receipt: receiptPayload,
    rawLineItems,
  };
}

/**
 * Normalizes a Shopify fulfillment webhook event (orders/fulfilled, fulfillments/create, etc.)
 * into a structured ShippingUpdatePayload with accurate carrier tracking URLs.
 */
export function extractFulfillmentData(
  topic: string,
  payload: any
): ShippingUpdatePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  // Detect whether the payload is an Order with fulfillments or a direct Fulfillment entity
  const isDirectFulfillment =
    topic.startsWith('fulfillments/') ||
    ('tracking_company' in payload && 'order_id' in payload);

  let carrier = 'USPS';
  let trackingNumber = '';
  let trackingUrl = '';
  let orderNumber = '';
  let orderId = '';
  let customerEmail = '';
  let customerName = 'Customer';
  let items: Array<{ title: string; variation_name?: string; quantity: number }> = [];

  if (isDirectFulfillment) {
    // Direct fulfillment payload (fulfillments/create or fulfillments/update)
    carrier = payload.tracking_company || payload.carrier || 'USPS';
    trackingNumber =
      payload.tracking_number ||
      (Array.isArray(payload.tracking_numbers) && payload.tracking_numbers[0]) ||
      '';
    const rawTrackingUrl =
      payload.tracking_url ||
      (Array.isArray(payload.tracking_urls) && payload.tracking_urls[0]) ||
      '';
    trackingUrl = formatCarrierTrackingUrl(carrier, trackingNumber, rawTrackingUrl);

    orderId = String(payload.order_id || payload.id || '');
    orderNumber =
      payload.order_name ||
      (payload.order_number ? `#${payload.order_number}` : '') ||
      (payload.order_id ? `#${payload.order_id}` : `#${payload.id}`);

    customerEmail =
      payload.email ||
      payload.customer_email ||
      payload.destination?.email ||
      payload.customer?.email ||
      'customer@example.com';

    customerName =
      payload.customer_name ||
      payload.destination?.name ||
      (payload.destination?.first_name
        ? `${payload.destination.first_name} ${payload.destination.last_name || ''}`.trim()
        : 'Customer');

    if (Array.isArray(payload.line_items)) {
      items = payload.line_items.map((item: any) => ({
        title: item.title || item.name || 'Equipment Item',
        variation_name: item.variant_title || undefined,
        quantity: Number(item.quantity) || 1,
      }));
    }
  } else {
    // Order payload (orders/fulfilled, orders/partially_fulfilled, or orders/updated)
    orderId = String(payload.id || '');
    orderNumber =
      payload.name ||
      (payload.order_number ? `#${payload.order_number}` : '') ||
      (payload.shopify_order_number ? `#${payload.shopify_order_number}` : '') ||
      `#${orderId}`;

    customerEmail =
      payload.customer_email ||
      payload.email ||
      payload.contact_email ||
      payload.customer?.email ||
      'customer@example.com';

    customerName =
      payload.customer_name ||
      payload.shipping_name ||
      (payload.customer?.first_name
        ? `${payload.customer.first_name} ${payload.customer.last_name || ''}`.trim()
        : '') ||
      payload.shipping_address?.name ||
      'Customer';

    const fulfillments = Array.isArray(payload.fulfillments) ? payload.fulfillments : [];
    const latestFulfillment = fulfillments.length > 0 ? fulfillments[fulfillments.length - 1] : null;

    if (latestFulfillment) {
      carrier = latestFulfillment.tracking_company || latestFulfillment.carrier || 'USPS';
      trackingNumber =
        latestFulfillment.tracking_number ||
        (Array.isArray(latestFulfillment.tracking_numbers) && latestFulfillment.tracking_numbers[0]) ||
        '';
      const rawTrackingUrl =
        latestFulfillment.tracking_url ||
        (Array.isArray(latestFulfillment.tracking_urls) && latestFulfillment.tracking_urls[0]) ||
        '';
      trackingUrl = formatCarrierTrackingUrl(carrier, trackingNumber, rawTrackingUrl);

      if (Array.isArray(latestFulfillment.line_items) && latestFulfillment.line_items.length > 0) {
        items = latestFulfillment.line_items.map((item: any) => ({
          title: item.title || item.name || 'Equipment Item',
          variation_name: item.variant_title || undefined,
          quantity: Number(item.quantity) || 1,
        }));
      }
    } else {
      // Fallback if fulfillments array is empty but status was fulfilled
      carrier = payload.carrier || payload.tracking_company || 'USPS';
      trackingNumber = payload.tracking_number || '';
      trackingUrl = formatCarrierTrackingUrl(carrier, trackingNumber, payload.tracking_url);
    }

    if (items.length === 0 && Array.isArray(payload.line_items)) {
      items = payload.line_items.map((item: any) => ({
        title: item.title || item.name || 'Equipment Item',
        variation_name: item.variant_title || undefined,
        quantity: Number(item.quantity) || 1,
      }));
    }
  }

  return {
    order_id: orderId,
    order_number: orderNumber,
    customer_name: customerName,
    customer_email: customerEmail,
    carrier,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    items,
  };
}

// ============================================================================
// 3. Low-Stock Target Discovery
// ============================================================================

/**
 * Extracts low stock targets from message metadata and line items
 * where remaining stock is at or below the threshold (default: <= 3).
 */
export function extractLowStockTargets(
  message: OrderQueueMessage,
  lineItems: ShopifyLineItem[],
  threshold: number = LOW_STOCK_THRESHOLD
): LowStockInventoryTarget[] {
  const targets: LowStockInventoryTarget[] = [];
  const seenKeys = new Set<string>();

  // 1. Explicit low stock items array
  if (Array.isArray(message.lowStockItems)) {
    for (const item of message.lowStockItems) {
      if (item && item.remainingStock <= threshold) {
        const key = `${item.productTitle}:${item.variationName}:${item.sku || ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          targets.push(item);
        }
      }
    }
  }

  // 2. Explicit remaining stock map
  if (message.remainingStockMap && typeof message.remainingStockMap === 'object') {
    for (const target of Object.values(message.remainingStockMap)) {
      if (target && target.remainingStock <= threshold) {
        const key = `${target.productTitle}:${target.variationName}:${target.sku || ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          targets.push(target);
        }
      }
    }
  }

  // 3. Line items with embedded stock_quantity, remaining_stock, or inventory_quantity
  for (const item of lineItems) {
    const rawStock = item.stock_quantity ?? item.remaining_stock ?? item.inventory_quantity;
    if (typeof rawStock === 'number' && rawStock <= threshold) {
      const productTitle = item.title || item.name || 'Artwork Product';
      const variationName = item.variant_title || 'Standard Edition';
      const sku = item.sku;
      const key = `${productTitle}:${variationName}:${sku || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        targets.push({
          productTitle,
          variationName,
          remainingStock: rawStock,
          sku,
        });
      }
    }
  }

  return targets;
}

// ============================================================================
// 4. Core Order Event Pipeline Processor
// ============================================================================

/**
 * Processes a single order queue message payload:
 * - Dispatches customer receipt email via ResendNotificationProvider
 * - Dispatches merchant purchase summary to MERCHANT_ALERT_EMAIL
 * - Evaluates inventory and dispatches low-stock alerts if stock_quantity <= 3
 * - Dispatches operational telemetry JSON if OPS_ALERT_WEBHOOK_URL is configured
 */
export async function processOrderEvent(
  messagePayload: OrderQueueMessage,
  env: OrderConsumerEnv = {},
  options: OrderConsumerOptions = {}
): Promise<{
  customerEmailSent: boolean;
  merchantAlertSent: boolean;
  lowStockAlertsSent: number;
  opsAlertSent: boolean;
  shippingUpdateSent?: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let customerEmailSent = false;
  let merchantAlertSent = false;
  let lowStockAlertsSent = 0;
  let opsAlertSent = false;

  // Initialize Providers
  const resendProvider =
    options.resendProvider ||
    new ResendNotificationProvider({
      apiKey: env.RESEND_API_KEY,
      fromEmail: env.RESEND_FROM_EMAIL || env.EMAIL_FROM,
      merchantAlertEmail: env.MERCHANT_ALERT_EMAIL,
    });

  const webhookUrl =
    env.DISCORD_WEBHOOK_STORE_ORDERS ||
    env.DISCORD_WEBHOOK_ORDERS ||
    env.DISCORD_WEBHOOK_URL ||
    env.OPS_ALERT_WEBHOOK_URL;

  const webhookProvider =
    options.webhookProvider ||
    new WebhookNotificationProvider(webhookUrl);

  const topic = messagePayload.topic || 'orders/create';
  const isFulfillmentEvent =
    topic === 'orders/fulfilled' ||
    topic === 'orders/partially_fulfilled' ||
    topic === 'fulfillments/create' ||
    topic === 'fulfillments/update' ||
    Boolean(
      (messagePayload.order as any)?.fulfillments?.length &&
        ((messagePayload.order as any)?.fulfillment_status === 'fulfilled' ||
          (messagePayload.order as any)?.fulfillment_status === 'partial')
    );

  // --------------------------------------------------------------------------
  // Fulfillment Pipeline: Customer Shipping Tracking Email & Discord Alert
  // --------------------------------------------------------------------------
  if (isFulfillmentEvent) {
    const fulfillmentData = extractFulfillmentData(topic, messagePayload.order);
    if (fulfillmentData) {
      // 1. Customer Shipping Tracking Notification (Resend)
      try {
        const result: EmailDispatchResult =
          await resendProvider.notifyShippingUpdate(fulfillmentData);
        if (result.success) {
          customerEmailSent = true;
        } else {
          errors.push(
            `Customer Shipping Update Error: ${result.error || 'Failed to dispatch tracking email'}`
          );
        }
      } catch (err: any) {
        const msg = `Customer Shipping Update Exception: ${err?.message || String(err)}`;
        console.error(`[OrderConsumer:ShippingUpdateFailure] ${msg}`);
        errors.push(msg);
      }

      // 2. Ops / Discord Webhook Telemetry Dispatch
      if (webhookProvider.isConfigured) {
        try {
          const shortOrder = fulfillmentData.order_number;
          const carrier = fulfillmentData.carrier;
          const tracking = fulfillmentData.tracking_number || 'N/A';
          const trackingUrl = fulfillmentData.tracking_url;

          const summaryText = `📦 Order Fulfilled: ${shortOrder} shipped via ${carrier} (Tracking: ${tracking})\n🔗 Track Package: ${trackingUrl}`;

          const webhookResult: WebhookDispatchResult = await webhookProvider.sendJson({
            event: topic,
            order_id: fulfillmentData.order_id,
            order_number: fulfillmentData.order_number,
            customer_email: fulfillmentData.customer_email,
            carrier: fulfillmentData.carrier,
            tracking_number: fulfillmentData.tracking_number,
            tracking_url: fulfillmentData.tracking_url,
            items_count: fulfillmentData.items?.length || 0,
            text: summaryText,
            content: summaryText,
          });

          if (webhookResult.success) {
            opsAlertSent = true;
          } else {
            errors.push(
              `Ops Fulfillment Telemetry Error: ${webhookResult.error || 'Failed to dispatch'}`
            );
          }
        } catch (err: any) {
          const msg = `Ops Fulfillment Telemetry Exception: ${err?.message || String(err)}`;
          console.error(`[OrderConsumer:OpsFulfillmentTelemetryFailure] ${msg}`);
          errors.push(msg);
        }
      }

      return {
        customerEmailSent,
        merchantAlertSent: false,
        lowStockAlertsSent: 0,
        opsAlertSent,
        shippingUpdateSent: customerEmailSent,
        errors,
      };
    }
  }

  const { order, receipt, rawLineItems } = normalizeOrderEvent(messagePayload.order);
  const lowStockThreshold = options.lowStockThreshold ?? LOW_STOCK_THRESHOLD;

  // 1. Customer Order Receipt (Resend)
  // Story 3.9: Transactional Email Policy & Customer Notification Disambiguation (Shopify vs. Resend)
  // Option A (Default): Resend dispatches 100% custom branded order confirmation receipts,
  // with Shopify native customer confirmations disabled in Shopify Admin to prevent duplicate receipts.
  // Option B: If disableCustomerReceipts or FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS is true,
  // customer receipts are handled natively by Shopify while Resend handles merchant/ops alerts.
  const disableCustomerReceipts =
    options.disableCustomerReceipts ??
    (env.FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS === 'true' ||
      env.DISABLE_RESEND_CUSTOMER_RECEIPTS === 'true' ||
      (typeof process !== 'undefined' &&
        (process.env?.FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS === 'true' ||
          process.env?.DISABLE_RESEND_CUSTOMER_RECEIPTS === 'true')));

  if (disableCustomerReceipts) {
    console.log(
      '[OrderConsumer:EmailDisambiguation] Customer receipt email skipped via policy flag (Option B active)'
    );
  } else {
    try {
      const result: EmailDispatchResult = await resendProvider.notifyOrderReceipt(receipt);
      if (result.success) {
        customerEmailSent = true;
      } else {
        errors.push(`Customer Receipt Error: ${result.error || 'Failed to dispatch email'}`);
      }
    } catch (err: any) {
      const msg = `Customer Receipt Exception: ${err?.message || String(err)}`;
      console.error(`[OrderConsumer:ReceiptFailure] ${msg}`);
      errors.push(msg);
    }
  }

  // 2. Merchant Order Alert (Resend to MERCHANT_ALERT_EMAIL)
  try {
    const result: EmailDispatchResult = await resendProvider.notifyMerchantOrderAlert(order);
    if (result.success) {
      merchantAlertSent = true;
    } else {
      errors.push(`Merchant Alert Error: ${result.error || 'Failed to dispatch email'}`);
    }
  } catch (err: any) {
    const msg = `Merchant Alert Exception: ${err?.message || String(err)}`;
    console.error(`[OrderConsumer:MerchantAlertFailure] ${msg}`);
    errors.push(msg);
  }

  // 3. Low Stock Inventory Warnings (Threshold <= 3)
  const lowStockTargets = extractLowStockTargets(messagePayload, rawLineItems, lowStockThreshold);
  for (const target of lowStockTargets) {
    try {
      // Dispatches email to merchant
      const emailResult = await resendProvider.notifyLowStock(
        target.productTitle,
        target.variationName,
        target.remainingStock,
        target.sku
      );

      // Dispatches structured JSON to ops webhook if configured
      if (webhookProvider.isConfigured) {
        await webhookProvider
          .notifyLowStock(
            target.productTitle,
            target.variationName,
            target.remainingStock,
            target.sku
          )
          .catch((err) => {
            console.warn('[OrderConsumer:WebhookLowStock] Webhook dispatch warning:', err);
          });
      }

      if (emailResult.success) {
        lowStockAlertsSent++;
      } else {
        errors.push(
          `Low Stock Alert Error (${target.variationName}): ${emailResult.error || 'Failed'}`
        );
      }
    } catch (err: any) {
      const msg = `Low Stock Exception (${target.variationName}): ${err?.message || String(err)}`;
      console.error(`[OrderConsumer:LowStockFailure] ${msg}`);
      errors.push(msg);
    }
  }

  // 4. Ops / Discord Webhook Telemetry Dispatch (if webhook URL is configured)
  if (webhookProvider.isConfigured) {
    try {
      const shortId = order.shopify_order_number || `#${order.id.slice(0, 8)}`;
      const amountStr = `$${order.amount_total.toFixed(2)} ${(order.currency || 'USD').toUpperCase()}`;
      const webhookResult: WebhookDispatchResult = await webhookProvider.sendJson({
        event: messagePayload.topic || 'orders/create',
        order_id: order.id,
        order_number: order.shopify_order_number,
        customer_email: order.customer_email,
        amount_total: order.amount_total,
        currency: order.currency,
        timestamp: new Date().toISOString(),
        items_count: receipt.items.length,
        text: `🛒 New Order Placed: ${shortId} for ${amountStr} (${order.customer_email})`,
        content: `🛒 New Order Placed: ${shortId} for ${amountStr} (${order.customer_email})`,
      });

      if (webhookResult.success) {
        opsAlertSent = true;
      } else {
        errors.push(`Ops Telemetry Error: ${webhookResult.error || 'Failed to dispatch'}`);
      }
    } catch (err: any) {
      const msg = `Ops Telemetry Exception: ${err?.message || String(err)}`;
      console.error(`[OrderConsumer:OpsTelemetryFailure] ${msg}`);
      errors.push(msg);
    }
  }

  return {
    customerEmailSent,
    merchantAlertSent,
    lowStockAlertsSent,
    opsAlertSent,
    errors,
  };
}

// ============================================================================
// 5. Cloudflare Queue Consumer Batch Handler with Error Isolation
// ============================================================================

/**
 * Computes exponential backoff delay seconds for message retry.
 */
export function calculateRetryDelay(
  attempts: number,
  initialDelaySeconds: number = DEFAULT_INITIAL_RETRY_DELAY_SECONDS,
  multiplier: number = 2
): number {
  return initialDelaySeconds * Math.pow(multiplier, Math.max(0, attempts - 1));
}

/**
 * Primary Cloudflare Queue Consumer Batch Handler.
 *
 * Implements strict error isolation:
 * - Processes each message independently so an error in message A never prevents message B.
 * - Captures notification dispatch failures in logs and schedules message retry with exponential backoff.
 * - Routes poison pills exceeding max retries to SHOPIFY_ORDERS_DLQ without crashing the isolate.
 * - Acknowledges successful messages.
 */
export async function handleOrderQueueBatch(
  batch: QueueMessageBatch<OrderQueueMessage>,
  env: OrderConsumerEnv = {},
  _ctx?: any,
  options: OrderConsumerOptions = {}
): Promise<OrderConsumerBatchResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelay = options.initialRetryDelaySeconds ?? DEFAULT_INITIAL_RETRY_DELAY_SECONDS;
  const backoffMultiplier = options.backoffMultiplier ?? 2;

  const results: MessageProcessingResult[] = [];
  let succeeded = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const message of batch.messages) {
    const attempts = message.attempts ?? 1;
    const messageId = message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      const outcome = await processOrderEvent(message.body, env, options);

      if (outcome.errors.length === 0) {
        // Full Success: acknowledge message from queue
        if (typeof message.ack === 'function') {
          await message.ack();
        }
        succeeded++;
        results.push({
          messageId,
          success: true,
          action: 'acked',
          customerEmailSent: outcome.customerEmailSent,
          merchantAlertSent: outcome.merchantAlertSent,
          lowStockAlertsSent: outcome.lowStockAlertsSent,
          opsAlertSent: outcome.opsAlertSent,
          attempts,
        });
      } else {
        // Notification dispatch failed
        const combinedError = outcome.errors.join('; ');
        console.error(
          `[OrderConsumer:DispatchError] Message ${messageId} (attempt ${attempts}/${maxRetries}) encountered errors: ${combinedError}`
        );

        if (attempts < maxRetries) {
          // Retry with exponential backoff
          const delaySeconds = calculateRetryDelay(attempts, initialDelay, backoffMultiplier);
          if (typeof message.retry === 'function') {
            await message.retry({ delaySeconds });
          }
          retried++;
          results.push({
            messageId,
            success: false,
            action: 'retried',
            customerEmailSent: outcome.customerEmailSent,
            merchantAlertSent: outcome.merchantAlertSent,
            lowStockAlertsSent: outcome.lowStockAlertsSent,
            opsAlertSent: outcome.opsAlertSent,
            error: combinedError,
            retryDelaySeconds: delaySeconds,
            attempts,
          });
        } else {
          // Max retries exceeded: Route to Dead Letter Queue (DLQ)
          console.warn(
            `[OrderConsumer:DLQ] Message ${messageId} exceeded max retries (${attempts}/${maxRetries}). Routing to DLQ.`
          );

          if (env.SHOPIFY_ORDERS_DLQ && typeof env.SHOPIFY_ORDERS_DLQ.send === 'function') {
            try {
              await env.SHOPIFY_ORDERS_DLQ.send({
                originalMessageId: messageId,
                payload: message.body,
                error: combinedError,
                attempts,
                failedAt: new Date().toISOString(),
              });
            } catch (dlqErr) {
              console.error(`[OrderConsumer:DLQFailure] Failed to enqueue to DLQ:`, dlqErr);
            }
          }

          // Acknowledge poisoned message so it does not block the queue
          if (typeof message.ack === 'function') {
            await message.ack();
          }
          deadLettered++;
          results.push({
            messageId,
            success: false,
            action: 'dead_lettered',
            customerEmailSent: outcome.customerEmailSent,
            merchantAlertSent: outcome.merchantAlertSent,
            lowStockAlertsSent: outcome.lowStockAlertsSent,
            opsAlertSent: outcome.opsAlertSent,
            error: combinedError,
            attempts,
          });
        }
      }
    } catch (unhandledErr: any) {
      // Catch-all safety net: ensure worker isolate never crashes
      const errStr = unhandledErr?.message || String(unhandledErr);
      console.error(
        `[OrderConsumer:UnhandledException] Unexpected error in message ${messageId}:`,
        unhandledErr
      );

      if (attempts < maxRetries) {
        const delaySeconds = calculateRetryDelay(attempts, initialDelay, backoffMultiplier);
        if (typeof message.retry === 'function') {
          await message.retry({ delaySeconds });
        }
        retried++;
        results.push({
          messageId,
          success: false,
          action: 'retried',
          customerEmailSent: false,
          merchantAlertSent: false,
          lowStockAlertsSent: 0,
          opsAlertSent: false,
          error: errStr,
          retryDelaySeconds: delaySeconds,
          attempts,
        });
      } else {
        if (env.SHOPIFY_ORDERS_DLQ && typeof env.SHOPIFY_ORDERS_DLQ.send === 'function') {
          try {
            await env.SHOPIFY_ORDERS_DLQ.send({
              originalMessageId: messageId,
              payload: message.body,
              error: errStr,
              attempts,
              failedAt: new Date().toISOString(),
            });
          } catch (dlqErr) {
            console.error('[OrderConsumer:DLQFailure] Failed to enqueue to DLQ:', dlqErr);
          }
        }

        if (typeof message.ack === 'function') {
          await message.ack();
        }
        deadLettered++;
        results.push({
          messageId,
          success: false,
          action: 'dead_lettered',
          customerEmailSent: false,
          merchantAlertSent: false,
          lowStockAlertsSent: 0,
          opsAlertSent: false,
          error: errStr,
          attempts,
        });
      }
    }
  }

  return {
    total: batch.messages.length,
    succeeded,
    retried,
    deadLettered,
    results,
  };
}
