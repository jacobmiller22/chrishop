import type { Order, ShippingAddress } from '@chrishop/types';

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

export const DISCORD_COLORS = {
  // Severity colors
  info: 0x3b82f6,
  success: 0x22c55e,
  warning: 0xeab308,
  error: 0xef4444,
  // Channel event colors per docs/deps/DEP_DISCORD.md
  orderPaid: 0x2ecc71,
  lowStock: 0xf1c40f,
  soldOut: 0xe67e22,
  healthFailure: 0xe74c3c,
  exception: 0x9b59b6,
  deployment: 0x3498db,
};

export interface DiscordProviderOptions {
  username?: string;
  avatarUrl?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

/**
 * Discord Webhook Notification Provider
 */
export class DiscordNotificationProvider implements NotificationProvider {
  constructor(
    private webhookUrl: string,
    private options: DiscordProviderOptions = {}
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('[DiscordNotificationProvider] Webhook URL not provided. Skipping alert.');
      return;
    }

    const colorMap = {
      info: DISCORD_COLORS.info,
      success: DISCORD_COLORS.success,
      warning: DISCORD_COLORS.warning,
      error: DISCORD_COLORS.error,
    };

    const embed: Record<string, any> = {
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
      footer: {
        text: 'ChrisShop Order Management',
      },
    };

    const username = this.options.username || 'ChrisShop Ops';
    const body: Record<string, any> = {
      username,
      embeds: [embed],
    };
    if (this.options.avatarUrl) {
      body.avatar_url = this.options.avatarUrl;
    }

    let attempt = 0;
    const maxRetries = this.options.maxRetries ?? 2;
    const initialDelay = this.options.initialRetryDelayMs ?? 100;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          return;
        }

        if (response.status === 429) {
          attempt++;
          if (attempt > maxRetries) {
            console.error('[DiscordNotificationProvider] Rate limit exceeded (429)');
            return;
          }
          const retryAfter =
            response.headers.get('X-RateLimit-Reset-After') ||
            response.headers.get('Retry-After');
          const delayMs = retryAfter
            ? parseFloat(retryAfter) * 1000
            : initialDelay * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        console.error(
          `[DiscordNotificationProvider] Failed to dispatch alert: ${response.statusText}`
        );
        return;
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          console.error('[DiscordNotificationProvider] Error sending notification:', err);
          return;
        }
        await new Promise((r) => setTimeout(r, initialDelay * Math.pow(2, attempt - 1)));
      }
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

  async notifyLowStock(
    productTitle: string,
    variationName: string,
    remainingStock: number,
    sku?: string
  ): Promise<void> {
    const isSoldOut = remainingStock <= 0;
    const color = isSoldOut ? DISCORD_COLORS.soldOut : DISCORD_COLORS.lowStock;
    const title = isSoldOut
      ? `🚫 Sold Out Alert: ${productTitle}`
      : `⚠️ Low Stock Alert: ${productTitle}`;
    const description = isSoldOut
      ? 'Inventory depleted for limited-edition release.'
      : 'Inventory threshold reached for limited-edition release.';

    const fields: Record<string, string> = {
      Variation: variationName + (sku ? ` (\`${sku}\`)` : ''),
      'Remaining Stock': isSoldOut ? '**0 units left**' : `**${remainingStock} units left**`,
    };

    if (!this.webhookUrl) return;

    const embed = {
      title,
      description,
      color,
      timestamp: new Date().toISOString(),
      fields: Object.entries(fields).map(([name, value]) => ({
        name,
        value,
        inline: true,
      })),
      footer: { text: 'ChrisShop Inventory Management' },
    };

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.options.username || 'ChrisShop Ops',
          embeds: [embed],
        }),
      });
    } catch (err) {
      console.error('[DiscordNotificationProvider] Error sending low stock alert:', err);
    }
  }

  async notifyDevAlert(
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' = 'error',
    details?: Record<string, string>
  ): Promise<void> {
    const colorMap = {
      info: DISCORD_COLORS.deployment,
      warning: DISCORD_COLORS.warning,
      error: DISCORD_COLORS.healthFailure,
    };

    if (!this.webhookUrl) return;

    const embed = {
      title,
      description: message,
      color: colorMap[severity] || DISCORD_COLORS.healthFailure,
      timestamp: new Date().toISOString(),
      fields: details
        ? Object.entries(details).map(([name, value]) => ({
            name,
            value,
            inline: true,
          }))
        : [],
      footer: { text: 'ChrisShop Dev Alerts' },
    };

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ChrisShop Ops [Dev Alerts]',
          embeds: [embed],
        }),
      });
    } catch (err) {
      console.error('[DiscordNotificationProvider] Error sending dev alert:', err);
    }
  }
}

