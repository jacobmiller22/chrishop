import type { Order } from '@chrishop/types';

export interface NotificationPayload {
  title: string;
  message: string;
  fields?: Record<string, string>;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<void>;
  notifyOrderCreated?(order: Order): Promise<void>;
}

/**
 * Discord Webhook Notification Provider
 */
export class DiscordNotificationProvider implements NotificationProvider {
  constructor(private webhookUrl: string) {}

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('[DiscordNotificationProvider] Webhook URL not provided. Skipping alert.');
      return;
    }

    const colorMap = {
      info: 0x3b82f6,
      success: 0x22c55e,
      warning: 0xeab308,
      error: 0xef4444,
    };

    const embed = {
      title: payload.title,
      description: payload.message,
      color: colorMap[payload.severity || 'info'],
      timestamp: new Date().toISOString(),
      fields: payload.fields
        ? Object.entries(payload.fields).map(([name, value]) => ({
            name,
            value,
            inline: true,
          }))
        : [],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (!response.ok) {
        console.error(
          `[DiscordNotificationProvider] Failed to dispatch alert: ${response.statusText}`
        );
      }
    } catch (err) {
      console.error('[DiscordNotificationProvider] Error sending notification:', err);
    }
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    await this.send({
      title: `🛒 New Order Placed: #${order.id.slice(0, 8)}`,
      message: `Customer **${order.shipping_name}** (${order.customer_email}) placed an order.`,
      severity: 'success',
      fields: {
        Total: `$${order.amount_total.toFixed(2)}`,
        Status: order.order_status,
        Shipping: order.shipping_status,
      },
    });
  }
}

/**
 * Console Notification Provider for development fallback
 */
export class ConsoleNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<void> {
    console.log(
      `[Notification:${payload.severity || 'info'}] ${payload.title} - ${payload.message}`
    );
    if (payload.fields) {
      console.log('  Fields:', payload.fields);
    }
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    console.log(`[Notification:OrderCreated] Order #${order.id} for $${order.amount_total}`);
  }
}

/**
 * Composite Notification Provider for sending to multiple providers
 */
export class CompositeNotificationProvider implements NotificationProvider {
  constructor(private providers: NotificationProvider[]) {}

  async send(payload: NotificationPayload): Promise<void> {
    await Promise.all(this.providers.map((p) => p.send(payload)));
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    await Promise.all(
      this.providers.map((p) =>
        p.notifyOrderCreated
          ? p.notifyOrderCreated(order)
          : p.send({
              title: `New Order #${order.id}`,
              message: `Order total: $${order.amount_total}`,
              severity: 'success',
            })
      )
    );
  }
}
