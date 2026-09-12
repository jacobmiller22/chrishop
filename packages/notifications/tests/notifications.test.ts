import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DiscordNotificationProvider,
  ConsoleNotificationProvider,
  CompositeNotificationProvider,
  ResendNotificationProvider,
  WebhookNotificationProvider,
  DISCORD_COLORS,
  type NotificationPayload,
  type OrderReceiptPayload,
  type ShippingUpdatePayload,
} from '../src/index';
import type { Order } from '@chrishop/types';

describe('Notification Providers (@chrishop/notifications)', () => {
  // --------------------------------------------------------------------------
  // Discord Notification Provider Tests
  // --------------------------------------------------------------------------
  describe('DiscordNotificationProvider', () => {
    it('should skip alert gracefully when Discord webhook URL is empty', async () => {
      const provider = new DiscordNotificationProvider('');
      await assert.doesNotReject(async () => {
        await provider.send({
          title: 'Test Title',
          message: 'Test Message',
          severity: 'info',
        });
      });
    });

    it('should format Discord webhook embed payload correctly on notifyOrderCreated', async () => {
      let capturedBody: any = null;
      const mockUrl = 'https://discord.com/api/webhooks/mock/test';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockUrl) {
          capturedBody = JSON.parse(init.body);
          return {
            ok: true,
            statusText: 'OK',
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new DiscordNotificationProvider(mockUrl);
        const testOrder: Order = {
          id: 'ord-12345678-abcd',
          customer_email: 'buyer@example.com',
          shipping_name: 'Jane Collector',
          amount_total: 495.0,
          currency: 'usd',
          shopify_order_id: 'gid://shopify/Order/1234567890',
          order_status: 'paid',
          shipping_status: 'pending',
          shipping_address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            postal_code: '10001',
            country: 'US',
          },
        };

        await provider.notifyOrderCreated(testOrder);

        assert.ok(capturedBody, 'Webhook request body should be captured');
        assert.ok(Array.isArray(capturedBody.embeds), 'Body should contain embeds array');
        assert.equal(capturedBody.embeds.length, 1);

        const embed = capturedBody.embeds[0];
        assert.ok(embed.title.includes('ord-1234'));
        assert.ok(embed.description.includes('Jane Collector'));
        assert.ok(embed.description.includes('buyer@example.com'));
        assert.equal(embed.color, 0x22c55e, 'Success severity should map to green (0x22c55e)');

        const fieldMap = Object.fromEntries(embed.fields.map((f: any) => [f.name, f.value]));
        assert.equal(fieldMap.Total, '$495.00');
        assert.equal(fieldMap.Status, 'paid');
        assert.equal(fieldMap.Shipping, 'pending');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should map severity levels to distinct Discord colors', async () => {
      const capturedColors: Record<string, number> = {};
      const mockUrl = 'https://discord.com/api/webhooks/mock/colors';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, init: any) => {
        const parsed = JSON.parse(init.body);
        const title = parsed.embeds[0].title;
        capturedColors[title] = parsed.embeds[0].color;
        return { ok: true, statusText: 'OK' } as Response;
      }) as any;

      try {
        const provider = new DiscordNotificationProvider(mockUrl);
        const severities: NotificationPayload['severity'][] = ['info', 'success', 'warning', 'error'];

        for (const severity of severities) {
          await provider.send({
            title: severity || 'none',
            message: `testing ${severity}`,
            severity,
          });
        }

        assert.equal(capturedColors['info'], 0x3b82f6);
        assert.equal(capturedColors['success'], 0x22c55e);
        assert.equal(capturedColors['warning'], 0xeab308);
        assert.equal(capturedColors['error'], 0xef4444);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format low stock and sold-out notifications per DEP_DISCORD.md Section 2', async () => {
      const capturedPayloads: any[] = [];
      const mockUrl = 'https://discord.com/api/webhooks/mock/inventory';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, init: any) => {
        capturedPayloads.push(JSON.parse(init.body));
        return { ok: true, statusText: 'OK' } as Response;
      }) as any;

      try {
        const provider = new DiscordNotificationProvider(mockUrl);

        // Low stock warning (stock = 2)
        await provider.notifyLowStock('Obsidian Beast', 'Gold Edition', 2, 'BEAST-GOLD');
        // Sold out alert (stock = 0)
        await provider.notifyLowStock('Obsidian Beast', 'Gold Edition', 0, 'BEAST-GOLD');

        assert.equal(capturedPayloads.length, 2);

        // Low stock: yellow (0xF1C40F / 15844367)
        const lowStockEmbed = capturedPayloads[0].embeds[0];
        assert.ok(lowStockEmbed.title.includes('Low Stock Alert'));
        assert.equal(lowStockEmbed.color, DISCORD_COLORS.lowStock);
        assert.ok(lowStockEmbed.fields.some((f: any) => f.name === 'Remaining Stock' && f.value.includes('2 units left')));

        // Sold out: orange (0xE67E22 / 15105570)
        const soldOutEmbed = capturedPayloads[1].embeds[0];
        assert.ok(soldOutEmbed.title.includes('Sold Out Alert'));
        assert.equal(soldOutEmbed.color, DISCORD_COLORS.soldOut);
        assert.ok(soldOutEmbed.fields.some((f: any) => f.name === 'Remaining Stock' && f.value.includes('0 units left')));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle dev alerts per DEP_DISCORD.md Section 2', async () => {
      let capturedBody: any = null;
      const mockUrl = 'https://discord.com/api/webhooks/mock/dev';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return { ok: true, statusText: 'OK' } as Response;
      }) as any;

      try {
        const provider = new DiscordNotificationProvider(mockUrl);
        await provider.notifyDevAlert('Edge Health Check Failed', 'HTTP 500 received from /api/health', 'error', {
          Route: '/api/health',
          Latency: '1240ms',
        });

        assert.ok(capturedBody);
        assert.equal(capturedBody.username, 'ChrisShop Ops [Dev Alerts]');
        const embed = capturedBody.embeds[0];
        assert.equal(embed.color, DISCORD_COLORS.healthFailure);
        assert.ok(embed.title.includes('Edge Health Check Failed'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should retry on HTTP 429 rate limits using X-RateLimit-Reset-After', async () => {
      let attemptCount = 0;
      const mockUrl = 'https://discord.com/api/webhooks/mock/ratelimit';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, _init: any) => {
        attemptCount++;
        if (attemptCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({ 'X-RateLimit-Reset-After': '0.01' }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
        } as Response;
      }) as any;

      try {
        const provider = new DiscordNotificationProvider(mockUrl, {
          maxRetries: 2,
          initialRetryDelayMs: 10,
        });

        await provider.send({
          title: 'Rate Limit Test',
          message: 'Retrying under throttle',
          severity: 'info',
        });

        assert.equal(attemptCount, 2, 'Should retry after 429 rate limit');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Resend Email Notification Provider Tests
  // --------------------------------------------------------------------------
  describe('ResendNotificationProvider', () => {
    it('should gracefully fallback to dev mode when API key is unconfigured', async () => {
      const provider = new ResendNotificationProvider({ apiKey: '' });
      assert.equal(provider.isConfigured, false);

      const result = await provider.sendEmail({
        to: 'buyer@example.com',
        subject: 'Dev Mode Fallback',
        html: '<p>Testing dev fallback</p>',
      });

      assert.equal(result.success, true);
      assert.ok(result.id?.startsWith('mock-msg-'));
    });

    it('should format order receipt email matching DEP_RESEND.md Section 3.1 & 4.1', async () => {
      let capturedRequest: any = null;
      const mockEndpoint = 'https://api.resend.com/emails';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockEndpoint) {
          capturedRequest = {
            headers: init.headers,
            body: JSON.parse(init.body),
          };
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 're_123456789' }),
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_test_key_abc',
          fromEmail: 'orders@shop.jacobmiller22.com',
        });

        const receiptPayload: OrderReceiptPayload = {
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: '#1042',
          customer_name: 'Jane Doe',
          customer_email: 'jane@example.com',
          items: [
            {
              title: 'Midnight Sculpture',
              variation_name: 'Gold Edition',
              sku: 'MS-GOLD-01',
              quantity: 1,
              unit_price: 150.0,
            },
          ],
          amount_subtotal: 150.0,
          amount_shipping: 15.0,
          amount_tax: 12.38,
          amount_total: 177.38,
          shipping_address: {
            street: '123 Art Gallery Way',
            city: 'New York',
            state: 'NY',
            postal_code: '10001',
            country: 'US',
          },
          created_at: '2026-09-10T17:00:00.000Z',
        };

        const result = await provider.notifyOrderReceipt(receiptPayload);

        assert.equal(result.success, true);
        assert.equal(result.id, 're_123456789');

        assert.ok(capturedRequest);
        assert.equal(capturedRequest.headers.Authorization, 'Bearer re_test_key_abc');
        assert.equal(capturedRequest.body.to, 'jane@example.com');
        assert.equal(capturedRequest.body.from, 'orders@shop.jacobmiller22.com');
        assert.ok(capturedRequest.body.subject.includes('#1042'));

        // Verify HTML contents
        const html = capturedRequest.body.html;
        assert.ok(html.includes('Thank you for your order, Jane Doe!'));
        assert.ok(html.includes('Midnight Sculpture'));
        assert.ok(html.includes('MS-GOLD-01'));
        assert.ok(html.includes('$177.38'));
        assert.ok(html.includes('123 Art Gallery Way'));

        // Verify plain-text alternative per DEP_RESEND.md Section 4.2
        const text = capturedRequest.body.text;
        assert.ok(text.includes('Order: #1042'));
        assert.ok(text.includes('Midnight Sculpture'));
        assert.ok(text.includes('Total: $177.38'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format shipping tracking email matching DEP_RESEND.md Section 3.2 & 4.2', async () => {
      let capturedBody: any = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 're_ship_987654' }),
        } as Response;
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_test_key_abc',
        });

        const shippingPayload: ShippingUpdatePayload = {
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: '#1042',
          customer_name: 'Jane Doe',
          customer_email: 'jane@example.com',
          carrier: 'USPS',
          tracking_number: '9400100000000000000000',
          tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000',
        };

        const result = await provider.notifyShippingUpdate(shippingPayload);

        assert.equal(result.success, true);
        assert.equal(result.id, 're_ship_987654');
        assert.ok(capturedBody.subject.includes('#1042'));
        assert.ok(capturedBody.html.includes('USPS'));
        assert.ok(capturedBody.html.includes('9400100000000000000000'));
        assert.ok(capturedBody.html.includes('Track Your Package'));
        assert.ok(capturedBody.text.includes('Tracking Number: 9400100000000000000000'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should retry on HTTP 429 rate limits with backoff per DEP_RESEND.md Section 5', async () => {
      let calls = 0;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        calls++;
        if (calls < 2) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({ 'Retry-After': '0.01' }),
            text: async () => 'Rate limit exceeded',
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ id: 're_success_after_retry' }),
        } as Response;
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_key',
          maxRetries: 3,
          initialRetryDelayMs: 10,
        });

        const res = await provider.sendEmail({
          to: 'test@example.com',
          subject: 'Retry Test',
          html: '<p>Testing</p>',
        });

        assert.equal(res.success, true);
        assert.equal(res.id, 're_success_after_retry');
        assert.equal(calls, 2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format and dispatch merchant order alert email to merchantAlertEmail', async () => {
      let capturedBody: any = null;
      const mockEndpoint = 'https://api.resend.com/emails';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockEndpoint) {
          capturedBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 're_merchant_alert_101' }),
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_live_key',
          fromEmail: 'notifications@shop.jacobmiller22.com',
          merchantAlertEmail: 'chris@shop.jacobmiller22.com',
        });

        const testOrder: Order = {
          id: 'ord-87654321-merchant',
          customer_email: 'buyer@example.com',
          shipping_name: 'David Wallace',
          amount_total: 1250.0,
          currency: 'usd',
          shopify_order_id: 'gid://shopify/Order/99887766',
          order_status: 'paid',
          shipping_status: 'unfulfilled',
          shipping_address: {
            street: '1725 Slough Ave',
            city: 'Scranton',
            state: 'PA',
            postal_code: '18503',
            country: 'US',
          },
        };

        const result = await provider.notifyMerchantOrderAlert(testOrder);

        assert.equal(result.success, true);
        assert.equal(result.id, 're_merchant_alert_101');
        assert.ok(capturedBody);
        assert.equal(capturedBody.to, 'chris@shop.jacobmiller22.com');
        assert.equal(capturedBody.from, 'notifications@shop.jacobmiller22.com');
        assert.ok(capturedBody.subject.includes('[NEW ORDER] #ord-8765'));
        assert.ok(capturedBody.subject.includes('$1250.00'));
        assert.ok(capturedBody.subject.includes('David Wallace'));
        assert.ok(capturedBody.html.includes('1725 Slough Ave'));
        assert.ok(capturedBody.html.includes('gid://shopify/Order/99887766'));
        assert.ok(capturedBody.text.includes('David Wallace (buyer@example.com)'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format and dispatch low stock and sold-out notifications via email', async () => {
      const capturedPayloads: any[] = [];
      const mockEndpoint = 'https://api.resend.com/emails';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockEndpoint) {
          capturedPayloads.push(JSON.parse(init.body));
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 're_inv_' + capturedPayloads.length }),
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_live_key',
          merchantAlertEmail: 'ops@shop.jacobmiller22.com',
        });

        // 1. Low stock alert (stock = 3)
        const lowStockRes = await provider.notifyLowStock(
          'Bronze Helix',
          'Limited Edition',
          3,
          'BH-LTD-01'
        );
        assert.equal(lowStockRes.success, true);

        // 2. Sold out alert (stock = 0)
        const soldOutRes = await provider.notifyLowStock(
          'Bronze Helix',
          'Limited Edition',
          0,
          'BH-LTD-01'
        );
        assert.equal(soldOutRes.success, true);

        assert.equal(capturedPayloads.length, 2);

        // Low stock payload assertions
        const lowStock = capturedPayloads[0];
        assert.equal(lowStock.to, 'ops@shop.jacobmiller22.com');
        assert.ok(lowStock.subject.includes('⚠️ Low Stock Alert: Bronze Helix — Limited Edition (3 units left)'));
        assert.ok(lowStock.html.includes('3 UNITS REMAINING'));
        assert.ok(lowStock.html.includes('BH-LTD-01'));
        assert.ok(lowStock.text.includes('Remaining Units: 3'));

        // Sold out payload assertions
        const soldOut = capturedPayloads[1];
        assert.equal(soldOut.to, 'ops@shop.jacobmiller22.com');
        assert.ok(soldOut.subject.includes('🚫 Sold Out Alert: Bronze Helix — Limited Edition'));
        assert.ok(soldOut.html.includes('DEPLETED / SOLD OUT'));
        assert.ok(soldOut.text.includes('Status: Depleted / Sold Out'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should dispatch both customer receipt and merchant alert on notifyOrderCreated', async () => {
      const capturedPayloads: any[] = [];
      const mockEndpoint = 'https://api.resend.com/emails';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockEndpoint) {
          capturedPayloads.push(JSON.parse(init.body));
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 're_multi_' + capturedPayloads.length }),
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_live_key',
          merchantAlertEmail: 'merchant@shop.jacobmiller22.com',
        });

        const testOrder: Order = {
          id: 'ord-multi-order-test',
          customer_email: 'buyer@example.com',
          shipping_name: 'Customer One',
          amount_total: 250.0,
          currency: 'usd',
          order_status: 'paid',
          shipping_status: 'pending',
          shipping_address: {
            street: '550 Market St',
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94104',
            country: 'US',
          },
        };

        await provider.notifyOrderCreated(testOrder);

        assert.equal(capturedPayloads.length, 2, 'Should dispatch 2 emails: receipt and merchant alert');

        const recipients = capturedPayloads.map((p) => p.to);
        assert.ok(recipients.includes('buyer@example.com'), 'Customer receipt must be sent to customer');
        assert.ok(recipients.includes('merchant@shop.jacobmiller22.com'), 'Merchant alert must be sent to merchant');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should format general NotificationPayload into formatted email to merchant', async () => {
      let capturedPayload: any = null;
      const mockEndpoint = 'https://api.resend.com/emails';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockEndpoint) {
          capturedPayload = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 're_payload_1' }),
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new ResendNotificationProvider({
          apiKey: 're_live_key',
          merchantAlertEmail: 'alerts@shop.jacobmiller22.com',
        });

        await provider.send({
          title: 'System Health Check',
          message: 'All edge probes are green',
          severity: 'info',
          fields: {
            Region: 'IAD',
            Latency: '12ms',
          },
        });

        assert.ok(capturedPayload);
        assert.equal(capturedPayload.to, 'alerts@shop.jacobmiller22.com');
        assert.ok(capturedPayload.subject.includes('[INFO] System Health Check'));
        assert.ok(capturedPayload.html.includes('All edge probes are green'));
        assert.ok(capturedPayload.html.includes('Region:</strong> IAD'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should respect custom options and default fallback configurations', () => {
      const defaultProvider = new ResendNotificationProvider();
      assert.equal(defaultProvider.configuredFromEmail, 'orders@shop.jacobmiller22.com');
      assert.equal(defaultProvider.configuredMerchantAlertEmail, 'orders@shop.jacobmiller22.com');

      const customProvider = new ResendNotificationProvider({
        fromEmail: 'custom-from@example.com',
        merchantAlertEmail: 'custom-merchant@example.com',
      });
      assert.equal(customProvider.configuredFromEmail, 'custom-from@example.com');
      assert.equal(customProvider.configuredMerchantAlertEmail, 'custom-merchant@example.com');
    });
  });

  // --------------------------------------------------------------------------
  // Webhook Notification Provider Tests
  // --------------------------------------------------------------------------
  describe('WebhookNotificationProvider', () => {
    it('should skip alert gracefully when webhook URL is unconfigured', async () => {
      const provider = new WebhookNotificationProvider('');
      assert.equal(provider.isConfigured, false);

      await assert.doesNotReject(async () => {
        await provider.send({
          title: 'Unconfigured Test',
          message: 'Should skip gracefully',
          severity: 'info',
        });
      });

      const jsonRes = await provider.sendJson({ test: true });
      assert.equal(jsonRes.success, true);
      assert.equal(jsonRes.statusCode, 200);
    });

    it('should dispatch standard JSON payload with configurable headers on send', async () => {
      let capturedRequest: any = null;
      const mockUrl = 'https://webhook.site/test-endpoint';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockUrl) {
          capturedRequest = {
            headers: init.headers,
            body: JSON.parse(init.body),
          };
          return {
            ok: true,
            status: 200,
            text: async () => '{"received":true}',
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new WebhookNotificationProvider(mockUrl, {
          headers: {
            Authorization: 'Bearer ops_secret_token_123',
            'X-Custom-Header': 'ChrisShop-Ops',
          },
        });

        await provider.send({
          title: 'Database Failover',
          message: 'Replication sync complete',
          severity: 'warning',
          fields: {
            Cluster: 'us-east',
            Lag: '0ms',
          },
        });

        assert.ok(capturedRequest);
        assert.equal(capturedRequest.headers['Content-Type'], 'application/json');
        assert.equal(capturedRequest.headers['Authorization'], 'Bearer ops_secret_token_123');
        assert.equal(capturedRequest.headers['X-Custom-Header'], 'ChrisShop-Ops');

        const body = capturedRequest.body;
        assert.equal(body.event, 'notification');
        assert.equal(body.title, 'Database Failover');
        assert.equal(body.message, 'Replication sync complete');
        assert.equal(body.severity, 'warning');
        assert.equal(body.fields.Cluster, 'us-east');
        assert.equal(body.fields.Lag, '0ms');
        assert.ok(body.timestamp);
        // Slack-compatible top-level text field
        assert.equal(body.text, '[WARNING] Database Failover: Replication sync complete');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should dispatch structured JSON order payload on notifyOrderCreated', async () => {
      let capturedBody: any = null;
      const mockUrl = 'https://webhook.site/order-created-sink';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockUrl) {
          capturedBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 201,
            text: async () => '{"status":"created"}',
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new WebhookNotificationProvider(mockUrl);
        const testOrder: Order = {
          id: 'ord-webhook-order-test-1234',
          customer_email: 'collector@gallery.com',
          shipping_name: 'Arthur Pendelton',
          amount_total: 850.0,
          currency: 'usd',
          shopify_order_id: 'gid://shopify/Order/776655',
          order_status: 'paid',
          shipping_status: 'unfulfilled',
          shipping_address: {
            street: '10 Beacon St',
            city: 'Boston',
            state: 'MA',
            postal_code: '02108',
            country: 'US',
          },
        };

        await provider.notifyOrderCreated(testOrder);

        assert.ok(capturedBody);
        assert.equal(capturedBody.event, 'order.created');
        assert.ok(capturedBody.timestamp);
        assert.ok(capturedBody.text.includes('#ord-webh'));
        assert.ok(capturedBody.text.includes('$850.00'));

        const order = capturedBody.order;
        assert.equal(order.id, 'ord-webhook-order-test-1234');
        assert.equal(order.order_number, '#ord-webh');
        assert.equal(order.customer_name, 'Arthur Pendelton');
        assert.equal(order.customer_email, 'collector@gallery.com');
        assert.equal(order.amount_total, 850.0);
        assert.equal(order.currency, 'usd');
        assert.equal(order.order_status, 'paid');
        assert.equal(order.shipping_address.city, 'Boston');
        assert.equal(order.shopify_order_id, 'gid://shopify/Order/776655');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should dispatch structured JSON inventory payloads on notifyLowStock', async () => {
      const capturedPayloads: any[] = [];
      const mockUrl = 'https://webhook.site/inventory-sink';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockUrl) {
          capturedPayloads.push(JSON.parse(init.body));
          return {
            ok: true,
            status: 200,
            text: async () => 'OK',
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new WebhookNotificationProvider(mockUrl);

        // Low stock: remaining = 4
        const resLow = await provider.notifyLowStock('Prism Core', 'Crystal Cut', 4, 'PRISM-CC');
        assert.equal(resLow.success, true);
        assert.equal(resLow.statusCode, 200);

        // Sold out: remaining = 0
        const resSoldOut = await provider.notifyLowStock('Prism Core', 'Crystal Cut', 0, 'PRISM-CC');
        assert.equal(resSoldOut.success, true);
        assert.equal(resSoldOut.statusCode, 200);

        assert.equal(capturedPayloads.length, 2);

        // Assert low stock payload
        const lowStock = capturedPayloads[0];
        assert.equal(lowStock.event, 'inventory.low_stock');
        assert.equal(lowStock.inventory.product_title, 'Prism Core');
        assert.equal(lowStock.inventory.variation_name, 'Crystal Cut');
        assert.equal(lowStock.inventory.sku, 'PRISM-CC');
        assert.equal(lowStock.inventory.remaining_stock, 4);
        assert.equal(lowStock.inventory.is_sold_out, false);
        assert.ok(lowStock.text.includes('⚠️ Low Stock Alert'));

        // Assert sold out payload
        const soldOut = capturedPayloads[1];
        assert.equal(soldOut.event, 'inventory.sold_out');
        assert.equal(soldOut.inventory.remaining_stock, 0);
        assert.equal(soldOut.inventory.is_sold_out, true);
        assert.ok(soldOut.text.includes('🚫 Sold Out Alert'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should dispatch operational alert JSON payload on notifyOpsAlert', async () => {
      let capturedBody: any = null;
      const mockUrl = 'https://webhook.site/ops-sink';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init: any) => {
        if (url === mockUrl) {
          capturedBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            text: async () => 'OK',
          } as Response;
        }
        return originalFetch(url, init);
      }) as any;

      try {
        const provider = new WebhookNotificationProvider(mockUrl);
        const result = await provider.notifyOpsAlert(
          'D1 Latency Spike',
          'P99 exceeded 250ms threshold',
          'warning',
          { route: '/catalog', p99_ms: 310 }
        );

        assert.equal(result.success, true);
        assert.ok(capturedBody);
        assert.equal(capturedBody.event, 'ops.alert');
        assert.equal(capturedBody.severity, 'warning');
        assert.equal(capturedBody.title, 'D1 Latency Spike');
        assert.equal(capturedBody.details.route, '/catalog');
        assert.equal(capturedBody.details.p99_ms, 310);
        assert.ok(capturedBody.text.includes('[OPS ALERT - WARNING]'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should retry on HTTP 429 and HTTP 500 with exponential backoff', async () => {
      let attempts = 0;
      const mockUrl = 'https://webhook.site/retry-sink';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any) => {
        if (url === mockUrl) {
          attempts++;
          if (attempts === 1) {
            return {
              ok: false,
              status: 429,
              statusText: 'Too Many Requests',
              headers: new Headers({ 'Retry-After': '0.01' }),
              text: async () => 'Throttled',
            } as Response;
          }
          return {
            ok: true,
            status: 200,
            text: async () => '{"ok":true}',
          } as Response;
        }
        return originalFetch(url);
      }) as any;

      try {
        const provider = new WebhookNotificationProvider(mockUrl, {
          maxRetries: 2,
          initialRetryDelayMs: 5,
        });

        const result = await provider.sendJson({ test: 'retry' });
        assert.equal(result.success, true);
        assert.equal(result.statusCode, 200);
        assert.equal(attempts, 2, 'Should succeed on second attempt after 429 retry');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should return failure result when error cannot be recovered', async () => {
      const mockUrl = 'https://webhook.site/error-sink';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any) => {
        if (url === mockUrl) {
          return {
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => 'Invalid payload schema',
          } as Response;
        }
        return originalFetch(url);
      }) as any;

      try {
        const provider = new WebhookNotificationProvider(mockUrl);
        const result = await provider.sendJson({ test: 'bad-schema' });
        assert.equal(result.success, false);
        assert.equal(result.statusCode, 400);
        assert.ok(result.error?.includes('Webhook HTTP 400'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Console & Composite Providers
  // --------------------------------------------------------------------------
  it('should execute ConsoleNotificationProvider without throwing', async () => {
    const consoleProvider = new ConsoleNotificationProvider();
    await assert.doesNotReject(async () => {
      await consoleProvider.send({
        title: 'Console Notice',
        message: 'System info',
        fields: { Key: 'Val' },
      });
      await consoleProvider.notifyOrderCreated({
        id: 'ord-console',
        customer_email: 'c@example.com',
        shipping_name: 'Console User',
        amount_total: 100,
        currency: 'usd',
        shopify_order_id: 'gid://shopify/Order/9876543210',
        order_status: 'paid',
        shipping_status: 'pending',
        shipping_address: {
          street: '123 Test St',
          city: 'City',
          state: 'ST',
          postal_code: '12345',
          country: 'US',
        },
      });
    });
  });

  it('should fan out alerts to multiple providers in CompositeNotificationProvider', async () => {
    let providerACalled = false;
    let providerBCalled = false;

    const providerA = {
      send: async () => {
        providerACalled = true;
      },
    };
    const providerB = {
      send: async () => {
        providerBCalled = true;
      },
    };

    const composite = new CompositeNotificationProvider([providerA, providerB]);
    await composite.send({ title: 'Fanout', message: 'Test message' });

    assert.ok(providerACalled, 'Provider A must be called');
    assert.ok(providerBCalled, 'Provider B must be called');
  });

  it('should fan out notifyOrderCreated and notifyLowStock across multiple providers in CompositeNotificationProvider', async () => {
    let lowStockCount = 0;
    let orderCreatedCount = 0;

    const providerA = {
      send: async () => {},
      notifyOrderCreated: async () => {
        orderCreatedCount++;
      },
      notifyLowStock: async () => {
        lowStockCount++;
      },
    };

    const providerB = {
      send: async () => {},
      notifyOrderCreated: async () => {
        orderCreatedCount++;
      },
      notifyLowStock: async () => {
        lowStockCount++;
      },
    };

    const composite = new CompositeNotificationProvider([providerA, providerB]);
    const mockOrder: Order = {
      id: 'ord-composite-test',
      customer_email: 'test@example.com',
      shipping_name: 'Test Name',
      amount_total: 50.0,
      order_status: 'paid',
      shipping_status: 'pending',
      shipping_address: {
        street: '123 Main St',
        city: 'City',
        state: 'ST',
        postal_code: '12345',
        country: 'US',
      },
    };

    await composite.notifyOrderCreated(mockOrder);
    assert.equal(orderCreatedCount, 2, 'Both providers should receive notifyOrderCreated');

    await composite.notifyLowStock('Test Product', 'Variant A', 1, 'SKU-A');
    assert.equal(lowStockCount, 2, 'Both providers should receive notifyLowStock');
  });
});