/**
 * Resend Transactional Email Types and Provider
 * Specification: docs/deps/DEP_RESEND.md
 */
export interface EmailMessagePayload {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

export interface OrderItemReceipt {
  title: string;
  variation_name?: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface OrderReceiptPayload {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  items: OrderItemReceipt[];
  amount_subtotal: number;
  amount_shipping: number;
  amount_tax: number;
  amount_total: number;
  shipping_address: ShippingAddress;
  created_at?: string;
}

export interface ShippingUpdatePayload {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  items?: Array<{
    title: string;
    variation_name?: string;
    quantity: number;
  }>;
}

export interface ResendProviderOptions {
  apiKey?: string;
  fromEmail?: string;
  apiEndpoint?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

export interface EmailDispatchResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Resend Email Notification Provider
 */
export class ResendNotificationProvider implements NotificationProvider {
  private apiKey: string;
  private fromEmail: string;
  private apiEndpoint: string;
  private maxRetries: number;
  private initialRetryDelayMs: number;

  constructor(options: ResendProviderOptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY || '' : '');
    this.fromEmail = options.fromEmail || 'orders@shop.jacobmiller22.com';
    this.apiEndpoint = options.apiEndpoint || 'https://api.resend.com/emails';
    this.maxRetries = options.maxRetries ?? 3;
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? 100;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async sendEmail(payload: EmailMessagePayload): Promise<EmailDispatchResult> {
    if (!this.isConfigured) {
      console.log(
        `[ResendNotificationProvider:DevFallback] To: ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to} | Subject: ${payload.subject}`
      );
      return { success: true, id: 'mock-msg-' + Date.now() };
    }

    const from = payload.from || this.fromEmail;
    const body = {
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text:
        payload.text ||
        payload.html
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      ...(payload.headers ? { headers: payload.headers } : {}),
    };

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = (await response.json().catch(() => ({}))) as { id?: string };
          return { success: true, id: data.id || 'resend-id' };
        }

