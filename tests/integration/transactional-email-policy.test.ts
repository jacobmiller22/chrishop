import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as webhookHandler } from '../../apps/web/src/app/api/webhooks/shopify/route';
import {
  processOrderEvent,
  handleOrderQueueBatch,
  type OrderQueueMessage,
  type QueueMessage,
  type QueueMessageBatch,
  type ShopifyOrderWebhookPayload,
} from '../../apps/web/src/lib/order-consumer';
import {
  ResendNotificationProvider,
  WebhookNotificationProvider,
} from '@chrishop/notifications';

const rootDir = path.resolve(__dirname, '../..');
const TEST_SECRET = 'shpss_story_3_9_email_policy_secret';
const MERCHANT_EMAIL = 'merchant-ops@shop.jacobmiller22.com';

function createMockOrder(overrides: Partial<ShopifyOrderWebhookPayload> = {}): ShopifyOrderWebhookPayload {
  return {
    id: 9918273645,
    name: '#1055',
    order_number: 1055,
    email: 'collector@example.com',
    customer: {
      first_name: 'Miles',
      last_name: 'Davis',
      email: 'collector@example.com',
    },
    total_price: '750.00',
    subtotal_price: '700.00',
    total_shipping: '35.00',
    total_tax: '15.00',
    currency: 'USD',
    financial_status: 'paid',
    fulfillment_status: 'unfulfilled',
    shipping_address: {
      name: 'Miles Davis',
      address1: '52nd Street',
      city: 'New York',
      province: 'NY',
      zip: '10019',
      country: 'US',
    },
    line_items: [
      {
        id: 771122,
        title: 'Kind of Blue Silk Screen',
        variant_title: 'Archival Print Edition',
        sku: 'KOB-PRINT-01',
        quantity: 1,
        price: '700.00',
        stock_quantity: 4,
      },
    ],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    _store: store,
  };
}

