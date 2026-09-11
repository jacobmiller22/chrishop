import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DiscordNotificationProvider,
  ConsoleNotificationProvider,
  CompositeNotificationProvider,
  ResendNotificationProvider,
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
});
