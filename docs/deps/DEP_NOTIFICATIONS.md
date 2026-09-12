# Dependency Specification: Channel-Agnostic Event Notification Engine (`DEP_NOTIFICATIONS.md`)

This document specifies the technical architecture, provider interfaces, payload schemas, retry semantics, and operational procedures for the **Event Notification Engine** (`packages/notifications`) in ChrisShop.

---

## 1. Service Overview & Architecture

Originally, Discord webhooks were utilized as a rapid prototyping notification channel. In Story 3.13 (#186), the notification engine was decoupled into a **channel-agnostic, email-first architecture**:
- **Primary Channel**: Transactional email via **Resend** for customer receipts, shipment tracking, merchant order notifications, and inventory threshold alerts.
- **Operational Channel**: Generic **Webhooks** accepting standard JSON payloads with configurable headers for Slack incoming webhooks, Zapier, PagerDuty, or custom HTTP sinks.
- **Legacy Channel**: Deprecated **Discord Webhook** provider retained strictly for backward compatibility.

### Module Path:
`packages/notifications`

### Primary Use Cases:
1. **Customer Order Receipts**: Branded, itemized HTML and plain-text order confirmations dispatched immediately upon payment capture.
2. **Shipment Tracking Updates**: Real-time carrier status and tracking links dispatched upon fulfillment.
3. **Merchant Order Alerts**: Instant notification to the merchant (`MERCHANT_ALERT_EMAIL`) detailing order items, totals, and shipping destinations.
4. **Inventory Threshold Warnings**: Immediate warnings when limited-edition stock drops below thresholds (`stock <= 3`) or sells out completely (`stock <= 0`).
5. **Operational Telemetry & Error Alerts**: Structured JSON events sent to `OPS_ALERT_WEBHOOK_URL` for health probe failures, edge anomalies, and deployment completions.

---

## 2. Channel Architecture & Routing Matrix

| Event | Primary Channel | Destination / Endpoint | Schema / Format | Provider Class |
| :--- | :--- | :--- | :--- | :--- |
| **Order Placed** (Customer Receipt) | Transactional Email | Customer email (`order.customer_email`) | Branded HTML + Plain-text Receipt | `ResendNotificationProvider.notifyOrderReceipt()` |
| **Order Placed** (Merchant Alert) | Transactional Email | `MERCHANT_ALERT_EMAIL` | Merchant Summary HTML + Plain-text | `ResendNotificationProvider.notifyMerchantOrderAlert()` |
| **Order Placed** (Ops Event) | Generic Webhook | `OPS_ALERT_WEBHOOK_URL` | Structured JSON (`order.created`) | `WebhookNotificationProvider.notifyOrderCreated()` |
| **Low Stock Warning** (`<= 3`) | Transactional Email | `MERCHANT_ALERT_EMAIL` | Threshold Warning HTML + Plain-text | `ResendNotificationProvider.notifyLowStock()` |
| **Low Stock Warning** (`<= 3`) | Generic Webhook | `OPS_ALERT_WEBHOOK_URL` | Structured JSON (`inventory.low_stock`) | `WebhookNotificationProvider.notifyLowStock()` |
| **Drop Sold Out** (`== 0`) | Transactional Email | `MERCHANT_ALERT_EMAIL` | Depleted Banner HTML + Plain-text | `ResendNotificationProvider.notifyLowStock()` |
| **Drop Sold Out** (`== 0`) | Generic Webhook | `OPS_ALERT_WEBHOOK_URL` | Structured JSON (`inventory.sold_out`) | `WebhookNotificationProvider.notifyLowStock()` |
| **Shipping Update** | Transactional Email | Customer email (`shipping.customer_email`)| Carrier Tracking Button + Plain-text | `ResendNotificationProvider.notifyShippingUpdate()` |
| **Ops / Error Alert** | Generic Webhook | `OPS_ALERT_WEBHOOK_URL` | Structured JSON (`ops.alert`) | `WebhookNotificationProvider.notifyOpsAlert()` |

---

## 3. Configuration & Environment Variables

All notification configuration variables are centralized and validated by `@chrishop/config` (`packages/config/src/env.ts`):

| Environment Variable | Required / Mode | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | Optional in dev, Required in live edge | Resend API Bearer Token | `re_123456789...` |
| `RESEND_FROM_EMAIL` | Optional | Authoritative sender address (DKIM/SPF verified) | `orders@shop.jacobmiller22.com` |
| `MERCHANT_ALERT_EMAIL` | Optional | Email destination for merchant purchase & low-stock alerts | `orders@shop.jacobmiller22.com` |
| `OPS_ALERT_WEBHOOK_URL` | Optional | HTTPS endpoint for operational JSON webhook dispatch | `https://hooks.slack.com/services/...` |
| `EMAIL_FROM` | Optional (Deprecated) | Legacy alias for `RESEND_FROM_EMAIL` | `orders@shop.jacobmiller22.com` |
| `DISCORD_WEBHOOK_URL` | Optional (Deprecated) | Legacy Discord webhook URL | `https://discord.com/api/webhooks/...` |
| `DISCORD_WEBHOOK_ORDERS`| Optional (Deprecated) | Legacy Discord orders channel webhook | `https://discord.com/api/webhooks/...` |
| `DISCORD_WEBHOOK_ALERTS`| Optional (Deprecated) | Legacy Discord dev alerts channel webhook | `https://discord.com/api/webhooks/...` |

---

## 4. Provider Specifications

### 4.1 `NotificationProvider` (Core Abstract Interface)

```typescript
export interface NotificationPayload {
  title: string;
  message: string;
  fields?: Record<string, string>;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<void>;
  notifyOrderCreated?(order: Order): Promise<void>;
  notifyLowStock?(
    productTitle: string,
    variationName: string,
    remainingStock: number,
    sku?: string
  ): Promise<any>;
}
```

### 4.2 `ResendNotificationProvider`

The primary email provider utilizing the Resend REST API (`POST https://api.resend.com/emails`).

#### Features:
- **Dev Mode Fallback**: If `apiKey` is empty or unconfigured, logs messages cleanly to stdout (`[ResendNotificationProvider:DevFallback]`) without crashing.
- **Rate Limit Resilience**: Inspects `Retry-After` headers and retries HTTP 429 and 5xx errors with exponential backoff (default 3 retries, 100ms base delay).
- **Dual Order Dispatch**: Calling `notifyOrderCreated(order)` dispatches both the customer confirmation receipt and the merchant order alert.

### 4.3 `WebhookNotificationProvider`

The primary operational provider for arbitrary HTTP endpoints.

#### Features:
- **Standard JSON Payload Format**:
  ```json
  {
    "text": "[WARNING] Database Failover: Replication sync complete",
    "event": "notification",
    "timestamp": "2026-09-12T08:00:00.000Z",
    "title": "Database Failover",
    "message": "Replication sync complete",
    "severity": "warning",
    "fields": {
      "Cluster": "us-east",
      "Lag": "0ms"
    }
  }
  ```
- **Slack Native Compatibility**: Top-level `text` field enables direct compatibility with Slack Incoming Webhooks without requiring an adapter.
- **Configurable Headers**: Supports custom headers (e.g. `Authorization: Bearer <token>`, `X-Webhook-Secret: <secret>`).
- **Rate Limit & Server Error Retry**: Retries HTTP 429 and 5xx responses using `Retry-After` header or exponential backoff.

### 4.4 `CompositeNotificationProvider`

Enables multi-channel fan-out:
```typescript
const composite = new CompositeNotificationProvider([
  new ResendNotificationProvider({ apiKey: env.RESEND_API_KEY }),
  new WebhookNotificationProvider(env.OPS_ALERT_WEBHOOK_URL),
]);

// Dispatches to both email and webhook sinks simultaneously
await composite.notifyOrderCreated(order);
await composite.notifyLowStock('Obsidian Beast', 'Gold', 2, 'BEAST-GOLD');
```

---

## 5. Future Channel Extension Points

To add new alert channels, implement `NotificationProvider` and add the provider instance to `CompositeNotificationProvider`:

### SMS Notifications (e.g., Twilio):
```typescript
export class TwilioSmsNotificationProvider implements NotificationProvider {
  constructor(private accountSid: string, private authToken: string, private toPhone: string) {}

  async send(payload: NotificationPayload): Promise<void> {
    const text = `[ChrisShop] ${payload.title}: ${payload.message}`;
    // POST to Twilio Messages REST API
  }

  async notifyLowStock(productTitle: string, variationName: string, stock: number): Promise<void> {
    const text = stock <= 0 
      ? `[ChrisShop ALERT] ${productTitle} (${variationName}) SOLD OUT`
      : `[ChrisShop] Low stock: ${productTitle} (${variationName}) - ${stock} remaining`;
    // POST to Twilio Messages REST API
  }
}
```

### Native Slack App Bot:
```typescript
export class SlackBotNotificationProvider implements NotificationProvider {
  constructor(private botToken: string, private channelId: string) {}
  // POST to https://slack.com/api/chat.postMessage with Block Kit UI
}
```

---

## 6. Migration Guide from Legacy Discord

If migrating an environment from `DISCORD_WEBHOOK_URL`:
1. Set `MERCHANT_ALERT_EMAIL="your-email@domain.com"` in `.dev.vars` or Cloudflare Workers secrets.
2. Set `RESEND_API_KEY="re_..."` for transactional delivery.
3. If operational webhooks are desired, set `OPS_ALERT_WEBHOOK_URL` to your Slack webhook or monitoring sink.
4. Discord webhook variables (`DISCORD_WEBHOOK_URL`, `DISCORD_WEBHOOK_ORDERS`, `DISCORD_WEBHOOK_ALERTS`) remain functional for backward compatibility but are deprecated.

---

## 7. Operational Testing & Verification

```bash
# Run unit tests across all notification providers
pnpm --filter @chrishop/notifications test

# Run dependency control integration test suite
pnpm exec tsx --test tests/integration/dependency-control.test.ts

# Full local verification
pnpm run verify:local
```