describe('Story 3.9: Transactional Email Policy & Customer Notification Disambiguation (Shopify vs. Resend)', () => {
  // --------------------------------------------------------------------------
  // 1. Policy Documentation & Runbook Conformance
  // --------------------------------------------------------------------------
  describe('1. Architectural Policy Documentation & Shopify Admin Runbook', () => {
    it('should verify DEP_RESEND.md documents Option A policy, Shopify Admin runbook, and disambiguation matrix', () => {
      const depResendPath = path.join(rootDir, 'docs/deps/DEP_RESEND.md');
      assert.ok(fs.existsSync(depResendPath), 'DEP_RESEND.md must exist');
      const content = fs.readFileSync(depResendPath, 'utf-8');

      assert.ok(content.includes('Customer Transactional Email Disambiguation & Delivery Policy (Story 3.9)'));
      assert.ok(content.includes('Option A: Resend-Authoritative Transactional Receipts with Shopify Native Customer Confirmations Disabled'));
      assert.ok(content.includes('Shopify Admin Configuration Runbook'));
      assert.ok(content.includes('Settings > Notifications'));
      assert.ok(content.includes('Order confirmation'));
      assert.ok(content.includes('Option B Fallback (Configurable Override)'));
      assert.ok(content.includes('FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS'));
      assert.ok(content.includes('Disambiguation Matrix'));
    });

    it('should verify DEP_SHOPIFY.md cross-references the customer notification disambiguation policy', () => {
      const depShopifyPath = path.join(rootDir, 'docs/deps/DEP_SHOPIFY.md');
      assert.ok(fs.existsSync(depShopifyPath), 'DEP_SHOPIFY.md must exist');
      const content = fs.readFileSync(depShopifyPath, 'utf-8');

      assert.ok(content.includes('Customer Notification Disambiguation Policy (Story 3.9)'));
      assert.ok(content.includes('DEP_RESEND.md'));
      assert.ok(content.includes('Settings > Notifications > Customer notifications > Order confirmation'));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Option A Execution: Exactly ONE Resend Branded Receipt
  // --------------------------------------------------------------------------
  describe('2. Option A (Default): Authoritative Resend Customer Receipt Dispatch', () => {
    it('should dispatch exactly ONE customer receipt and ONE merchant alert for a checkout order', async () => {
      const capturedCustomerEmails: any[] = [];
      const capturedMerchantEmails: any[] = [];

      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });

      mockResend.notifyOrderReceipt = async (receipt) => {
        capturedCustomerEmails.push(receipt);
        return { success: true, id: 'resend-receipt-1055' };
      };

      mockResend.notifyMerchantOrderAlert = async (order) => {
        capturedMerchantEmails.push(order);
        return { success: true, id: 'resend-merchant-1055' };
      };

      const payload: OrderQueueMessage = {
        topic: 'orders/create',
        order: createMockOrder(),
      };

      const outcome = await processOrderEvent(
        payload,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        { resendProvider: mockResend }
      );

      assert.equal(outcome.customerEmailSent, true, 'Customer email must be flagged as sent');
      assert.equal(outcome.merchantAlertSent, true, 'Merchant alert must be flagged as sent');
      assert.equal(outcome.errors.length, 0);

      // Exactly ONE customer receipt received
      assert.equal(capturedCustomerEmails.length, 1, 'Customer must receive exactly ONE order receipt');
      assert.equal(capturedCustomerEmails[0].customer_email, 'collector@example.com');
      assert.equal(capturedCustomerEmails[0].order_number, '#1055');
      assert.equal(capturedCustomerEmails[0].amount_total, 750.0);

      // Exactly ONE merchant alert received
      assert.equal(capturedMerchantEmails.length, 1, 'Merchant must receive exactly ONE order alert');
      assert.equal(capturedMerchantEmails[0].customer_email, 'collector@example.com');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Option B Execution: Disambiguation Fallback Toggle
  // --------------------------------------------------------------------------
  describe('3. Option B: Configurable Disambiguation Override', () => {
    it('should suppress Resend customer receipt when FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS is true while preserving merchant alert', async () => {
      const capturedCustomerEmails: any[] = [];
      const capturedMerchantEmails: any[] = [];

      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });

      mockResend.notifyOrderReceipt = async (receipt) => {
        capturedCustomerEmails.push(receipt);
        return { success: true, id: 'resend-receipt-suppressed' };
      };

      mockResend.notifyMerchantOrderAlert = async (order) => {
        capturedMerchantEmails.push(order);
        return { success: true, id: 'resend-merchant-active' };
      };

      const payload: OrderQueueMessage = {
        topic: 'orders/create',
        order: createMockOrder(),
      };

      const outcome = await processOrderEvent(
        payload,
        {
          MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL,
          FLAG_DISABLE_RESEND_CUSTOMER_RECEIPTS: 'true',
        },
        { resendProvider: mockResend }
      );

      assert.equal(outcome.customerEmailSent, false, 'Customer receipt must be skipped under Option B');
      assert.equal(outcome.merchantAlertSent, true, 'Merchant alert must remain active');
      assert.equal(capturedCustomerEmails.length, 0, 'No customer receipts dispatched from Resend');
      assert.equal(capturedMerchantEmails.length, 1, 'Merchant alert dispatched as expected');
    });

    it('should support disableCustomerReceipts boolean option passed to handleOrderQueueBatch', async () => {
      const capturedCustomerEmails: any[] = [];
      const mockResend = new ResendNotificationProvider({
        merchantAlertEmail: MERCHANT_EMAIL,
      });
      mockResend.notifyOrderReceipt = async (r) => {
        capturedCustomerEmails.push(r);
        return { success: true };
      };
      mockResend.notifyMerchantOrderAlert = async () => ({ success: true });

      const state = { acked: false, retried: false };
      const mockMsg: QueueMessage<OrderQueueMessage> = {
        id: 'msg-opt-b-test',
        timestamp: new Date(),
        attempts: 1,
        body: { topic: 'orders/create', order: createMockOrder() },
        ack: () => { state.acked = true; },
        retry: () => { state.retried = true; },
      };

      const batch: QueueMessageBatch<OrderQueueMessage> = {
        queue: 'shopify-orders-queue',
        messages: [mockMsg],
      };

      const batchResult = await handleOrderQueueBatch(
        batch,
        { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
        undefined,
        { resendProvider: mockResend, disableCustomerReceipts: true }
      );

      assert.equal(batchResult.succeeded, 1);
      assert.equal(state.acked, true);
      assert.equal(capturedCustomerEmails.length, 0, 'No customer receipt dispatched');
      assert.equal(batchResult.results[0].customerEmailSent, false);
      assert.equal(batchResult.results[0].merchantAlertSent, true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Idempotency Gate: Webhook Replay Duplicate Prevention
  // --------------------------------------------------------------------------
  describe('4. Idempotency Gate Guarantees Exactly-Once Receipt', () => {
    it('should deduplicate replayed webhooks and ensure customer receives exactly ONE receipt across multiple deliveries', async () => {
      const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      const enqueuedMessages: any[] = [];
      const mockKV = createMockKV();

      try {
        process.env.SHOPIFY_WEBHOOK_SECRET = TEST_SECRET;
        (globalThis as any).NEXT_CACHE_WORKERS_KV = mockKV;
        (globalThis as any).SHOPIFY_ORDERS_QUEUE = {
          send: async (msg: any) => {
            enqueuedMessages.push(msg);
          },
        };

        const mockOrder = createMockOrder();
        const rawBody = JSON.stringify(mockOrder);
        const validHmac = crypto
          .createHmac('sha256', TEST_SECRET)
          .update(rawBody, 'utf8')
          .digest('base64');

        const createWebhookReq = () =>
          new NextRequest('http://localhost:3000/api/webhooks/shopify', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-shopify-hmac-sha256': validHmac,
              'x-shopify-topic': 'orders/create',
              'x-shopify-webhook-id': 'wh-story39-exactly-once-01',
            },
            body: rawBody,
          });

        // 1. Initial Webhook Arrival
        const resp1 = await webhookHandler(createWebhookReq());
        assert.equal(resp1.status, 200);
        assert.equal(resp1.headers.get('x-idempotency-status'), 'miss');
        assert.equal(enqueuedMessages.length, 1);

        // 2. Replay Webhook Arrival (e.g. Shopify retry on network blip)
        const resp2 = await webhookHandler(createWebhookReq());
        assert.equal(resp2.status, 200);
        assert.equal(resp2.headers.get('x-idempotency-status'), 'hit');
        const json2 = await resp2.json();
        assert.equal(json2.deduplicated, true);

        // 3. Third Replay Webhook Arrival
        const resp3 = await webhookHandler(createWebhookReq());
        assert.equal(resp3.status, 200);
        assert.equal(resp3.headers.get('x-idempotency-status'), 'hit');

        // Verify that across 3 webhook transmissions, exactly 1 message was enqueued to queue
        assert.equal(enqueuedMessages.length, 1, 'Replays must never queue redundant orders');

        // Now process the single enqueued message through queue consumer
        const customerReceiptsSent: any[] = [];
        const mockResend = new ResendNotificationProvider({
          merchantAlertEmail: MERCHANT_EMAIL,
        });
        mockResend.notifyOrderReceipt = async (receipt) => {
          customerReceiptsSent.push(receipt);
          return { success: true, id: 'resend-1055-exactly-once' };
        };
        mockResend.notifyMerchantOrderAlert = async () => ({ success: true });

        const outcome = await processOrderEvent(
          enqueuedMessages[0],
          { MERCHANT_ALERT_EMAIL: MERCHANT_EMAIL },
          { resendProvider: mockResend }
        );

        assert.equal(outcome.customerEmailSent, true);
        assert.equal(customerReceiptsSent.length, 1, 'Customer receives exactly ONE receipt');
      } finally {
        process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
        delete (globalThis as any).NEXT_CACHE_WORKERS_KV;
        delete (globalThis as any).SHOPIFY_ORDERS_QUEUE;
      }
    });
  });
});
