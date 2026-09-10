import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DiscordNotificationProvider,
  ConsoleNotificationProvider,
  CompositeNotificationProvider,
  type NotificationPayload,
} from '../src/index';
import type { Order } from '@chrishop/types';

describe('Notification Providers (@chrishop/notifications)', () => {
  it('should skip alert gracefully when Discord webhook URL is empty', async () => {
    const provider = new DiscordNotificationProvider('');
    // Should not throw
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

    // Mock global fetch
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
        stripe_payment_intent_id: 'pi_test123',
        order_status: 'paid',
        shipping_status: 'pending',
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
        stripe_payment_intent_id: 'pi_test',
        order_status: 'paid',
        shipping_status: 'pending',
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
