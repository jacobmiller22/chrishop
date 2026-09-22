import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as shopifyWebhookHandler } from '../src/app/api/webhooks/shopify/route';
import {
  extractFulfillmentData,
  formatCarrierTrackingUrl,
  processOrderEvent,
  type ShopifyOrderWebhookPayload,
} from '../src/lib/order-consumer';
import { resetWebhookIdempotencyCache } from '../src/lib/shopify-webhook';
import {
  ResendNotificationProvider,
  WebhookNotificationProvider,
} from '@chrishop/notifications';

const TEST_SECRET = 'shpss_fulfillment_secret_key_889900';

function createSignedRequest(
  payload: any,
  options: {
    secret?: string;
    webhookId?: string;
    topic?: string;
    corruptSignature?: boolean;
    omitSignature?: boolean;
  } = {}
): NextRequest {
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const secret = options.secret ?? TEST_SECRET;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (!options.omitSignature) {
    let hmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (options.corruptSignature) {
      hmac = 'corrupted_hmac_signature_value=';
    }
    headers['x-shopify-hmac-sha256'] = hmac;
  }

  if (options.webhookId) {
    headers['x-shopify-webhook-id'] = options.webhookId;
  }

  if (options.topic) {
    headers['x-shopify-topic'] = options.topic;
  }

  return new NextRequest('https://chrishop.jacobmiller22.com/api/webhooks/shopify', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

function mockShopifyFulfilledOrder(): ShopifyOrderWebhookPayload {
  return {
    id: 9911223344,
    order_number: 1042,
    name: '#1042',
    email: 'leadville.collector@example.com',
    customer: {
      first_name: 'Miles',
      last_name: 'Leadville',
      email: 'leadville.collector@example.com',
    },
    shipping_address: {
      first_name: 'Miles',
      last_name: 'Leadville',
      address1: '100 Harrison Ave',
      city: 'Leadville',
      province: 'CO',
      state: 'CO',
      zip: '80461',
      country: 'US',
    },
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
    line_items: [
      {
        id: 111,
        title: 'BankBeaters 5-Panel Guide Cap',
        variant_title: 'Signal Orange / One Size',
        sku: 'BB-CAP-ORG-01',
        quantity: 1,
        price: '48.00',
      },
      {
        id: 222,
        title: 'Waxed Canvas Tool Roll',
        variant_title: 'Charcoal',
        sku: 'BB-TR-CHR-01',
        quantity: 1,
        price: '74.00',
      },
    ],
    fulfillments: [
      {
        id: 778899,
        order_id: 9911223344,
        status: 'success',
        tracking_company: 'USPS',
        tracking_number: '9400111899562537624102',
        tracking_url:
          'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562537624102',
        line_items: [
          {
            id: 111,
            title: 'BankBeaters 5-Panel Guide Cap',
            variant_title: 'Signal Orange / One Size',
            sku: 'BB-CAP-ORG-01',
            quantity: 1,
            price: '48.00',
          },
          {
            id: 222,
            title: 'Waxed Canvas Tool Roll',
            variant_title: 'Charcoal',
            sku: 'BB-TR-CHR-01',
            quantity: 1,
            price: '74.00',
          },
        ],
      },
    ],
  };
}

describe('Story 3.5: Phase 1 Order Fulfillment & Customer Tracking Email Flow', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetWebhookIdempotencyCache();
    process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
    delete process.env.DISCORD_WEBHOOK_STORE_ORDERS;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetWebhookIdempotencyCache();
  });

  // ==========================================================================
  // 1. Carrier Tracking URL Composition & Parsing
  // ==========================================================================
  describe('1. Carrier Tracking URL Composition & Normalization', () => {
    it('should compose accurate USPS tracking URLs', () => {
      const url = formatCarrierTrackingUrl('USPS', '9400111899562537624102');
      assert.equal(
        url,
        'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562537624102'
      );
    });

    it('should compose accurate UPS tracking URLs', () => {
      const url = formatCarrierTrackingUrl('UPS', '1Z9999999999999999');
      assert.equal(url, 'https://www.ups.com/track?tracknum=1Z9999999999999999');
    });

    it('should compose accurate FedEx tracking URLs', () => {
      const url = formatCarrierTrackingUrl('FedEx', '794829104820');
      assert.equal(url, 'https://www.fedex.com/fedextrack/?trknbr=794829104820');
    });

    it('should compose accurate DHL tracking URLs', () => {
      const url = formatCarrierTrackingUrl('DHL Express', '1234567890');
      assert.equal(url, 'https://www.dhl.com/en/express/tracking.html?AWB=1234567890');
    });

    it('should respect explicit valid HTTP tracking URL when provided', () => {
      const explicit = 'https://custom-tracking.delivery/track/ABC123XYZ';
      const url = formatCarrierTrackingUrl('Specialty Carrier', 'ABC123XYZ', explicit);
      assert.equal(url, explicit);
    });

    it('should gracefully fallback when tracking number is missing', () => {
      const url = formatCarrierTrackingUrl('USPS', '');
      assert.equal(url, 'https://chrishop.jacobmiller22.com/orders');
    });
  });

  // ==========================================================================
  // 2. Fulfillment Webhook Payload Normalization
  // ==========================================================================
  describe('2. Fulfillment Webhook Payload Normalization', () => {
    it('should extract tracking and customer details from orders/fulfilled payload', () => {
      const order = mockShopifyFulfilledOrder();
      const extracted = extractFulfillmentData('orders/fulfilled', order);

      assert.ok(extracted);
      assert.equal(extracted.order_id, '9911223344');
      assert.equal(extracted.order_number, '#1042');
      assert.equal(extracted.customer_email, 'leadville.collector@example.com');
      assert.equal(extracted.customer_name, 'Miles Leadville');
      assert.equal(extracted.carrier, 'USPS');
      assert.equal(extracted.tracking_number, '9400111899562537624102');
      assert.ok(extracted.tracking_url.includes('9400111899562537624102'));
      assert.equal(extracted.items?.length, 2);
      assert.equal(extracted.items?.[0].title, 'BankBeaters 5-Panel Guide Cap');
      assert.equal(extracted.items?.[0].variation_name, 'Signal Orange / One Size');
    });

    it('should format carrier URL if tracking_url is omitted in fulfillment object', () => {
      const order = mockShopifyFulfilledOrder();
      if (order.fulfillments && order.fulfillments[0]) {
        delete order.fulfillments[0].tracking_url;
        order.fulfillments[0].tracking_company = 'UPS';
        order.fulfillments[0].tracking_number = '1Z12345E0291983942';
      }

      const extracted = extractFulfillmentData('orders/fulfilled', order);
      assert.ok(extracted);
      assert.equal(extracted.carrier, 'UPS');
      assert.equal(extracted.tracking_number, '1Z12345E0291983942');
      assert.equal(
        extracted.tracking_url,
        'https://www.ups.com/track?tracknum=1Z12345E0291983942'
      );
    });

    it('should extract details from direct fulfillments/create webhook payload', () => {
      const fulfillmentPayload = {
        id: 887766,
        order_id: 112233,
        order_name: '#1055',
        status: 'success',
        tracking_company: 'FedEx',
        tracking_number: '794829104820',
        email: 'alpine.hiker@colorado.example',
        customer_name: 'Colorado Hiker',
        line_items: [
          {
            title: 'Leadville Lumbar Pack',
            variant_title: 'Graphite',
            quantity: 1,
          },
        ],
      };

      const extracted = extractFulfillmentData('fulfillments/create', fulfillmentPayload);
      assert.ok(extracted);
      assert.equal(extracted.order_id, '112233');
      assert.equal(extracted.order_number, '#1055');
      assert.equal(extracted.customer_email, 'alpine.hiker@colorado.example');
      assert.equal(extracted.customer_name, 'Colorado Hiker');
      assert.equal(extracted.carrier, 'FedEx');
      assert.equal(extracted.tracking_number, '794829104820');
      assert.ok(extracted.tracking_url.includes('fedextrack'));
      assert.equal(extracted.items?.length, 1);
      assert.equal(extracted.items?.[0].title, 'Leadville Lumbar Pack');
    });

    it('should return null for non-object payloads', () => {
      assert.equal(extractFulfillmentData('orders/fulfilled', null), null);
      assert.equal(extractFulfillmentData('orders/fulfilled', 'invalid string'), null);
    });
  });

  // ==========================================================================
  // 3. Email Dispatch & Discord Telemetry
  // ==========================================================================
  describe('3. Email Dispatch & Discord Telemetry Execution', () => {
    it('should dispatch tracking email and Discord telemetry on fulfillment event', async () => {
      let dispatchedEmail: any = null;
      let dispatchedDiscord: any = null;

      const mockResend = new ResendNotificationProvider({
        apiKey: 're_test_key_fake',
      });
      mockResend.sendEmail = async (payload) => {
        dispatchedEmail = payload;
        return { success: true, id: 'msg-ship-12345' };
      };

      const mockWebhook = new WebhookNotificationProvider('https://discord.com/api/webhooks/mock');
      mockWebhook.sendJson = async (payload) => {
        dispatchedDiscord = payload;
        return { success: true };
      };

      const order = mockShopifyFulfilledOrder();

      const result = await processOrderEvent(
        {
          topic: 'orders/fulfilled',
          order,
          eventId: 'evt-ful-1',
        },
        {},
        {
          resendProvider: mockResend,
          webhookProvider: mockWebhook,
        }
      );

      // Verify email dispatched
      assert.equal(result.customerEmailSent, true);
      assert.equal(result.shippingUpdateSent, true);
      assert.equal(result.merchantAlertSent, false, 'No merchant alert on fulfillment');
      assert.equal(result.lowStockAlertsSent, 0, 'No low stock alerts on fulfillment');
      assert.equal(result.opsAlertSent, true);
      assert.equal(result.errors.length, 0);

      // Verify email contents
      assert.ok(dispatchedEmail);
      assert.equal(dispatchedEmail.to, 'leadville.collector@example.com');
      assert.ok(dispatchedEmail.subject.includes('#1042'));
      assert.ok(dispatchedEmail.subject.includes('shipped'));
      assert.ok(dispatchedEmail.html.includes('USPS'));
      assert.ok(dispatchedEmail.html.includes('9400111899562537624102'));
      assert.ok(dispatchedEmail.html.includes('BankBeaters 5-Panel Guide Cap'));
      assert.ok(dispatchedEmail.html.includes('Waxed Canvas Tool Roll'));
      assert.ok(dispatchedEmail.html.includes('Leadville Workshop Guarantee'));

      // Verify Discord contents
      assert.ok(dispatchedDiscord);
      assert.equal(dispatchedDiscord.event, 'orders/fulfilled');
      assert.equal(dispatchedDiscord.order_number, '#1042');
      assert.equal(dispatchedDiscord.carrier, 'USPS');
      assert.equal(dispatchedDiscord.tracking_number, '9400111899562537624102');
      assert.ok(dispatchedDiscord.text.includes('📦 Order Fulfilled: #1042'));
      assert.ok(dispatchedDiscord.text.includes('USPS'));
      assert.ok(dispatchedDiscord.text.includes('Track Package'));
    });

    it('should not fail processOrderEvent if email fails and report error', async () => {
      const mockResend = new ResendNotificationProvider({
        apiKey: 're_test_key_fake',
      });
      mockResend.sendEmail = async () => {
        return { success: false, error: 'Resend API service unavailable (HTTP 503)' };
      };

      const order = mockShopifyFulfilledOrder();

      const result = await processOrderEvent(
        {
          topic: 'orders/fulfilled',
          order,
          eventId: 'evt-ful-fail',
        },
        {},
        {
          resendProvider: mockResend,
        }
      );

      assert.equal(result.customerEmailSent, false);
      assert.equal(result.errors.length, 1);
      assert.ok(result.errors[0].includes('Resend API service unavailable'));
    });
  });

  // ==========================================================================
  // 4. Edge HTTP Ingestion Route Tests (POST /api/webhooks/shopify)
  // ==========================================================================
  describe('4. Edge HTTP Ingestion Route (POST /api/webhooks/shopify)', () => {
    it('should verify HMAC signature and acknowledge orders/fulfilled event with 200 OK', async () => {
      const order = mockShopifyFulfilledOrder();
      const req = createSignedRequest(order, {
        topic: 'orders/fulfilled',
        webhookId: 'wh-ful-001',
      });

      const res = await shopifyWebhookHandler(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.received, true);
      assert.equal(json.topic, 'orders/fulfilled');
      assert.equal(json.webhookId, 'wh-ful-001');
      assert.ok(res.headers.get('x-response-time-ms'));
    });

    it('should reject orders/fulfilled webhook with invalid HMAC signature with 401', async () => {
      const order = mockShopifyFulfilledOrder();
      const req = createSignedRequest(order, {
        topic: 'orders/fulfilled',
        corruptSignature: true,
      });

      const res = await shopifyWebhookHandler(req);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.ok(json.error.includes('Unauthorized'));
    });

    it('should deduplicate replayed fulfillment webhook without redundant processing', async () => {
      const order = mockShopifyFulfilledOrder();
      const webhookId = 'wh-ful-replay-001';

      // First delivery
      const req1 = createSignedRequest(order, {
        topic: 'orders/fulfilled',
        webhookId,
      });
      const res1 = await shopifyWebhookHandler(req1);
      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get('x-idempotency-status'), 'miss');

      // Duplicate delivery
      const req2 = createSignedRequest(order, {
        topic: 'orders/fulfilled',
        webhookId,
      });
      const res2 = await shopifyWebhookHandler(req2);
      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get('x-idempotency-status'), 'hit');
      const json2 = await res2.json();
      assert.equal(json2.deduplicated, true);
    });
  });
});