        if (response.status === 429 || response.status >= 500) {
          attempt++;
          if (attempt > this.maxRetries) {
            const errText = await response.text().catch(() => response.statusText);
            return { success: false, error: `Resend API Error HTTP ${response.status}: ${errText}` };
          }
          const retryAfter = response.headers.get('Retry-After');
          const delayMs = retryAfter
            ? parseFloat(retryAfter) * 1000
            : this.initialRetryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        const errText = await response.text().catch(() => response.statusText);
        return { success: false, error: `Resend API Error HTTP ${response.status}: ${errText}` };
      } catch (err: any) {
        attempt++;
        if (attempt > this.maxRetries) {
          return { success: false, error: err?.message || String(err) };
        }
        await new Promise((r) => setTimeout(r, this.initialRetryDelayMs * Math.pow(2, attempt - 1)));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  async send(payload: NotificationPayload): Promise<void> {
    const html = `<h2>${payload.title}</h2><p>${payload.message}</p>${
      payload.fields
        ? '<ul>' +
          Object.entries(payload.fields)
            .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
            .join('') +
          '</ul>'
        : ''
    }`;

    await this.sendEmail({
      to: 'alerts@shop.jacobmiller22.com',
      subject: `[${payload.severity?.toUpperCase() || 'INFO'}] ${payload.title}`,
      html,
      text: `${payload.title}\n\n${payload.message}`,
    });
  }

  async notifyOrderReceipt(receipt: OrderReceiptPayload): Promise<EmailDispatchResult> {
    const itemsHtml = receipt.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            <strong>${item.title}</strong>${item.variation_name ? ` (${item.variation_name})` : ''}
            <div style="font-size: 12px; color: #666;">SKU: ${item.sku}</div>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unit_price.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.quantity * item.unit_price).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h1 style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px;">ChrisShop</h1>
        <h2>Thank you for your order, ${receipt.customer_name}!</h2>
        <p>Order Reference: <strong>${receipt.order_number}</strong></p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background-color: #f9f9f9; text-align: left;">
              <th style="padding: 8px;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="margin-top: 20px; text-align: right;">
          <p style="margin: 4px 0;">Subtotal: $${receipt.amount_subtotal.toFixed(2)}</p>
          <p style="margin: 4px 0;">Shipping: $${receipt.amount_shipping.toFixed(2)}</p>
          <p style="margin: 4px 0;">Tax: $${receipt.amount_tax.toFixed(2)}</p>
          <h3 style="margin: 8px 0; font-size: 18px;">Total: $${receipt.amount_total.toFixed(2)}</h3>
        </div>
        <div style="margin-top: 24px; padding: 16px; background-color: #f5f5f5; border-radius: 6px;">
          <h4 style="margin: 0 0 8px 0;">Shipping Address:</h4>
          <p style="margin: 2px 0;">${receipt.shipping_address.street}</p>
          <p style="margin: 2px 0;">${receipt.shipping_address.city}, ${receipt.shipping_address.state} ${receipt.shipping_address.postal_code}</p>
          <p style="margin: 2px 0;">${receipt.shipping_address.country}</p>
        </div>
      </div>
    `;

    const text = `ChrisShop Order Confirmation
Order: ${receipt.order_number}
Customer: ${receipt.customer_name}

Items:
${receipt.items.map((i) => `- ${i.title} (${i.variation_name || 'Standard'}) x${i.quantity} @ $${i.unit_price.toFixed(2)} (SKU: ${i.sku})`).join('\n')}

Subtotal: $${receipt.amount_subtotal.toFixed(2)}
Shipping: $${receipt.amount_shipping.toFixed(2)}
Tax: $${receipt.amount_tax.toFixed(2)}
Total: $${receipt.amount_total.toFixed(2)}

Shipping to:
${receipt.shipping_address.street}
${receipt.shipping_address.city}, ${receipt.shipping_address.state} ${receipt.shipping_address.postal_code}, ${receipt.shipping_address.country}
`;

    return this.sendEmail({
      to: receipt.customer_email,
      subject: `Order Confirmation: ${receipt.order_number}`,
      html,
      text,
    });
  }

  async notifyShippingUpdate(shipping: ShippingUpdatePayload): Promise<EmailDispatchResult> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h1 style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px;">ChrisShop</h1>
        <h2>Your order ${shipping.order_number} is on the way! 📦</h2>
        <p>Carrier: <strong>${shipping.carrier}</strong></p>
        <p>Tracking Number: <strong>${shipping.tracking_number}</strong></p>
        <div style="margin: 24px 0;">
          <a href="${shipping.tracking_url}" style="background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Track Your Package
          </a>
        </div>
      </div>
    `;

    const text = `ChrisShop Shipping Update
Your order ${shipping.order_number} has shipped!
Carrier: ${shipping.carrier}
Tracking Number: ${shipping.tracking_number}
Track Package: ${shipping.tracking_url}
`;

    return this.sendEmail({
      to: shipping.customer_email,
      subject: `Your order ${shipping.order_number} has shipped! 📦`,
      html,
      text,
    });
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    const receipt: OrderReceiptPayload = {
      order_id: order.id,
      order_number: `#${order.id.slice(0, 8)}`,
      customer_name: order.customer_name || order.shipping_name,
      customer_email: order.customer_email,
      items: [
        {
          title: 'Artwork Order',
          sku: 'ART-01',
          quantity: 1,
          unit_price: order.amount_total,
        },
      ],
      amount_subtotal: order.amount_subtotal ?? order.amount_total,
      amount_shipping: order.amount_shipping ?? 0,
      amount_tax: order.amount_tax ?? 0,
      amount_total: order.amount_total,
      shipping_address: order.shipping_address,
      created_at: order.created_at,
    };
    await this.notifyOrderReceipt(receipt);
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
